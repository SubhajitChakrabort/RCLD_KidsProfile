const express = require('express');
const router = express.Router();
const { createSection, getSections, addSectionItem, getSectionItems, deleteSection, deleteSectionItem, updateSection, updateSectionItem } = require('../controllers/sectionController');
const { uploadContent } = require('../config/cloudinary');

// Section CRUD
router.post('/section', createSection);
router.get('/sections', getSections);
router.put('/section/:sectionId', updateSection);
router.delete('/section/:sectionId', deleteSection);

// Section Items CRUD
router.post('/section/item', uploadContent.array('files', 10), addSectionItem);
router.get('/section/items', getSectionItems);
router.put('/section/item/:itemId', uploadContent.array('files', 10), updateSectionItem);
router.delete('/section/item/:itemId', deleteSectionItem);

module.exports = router;