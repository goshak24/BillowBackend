const Tesseract = require("tesseract.js");
const axios = require('axios');
const { getStorage, ref, uploadBytes, getDownloadURL } = require("firebase/storage");
const { doc, getDoc } = require('firebase/firestore');
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

// Cache for vendor-category mapping to reduce database calls
let vendorCategoryCache = null;
let lastCacheFetch = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Function to get vendor-category mappings with caching
const getVendorCategories = async () => {
    const now = Date.now();
    
    // Return cached data if it exists and is fresh
    if (vendorCategoryCache && lastCacheFetch && (now - lastCacheFetch < CACHE_TTL)) {
        return vendorCategoryCache;
    }
    
    try {
        const heuristicDoc = await getDoc(heuristicRef);
        if (heuristicDoc.exists()) {
            // Store in cache
            vendorCategoryCache = heuristicDoc.data();
            lastCacheFetch = Date.now();
            return vendorCategoryCache;
        } else {
            console.log("No heuristic data found in database");
            return {};
        }
    } catch (error) {
        console.error("Error fetching vendor categories:", error);
        // Return cached data if available, even if outdated
        return vendorCategoryCache || {};
    }
};

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
            let billData = await extractBillDetails(text);

            // Store extracted details 
            billData = { fileUrl: "temp_url", ...billData };
            savedBills.push(billData);
        }

        res.status(200).json({ message: "OCR processed", savedBills });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Fixed the export/reference issue by making this a separate function
const extractBillDetails = async (input) => {
    try {
        const preprocessed = preprocessText(input);
        
        const keyInfo = await detectKeyInformation(preprocessed);
        return keyInfo;
    } catch (error) {
        console.error('Failed at extracting bill details:', error);
        return {
            amount: null,
            vendor: null,
            category: null,
            payDate: null
        };
    }
};

// Making this available as export
exports.extractBillDetails = extractBillDetails;

// Helper functions for 'extractBillDetails' 

const preprocessText = (text) => {
    try {
        // Fixed regex patterns by removing incorrect forward slashes
        return text
            .replace(/\r\n/g, ' ')
            .replace(/[^a-zA-Z0-9@.:$\/-]/g, ' ')
            .replace(/\s+/g, ' ')
            .toLowerCase();
    } catch (error) {
        console.error('Failed preprocessing input text:', error);
        return text.toLowerCase(); // Return basic lowercase as fallback
    }
};

const detectKeyInformation = async (text) => {
    let amount, vendor, category, payDate;

    try {
        // Get vendor-category mappings from database
        const vendorCategoryMap = await getVendorCategories();
        
        // Heuristic extraction
        amount = extractAmount(text);
        vendor = await extractVendor(text, vendorCategoryMap);
        payDate = extractPayDate(text);
        
        // Use the mapping to categorize if we have a valid vendor
        category = vendor.value ? categoriseBill(vendor.value, vendorCategoryMap) : "Unknown Category";

        let confidenceScores = [];
        
        // Only add confidence scores for values that were successfully extracted
        if (amount.confidence !== null) confidenceScores.push(amount.confidence);
        if (vendor.confidence !== null) confidenceScores.push(vendor.confidence);
        if (payDate.confidence !== null) confidenceScores.push(payDate.confidence);
        
        // Calculate overall confidence only if we have scores
        const overallConfidence = confidenceScores.length > 0 
            ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length 
            : 0;
            
        console.log(
            amount.confidence,
            vendor.confidence,
            payDate.confidence, 
            overallConfidence
        );

        // Use AI fallback if confidence is too low or missing critical data
        if (overallConfidence < 70 || !amount.value || !vendor.value) {
            console.log("Confidence too low (", overallConfidence, "%). Using AI fallback...");

            const aiExtractedData = await parseBillWithAI(text);

            // If AI was able to extract data, update heuristics
            if (aiExtractedData.vendor && aiExtractedData.category) {
                await updateHeuristicRules(
                    amount.value,
                    vendor.value,
                    category,
                    payDate.value,
                    aiExtractedData
                );
            }

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
        console.error('Failed to detect key information:', error);
        return {
            amount: null,
            vendor: null,
            category: null,
            payDate: null
        };
    }
};

const openai = new OpenAI();

const parseBillWithAI = async (rawText) => {
    try {
        const prompt = `
You are an intelligent assistant. Extract the following fields from the given bill text:
- Amount (just the number, e.g., 7.49 not USD 7.49)
- Vendor
- Category (Utilities, Subscriptions, Insurance, etc.)
- Pay Date (in YYYY-MM-DD)

Bill Text:
"""
${rawText}
"""

Return response as a JSON object with keys: amount, vendor, category, payDate.
        `.trim();

        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                { role: "system", content: "You are a bill-parsing assistant." },
                { role: "user", content: prompt }
            ],
            temperature: 0.3
        });

        const responseText = response?.choices?.[0]?.message?.content || '{}';
        const aiData = JSON.parse(responseText);
        
        // Ensure amount is in numeric format if provided
        if (aiData.amount) {
            // Remove any currency symbols and convert to number
            const numericAmount = parseFloat(aiData.amount.toString().replace(/[^0-9.]/g, ""));
            aiData.amount = isNaN(numericAmount) ? null : numericAmount;
        }
        
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
        if (aiData.vendor && aiData.category && (!vendor || vendor !== aiData.vendor)) {
            console.log(`Vendor mismatch. Heuristic: "${vendor}", AI: "${aiData.vendor}"`);
            updates[aiData.vendor] = aiData.category;
        }

        // Log differences for amount
        if ((amount !== aiData.amount) && aiData.amount !== null) {
            console.log(`Amount mismatch. Heuristic: "${amount}", AI: "${aiData.amount}"`);
        }

        // Log differences for payDate
        if ((payDate !== aiData.payDate) && aiData.payDate !== null) {
            console.log(`PayDate mismatch. Heuristic: "${payDate}", AI: "${aiData.payDate}"`);
        }

        // If we have vendor-category mappings to add, update Firestore
        if (Object.keys(updates).length > 0) {
            console.log("Updating vendor-category mappings in Firestore:", updates);

            await setDoc(heuristicRef, updates, { merge: true });
            
            // Update local cache as well
            vendorCategoryCache = { ...vendorCategoryCache, ...updates };
        }

    } catch (error) {
        console.error("Failed to update heuristic rules:", error.message);
    }
};

