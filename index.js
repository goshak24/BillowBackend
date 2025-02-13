const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Importing routes
const authRoutes = require('./src/routes/authRoutes');
const billRoutes = require('./src/routes/billRoutes'); 
const ocrRoutes = require('./src/routes/ocrRoutes'); 

// Using routes
app.use('/api/auth', authRoutes);
app.use('/api/bill', billRoutes); 
app.use('/api/ocr', ocrRoutes)

module.exports = app; 