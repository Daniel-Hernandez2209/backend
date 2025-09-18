// routes/auth.js - Rutas de autenticación actualizadas con controladores
const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const AuthController = require('../controllers/authController');
const { auth } = require('../middleware/auth');

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

const updateProfileValidation = [
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
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Contraseña actual requerida'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('La nueva contraseña debe tener al menos 6 caracteres')
];

const resetPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Token requerido'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres')
];

// Rutas públicas
router.post('/register', registerValidation, AuthController.register);
router.post('/login', authLimiter, loginValidation, AuthController.login);
router.post('/verify-email', AuthController.verifyEmail);
router.post('/forgot-password', [body('email').isEmail().normalizeEmail()], AuthController.forgotPassword);
router.post('/reset-password', resetPasswordValidation, AuthController.resetPassword);

// Rutas protegidas
router.get('/me', auth, AuthController.getProfile);
router.put('/profile', auth, updateProfileValidation, AuthController.updateProfile);
router.post('/change-password', auth, changePasswordValidation, AuthController.changePassword);
router.post('/refresh-token', auth, AuthController.refreshToken);
router.post('/logout', auth, AuthController.logout);

module.exports = router;