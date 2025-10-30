// middleware/auth.js - Middleware de autenticación
// middleware/auth.js - Middleware de autenticación
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";


// Middleware de autenticación básico
const auth = async (req, res, next) => {
  try {
      console.log('🔍 Headers recibidos:', req.headers);
    let token = req.headers.authorization || req.header('Authorization');

    // Verificar si existe el token
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Acceso denegado. Token no proporcionado.'
      });
    }
    // Validar formato básico del token
    if (!token || typeof token !== 'string' || token.length < 10) {
      return res.status(401).json({
        success: false,
        message: 'Formato de token inválido.'
      });
    }

    // Remover 'Bearer ' del token
    if (token.startsWith('Bearer ')) {
      token = token.slice(7, token.length);
    }

    // Verificar token
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET no está configurado');
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
           console.log('✅ Token decodificado:', decoded); // <-- AGREGA ESTO
    // Buscar usuario
    // Validar que userId es un string válido de ObjectId
      if (!decoded.userId || typeof decoded.userId !== 'string') {
        throw new Error('Invalid userId format');
      }

    if (!mongoose.Types.ObjectId.isValid(decoded.userId)) {
      throw new Error('Invalid ObjectId format');
    }

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

    console.error('Error en middleware auth:', {
      name: error.name,
      message: error.message,
      userId: req.userId || 'unknown',
      timestamp: new Date().toISOString()
    });
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
  if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autenticación requerida.'
      });
    }

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

export default  {
  auth,
  adminAuth,
  optionalAuth
};
export { auth, adminAuth, optionalAuth };