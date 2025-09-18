// controllers/uploadController.js - Controlador de subida de archivos para ATHENA BRAND
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

class UploadController {
  // Función para generar nombre único de archivo
  static generateFileName(originalName, prefix = '') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(originalName).toLowerCase();
    return `${prefix}${timestamp}-${random}${ext}`;
  }

  // Función para procesar imagen con Sharp
  static async processImage(buffer, options = {}) {
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
  }

  // POST /api/upload/products - Subir imágenes de productos (solo admin)
  static async uploadProductImages(req, res) {
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
        const fileName = UploadController.generateFileName(file.originalname, 'product-');
        const thumbName = UploadController.generateFileName(file.originalname, 'thumb-');
        
        // Rutas de archivos
        const filePath = path.join('uploads/products', fileName);
        const thumbPath = path.join('uploads/products/thumbs', thumbName);
        
        try {
          // Procesar imagen principal (800x800)
          const processedImage = await UploadController.processImage(file.buffer, {
            width: 800,
            height: 800,
            quality: 85
          });
          
          // Procesar thumbnail (300x300)
          const thumbnail = await UploadController.processImage(file.buffer, {
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
  }

  // POST /api/upload/avatar - Subir avatar de usuario
  static async uploadAvatar(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No se subió archivo'
        });
      }

      const fileName = UploadController.generateFileName(req.file.originalname, `user-${req.userId}-`);
      const filePath = path.join('uploads/users', fileName);

      // Procesar imagen de avatar (200x200, circular)
      const processedImage = await UploadController.processImage(req.file.buffer, {
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
  }

  // POST /api/upload/categories - Subir imágenes de categorías (solo admin)
  static async uploadCategoryImage(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No se subió archivo'
        });
      }

      const fileName = UploadController.generateFileName(req.file.originalname, 'category-');
      const filePath = path.join('uploads/categories', fileName);

      // Procesar imagen de categoría (600x400 para banners)
      const processedImage = await UploadController.processImage(req.file.buffer, {
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
  }

  // DELETE /api/upload/:folder/:filename - Eliminar archivo (solo admin)
  static async deleteFile(req, res) {
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
  }

  // GET /api/upload/gallery/:folder - Listar archivos de una carpeta (solo admin)
  static async getGallery(req, res) {
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
  }

  // POST /api/upload/batch - Subida en lote de imágenes
  static async batchUpload(req, res) {
    try {
      const { folder } = req.body;
      
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No se subieron archivos'
        });
      }

      const allowedFolders = ['products', 'categories'];
      if (!allowedFolders.includes(folder)) {
        return res.status(400).json({
          success: false,
          message: 'Carpeta no válida para subida en lote'
        });
      }

      const uploadedFiles = [];
      const errors = [];

      for (const file of req.files) {
        try {
          const fileName = UploadController.generateFileName(file.originalname, `${folder}-`);
          const filePath = path.join('uploads', folder, fileName);
          
          // Configuración específica por tipo de carpeta
          let processOptions = {};
          if (folder === 'products') {
            processOptions = { width: 800, height: 800, quality: 85 };
          } else if (folder === 'categories') {
            processOptions = { width: 600, height: 400, quality: 85 };
          }

          const processedImage = await UploadController.processImage(file.buffer, processOptions);
          await fs.writeFile(filePath, processedImage);
          
          uploadedFiles.push({
            originalName: file.originalname,
            url: `/uploads/${folder}/${fileName}`,
            size: processedImage.length
          });
          
        } catch (fileError) {
          errors.push({
            filename: file.originalname,
            error: fileError.message
          });
        }
      }

      res.json({
        success: true,
        message: `Subida en lote completada. ${uploadedFiles.length} archivos procesados.`,
        data: {
          uploaded: uploadedFiles,
          errors: errors
        }
      });

    } catch (error) {
      console.error('Error en subida en lote:', error);
      res.status(500).json({
        success: false,
        message: 'Error en subida en lote'
      });
    }
  }

  // GET /api/upload/stats - Estadísticas de archivos subidos
  static async getUploadStats(req, res) {
    try {
      const folders = ['products', 'users', 'categories'];
      const stats = {};

      for (const folder of folders) {
        try {
          const folderPath = path.join('uploads', folder);
          const files = await fs.readdir(folderPath);
          const imageFiles = files.filter(file => 
            /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
          );

          let totalSize = 0;
          for (const file of imageFiles) {
            try {
              const filePath = path.join(folderPath, file);
              const stat = await fs.stat(filePath);
              totalSize += stat.size;
            } catch (statError) {
              // Ignorar archivos que no se pueden leer
            }
          }

          stats[folder] = {
            count: imageFiles.length,
            totalSize: totalSize,
            averageSize: imageFiles.length > 0 ? Math.round(totalSize / imageFiles.length) : 0
          };

        } catch (folderError) {
          stats[folder] = {
            count: 0,
            totalSize: 0,
            averageSize: 0
          };
        }
      }

      // Calcular totales
      const totalFiles = Object.values(stats).reduce((sum, folder) => sum + folder.count, 0);
      const totalSize = Object.values(stats).reduce((sum, folder) => sum + folder.totalSize, 0);

      res.json({
        success: true,
        data: {
          byFolder: stats,
          totals: {
            files: totalFiles,
            size: totalSize,
            averageSize: totalFiles > 0 ? Math.round(totalSize / totalFiles) : 0
          }
        }
      });

    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo estadísticas'
      });
    }
  }

  // POST /api/upload/optimize - Optimizar imágenes existentes
  static async optimizeImages(req, res) {
    try {
      const { folder, quality = 80 } = req.body;
      
      const allowedFolders = ['products', 'categories'];
      if (!allowedFolders.includes(folder)) {
        return res.status(400).json({
          success: false,
          message: 'Carpeta no válida para optimización'
        });
      }

      const folderPath = path.join('uploads', folder);
      const files = await fs.readdir(folderPath);
      const imageFiles = files.filter(file => 
        /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
      );

      let optimizedCount = 0;
      let totalSaved = 0;

      for (const filename of imageFiles) {
        try {
          const filePath = path.join(folderPath, filename);
          const originalBuffer = await fs.readFile(filePath);
          const originalSize = originalBuffer.length;

          const optimizedBuffer = await UploadController.processImage(originalBuffer, {
            quality: parseInt(quality)
          });

          if (optimizedBuffer.length < originalSize) {
            await fs.writeFile(filePath, optimizedBuffer);
            totalSaved += (originalSize - optimizedBuffer.length);
            optimizedCount++;
          }

        } catch (fileError) {
          console.error(`Error optimizando ${filename}:`, fileError);
        }
      }

      res.json({
        success: true,
        message: `Optimización completada`,
        data: {
          filesProcessed: imageFiles.length,
          filesOptimized: optimizedCount,
          bytesSaved: totalSaved,
          percentageSaved: imageFiles.length > 0 ? 
            ((optimizedCount / imageFiles.length) * 100).toFixed(2) : 0
        }
      });

    } catch (error) {
      console.error('Error optimizando imágenes:', error);
      res.status(500).json({
        success: false,
        message: 'Error optimizando imágenes'
      });
    }
  }
}

module.exports = UploadController;