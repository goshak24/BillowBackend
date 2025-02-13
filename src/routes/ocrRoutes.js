const express = require('express'); 
const { processMultipleOCR } = require('../controllers/ocrController'); 
const router = express.Router(); 

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() }); // Store file in memory for processing

const { authenticateToken } = require('../middlewares/authMiddleware'); 

router.post('/process', authenticateToken, upload.array("files"), processMultipleOCR); 

module.exports = router; 