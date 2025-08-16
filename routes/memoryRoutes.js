const express = require('express');
const router = express.Router();
const { getMemories, uploadMemory, deleteMemory } = require('../controllers/memoryController');
const { uploadMemory: uploadMemoryMiddleware } = require('../config/cloudinary');

// Memory routes (no auth required - uses profile ID)
router.get('/', getMemories);
router.post('/', uploadMemoryMiddleware.single('memory'), uploadMemory);
router.delete('/:id', deleteMemory);

module.exports = router;
