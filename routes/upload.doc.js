# 📁 **Archivo: routes/upload.js**

## 📋 **Descripción General**
Este archivo define las rutas de una API RESTful para la gestión de uploads de archivos de imagen en una aplicación web. Implementa funcionalidades de carga, validación, organización y administración de imágenes para productos, avatares de usuarios y categorías. Utiliza Multer para el procesamiento de archivos multipart y incluye middleware de autenticación y autorización.

---

## 💻 **Código Comentado Línea por Línea**

```js
// routes/upload.js - Rutas de upload actualizadas con controladores

// Importación de Express para crear el enrutador
const express = require('express');

// Multer: middleware para manejar datos multipart/form-data (uploads de archivos)
const multer = require('multer');

// Path: utilidades para trabajar con rutas de archivos y directorios
const path = require('path');

// fs.promises: versión con promesas del sistema de archivos para operaciones asíncronas
const fs = require('fs').promises;

// Controlador que contiene la lógica de negocio para operaciones de upload
const UploadController = require('../controllers/uploadController');

// Middleware de autenticación: auth (usuarios) y adminAuth (administradores)
const { auth, adminAuth } = require('../middleware/auth');

// Crear una instancia del enrutador de Express
const router = express.Router();

// === CONFIGURACIÓN DE MULTER ===

// Configurar almacenamiento en memoria (archivos se guardan en RAM temporalmente)
// Esto permite procesar/validar archivos antes de guardarlos en disco
const storage = multer.memoryStorage();

// Función de filtrado de archivos para validar tipos permitidos
const fileFilter = (req, file, cb) => {
  // Array de tipos MIME permitidos (solo imágenes)
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  // Verificar si el tipo MIME del archivo está en la lista permitida
  if (allowedTypes.includes(file.mimetype)) {
    // Acepta el archivo (primer parámetro null = sin error, segundo true = aceptar)
    cb(null, true);
  } else {
    // Rechaza el archivo con un mensaje de error personalizado
    cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes.'), false);
  }
};

// Configuración principal de Multer con todas las opciones
const upload = multer({
  // Usar el almacenamiento en memoria configurado anteriormente
  storage,
  // Aplicar el filtro de tipos de archivo
  fileFilter,
  // Establecer límites de seguridad para los uploads
  limits: {
    // Tamaño máximo por archivo: valor de variable de entorno o 10MB por defecto
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    // Número máximo de archivos en un solo upload
    files: 5
  }
});

// === CREACIÓN DE ESTRUCTURA DE DIRECTORIOS ===

// Función asíncrona para asegurar que existan los directorios necesarios
const ensureDirectories = async () => {
  // Array con todas las rutas de directorios que la aplicación necesita
  const dirs = [
    'uploads',                    // Directorio raíz de uploads
    'uploads/products',           // Imágenes de productos
    'uploads/products/thumbs',    // Miniaturas de productos
    'uploads/users',              // Avatares de usuarios
    'uploads/categories'          // Imágenes de categorías
  ];
  
  // Iterar sobre cada directorio para verificar/crear
  for (const dir of dirs) {
    try {
      // Intentar acceder al directorio (verificar si existe)
      await fs.access(dir);
    } catch (error) {
      // Si no existe, crearlo recursivamente (crea directorios padre si es necesario)
      await fs.mkdir(dir, { recursive: true });
      // Log informativo de creación de directorio
      console.log(`📁 Directorio creado: ${dir}`);
    }
  }
};

// Ejecutar la creación de directorios inmediatamente
ensureDirectories();

// === DEFINICIÓN DE RUTAS DE UPLOAD ===

// Ruta para subir múltiples imágenes de productos (máximo 5)
// Requiere permisos de administrador
router.post('/products', adminAuth, upload.array('images', 5), UploadController.uploadProductImages);

// Ruta para subir avatar de usuario (una sola imagen)
// Requiere autenticación de usuario
router.post('/avatar', auth, upload.single('avatar'), UploadController.uploadAvatar);

// Ruta para subir imagen de categoría (una sola imagen)
// Requiere permisos de administrador
router.post('/categories', adminAuth, upload.single('image'), UploadController.uploadCategoryImage);

// Ruta para upload por lotes (máximo 10 archivos)
// Requiere permisos de administrador
router.post('/batch', adminAuth, upload.array('files', 10), UploadController.batchUpload);

// === RUTAS DE GESTIÓN DE ARCHIVOS (ADMINISTRACIÓN) ===

// Obtener galería de imágenes de una carpeta específica
// Parámetro dinámico :folder indica la carpeta a consultar
router.get('/gallery/:folder', adminAuth, UploadController.getGallery);

// Eliminar un archivo específico de una carpeta
// Parámetros dinámicos :folder y :filename para identificar el archivo
router.delete('/:folder/:filename', adminAuth, UploadController.deleteFile);

// Obtener estadísticas de uso de almacenamiento y uploads
router.get('/stats', adminAuth, UploadController.getUploadStats);

// Optimizar imágenes existentes (comprimir, redimensionar, etc.)
router.post('/optimize', adminAuth, UploadController.optimizeImages);

// === MIDDLEWARE DE MANEJO DE ERRORES ===

// Middleware específico para manejar errores de Multer
router.use((error, req, res, next) => {
  // Verificar si el error es específicamente de Multer
  if (error instanceof multer.MulterError) {
    // Mensaje de error por defecto
    let message = 'Error subiendo archivo';
    
    // Personalizar mensaje según el tipo de error de Multer
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        // Archivo excede el tamaño máximo permitido
        message = 'Archivo demasiado grande. Máximo permitido: 10MB';
        break;
      case 'LIMIT_FILE_COUNT':
        // Se intentaron subir más archivos de los permitidos
        message = 'Demasiados archivos. Máximo permitido: 5 archivos';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        // Se recibió un campo de archivo no esperado
        message = 'Campo de archivo no esperado';
        break;
    }
    
    // Responder con error 400 (Bad Request) y mensaje específico
    return res.status(400).json({
      success: false,
      message
    });
  }
  
  // Manejar errores del filtro de archivos (tipos no permitidos)
  if (error.message.includes('Tipo de archivo no permitido')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  // Si no es un error conocido, pasarlo al siguiente middleware de error
  next(error);