const Tesseract = require("tesseract.js");
const fs = require("fs");

// Load test image (replace with file path)
const imagePath = ""; 

(async () => {
    try {
        console.log("Running OCR...");
        const { data: { text } } = await Tesseract.recognize(imagePath, "eng");
        console.log("Extracted Text:\n", text);
    } catch (error) {
        console.error("OCR Error:", error);
    }
})(); 