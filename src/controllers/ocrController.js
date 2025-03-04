const Tesseract = require("tesseract.js");
const axios = require('axios'); 
const { getStorage, ref, uploadBytes, getDownloadURL } = require("firebase/storage"); 
const { doc } = require('firebase/firestore'); 
const { db } = require('../config/firebase_config'); 

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
            
            /* const storage = getStorage();
            const storageRef = ref(storage, `bills/${userId}/${Date.now()}-${file.originalname}`);
            await uploadBytes(storageRef, file.buffer);  
            const fileUrl = await getDownloadURL(storageRef); */

            const fileUrl = "test for now"

            // Run OCR using the scheduler, to extract the text. 
            const { data: { text } } = await scheduler.addJob("recognize", file.buffer);

            // Call extractBillDetails to format the OCR'd text into JSON format compatible with firestore  

            let billData = await this.extractBillDetails(text); // add generated fileUrl into this JSON
            billData = { fileUrl: fileUrl, ...billData }

            // Send data to uploadBill API using Axios
            const { data: responseData } = await axios.post(
                `${req.protocol}://${req.get("host")}/api/bill/upload`,
                billData,
                {
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": req.headers.authorization, 
                        "Content-Length": JSON.stringify(billData).length, 
                        "Host": req.get("host"), 
                        "Connection": "keep-alive", 
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

const detectKeyInformation = async (text) => {
    let amount, category, payDate, vendor; 
    try {
        amount = extractAmount(text); 
        vendor = extractVendor(text); 
        category = categoriseBill(vendor.value); 
        payDate = extractPayDate(text);

        let confidenceScores = [
            amount.confidence,
            vendor.confidence,
            payDate.confidence
        ]

        const overallConfidence = ((confidenceScores[0] + confidenceScores[1] + confidenceScores[2]) / 3); 

        if (overallConfidence < 70) {
            console.log("Confidence too low, using AI fallback...");
            // const aiExtractedData = await parseBillWithAI(text);
            // updateHeuristicRules(amount.value, vendor.value, category, payDate.value, aiExtractedData);
            // return aiExtractedData;
        }
    
        return { 
            amount: amount.value, 
            vendor: vendor.value, 
            category, 
            payDate: payDate.value 
        };
    } catch (error) {
        console.error('Failed to detect key information')
    }
}

const extractAmount = (text) => {
    let amountConfidence = 100;
    let amountCount = 0;
    let lastAmount = null;

    const words = text.split(" ");
    for (const word of words) {
        if (/^[£$€]?\d{1,5}(\.\d{2})?$/.test(word)) {
            amountCount += 1;
            lastAmount = parseFloat(word.replace(/[^0-9.]/g, "")); 
        }
    }

    amountConfidence = Math.max(100 - (amountCount - 1) * 20, 0);

    return { confidence: amountConfidence, value: lastAmount };
};


const extractVendor = (text) => {
    // Link to dynamically changing vendors list for optimum solution 
    const vendors = ["Netflix", "Amazon", "British Gas", "Virgin Media", "Spotify", "Apple", "Verizon", "AT&T"]; 
    let vendorMatches = [];  

    for (const vendor of vendors) {
        if (text.includes(vendor.toLowerCase())) {
            vendorMatches.push(vendor);
        }
    }

    let vendorConfidence = 100; 
    if (vendorMatches.length > 1) {
        vendorConfidence = Math.max(100 - (vendorMatches.length-1) * 30, 0);
    } 

    return { confidence: vendorConfidence, value: vendorMatches.length>0 ? vendorMatches[0] : "Unknown Vendor"}; 
} 

const categoriseBill = (vendor) => {
    try {
        const categories = { 
            "Utilities": ["British Gas", "Verizon", "AT&T"],
            "Subscriptions": ["Netflix", "Spotify", "Amazon"],
            "Insurance": ["Axa", "Geico", "Allstate"],
        };

        for (let key in categories) {
            if (categories[key].map(v => v.toLowerCase()).includes(vendor.toLowerCase())) {
                return key; 
            } 
        } 

        return "Unknown Category";  // ✅ Correct placement
    } catch (error) {
        console.error('Unable to categorise bill', error); 
        return "Unknown Category"; 
    } 
}

const extractPayDate = (text) => {
    const parsedDate = chrono.parse(text); 
    if (parsedDate.length === 0) { 
        return { confidence: 0, value: 'No Date' };
    } 

    let dateConfidence = 100; 
    if (parsedDate.length > 1) {
        dateConfidence = Math.max(dateConfidence - (parsedDate.length-1)*30, 0);  
    } 
    
    return {
        confidence: dateConfidence, value: parsedDate[0].refDate.toISOString().split("T")[0]
    }
} 