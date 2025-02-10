const Tesseract = require("tesseract.js");
const { getStorage, ref, uploadBytes, getDownloadURL } = require("firebase/storage");
const { addBill } = require("./billsController"); 

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

            // Run OCR using the scheduler
            const { data: { text } } = await scheduler.addJob("recognize", file.buffer);

            const billData = extractBillDetails(text);
            billData.userId = userId;
            billData.fileUrl = fileUrl;

            console.log(billData)

            // Save bill to Firestore using billsController.js
            return 0
        });

        const savedBills = await Promise.all(billPromises);
        res.status(201).json({ message: "Bills processed successfully", savedBills });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}; 