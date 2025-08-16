const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { testConnection } = require('./config/db');
const profileRoutes = require('./routes/profileRoutes');
const contentRoutes = require('./routes/contentRoutes');
const memoryRoutes = require('./routes/memoryRoutes');
const sectionsRoutes = require('./routes/sectionsRoutes');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('public'));

// Set views directory
app.set('views', path.join(__dirname, 'views'));

// Test database connection
testConnection();

// Routes
app.use('/api/profile', profileRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/memories', memoryRoutes);
app.use('/api/sections', sectionsRoutes);
// Serve main HTML file for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'create-profile.html'));
});

// Serve profile page with unique ID
app.get('/profile/:profileId', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Serve profile page by username
app.get('/@:username', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  
  // Handle Multer errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ 
      error: 'File too large. Maximum file size is 10MB.' 
    });
  }
  
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ 
      error: 'Unexpected file field. Please check your upload form.' 
    });
  }
  
  // Handle Cloudinary-specific errors
  if (error.message && error.message.includes('cloudinary')) {
    return res.status(500).json({ 
      error: 'File upload failed. Please try again with a different file.' 
    });
  }
  
  res.status(500).json({ error: error.message || 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

module.exports = app;
