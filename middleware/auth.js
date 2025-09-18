// middleware/auth.js - Middleware de autenticación
// middleware/auth.js - Middleware de autenticación
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware de autenticación básico
const auth = async (req, res, next) => {
  try {
    let token = req.header('Authorization');

    // Verificar si existe el token
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Acceso denegado. Token no proporcionado.'
      });
    }

    // Remover 'Bearer ' del token
    if (token.startsWith('Bearer ')) {
      token = token.slice(7, token.length);
    }

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar usuario
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido. Usuario no encontrado.'
      });
    }

    // Verificar si el usuario está activo
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Cuenta desactivada.'
      });
    }

    // Agregar usuario a la request
    req.userId = user._id;
    req.user = user;
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido.'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado.'
      });
    }

    console.error('Error en middleware auth:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor.'
    });
  }
};

// Middleware para verificar si es admin
const adminAuth = async (req, res, next) => {
  try {
    // Primero ejecutar auth básico
    await new Promise((resolve, reject) => {
      auth(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Verificar si es admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Se requieren permisos de administrador.'
      });
    }

    next();

  } catch (error) {
    console.error('Error en middleware adminAuth:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor.'
    });
  }
};

// Middleware opcional - no requiere autenticación pero la detecta
const optionalAuth = async (req, res, next) => {
  try {
    let token = req.header('Authorization');

    if (!token) {
      req.userId = null;
      req.user = null;
      return next();
    }

    if (token.startsWith('Bearer ')) {
      token = token.slice(7, token.length);
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      
      if (user && user.isActive) {
        req.userId = user._id;
        req.user = user;
      }
    } catch (tokenError) {
      // Token inválido pero no es error, continúa como usuario no autenticado
      req.userId = null;
      req.user = null;
    }

    next();

  } catch (error) {
    console.error('Error en middleware optionalAuth:', error);
    req.userId = null;
    req.user = null;
    next();
  }
};

module.exports = {
  auth,
  adminAuth,
  optionalAuth
};