const extractAmount = (text) => {
    let amountConfidence = 0;
    let amountCount = 0;
    let lastAmount = null;

    // Look for currency patterns like $10.99, £20, 15.99, etc.
    const currencyRegex = /(?:[\£\$\€]?\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?)|\d+\.\d{2}/g;
    const matches = text.match(currencyRegex);
    
    if (matches && matches.length > 0) {
        amountCount = matches.length;
        // Get the last match which is often the total amount
        const amountStr = matches[matches.length - 1];
        lastAmount = parseFloat(amountStr.replace(/[^0-9.]/g, ""));
        
        // Calculate confidence based on number of potential amounts found
        amountConfidence = Math.max(100 - (amountCount - 1) * 20, 0);
    }

    return { 
        confidence: amountConfidence, 
        value: lastAmount 
    };
};

const extractVendor = async (text, vendorCategoryMap = null) => {
    try {
        // If not provided, fetch the vendor-category map
        if (!vendorCategoryMap) {
            vendorCategoryMap = await getVendorCategories();
        }
        
        // Get a list of all vendors from the database
        const knownVendors = Object.keys(vendorCategoryMap).map(v => v.toLowerCase());
        
        // Fallback list in case database is empty
        const fallbackVendors = ["netflix", "amazon", "british gas", "virgin media", "spotify", "apple", "verizon", "at&t", "streamify"];
        
        // Use database vendors if available, otherwise use fallback
        const vendorList = knownVendors.length > 0 ? knownVendors : fallbackVendors;
        
        let vendorMatches = [];

        for (const vendor of vendorList) {
            if (text.includes(vendor.toLowerCase())) {
                // Find the original case from the map or fallback
                const originalCase = Object.keys(vendorCategoryMap).find(
                    v => v.toLowerCase() === vendor.toLowerCase()
                ) || vendor.charAt(0).toUpperCase() + vendor.slice(1);
                
                vendorMatches.push(originalCase);
            }
        }

        let vendorConfidence = 0;
        if (vendorMatches.length > 0) {
            vendorConfidence = Math.max(100 - (vendorMatches.length - 1) * 30, 0);
        }

        return { 
            confidence: vendorConfidence, 
            value: vendorMatches.length > 0 ? vendorMatches[0] : null 
        };
    } catch (error) {
        console.error("Error extracting vendor:", error);
        return { confidence: 0, value: null };
    }
};

const categoriseBill = (vendor, vendorCategoryMap = null) => {
    try {
        if (!vendor) return "Unknown Category";
        
        // If a vendor-category map is provided, use it
        if (vendorCategoryMap && Object.keys(vendorCategoryMap).length > 0) {
            // Look for a case-insensitive match
            const vendorKey = Object.keys(vendorCategoryMap).find(
                v => v.toLowerCase() === vendor.toLowerCase()
            );
            
            if (vendorKey) {
                return vendorCategoryMap[vendorKey];
            }
        }
        
        // Fallback categories if not found in database
        const fallbackCategories = {
            "Utilities": ["British Gas", "Verizon", "AT&T"],
            "Subscriptions": ["Netflix", "Spotify", "Amazon", "Streamify"],
            "Insurance": ["Axa", "Geico", "Allstate"],
        };

        for (let key in fallbackCategories) {
            if (fallbackCategories[key].some(v => v.toLowerCase() === vendor.toLowerCase())) {
                return key;
            }
        }

        return "Unknown Category";
    } catch (error) {
        console.error('Unable to categorise bill:', error);
        return "Unknown Category";
    }
};

const extractPayDate = (text) => {
    try {
        const parsedDate = chrono.parse(text); 
        
        if (!parsedDate || parsedDate.length === 0) {
            return { confidence: 0, value: null };
        }

        let dateConfidence = 100;
        if (parsedDate.length > 1) {
            dateConfidence = Math.max(dateConfidence - (parsedDate.length - 1) * 30, 0);
        }

        const extractedDate = parsedDate[0].start ?
            parsedDate[0].start.date().toISOString().split("T")[0] :
            parsedDate[0].refDate.toISOString().split("T")[0];

        return {
            confidence: dateConfidence, 
            value: extractedDate
        };
    } catch (error) {
        console.error('Failed to extract date:', error);
        return { confidence: 0, value: null };
    }
};