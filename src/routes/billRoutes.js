const express = require('express')
const { uploadBill, getBillById, getBillsByField, markBillAsPaid, deleteBill, updateBill, highlightBill } = require('../controllers/billController');  
const router = express.Router()

const { authenticateToken } = require('../middlewares/authMiddleware'); // For protected routes that get information from firestore

router.post('/upload', authenticateToken, uploadBill); 
router.get('/:billId', authenticateToken, getBillById); 
router.get('/field', authenticateToken, getBillsByField)
router.patch('/:billId/paid', authenticateToken, markBillAsPaid); 
router.patch('/:billId/saved', authenticateToken, highlightBill)
router.put('/:billId', authenticateToken, updateBill); 
router.delete('/:billId', authenticateToken, deleteBill)

router.get("/test", (req, res) => {
    console.log("Test route hit!");
    res.send("Server is working!");
});

module.exports = router; 