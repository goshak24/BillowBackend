const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');

// OAuth routes
router.get('/auth/url', emailController.getAuthUrl);
router.post('/auth/token', emailController.exchangeCode);

// Gmail API routes
router.get('/labels', emailController.listLabels);
router.delete('/disconnect', emailController.disconnectGmail);

module.exports = router;