const { pool } = require('../config/db');
const path = require('path');
const fs = require('fs');
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

// Create a new section
exports.createSection = async (req, res) => {
  try {
    const { userId, name, icon, profileId } = req.body;
    const actualUserId = profileId ? await getUserId(profileId) : userId;
    const [result] = await pool.execute(
      'INSERT INTO sections (user_id, name, icon) VALUES (?, ?, ?)',
      [actualUserId, name, icon]
    );
    res.json({ id: result.insertId, name, icon });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create section' });
  }
};

// Get all sections for a user
exports.getSections = async (req, res) => {
  try {
    const { userId, profileId } = req.query;
    const actualUserId = profileId ? await getUserId(profileId) : userId;
    const [sections] = await pool.execute(
      'SELECT * FROM sections WHERE user_id = ? ORDER BY section_order, id',
      [actualUserId]
    );
    res.json({ sections });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sections' });
  }
};

// Add item to a section
exports.addSectionItem = async (req, res) => {
  try {
    const { sectionId, title, icon, description } = req.body;
    let file_path = null, file_type = null;
    
    if (req.files && req.files.length > 0) {
      // Handle multiple files
      const files = req.files.map(file => ({
        path: file.path, // Cloudinary URL
        type: file.mimetype.startsWith('image/') ? 'image'
             : file.mimetype.startsWith('video/') ? 'video'
             : 'file'
      }));
      file_path = JSON.stringify(files);
      file_type = 'multiple';
    } else if (req.file) {
      // Handle single file (backward compatibility)
      file_path = req.file.path; // Cloudinary URL
      file_type = req.file.mimetype.startsWith('image/') ? 'image'
                : req.file.mimetype.startsWith('video/') ? 'video'
                : 'file';
    }
    
    // First, let's check if the section exists
    const [sectionCheck] = await pool.execute('SELECT id FROM sections WHERE id = ?', [sectionId]);
    if (sectionCheck.length === 0) {
      return res.status(400).json({ error: 'Section not found' });
    }
    
    const [result] = await pool.execute(
      'INSERT INTO section_items (section_id, title, icon, file_path, file_type, description) VALUES (?, ?, ?, ?, ?, ?)',
      [sectionId, title, icon, file_path, file_type, description]
    );
    res.json({ id: result.insertId, title, icon, file_path, file_type, description });
  } catch (err) {
    console.error('Error in addSectionItem:', err);
    res.status(500).json({ error: 'Failed to add item' });
  }
};

// Get items for a section
exports.getSectionItems = async (req, res) => {
  try {
    const { sectionId } = req.query;
    const [items] = await pool.execute(
      'SELECT * FROM section_items WHERE section_id = ? ORDER BY id',
      [sectionId]
    );
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch items' });
  }
};

// Delete a section (and its items)
exports.deleteSection = async (req, res) => {
  try {
    const { sectionId } = req.params;
    await pool.execute('DELETE FROM sections WHERE id = ?', [sectionId]);
    res.json({ message: 'Section deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete section' });
  }
};

// Delete an item
exports.deleteSectionItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    // Delete files from Cloudinary
    const [rows] = await pool.execute('SELECT file_path, file_type FROM section_items WHERE id = ?', [itemId]);
    if (rows.length && rows[0].file_path) {
      try {
        // Try to parse as JSON (multiple files)
        const files = JSON.parse(rows[0].file_path);
        if (Array.isArray(files)) {
          // Delete multiple files from Cloudinary
          for (const file of files) {
            const publicId = getPublicIdFromUrl(file.path);
            await deleteFromCloudinary(publicId);
          }
        } else {
          // Single file (backward compatibility)
          const publicId = getPublicIdFromUrl(rows[0].file_path);
          await deleteFromCloudinary(publicId);
        }
      } catch (e) {
        // Single file (backward compatibility)
        const publicId = getPublicIdFromUrl(rows[0].file_path);
        await deleteFromCloudinary(publicId);
      }
    }
    await pool.execute('DELETE FROM section_items WHERE id = ?', [itemId]);
    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete item' });
  }
};

// Update a section
exports.updateSection = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { name, icon, profileId } = req.body;
    const actualUserId = profileId ? await getUserId(profileId) : 1;
    
    await pool.execute(
      'UPDATE sections SET name = ?, icon = ? WHERE id = ? AND user_id = ?',
      [name, icon, sectionId, actualUserId]
    );
    res.json({ message: 'Section updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update section' });
  }
};

// Update a section item
exports.updateSectionItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { title, icon, description, existingFiles: existingFilesData } = req.body;
    let file_path = null, file_type = null;
    
    // Parse existing files from request body (files that should be kept)
    let existingFiles = [];
    if (existingFilesData) {
      try {
        existingFiles = JSON.parse(existingFilesData);
      } catch (e) {
        console.error('Error parsing existing files data:', e);
      }
    }
    
    if (req.files && req.files.length > 0) {
      // Handle new uploaded files
      const newFiles = req.files.map(file => ({
        path: file.path, // Cloudinary URL
        type: file.mimetype.startsWith('image/') ? 'image'
             : file.mimetype.startsWith('video/') ? 'video'
             : 'file'
      }));
      
      // Combine existing files (that weren't removed) with new files
      const allFiles = [...existingFiles, ...newFiles];
      file_path = JSON.stringify(allFiles);
      file_type = 'multiple';
    } else {
      // No new files uploaded, use only the existing files that weren't removed
      if (existingFiles.length > 0) {
        file_path = JSON.stringify(existingFiles);
        file_type = 'multiple';
      }
    }
    
    if (file_path) {
      await pool.execute(
        'UPDATE section_items SET title = ?, icon = ?, description = ?, file_path = ?, file_type = ? WHERE id = ?',
        [title, icon, description, file_path, file_type, itemId]
      );
    } else {
      await pool.execute(
        'UPDATE section_items SET title = ?, icon = ?, description = ? WHERE id = ?',
        [title, icon, description, itemId]
      );
    }
    
    res.json({ message: 'Item updated successfully' });
  } catch (err) {
    console.error('Error updating section item:', err);
    res.status(500).json({ error: 'Failed to update item' });
  }
};