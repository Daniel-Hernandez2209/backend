// middleware/validateImage.js
const sharp = import('sharp');
const path = import('path');

/**
 * Middleware avanzado para validar imágenes antes de subirlas a Cloudinary.
 * Protege contra:
 *  - Tipos de archivos no permitidos
 *  - Extensiones sospechosas (ej: .php, .exe, .bat)
 *  - Tamaño excesivo (> 10MB o según configuración)
 *  - Imágenes demasiado pequeñas o grandes
 *  - Archivos manipulados o corruptos
 */
module.exports = async function validateImage(req, res, next) {
  try {
    if (!req.file && !req.files) {
      return res.status(400).json({
        success: false,
        message: 'No se encontró ningún archivo para validar',
      });
    }

    const files = req.files || [req.file];

    // ⚙️ Configuración global (puedes ajustar según tus necesidades)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const forbiddenExtensions = ['.php', '.exe', '.bat', '.cmd', '.sh', '.js', '.py'];
    const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10 MB
    const minWidth = 150;
    const minHeight = 150;
    const maxWidth = 5000;
    const maxHeight = 5000;

    for (const file of files) {
      // 1️⃣ Verificar extensión del archivo
      const ext = path.extname(file.originalname).toLowerCase();
      if (forbiddenExtensions.includes(ext)) {
        return res.status(400).json({
          success: false,
          message: `Extensión no permitida (${ext}) en archivo "${file.originalname}"`,
        });
      }

      if (!allowedExtensions.includes(ext)) {
        return res.status(400).json({
          success: false,
          message: `Solo se permiten imágenes con extensiones: ${allowedExtensions.join(', ')}`,
        });
      }

      // 2️⃣ Validar tipo MIME
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: `Tipo MIME no permitido (${file.mimetype}). Solo se permiten imágenes.`,
        });
      }

      // 3️⃣ Validar tamaño del archivo
      if (file.size > maxSize) {
        return res.status(400).json({
          success: false,
          message: `El archivo "${file.originalname}" excede el tamaño máximo (${(maxSize / (1024 * 1024)).toFixed(1)} MB).`,
        });
      }

      // 4️⃣ Validar dimensiones con sharp
      let metadata;
      try {
        metadata = await sharp(file.buffer).metadata();
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: `El archivo "${file.originalname}" no es una imagen válida o está corrupta.`,
        });
      }

      if (metadata.width < minWidth || metadata.height < minHeight) {
        return res.status(400).json({
          success: false,
          message: `La imagen "${file.originalname}" es demasiado pequeña (${metadata.width}x${metadata.height}). Mínimo ${minWidth}x${minHeight}px.`,
        });
      }

      if (metadata.width > maxWidth || metadata.height > maxHeight) {
        return res.status(400).json({
          success: false,
          message: `La imagen "${file.originalname}" excede las dimensiones máximas permitidas (${metadata.width}x${metadata.height}). Máximo ${maxWidth}x${maxHeight}px.`,
        });
      }
    }

    // ✅ Si pasa todas las validaciones, continuar
    next();
  } catch (error) {
    console.error('❌ Error en validación de imagen:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno validando imagen',
      errorCode: 'VALIDATE_IMAGE_ERROR',
    });
  }
};


export default  validateImage;