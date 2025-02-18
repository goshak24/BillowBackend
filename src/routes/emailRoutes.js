const express = require('express');
const { listLabels, getLabelledEmails, createLabel, deleteLabel, disconnectGmail } = require('../controllers/emailController');

const router = express.Router();

// Route to fetch Gmail labels
router.get('/labels', listLabels);
router.get("/labels/:id", getLabelledEmails);
router.post("/labels", createLabel);
router.delete("/labels/:id", deleteLabel);
router.delete("/disconnect", disconnectGmail); 

module.exports = router; 