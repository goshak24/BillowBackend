const express = require('express');
const { createUser, signUserIn, verifyToken, refreshToken } = require('../controllers/authController');
const router = express.Router();

router.post('/signup', createUser); 
router.post('/signin', signUserIn); 
router.get('/verify-token', verifyToken); 
router.post("/refresh-token", refreshToken);

module.exports = router;