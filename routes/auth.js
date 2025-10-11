// routes/auth.js - Rutas de autenticación con middlewares en cadena
const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const AuthController = require('../controllers/authController');
const { auth } = require('../middleware/auth');

const router = express.Router();

// ========================================
// RATE LIMITERS
// ========================================

// Rate limiting para auth endpoints (login/registro)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 intentos por ventana
  message: {
    success: false,
    message: 'Demasiados intentos de autenticación. Intenta de nuevo en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting para recuperación de contraseña
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // máximo 3 intentos
  message: {
    success: false,
    message: 'Demasiados intentos de recuperación. Intenta de nuevo en 1 hora.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting general para rutas protegidas
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 30, // 30 requests por minuto
  message: {
    success: false,
    message: 'Demasiadas solicitudes. Reduce la velocidad.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ========================================
// VALIDACIONES
// ========================================

const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email no válido'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('La contraseña debe contener al menos una mayúscula, una minúscula y un número'),
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('El nombre solo puede contener letras'),
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El apellido debe tener entre 2 y 50 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('El apellido solo puede contener letras'),
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

const updateProfileValidation = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('El nombre solo puede contener letras'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('El apellido solo puede contener letras'),
  body('phone')
    .optional()
    .matches(/^[+]?[\d\s\-\(\)]+$/)
    .withMessage('Número de teléfono no válido'),
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Contraseña actual requerida'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('La nueva contraseña debe tener al menos 6 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('La contraseña debe contener al menos una mayúscula, una minúscula y un número')
];

const resetPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Token requerido'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('La contraseña debe contener al menos una mayúscula, una minúscula y un número')
];

const forgotPasswordValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email no válido')
];

// ========================================
// RUTAS PÚBLICAS
// ========================================

// POST /api/auth/register - Registrar nuevo usuario
router.post('/register', 
  authLimiter,           // 1. Rate limiter
  registerValidation,    // 2. Validaciones
  AuthController.register // 3. Controlador
);

// POST /api/auth/login - Iniciar sesión
router.post('/login', 
  authLimiter,          // 1. Rate limiter
  loginValidation,      // 2. Validaciones
  AuthController.login  // 3. Controlador
);

// POST /api/auth/verify-email - Verificar email
router.post('/verify-email', 
  generalLimiter,              // 1. Rate limiter
  AuthController.verifyEmail   // 2. Controlador
);

// POST /api/auth/forgot-password - Solicitar recuperación de contraseña
router.post('/forgot-password', 
  passwordResetLimiter,        // 1. Rate limiter específico
  forgotPasswordValidation,    // 2. Validaciones
  AuthController.forgotPassword // 3. Controlador
);

// POST /api/auth/reset-password - Restablecer contraseña
router.post('/reset-password', 
  passwordResetLimiter,         // 1. Rate limiter específico
  resetPasswordValidation,      // 2. Validaciones
  AuthController.resetPassword  // 3. Controlador
);

// ========================================
// RUTAS PROTEGIDAS
// ========================================

// GET /api/auth/me - Obtener perfil del usuario autenticado
router.get('/me', 
  generalLimiter,          // 1. Rate limiter
  auth,                    // 2. Autenticación (verifica token)
  AuthController.getProfile // 3. Controlador
  // auth se ejecuta primero, luego el controlador
  // Solo llegas al controlador si auth pasa
);

// PUT /api/auth/profile - Actualizar perfil
router.put('/profile', 
  generalLimiter,            // 1. Rate limiter
  auth,                      // 2. Autenticación
  updateProfileValidation,   // 3. Validaciones
  AuthController.updateProfile // 4. Controlador
);

// POST /api/auth/change-password - Cambiar contraseña
router.post('/change-password', 
  generalLimiter,              // 1. Rate limiter
  auth,                        // 2. Autenticación
  changePasswordValidation,    // 3. Validaciones
  AuthController.changePassword // 4. Controlador
);

// POST /api/auth/refresh-token - Refrescar token
router.post('/refresh-token', 
  generalLimiter,              // 1. Rate limiter
  auth,                        // 2. Autenticación
  AuthController.refreshToken  // 3. Controlador
);

// POST /api/auth/logout - Cerrar sesión
router.post('/logout', 
  generalLimiter,        // 1. Rate limiter
  auth,                  // 2. Autenticación
  AuthController.logout  // 3. Controlador
);

module.exports = router;