```javascript
/**
 * 📋 DESCRIPCIÓN GENERAL DEL ARCHIVO
 * 
 * middleware/auth.js - Sistema de Middlewares de Autenticación y Autorización
 * 
 * Este archivo implementa tres middlewares de seguridad para una aplicación Express.js:
 * 
 * 1. 🔐 auth: Middleware básico que valida tokens JWT obligatorios
 * 2. 👑 adminAuth: Extiende auth verificando permisos de administrador
 * 3. 🔓 optionalAuth: Detecta autenticación si existe, pero no la requiere
 * 
 * Funcionalidades principales:
 * - Validación de tokens JWT
 * - Verificación de usuarios activos en base de datos
 * - Control de acceso basado en roles
 * - Manejo de errores de autenticación
 * - Inyección de datos de usuario en el objeto request
 */

// middleware/auth.js - Middleware de autenticación
const jwt = require('jsonwebtoken'); // Importa la librería para manejar JSON Web Tokens
const User = require('../models/User'); // Importa el modelo de usuario de la base de datos

// Middleware de autenticación básico - REQUIERE token válido para continuar
const auth = async (req, res, next) => {
  try {
    // Extrae el token del header 'Authorization' de la petición HTTP
    let token = req.header('Authorization');

    // Verificar si existe el token en la petición
    if (!token) {
      // Si no hay token, denegar acceso con código 401 (No autorizado)
      return res.status(401).json({
        success: false,
        message: 'Acceso denegado. Token no proporcionado.'
      });
    }

    // Remover el prefijo 'Bearer ' del token si está presente
    if (token.startsWith('Bearer ')) {
      // Extrae solo la parte del token, removiendo 'Bearer ' (7 caracteres)
      token = token.slice(7, token.length);
    }

    // Verificar y decodificar el token JWT usando la clave secreta
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar el usuario en la base de datos usando el ID del token decodificado
    const user = await User.findById(decoded.userId);
    // Si el usuario no existe en la base de datos
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido. Usuario no encontrado.'
      });
    }

    // Verificar si el usuario está activo (no ha sido deshabilitado)
    if (!user.isActive) {
      // Si la cuenta está desactivada, denegar acceso con código 403 (Prohibido)
      return res.status(403).json({
        success: false,
        message: 'Cuenta desactivada.'
      });
    }

    // Agregar el ID del usuario al objeto request para uso posterior
    req.userId = user._id;
    // Agregar el objeto completo del usuario al request
    req.user = user;
    // Continuar al siguiente middleware o ruta
    next();

  } catch (error) {
    // Manejo específico para errores de JWT inválido
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido.'
      });
    }

    // Manejo específico para tokens expirados
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado.'
      });
    }

    // ⚠️ VULNERABILIDAD: Loguea errores completos que pueden exponer información sensible
    console.error('Error en middleware auth:', error);
    // Respuesta genérica para errores no manejados específicamente
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor.'
    });
  }
};

// Middleware para verificar permisos de administrador - REQUIERE ser admin
const adminAuth = async (req, res, next) => {
  try {
    // Ejecutar el middleware auth básico primero usando Promises
    await new Promise((resolve, reject) => {
      // Llama al middleware auth y espera su resultado
      auth(req, res, (err) => {
        // Si auth falla, rechazar la promesa
        if (err) reject(err);
        // Si auth es exitoso, resolver la promesa
        else resolve();
      });
    });

    // Verificar si el usuario autenticado tiene rol de administrador
    if (req.user.role !== 'admin') {
      // Si no es admin, denegar acceso con código 403 (Prohibido)
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Se requieren permisos de administrador.'
      });
    }

    // Si es admin, continuar al siguiente middleware o ruta
    next();

  } catch (error) {
    // ⚠️ VULNERABILIDAD: Loguea errores completos potencialmente sensibles
    console.error('Error en middleware adminAuth:', error);
    // Respuesta genérica para errores
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor.'
    });
  }
};

// Middleware opcional - Detecta autenticación si existe, pero NO LA REQUIERE
const optionalAuth = async (req, res, next) => {
  try {
    // Intentar extraer token del header Authorization
    let token = req.header('Authorization');

    // Si no hay token, establecer usuario como null y continuar
    if (!token) {
      req.userId = null; // No hay usuario autenticado
      req.user = null;   // No hay datos de usuario
      return next();     // Continuar sin error
    }

    // Remover prefijo 'Bearer ' si existe
    if (token.startsWith('Bearer ')) {
      token = token.slice(7, token.length);
    }

    try {
      // Intentar verificar el token JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // Buscar usuario en la base de datos
      const user = await User.findById(decoded.userId);
      
      // Si el usuario existe y está activo, agregarlo al request
      if (user && user.isActive) {
        req.userId = user._id; // Establecer ID de usuario
        req.user = user;       // Establecer datos completos del usuario
      }
    } catch (tokenError) {
      // Token inválido pero no es error crítico en modo opcional
      // Continuar como usuario no autenticado
      req.userId = null;
      req.user = null;
    }

    // Siempre continuar, sin importar si la autenticación falló
    next();

  } catch (error) {
    // En caso de error, loguear pero no bloquear la petición
    console.error('Error en middleware optionalAuth:', error);
    // Establecer como usuario no autenticado
    req.userId = null;
    req.user = null;
    // Continuar sin error
    next();
  }
};

// Exportar los tres middlewares para uso en otras partes de la aplicación
module.exports = {
  auth,        // Middleware de autenticación obligatoria
  adminAuth,   // Middleware de verificación de admin
  optionalAuth // Middleware de autenticación opcional
};
```

## 🚨 **VULNERABILIDADES IDENTIFICADAS**

### **CRÍTICAS** 🔴
1. **Líneas 55-56 & 84**: Exposición de información sensible en