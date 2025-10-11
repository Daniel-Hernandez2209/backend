```js
/**
 * controllers/uploadController.js - Controlador de subida de archivos para ATHENA BRAND
 * 
 * DESCRIPCIÓN GENERAL:
 * Este controlador maneja todas las operaciones relacionadas con la subida, procesamiento
 * y gestión de archivos de imagen en la aplicación ATHENA BRAND. Utiliza la librería Sharp
 * para el procesamiento de imágenes y proporciona endpoints para:
 * - Subida de imágenes de productos con generación automática de thumbnails
 * - Gestión de avatares de usuario
 * - Imágenes de categorías
 * - Operaciones CRUD (eliminar archivos, galería, estadísticas)
 * - Funciones avanzadas (subida en lote, optimización de imágenes existentes)
 * 
 * ⚠️  ADVERTENCIA DE SEGURIDAD:
 * Este código contiene múltiples vulnerabilidades críticas que deben ser corregidas
 * antes de su implementación en producción. Ver comentarios de seguridad en líneas específicas.
 */

// Importación de librerías necesarias
const sharp = require('sharp');           // Librería para procesamiento de imágenes
const path = require('path');            // Módulo para manipulación de rutas de archivos
const fs = require('fs').promises;       // Módulo del sistema de archivos con promesas

class UploadController {
  // Función para generar nombre único de archivo
  static generateFileName(originalName, prefix = '') {
    const timestamp = Date.now();                                    // Timestamp actual en milisegundos
    const random = Math.random().toString(36).substring(2, 8);      // String aleatorio de 6 caracteres
    const ext = path.extname(originalName).toLowerCase();           // Extensión del archivo en minúsculas
    return `${prefix}${timestamp}-${random}${ext}`;                 // Combina prefix + timestamp + random + extensión
    // 🔴 VULNERABILIDAD: Condición de carrera - nombres pueden duplicarse
  }

  // Función para procesar imagen con Sharp
  static async processImage(buffer, options = {}) {
    // Destructuring de opciones con valores por defecto
    const {
      width = 800,        // Ancho por defecto
      height = 800,       // Alto por defecto
      quality = 85,       // Calidad por defecto
      format = 'jpeg'     // Formato por defecto
    } = options;
    
    let sharpInstance = sharp(buffer);      // Crear instancia de Sharp con el buffer de la imagen
    
    // Redimensionar manteniendo proporción
    sharpInstance = sharpInstance
      .resize(width, height, {              // Redimensionar a dimensiones especificadas
        fit: 'inside',                      // Mantener proporción dentro de las dimensiones
        withoutEnlargement: true            // No agrandar imágenes más pequeñas
      });
    
    // Aplicar formato y calidad según el tipo especificado
    switch (format) {
      case 'jpeg':
      case 'jpg':
        sharpInstance = sharpInstance.jpeg({ quality });    // Aplicar compresión JPEG
        break;
      case 'png':
        sharpInstance = sharpInstance.png({ quality });     // Aplicar compresión PNG
        break;
      case 'webp':
        sharpInstance = sharpInstance.webp({ quality });    // Aplicar compresión WebP
        break;
    }
    
    return await sharpInstance.toBuffer();  // Convertir a buffer y retornar
    // 🔴 VULNERABILIDAD: No hay validación de tipo de archivo - acepta cualquier buffer
  }

  // POST /api/upload/products - Subir imágenes de productos (solo admin)
  static async uploadProductImages(req, res) {
    try {
      // Verificar si se subieron archivos
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({                       // Respuesta HTTP 400 Bad Request
          success: false,
          message: 'No se subieron archivos'
        });
      }
      // 🔴 VULNERABILIDAD: No hay validación de autorización - cualquiera puede subir

      const uploadedFiles = [];                             // Array para almacenar información de archivos subidos
      
      // Procesar cada archivo subido
      for (const file of req.files) {
        // Generar nombres de archivos únicos
        const fileName = UploadController.generateFileName(file.originalname, 'product-');  // Nombre principal
        const thumbName = UploadController.generateFileName(file.originalname, 'thumb-');   // Nombre del thumbnail
        
        // Construir rutas de archivos
        const filePath = path.join('uploads/products', fileName);           // Ruta del archivo principal
        const thumbPath = path.join('uploads/products/thumbs', thumbName);  // Ruta del thumbnail
        
        try {
          // Procesar imagen principal (800x800)
          const processedImage = await UploadController.processImage(file.buffer, {
            width: 800,
            height: 800,
            quality: 85
          });
          // 🔴 VULNERABILIDAD: No hay validación de tamaño - puede causar DoS
          
          // Procesar thumbnail (300x300)
          const thumbnail = await UploadController.processImage(file.buffer, {
            width: 300,
            height: 300,
            quality: 80
          });
          
          // Guardar archivos en el sistema de archivos
          await fs.writeFile(filePath, processedImage);     // Escribir imagen principal
          await fs.writeFile(thumbPath, thumbnail);         // Escribir thumbnail
          
          // Agregar información del archivo al array de respuesta
          uploadedFiles.push({
            url: `/uploads/products/${fileName}`,           // URL pública del archivo
            thumbnail: `/uploads/products/thumbs/${thumbName}`, // URL del thumbnail
            originalName: file.originalname,                // Nombre original del archivo
            size: processedImage.length,                    // Tamaño del archivo procesado
            alt: req.body.alt || ''                        // Texto alternativo
            // 🔴 VULNERABILIDAD XSS: originalName y alt no están sanitizados
          });
          
        } catch (processError) {
          console.error('Error procesando imagen:', processError);          // Log del error
          throw new Error(`Error procesando ${file.originalname}: ${processError.message}`);
        }
      }

      // Respuesta exitosa
      res.json({
        success: true,
        message: `${uploadedFiles.length} imagen(es) subidas exitosamente`,
        data: uploadedFiles
      });

    } catch (error) {
      console.error('Error subiendo imágenes de productos:', error);       // Log del error
      res.status(500).json({                                              // Respuesta HTTP 500 Internal Server Error
        success: false,
        message: 'Error subiendo imágenes',
        error: process.env.NODE_ENV === 'development' ? error.message : {}  // Solo mostrar detalles en desarrollo
        // 🔴 VULNERABILIDAD: Exposición de información sensible en modo desarrollo
      });
    }
  }

  // POST /api/upload/avatar - Subir avatar de usuario
  static async uploadAvatar(req, res) {
    try {
      // Verificar si se subió un archivo
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No se subió archivo'
        });
      }

      // Generar nombre único para el avatar usando el ID del usuario
      const fileName = UploadController.generateFileName(req.file.originalname, `user-${req.userId}-`);