// routes/upload.js - Subidas seguras a Cloudinary (Vercel Ready)
import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';
import { auth, adminAuth } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import  validateImage  from '../middleware/validateImage.js';


const router = express.Router();

// ----------------------------
// Cloudinary se configura en cada request para asegurar que
// las env vars ya fueron cargadas por dotenv (problema de hoisting ESM)
// ----------------------------
const getCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return cloudinary;
};

// ----------------------------
// Configuración de multer
// ----------------------------
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes.'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    files: 5,
  },
});

// ----------------------------
// Función auxiliar de subida
// ----------------------------
const uploadToCloudinary = (fileBuffer, folder, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder,
      resource_type: 'image',
      quality: 'auto:good',
      fetch_format: 'auto',
      secure: true,
      ...options,
    };

    const uploadStream = getCloudinary().uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });

    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};

// ----------------------------
// Rutas
// ----------------------------

// Subida de imágenes de productos
router.post('/products', auth, adminAuth, upload.any(), validateImage, async (req, res) => {
  try {
    if (!req.files?.length) {
      return res.status(400).json({ success: false, message: 'No se subieron archivos' });
    }
    if (req.files.length > 5) {
      return res.status(400).json({ success: false, message: 'Máximo 5 imágenes por producto' });
    }

    const results = await Promise.all(
      req.files.map(async (file) => {
        const result = await uploadToCloudinary(file.buffer, 'products');
        return {
          url: result.secure_url,
          public_id: result.public_id,
          format: result.format,
          size: result.bytes,
          width: result.width,
          height: result.height,
        };
      })
    );

    logger.info('Imágenes de producto subidas a Cloudinary', {
      userId: req.user?.id,
      count: results.length,
      publicIds: results.map((r) => r.public_id),
    });

    res.json({
      success: true,
      message: 'Imágenes subidas correctamente',
      results,
    });
  } catch (error) {
    logger.error('Error subiendo imágenes a Cloudinary', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Error subiendo imágenes', errorCode: 'CLOUDINARY_UPLOAD_ERROR' });
  }
});

// Subida de avatar
router.post('/avatar', auth, upload.single('avatar'),validateImage, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No se subió archivo' });

    const result = await uploadToCloudinary(req.file.buffer, 'users', {
      transformation: [
        { width: 200, height: 200, crop: 'thumb', gravity: 'face' },
        { radius: 'max' },
      ],
    });

    logger.info('Avatar subido a Cloudinary', { userId: req.user?.id, publicId: result.public_id });

    res.json({
      success: true,
      message: 'Avatar subido exitosamente',
      result: {
        url: result.secure_url,
        public_id: result.public_id,
        size: result.bytes,
      },
    });
  } catch (error) {
    logger.error('Error subiendo avatar', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Error subiendo avatar', errorCode: 'AVATAR_UPLOAD_ERROR' });
  }
});

// Subida de imágenes de categorías
router.post('/categories', auth, adminAuth, upload.single('image'), validateImage, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No se subió archivo' });

    const result = await uploadToCloudinary(req.file.buffer, 'categories', {
      transformation: [{ width: 600, height: 400, crop: 'fill' }, { quality: 'auto' }],
    });

    logger.info('Imagen de categoría subida', { userId: req.user?.id, publicId: result.public_id });

    res.json({
      success: true,
      message: 'Imagen de categoría subida correctamente',
      result: {
        url: result.secure_url,
        public_id: result.public_id,
        size: result.bytes,
      },
    });
  } catch (error) {
    logger.error('Error subiendo imagen de categoría', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Error subiendo imagen de categoría', errorCode: 'CATEGORY_UPLOAD_ERROR' });
  }
});

// Ver uso de Cloudinary
router.get('/usage', auth, adminAuth, async (req, res) => {
  try {
    const usage = await getCloudinary().api.usage();
    res.json({
      success: true,
      usage: {
        account: usage.account_id,
        plan: usage.plan,
        used_bytes: usage.used_bytes,
        limit_bytes: usage.limit_bytes,
        used_percent: ((usage.used_bytes / usage.limit_bytes) * 100).toFixed(2),
      },
    });
  } catch (error) {
    logger.error('Error obteniendo uso de Cloudinary', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Error obteniendo uso', errorCode: 'CLOUDINARY_USAGE_ERROR' });
  }
});

// Eliminar archivo de Cloudinary
router.delete('/:public_id', auth, adminAuth, async (req, res) => {
  try {
    const { public_id } = req.params;

    if (!public_id || typeof public_id !== 'string' || public_id.length > 255) {
      return res.status(400).json({ success: false, message: 'Public ID inválido' });
    }

    const result = await getCloudinary().uploader.destroy(public_id);
    if (result.result === 'ok') {
      logger.info('Archivo eliminado de Cloudinary', { userId: req.user?.id, publicId: public_id });
      res.json({ success: true, message: 'Archivo eliminado exitosamente' });
    } else {
      res.status(404).json({ success: false, message: 'Archivo no encontrado en Cloudinary' });
    }
  } catch (error) {
    logger.error('Error eliminando archivo de Cloudinary', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Error eliminando archivo', errorCode: 'CLOUDINARY_DELETE_ERROR' });
  }
});

// Manejo de errores de multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    let message = 'Error subiendo archivo';
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'Archivo demasiado grande. Máximo permitido: 10MB';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Demasiados archivos. Máximo 5 archivos';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Campo de archivo no esperado';
        break;
    }
    return res.status(400).json({ success: false, message });
  }

  if (error.message.includes('Tipo de archivo no permitido')) {
    return res.status(400).json({ success: false, message: error.message });
  }

  logger.error('Error general en subida', { error: error.message, stack: error.stack });
  res.status(500).json({ success: false, message: 'Error interno del servidor', errorCode: 'UPLOAD_GENERAL_ERROR' });
});

export default router;
