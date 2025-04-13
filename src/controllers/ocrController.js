const Tesseract = require("tesseract.js");
const axios = require('axios');
const { getStorage, ref, uploadBytes, getDownloadURL } = require("firebase/storage");
const { doc } = require('firebase/firestore');
const { db } = require('../config/firebase_config');
const OpenAI = require("openai");
const { setDoc } = require("firebase/firestore");

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
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({ error: "No files uploaded" });
        }

        const savedBills = [];

        for (const file of files) {
            // Run OCR to extract text
            const { data: { text } } = await scheduler.addJob("recognize", file.buffer);

            // Extract details from text
            let billData = await this.extractBillDetails(text);

            // Store extracted details 
            billData = { fileUrl: "temp_url", ...billData };
            savedBills.push(billData);
        }

        res.status(200).json({ message: "OCR processed", savedBills });
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
        // Heuristic extraction
        amount = extractAmount(text);
        vendor = extractVendor(text);
        category = categoriseBill(vendor.value);
        payDate = extractPayDate(text);

        let confidenceScores = [
            amount.confidence,
            vendor.confidence,
            payDate.confidence
        ];

        const overallConfidence = confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length;

        if (overallConfidence < 70) {
            console.log("Confidence too low (", overallConfidence, "%). Using AI fallback...");

            const aiExtractedData = await parseBillWithAI(text);

            await updateHeuristicRules(
                amount.value,
                vendor.value,
                category,
                payDate.value,
                aiExtractedData
            );

            return aiExtractedData;
        }

        // Return heuristically extracted data
        return {
            amount: amount.value,
            vendor: vendor.value,
            category,
            payDate: payDate.value
        };

    } catch (error) {
        console.error('Failed to detect key information', error);
        return {
            amount: null,
            vendor: null,
            category: null,
            payDate: null
        };
    }
};

const openai = new OpenAI();

exports.parseBillWithAI = async (rawText) => {
    try {
        const prompt = `
You are an intelligent assistant. Extract the following fields from the given bill text:
- Amount (currency and number)
- Vendor
- Category (Utilities, Subscriptions, Insurance, etc.)
- Pay Date (in YYYY-MM-DD)

Bill Text:
"""
${rawText}
"""

Return response as a JSON object with keys: amount, vendor, category, payDate.
        `.trim();

        const response = await openai.responses.create({
            model: "gpt-4",
            input: [
                { role: "system", content: "You are a bill-parsing assistant." },
                { role: "user", content: prompt }
            ],
            temperature: 0.3
        });

        const rawTextOutput = response?.data?.output_text || response?.output_text;

        const aiData = JSON.parse(rawTextOutput);
        return aiData;
    } catch (error) {
        console.error("AI parsing failed:", error.message);
        return {
            amount: null,
            vendor: null,
            category: null,
            payDate: null
        };
    }
};

const updateHeuristicRules = async (amount, vendor, category, payDate, aiData) => {
    try {
        const updates = {};

        // Check if AI has more confident or corrected values
        if (vendor !== aiData.vendor && aiData.vendor && aiData.category) {
            console.log(`Vendor mismatch. Heuristic: "${vendor}", AI: "${aiData.vendor}"`);
            updates[aiData.vendor] = aiData.category;
        }

        // Log differences (could also compare amount/payDate if you want)
        if (amount !== aiData.amount) {
            console.log(`Amount mismatch. Heuristic: "${amount}", AI: "${aiData.amount}"`);
        }

        if (payDate !== aiData.payDate) {
            console.log(`PayDate mismatch. Heuristic: "${payDate}", AI: "${aiData.payDate}"`);
        }

        // If we have vendor-category mappings to add, update Firestore
        if (Object.keys(updates).length > 0) {
            console.log("Updating vendor-category mappings in Firestore:", updates);

            await setDoc(heuristicRef, updates, { merge: true });
        }

    } catch (error) {
        console.error("Failed to update heuristic rules:", error.message);
    }
};

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
        vendorConfidence = Math.max(100 - (vendorMatches.length - 1) * 30, 0);
    }

    return { confidence: vendorConfidence, value: vendorMatches.length > 0 ? vendorMatches[0] : "Unknown Vendor" };
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

        return "Unknown Category";
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
        dateConfidence = Math.max(dateConfidence - (parsedDate.length - 1) * 30, 0);
    }

    return {
        confidence: dateConfidence, value: parsedDate[0].refDate.toISOString().split("T")[0]
    }
} 