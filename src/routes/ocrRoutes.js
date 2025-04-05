const express = require('express'); 
const { processMultipleOCR, parseBillWithAI } = require('../controllers/ocrController'); 
const router = express.Router(); 

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() }); // Store file in memory for processing

const { authenticateToken } = require('../middlewares/authMiddleware'); 

router.post('/process', authenticateToken, upload.array("files"), processMultipleOCR); 

router.post('/testai', async (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ error: "Missing 'text' in request body" });
        }

        const parsedData = await parseBillWithAI(text);

        res.status(200).json({
            message: "AI parsed bill successfully",
            data: parsedData
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


module.exports = router; 