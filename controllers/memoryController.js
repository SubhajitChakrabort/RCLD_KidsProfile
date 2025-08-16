const { pool } = require('../config/db');
const fs = require('fs');
const path = require('path');
const { deleteFromCloudinary, getPublicIdFromUrl } = require('../config/cloudinary');

// Helper function to get user ID from profile ID or use default
const getUserId = async (profileId) => {
  if (profileId) {
    const [userRows] = await pool.execute(
      'SELECT id FROM users WHERE profile_id = ?',
      [profileId]
    );
    if (userRows.length > 0) {
      return userRows[0].id;
    }
  }
  return 1; // Default user ID for backward compatibility
};

// Get all memories for a user
const getMemories = async (req, res) => {
  try {
    const { profileId } = req.query;
    const userId = await getUserId(profileId);
    
    const [memories] = await pool.execute(
      'SELECT * FROM memories WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    
    res.json({ memories });
  } catch (error) {
    console.error('Error fetching memories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Upload new memory
const uploadMemory = async (req, res) => {
  try {
    const { caption, profileId } = req.body;
    const userId = await getUserId(profileId);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Determine file type
    const fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
    
    // Insert memory into database
    const [result] = await pool.execute(
      'INSERT INTO memories (user_id, file_path, file_type, original_name, caption) VALUES (?, ?, ?, ?, ?)',
      [userId, req.file.path, fileType, req.file.originalname, caption || '']
    );
    
    res.json({ 
      message: 'Memory uploaded successfully',
      id: result.insertId,
      file_path: req.file.path,
      file_type: fileType
    });
  } catch (error) {
    console.error('Error uploading memory:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete memory
const deleteMemory = async (req, res) => {
  try {
    const { id } = req.params;
    const { profileId } = req.query;
    const userId = await getUserId(profileId);
    
    // Get file path before deletion
    const [rows] = await pool.execute(
      'SELECT file_path FROM memories WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Memory not found' });
    }
    
    // Delete file from Cloudinary
    const publicId = getPublicIdFromUrl(rows[0].file_path);
    await deleteFromCloudinary(publicId);
    
    // Delete from database
    await pool.execute('DELETE FROM memories WHERE id = ? AND user_id = ?', [id, userId]);
    
    res.json({ message: 'Memory deleted successfully' });
  } catch (error) {
    console.error('Error deleting memory:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getMemories,
  uploadMemory,
  deleteMemory
};
