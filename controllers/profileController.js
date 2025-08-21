const { pool } = require('../config/db');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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

// Create new profile
const createProfile = async (req, res) => {
  try {
    const { name, username, intro_text, highlights, password, securityCode } = req.body;
    
    if (!name || !username || !intro_text || !highlights) {
      return res.status(400).json({ error: 'Name, username, intro text, and highlights are required' });
    }

    if (!securityCode || typeof securityCode !== 'string' || securityCode.trim().length < 2) {
      return res.status(400).json({ error: 'Security code is required (min 2 characters)' });
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
    }

    // Check if username already exists
    const [existingUser] = await pool.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    
    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'Username already taken. Please choose a different one.' });
    }

    // Generate unique profile ID
    const profileId = uuidv4().replace(/-/g, '').substring(0, 12);
    
    // Create user record (base fields)
    const [userResult] = await pool.execute(
      'INSERT INTO users (profile_id, username, name, intro_text) VALUES (?, ?, ?, ?)',
      [profileId, username, name, intro_text]
    );
    
    const userId = userResult.insertId;

    // If password provided, hash and update (tolerate if column not present yet)
    if (password && typeof password === 'string' && password.length >= 6) {
      try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);
      } catch (e) {
        // Ignore if column doesn't exist yet; log for visibility
        console.warn('Password not stored (likely missing password_hash column):', e.code || e.message);
      }
    }

    // Store security code hash (tolerate if column not present yet)
    try {
      const salt2 = await bcrypt.genSalt(10);
      const scHash = await bcrypt.hash(securityCode.trim(), salt2);
      await pool.execute('UPDATE users SET security_code_hash = ? WHERE id = ?', [scHash, userId]);
    } catch (e) {
      console.warn('Security code not stored (likely missing security_code_hash column):', e.code || e.message);
    }
    
    // Handle profile picture
    let profilePictureUrl = null;
    if (req.files && req.files.profilePicture) {
      profilePictureUrl = req.files.profilePicture[0].path;
      await pool.execute(
        'UPDATE users SET profile_picture = ? WHERE id = ?',
        [profilePictureUrl, userId]
      );
    }
    
    // Handle cover image
    let coverImageUrl = null;
    if (req.files && req.files.coverImage) {
      coverImageUrl = req.files.coverImage[0].path;
      await pool.execute(
        'UPDATE users SET cover_image = ? WHERE id = ?',
        [coverImageUrl, userId]
      );
    }
    
    // Create highlights
    const highlightsArray = highlights.split(',').map(h => h.trim()).filter(h => h);
    for (const highlight of highlightsArray) {
      await pool.execute(
        'INSERT INTO highlights (user_id, highlight_text) VALUES (?, ?)',
        [userId, highlight]
      );
    }
    
    res.json({ 
      message: 'Profile created successfully',
      profileId: profileId,
      userId: userId
    });
  } catch (error) {
    console.error('Error creating profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Login controller
const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const [rows] = await pool.execute('SELECT id, username, password_hash FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = rows[0];
    if (!user.password_hash) {
      return res.status(401).json({ error: 'Password not set for this account' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET || 'dev_secret_change_me', {
      expiresIn: '7d'
    });

    res.json({ token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Forgot password controller (requires matching security code)
const forgotPassword = async (req, res) => {
  try {
    const { username, securityCode, newPassword, confirmPassword } = req.body;
    if (!username || !newPassword || !confirmPassword || !securityCode) {
      return res.status(400).json({ error: 'Username, security code, new password, and confirm password are required' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const [rows] = await pool.execute('SELECT id, security_code_hash FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify security code
    const user = rows[0];
    if (!user.security_code_hash) {
      return res.status(400).json({ error: 'Security code not set for this account' });
    }
    const scOk = await bcrypt.compare(String(securityCode), user.security_code_hash);
    if (!scOk) {
      return res.status(401).json({ error: 'Invalid security code' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);
    await pool.execute('UPDATE users SET password_hash = ? WHERE username = ?', [hash, username]);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get profile by ID
const getProfileById = async (req, res) => {
  try {
    const { profileId } = req.params;
    
    // Get user data by profile_id
    const [userRows] = await pool.execute(
      'SELECT * FROM users WHERE profile_id = ?',
      [profileId]
    );
    
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    const user = userRows[0];
    
    // Get highlights
    const [highlightRows] = await pool.execute(
      'SELECT * FROM highlights WHERE user_id = ? ORDER BY id',
      [user.id]
    );
    
    // Get dynamic sections and their items
    const [sectionRows] = await pool.execute(
      'SELECT * FROM sections WHERE user_id = ? ORDER BY section_order, id',
      [user.id]
    );
    
    for (const section of sectionRows) {
      const [itemRows] = await pool.execute(
        'SELECT * FROM section_items WHERE section_id = ? ORDER BY id',
        [section.id]
    );
      section.items = itemRows;
    }

    res.json({
      user,
      highlights: highlightRows,
      sections: sectionRows
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get profile by username
const getProfileByUsername = async (req, res) => {
  try {
    const { username } = req.params;
    
    // Get user data by username
    const [userRows] = await pool.execute(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
    
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    const user = userRows[0];
    
    res.json({
      profileId: user.profile_id,
      username: user.username,
      name: user.name
    });
  } catch (error) {
    console.error('Error fetching profile by username:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get complete profile data (for authenticated users)
const getProfile = async (req, res) => {
  try {
    const userId = req.userId || 1;
    
    // Get user data
    const [userRows] = await pool.execute(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );
    
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userRows[0];
    
    // Get highlights
    const [highlightRows] = await pool.execute(
      'SELECT * FROM highlights WHERE user_id = ? ORDER BY id',
      [userId]
    );
    
    // Get dynamic sections and their items
    const [sectionRows] = await pool.execute(
      'SELECT * FROM sections WHERE user_id = ? ORDER BY section_order, id',
      [userId]
    );
    
    for (const section of sectionRows) {
      const [itemRows] = await pool.execute(
        'SELECT * FROM section_items WHERE section_id = ? ORDER BY id',
        [section.id]
    );
      section.items = itemRows;
    }

    res.json({
      user,
      highlights: highlightRows,
      sections: sectionRows
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update profile
const updateProfile = async (req, res) => {
  try {
    const { name, username, intro_text, highlights, profileId } = req.body;
    const userId = await getUserId(profileId);
    
    // Validate username format if provided
    if (username) {
      const usernameRegex = /^[a-zA-Z0-9_]+$/;
      if (!usernameRegex.test(username)) {
        return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
      }

      // Check if username already exists (excluding current user)
      const [existingUser] = await pool.execute(
        'SELECT id FROM users WHERE username = ? AND id != ?',
        [username, userId]
      );
      
      if (existingUser.length > 0) {
        return res.status(400).json({ error: 'Username already taken. Please choose a different one.' });
      }
    }
    
    // Update user data
    const updateFields = [];
    const updateValues = [];
    
    if (name) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (username) {
      updateFields.push('username = ?');
      updateValues.push(username);
    }
    if (intro_text) {
      updateFields.push('intro_text = ?');
      updateValues.push(intro_text);
    }
    
    updateValues.push(userId);
    
    if (updateFields.length > 0) {
      await pool.execute(
        `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
    }
    
    // Update highlights
    if (highlights && Array.isArray(highlights)) {
      // Delete existing highlights
      await pool.execute('DELETE FROM highlights WHERE user_id = ?', [userId]);
      
      // Insert new highlights
      for (const highlight of highlights) {
        if (highlight.trim()) {
          await pool.execute(
            'INSERT INTO highlights (user_id, highlight_text) VALUES (?, ?)',
            [userId, highlight.trim()]
          );
        }
      }
    }
    
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update profile picture
const updateProfilePicture = async (req, res) => {
  try {
    const { profileId } = req.body;
    const userId = await getUserId(profileId);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Get current profile picture
    const [userRows] = await pool.execute(
      'SELECT profile_picture FROM users WHERE id = ?',
      [userId]
    );
    
    // Delete old profile picture from Cloudinary if exists
    if (userRows.length > 0 && userRows[0].profile_picture && !userRows[0].profile_picture.startsWith('user.')) {
      const publicId = getPublicIdFromUrl(userRows[0].profile_picture);
      await deleteFromCloudinary(publicId);
    }
    
    // Update profile picture with Cloudinary URL
    await pool.execute(
      'UPDATE users SET profile_picture = ? WHERE id = ?',
      [req.file.path, userId]
    );
    
    res.json({ 
      message: 'Profile picture updated successfully',
      url: req.file.path
    });
  } catch (error) {
    console.error('Error updating profile picture:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update cover image
const updateCoverImage = async (req, res) => {
  try {
    const { profileId } = req.body;
    const userId = await getUserId(profileId);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Get current cover image
    const [userRows] = await pool.execute(
      'SELECT cover_image FROM users WHERE id = ?',
      [userId]
    );
    
    // Delete old cover image from Cloudinary if exists
    if (userRows.length > 0 && userRows[0].cover_image) {
      const publicId = getPublicIdFromUrl(userRows[0].cover_image);
      await deleteFromCloudinary(publicId);
    }
    
    // Update cover image with Cloudinary URL
    await pool.execute(
      'UPDATE users SET cover_image = ? WHERE id = ?',
      [req.file.path, userId]
    );
    
    res.json({ 
      message: 'Cover image updated successfully',
      url: req.file.path
    });
  } catch (error) {
    console.error('Error updating cover image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createProfile,
  getProfileById,
  getProfileByUsername,
  getProfile,
  updateProfile,
  updateProfilePicture,
  updateCoverImage,
  login,
  forgotPassword
};