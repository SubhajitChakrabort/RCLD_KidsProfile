const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: 'dqchvzeso',
  api_key: '798244387539599',
  api_secret: '0yfAu5oDhhuZQ7rAnXIRRCqfjFU'
});

// Create storage for different types of uploads
const createStorage = (folder) => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: folder,
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi', 'pdf', 'doc', 'docx', 'txt', 'apk'],
      transformation: [
        { width: 1000, height: 1000, crop: 'limit' }, // Limit size for images
        { quality: 'auto:good' } // Optimize quality
      ]
    }
  });
};

// Storage configurations for different upload types
const profileStorage = createStorage('profile-images');
const coverStorage = createStorage('cover-images');
const contentStorage = createStorage('content-files');
const memoryStorage = createStorage('memory-files');

// Multer upload configurations with file size limits
const uploadProfilePic = multer({ 
  storage: profileStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});
const uploadCoverImage = multer({ 
  storage: coverStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});
const uploadContent = multer({ 
  storage: contentStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});
const uploadMemory = multer({ 
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper function to delete file from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  try {
    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
    }
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
  }
};

// Helper function to get public ID from URL
const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  const parts = url.split('/');
  const filename = parts[parts.length - 1];
  const nameWithoutExtension = filename.split('.')[0];
  const folder = parts[parts.length - 2];
  return `${folder}/${nameWithoutExtension}`;
};

module.exports = {
  cloudinary,
  uploadProfilePic,
  uploadCoverImage,
  uploadContent,
  uploadMemory,
  deleteFromCloudinary,
  getPublicIdFromUrl
};
