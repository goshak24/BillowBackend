const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Importing routes
const authRoutes = require('./src/routes/authRoutes');

// Using routes
app.use('/api/auth', authRoutes);

module.exports = app; 