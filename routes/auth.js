// routes/auth.js - Rutas de autenticación para ATHENA BRAND
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const {auth} = require('../middleware/auth');
const sendEmail = require('../utils/sendEmail');

const router = express.Router();

// Rate limiting para auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 intentos por ventana
  message: {
    success: false,
    message: 'Demasiados intentos de login. Intenta de nuevo en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validaciones
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email no válido'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres'),
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El apellido debe tener entre 2 y 50 caracteres'),
  body('phone')
    .optional()
    .matches(/^[+]?[\d\s\-\(\)]+$/)
    .withMessage('Número de teléfono no válido')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email no válido'),
  body('password')
    .notEmpty()
    .withMessage('La contraseña es requerida')
];

// Función para generar JWT
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

// POST /api/auth/register - Registro de usuario
router.post('/register', registerValidation, async (req, res) => {
  try {
    // Verificar errores de validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de registro inválidos',
        errors: errors.array()
      });
    }

    const { email, password, firstName, lastName, phone, address } = req.body;

    // Verificar si el usuario ya existe
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe una cuenta con este email'
      });
    }

    // Crear nuevo usuario
    const user = new User({
      email,
      password,
      firstName,
      lastName,
      phone,
      address
    });

    // Generar token de verificación
    const verificationToken = user.generateVerificationToken();
    
    await user.save();

    // Enviar email de verificación
    try {
      await sendEmail({
        to: user.email,
        subject: 'Verificar cuenta - ATHENA BRAND',
        template: 'verification',
        data: {
          firstName: user.firstName,
          verificationToken,
          verificationUrl: `${process.env.FRONTEND_URL}/verificar-cuenta?token=${verificationToken}`
        }
      });
    } catch (emailError) {
      console.error('Error enviando email de verificación:', emailError);
      // No fallar el registro si el email falla
    }

    // Generar JWT
    const token = generateToken(user._id);

    // Respuesta sin contraseña
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.verificationToken;
    delete userResponse.verificationTokenExpires;

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente. Revisa tu email para verificar tu cuenta.',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
});

// POST /api/auth/login - Login de usuario
router.post('/login', authLimiter, loginValidation, async (req, res) => {
  try {
    // Verificar errores de validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de login inválidos',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Buscar usuario con contraseña
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Verificar si la cuenta está bloqueada
    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        message: 'Cuenta temporalmente bloqueada debido a múltiples intentos de login fallidos'
      });
    }

    // Verificar contraseña
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      // Incrementar intentos fallidos
      await user.incrementLoginAttempts();
      
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Verificar si la cuenta está activa
    if (!user.isActive) {
      return res.status(423).json({
        success: false,
        message: 'Cuenta desactivada. Contacta al soporte.'
      });
    }

    // Login exitoso - resetear intentos fallidos
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Actualizar último login
    user.lastLogin = new Date();
    await user.save();

    // Generar JWT
    const token = generateToken(user._id);

    // Respuesta sin datos sensibles
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.loginAttempts;
    delete userResponse.lockUntil;
    delete userResponse.verificationToken;
    delete userResponse.verificationTokenExpires;
    delete userResponse.passwordResetToken;
    delete userResponse.passwordResetExpires;

    res.json({
      success: true,
      message: 'Login exitoso',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
});

// GET /api/auth/me - Obtener perfil del usuario logueado
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('-password -loginAttempts -lockUntil -verificationToken -passwordResetToken')
      .populate('wishlist', 'name slug images price discountPrice');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// PUT /api/auth/profile - Actualizar perfil
router.put('/profile', auth, [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }),
  body('phone')
    .optional()
    .matches(/^[+]?[\d\s\-\(\)]+$/),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos inválidos',
        errors: errors.array()
      });
    }

    const allowedUpdates = ['firstName', 'lastName', 'phone', 'address', 'birthDate', 'gender', 'preferences'];
    const updates = {};
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.userId,
      updates,
      { new: true, runValidators: true }
    ).select('-password -loginAttempts -lockUntil -verificationToken -passwordResetToken');

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      user
    });

  } catch (error) {
    console.error('Error actualizando perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// POST /api/auth/verify-email - Verificar email
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token de verificación requerido'
      });
    }

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Token de verificación inválido o expirado'
      });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    
    await user.save();

    res.json({
      success: true,
      message: 'Email verificado exitosamente'
    });

  } catch (error) {
    console.error('Error verificando email:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// POST /api/auth/forgot-password - Solicitar reseteo de contraseña
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Email no válido'
      });
    }

    const { email } = req.body;
    const user = await User.findByEmail(email);

    if (!user) {
      // Por seguridad, siempre responder success
      return res.json({
        success: true,
        message: 'Si el email existe, se ha enviado un enlace de recuperación'
      });
    }

    const resetToken = user.generatePasswordResetToken();
    await user.save();

    try {
      await sendEmail({
        to: user.email,
        subject: 'Resetear contraseña - ATHENA BRAND',
        template: 'password-reset',
        data: {
          firstName: user.firstName,
          resetToken,
          resetUrl: `${process.env.FRONTEND_URL}/resetear-password?token=${resetToken}`
        }
      });
    } catch (emailError) {
      console.error('Error enviando email de reset:', emailError);
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
      
      return res.status(500).json({
        success: false,
        message: 'Error enviando email de recuperación'
      });
    }

    res.json({
      success: true,
      message: 'Se ha enviado un enlace de recuperación a tu email'
    });

  } catch (error) {
    console.error('Error en forgot password:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// POST /api/auth/reset-password - Resetear contraseña
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Token requerido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos inválidos',
        errors: errors.array()
      });
    }

    const { token, password } = req.body;

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Token de reset inválido o expirado'
      });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    
    await user.save();

    res.json({
      success: true,
      message: 'Contraseña restablecida exitosamente'
    });

  } catch (error) {
    console.error('Error en reset password:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// POST /api/auth/logout - Logout (opcional, más para limpiar tokens del cliente)
router.post('/logout', auth, (req, res) => {
  res.json({
    success: true,
    message: 'Logout exitoso'
  });
});

module.exports = router;