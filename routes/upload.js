// routes/upload.js - Rutas para subida de archivos
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// Configuración de multer para subida de archivos
const storage = multer.memoryStorage(); // Usar memoria para procesar con Sharp

const fileFilter = (req, file, cb) => {
  // Tipos de archivo permitidos
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
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB por defecto
    files: 5 // máximo 5 archivos por request
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

// Inicializar directorios al cargar el módulo
ensureDirectories();

// Función para generar nombre único de archivo
const generateFileName = (originalName, prefix = '') => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = path.extname(originalName).toLowerCase();
  return `${prefix}${timestamp}-${random}${ext}`;
};

// Función para procesar imagen con Sharp
const processImage = async (buffer, options = {}) => {
  const {
    width = 800,
    height = 800,
    quality = 85,
    format = 'jpeg'
  } = options;
  
  let sharpInstance = sharp(buffer);
  
  // Redimensionar manteniendo proporción
  sharpInstance = sharpInstance
    .resize(width, height, {
      fit: 'inside',
      withoutEnlargement: true
    });
  
  // Aplicar formato y calidad
  switch (format) {
    case 'jpeg':
    case 'jpg':
      sharpInstance = sharpInstance.jpeg({ quality });
      break;
    case 'png':
      sharpInstance = sharpInstance.png({ quality });
      break;
    case 'webp':
      sharpInstance = sharpInstance.webp({ quality });
      break;
  }
  
  return await sharpInstance.toBuffer();
};

// POST /api/upload/products - Subir imágenes de productos (solo admin)
router.post('/products', adminAuth, upload.array('images', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se subieron archivos'
      });
    }

    const uploadedFiles = [];
    
    for (const file of req.files) {
      // Generar nombres de archivos
      const fileName = generateFileName(file.originalname, 'product-');
      const thumbName = generateFileName(file.originalname, 'thumb-');
      
      // Rutas de archivos
      const filePath = path.join('uploads/products', fileName);
      const thumbPath = path.join('uploads/products/thumbs', thumbName);
      
      try {
        // Procesar imagen principal (800x800)
        const processedImage = await processImage(file.buffer, {
          width: 800,
          height: 800,
          quality: 85
        });
        
        // Procesar thumbnail (300x300)
        const thumbnail = await processImage(file.buffer, {
          width: 300,
          height: 300,
          quality: 80
        });
        
        // Guardar archivos
        await fs.writeFile(filePath, processedImage);
        await fs.writeFile(thumbPath, thumbnail);
        
        uploadedFiles.push({
          url: `/uploads/products/${fileName}`,
          thumbnail: `/uploads/products/thumbs/${thumbName}`,
          originalName: file.originalname,
          size: processedImage.length,
          alt: req.body.alt || ''
        });
        
      } catch (processError) {
        console.error('Error procesando imagen:', processError);
        throw new Error(`Error procesando ${file.originalname}: ${processError.message}`);
      }
    }

    res.json({
      success: true,
      message: `${uploadedFiles.length} imagen(es) subidas exitosamente`,
      data: uploadedFiles
    });

  } catch (error) {
    console.error('Error subiendo imágenes de productos:', error);
    res.status(500).json({
      success: false,
      message: 'Error subiendo imágenes',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
});

// POST /api/upload/avatar - Subir avatar de usuario
router.post('/avatar', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se subió archivo'
      });
    }

    const fileName = generateFileName(req.file.originalname, `user-${req.userId}-`);
    const filePath = path.join('uploads/users', fileName);

    // Procesar imagen de avatar (200x200, circular)
    const processedImage = await processImage(req.file.buffer, {
      width: 200,
      height: 200,
      quality: 90
    });

    await fs.writeFile(filePath, processedImage);

    const avatarUrl = `/uploads/users/${fileName}`;

    res.json({
      success: true,
      message: 'Avatar subido exitosamente',
      data: {
        url: avatarUrl,
        size: processedImage.length
      }
    });

  } catch (error) {
    console.error('Error subiendo avatar:', error);
    res.status(500).json({
      success: false,
      message: 'Error subiendo avatar'
    });
  }
});

