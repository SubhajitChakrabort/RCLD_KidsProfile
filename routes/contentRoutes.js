const express = require('express');
const router = express.Router();
const { 
  addHobby,
  updateHobby, 
  addProject,
  updateProject, 
  addSkill,
  updateSkill,
  deleteHobby,
  deleteProject,
  deleteSkill,
  addCertificate,
  updateCertificate,
  deleteCertificate,
  addAchievement,
  updateAchievement,
  deleteAchievement,
  addAdventure,
  updateAdventure,
  deleteAdventure
} = require('../controllers/contentController');
const { uploadContent } = require('../config/cloudinary');

// Hobby routes (no auth required - uses profile ID)
router.post('/hobbies', uploadContent.single('file'), addHobby);
router.put('/hobbies/:id', uploadContent.single('file'), updateHobby);
router.delete('/hobbies/:id', deleteHobby);

// Project routes (no auth required - uses profile ID)
router.post('/projects', uploadContent.single('file'), addProject);
router.put('/projects/:id', uploadContent.single('file'), updateProject);
router.delete('/projects/:id', deleteProject);

// Skill routes (no auth required - uses profile ID)
router.post('/skills', uploadContent.single('file'), addSkill);
router.put('/skills/:id', uploadContent.single('file'), updateSkill);
router.delete('/skills/:id', deleteSkill);

// Certificate routes (no auth required - uses profile ID)
router.post('/certificates', uploadContent.single('file'), addCertificate);
router.put('/certificates/:id', uploadContent.single('file'), updateCertificate);
router.delete('/certificates/:id', deleteCertificate);

// Achievement routes (no auth required - uses profile ID)
router.post('/achievements', uploadContent.single('file'), addAchievement);
router.put('/achievements/:id', uploadContent.single('file'), updateAchievement);
router.delete('/achievements/:id', deleteAchievement);

// Adventure routes (no auth required - uses profile ID)
router.post('/adventures', uploadContent.single('file'), addAdventure);
router.put('/adventures/:id', uploadContent.single('file'), updateAdventure);
router.delete('/adventures/:id', deleteAdventure);

module.exports = router;
