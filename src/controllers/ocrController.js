const Tesseract = require("tesseract.js");
const axios = require('axios'); 
const { getStorage, ref, uploadBytes, getDownloadURL } = require("firebase/storage"); 

// Heuristic approach cloud data 
const heuristicRef = doc(db, "heuristic_data", "vendors_categories"); 

const chrono = require('chrono-node'); 

const scheduler = Tesseract.createScheduler();

const workerGen = async () => {
    const worker = await Tesseract.createWorker("eng");
    scheduler.addWorker(worker);
};

const workerCount = 3;
(async () => {
    await Promise.all(Array(workerCount).fill(0).map(() => workerGen()));
})();

exports.processMultipleOCR = async (req, res) => {
    try {
        const userId = req.user.uid;
        const files = req.files; // Array of uploaded images/PDFs

        if (!files || files.length === 0) {
            return res.status(400).json({ error: "No files uploaded" });
        }

        const billPromises = files.map(async (file) => {
            // Upload physical documents to cloud
            const storage = getStorage();
            const storageRef = ref(storage, `bills/${userId}/${Date.now()}-${file.originalname}`);
            await uploadBytes(storageRef, file.buffer);
            const fileUrl = await getDownloadURL(storageRef);

            // Run OCR using the scheduler, to extract the text. 
            const { data: { text } } = await scheduler.addJob("recognize", file.buffer);

            // Call extractBillDetails to format the OCR'd text into JSON format compatible with firestore  

            let billData = extractBillDetails(text); // add generated fileUrl into this JSON
            billData = { fileUrl: fileUrl, ...billData }

            console.log(billData) // check format is good 

            // Send data to uploadBill API using Axios
            const { data: responseData } = await axios.post(
                `${req.protocol}://${req.get("host")}/api/bill/uploadBill`,
                billData,
                {
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": req.headers("Authorization"), // Forward auth header (return VALID required since the route is protected) 
                    },
                    timeout: 5000, // 5s timeout
                }
            );

            return responseData;
        });

        const savedBills = await Promise.all(billPromises);
        res.status(201).json({ message: "Bills processed successfully", savedBills });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}; 

exports.extractBillDetails = (input) => {
    try {
        const preprocessed = preprocessText(input); 
        const keyInfo = detectKeyInformation(preprocessed); 

        return keyInfo; 
    } catch (error) {
        console.error('Failed at extracting bill details')
    } 
} 

// Helper functions for 'extractBillDetails' 

const preprocessText = (text) => {
    try {
        return text
            .replace('/\r\n\g', ' ')
            .replace('/[^a-zA-Z0-9@.:$\/-]/g', ' ')
            .replace('/\s+/g', ' ')
            .toLowerCase(); 
    } catch (error) {
        console.error('Failed preprocessing input text'); 
    } 
} 

const detectKeyInformation = (text) => {
    let amount, category, payDate, vendor; 
    try {
        amount = extractAmount(text); 
        vendor = extractVendor(text); 
        category = categoriseBill(vendor); 
        payDate = extractPayDate(text);

        return { amount, vendor, category, payDate}; 
    } catch (error) {
        console.error('Failed to detect key information')
    }
}

const extractAmount = (text) => {
    const words = text.split(" "); 
    for (const word in words) {
        if (/^\£?\d{1,5}(\.\d{2})?£/.test(word)) {
            return parseFloat(word.replace("£", "")) // can add or change the dollar sign to support more currencies 
        } 
    } 
} 

const extractVendor = (text) => {
    // Link to dynamically changing vendors list for optimum solution 
    const vendors = ["Netflix", "Amazon", "British Gas", "Virgin Media", "Spotify", "Apple", "Verizon", "AT&T"]; 

    for (const vendor of vendors) {
        if (text.includes(vendor.toLowerCase())) {
            return vendor;
        }
    }
    return "Unknown Vendor";
} 

const categoriseBill = (vendor) => {
    try {
        // update to dynamically changing categories list for optimum solution 
        const categories = { 
            "utilities": ["British Gas", "Verizon", "AT&T"],
            "subscriptions": ["Netflix", "Spotify", "Amazon"],
            "insurance": ["Axa", "Geico", "Allstate"],
        };

        for (let key in categories) {
            if (categories[key].includes(vendor)) {
                return key; 
            } 
            return "Unknown Category"
        } 
    } catch (error) {
        console.error('Unable to categorise bill'); 
    } 
} 

const extractPayDate = (text) => {
    const parsedDate = chrono.parse(text); 
    if (parsedDate) {
        return parsedDate
    } else {
        return "No Date" // need to figure out optimum handling of this 
    } 
} 