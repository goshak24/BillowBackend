const express = require('express');
const { createUser, signUserIn, verifyToken, refreshToken, updateBudget, getUser } = require('../controllers/authController');
const router = express.Router();

const { authenticateToken } = require('../middlewares/authMiddleware'); // For protected routes that get information from firestore

router.post('/signup', createUser); 
router.post('/signin', signUserIn); 
router.get('/verify-token', verifyToken); 
router.post("/refresh-token", refreshToken);
router.put("/updatebudget", authenticateToken, updateBudget); 
router.get("/user/:userId", authenticateToken, getUser);

module.exports = router; 