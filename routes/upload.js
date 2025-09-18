// routes/upload.js - Rutas de upload actualizadas con controladores
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const UploadController = require('../controllers/uploadController');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Configuración de multer
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    files: 5
  }
});

// Crear directorios si no existen
const ensureDirectories = async () => {
  const dirs = [
    'uploads',
    'uploads/products',
    'uploads/products/thumbs',
    'uploads/users',
    'uploads/categories'
  ];
  
  for (const dir of dirs) {
    try {
      await fs.access(dir);
    } catch (error) {
      await fs.mkdir(dir, { recursive: true });
      console.log(`📁 Directorio creado: ${dir}`);
    }
  }
};

// Inicializar directorios
ensureDirectories();

// Rutas de upload
router.post('/products', adminAuth, upload.array('images', 5), UploadController.uploadProductImages);
router.post('/avatar', auth, upload.single('avatar'), UploadController.uploadAvatar);
router.post('/categories', adminAuth, upload.single('image'), UploadController.uploadCategoryImage);
router.post('/batch', adminAuth, upload.array('files', 10), UploadController.batchUpload);

// Rutas de gestión de archivos (admin)
router.get('/gallery/:folder', adminAuth, UploadController.getGallery);
router.delete('/:folder/:filename', adminAuth, UploadController.deleteFile);
router.get('/stats', adminAuth, UploadController.getUploadStats);
router.post('/optimize', adminAuth, UploadController.optimizeImages);

// Middleware de manejo de errores de multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    let message = 'Error subiendo archivo';
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'Archivo demasiado grande. Máximo permitido: 10MB';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Demasiados archivos. Máximo permitido: 5 archivos';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Campo de archivo no esperado';
        break;
    }
    
    return res.status(400).json({
      success: false,
      message
    });
  }
  
  if (error.message.includes('Tipo de archivo no permitido')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  next(error);
});

module.exports = router;