// POST /api/upload/categories - Subir imágenes de categorías (solo admin)
router.post('/categories', adminAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se subió archivo'
      });
    }

    const fileName = generateFileName(req.file.originalname, 'category-');
    const filePath = path.join('uploads/categories', fileName);

    // Procesar imagen de categoría (600x400 para banners)
    const processedImage = await processImage(req.file.buffer, {
      width: 600,
      height: 400,
      quality: 85
    });

    await fs.writeFile(filePath, processedImage);

    res.json({
      success: true,
      message: 'Imagen de categoría subida exitosamente',
      data: {
        url: `/uploads/categories/${fileName}`,
        size: processedImage.length
      }
    });

  } catch (error) {
    console.error('Error subiendo imagen de categoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error subiendo imagen de categoría'
    });
  }
});

// DELETE /api/upload/:path - Eliminar archivo (solo admin)
router.delete('/:folder/:filename', adminAuth, async (req, res) => {
  try {
    const { folder, filename } = req.params;
    
    // Validar carpetas permitidas
    const allowedFolders = ['products', 'users', 'categories'];
    if (!allowedFolders.includes(folder)) {
      return res.status(400).json({
        success: false,
        message: 'Carpeta no válida'
      });
    }

    const filePath = path.join('uploads', folder, filename);

    try {
      await fs.access(filePath);
      await fs.unlink(filePath);

      // Si es producto, también eliminar thumbnail
      if (folder === 'products') {
        const thumbPath = path.join('uploads/products/thumbs', filename.replace('product-', 'thumb-'));
        try {
          await fs.unlink(thumbPath);
        } catch (thumbError) {
          // No es crítico si no existe el thumbnail
          console.log('Thumbnail no encontrado:', thumbPath);
        }
      }

      res.json({
        success: true,
        message: 'Archivo eliminado exitosamente'
      });

    } catch (fileError) {
      return res.status(404).json({
        success: false,
        message: 'Archivo no encontrado'
      });
    }

  } catch (error) {
    console.error('Error eliminando archivo:', error);
    res.status(500).json({
      success: false,
      message: 'Error eliminando archivo'
    });
  }
});

// GET /api/upload/gallery/:folder - Listar archivos de una carpeta (solo admin)
router.get('/gallery/:folder', adminAuth, async (req, res) => {
  try {
    const { folder } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    
    const allowedFolders = ['products', 'users', 'categories'];
    if (!allowedFolders.includes(folder)) {
      return res.status(400).json({
        success: false,
        message: 'Carpeta no válida'
      });
    }

    const folderPath = path.join('uploads', folder);
    
    try {
      const files = await fs.readdir(folderPath);
      const imageFiles = files.filter(file => 
        /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
      ).sort((a, b) => b.localeCompare(a)); // Más recientes primero

      // Paginación
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedFiles = imageFiles.slice(startIndex, endIndex);

      // Obtener información de archivos
      const fileInfo = await Promise.all(
        paginatedFiles.map(async (filename) => {
          try {
            const filePath = path.join(folderPath, filename);
            const stats = await fs.stat(filePath);
            
            return {
              filename,
              url: `/uploads/${folder}/${filename}`,
              size: stats.size,
              uploadDate: stats.birthtime,
              thumbnail: folder === 'products' ? 
                `/uploads/products/thumbs/${filename.replace('product-', 'thumb-')}` : 
                null
            };
          } catch (statError) {
            return null;
          }
        })
      );

      const validFiles = fileInfo.filter(file => file !== null);

      res.json({
        success: true,
        data: validFiles,
        pagination: {
          currentPage: page,
          totalItems: imageFiles.length,
          totalPages: Math.ceil(imageFiles.length / limit),
          itemsPerPage: limit
        }
      });

    } catch (readError) {
      return res.status(404).json({
        success: false,
        message: 'Carpeta no encontrada'
      });
    }

  } catch (error) {
    console.error('Error obteniendo galería:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo archivos'
    });
  }
});

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