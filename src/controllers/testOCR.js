const Tesseract = require("tesseract.js");
const fs = require("fs");
const { extractBillDetails } = require('./ocrController')

// Load test image (replace with file path) don't use require method... 
const imagePath = "C:/Users/gnozh/OneDrive/Desktop/City Work/Year 3/Individual Project/BillowBackend/test_images/tesTest2.png"; 

(async () => {
    try {
        console.log("Running OCR...");
        const { data: { text } } = await Tesseract.recognize(imagePath, "eng");
        console.log("Extracted Text:\n", text);
        extractBillDetails(text);
    } catch (error) {
        console.error("OCR Error:", error);
    }
})(); 