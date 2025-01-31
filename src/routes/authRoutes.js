const express = require('express');
const { createUser, signUserIn } = require('../controllers/authController');
const router = express.Router();

router.post('/signup', createUser); 
router.post('/signin', signUserIn)

module.exports = router;