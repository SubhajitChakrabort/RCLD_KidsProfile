const express = require('express');
const router = express.Router();
const { 
  getProfile, 
  updateProfile, 
  updateProfilePicture,
  updateCoverImage,
  createProfile,
  getProfileById,
  getProfileByUsername,
  login,
  forgotPassword
} = require('../controllers/profileController');
const { authenticateUser } = require('../middleware/auth');
const { uploadProfilePic, uploadCoverImage, uploadContent } = require('../config/cloudinary');

// Create new profile (no auth required)
router.post('/create', uploadContent.fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 }
]), createProfile);

// Get profile data (requires auth) - must come before /:profileId
router.get('/', authenticateUser, getProfile);

// Update profile (no auth required - uses profile ID)
router.put('/', updateProfile);

// Update profile picture (no auth required - uses profile ID)
router.post('/picture', uploadProfilePic.single('profilePicture'), updateProfilePicture);

// Update cover image (no auth required - uses profile ID)
router.post('/cover', uploadCoverImage.single('coverImage'), updateCoverImage);

// Get profile by username (no auth required)
router.get('/username/:username', getProfileByUsername);

// Auth routes
router.post('/login', login);
router.post('/forgot-password', forgotPassword);

// Get profile by ID (no auth required) - must come last
router.get('/:profileId', getProfileById);

module.exports = router;