```js
/**
 * ARCHIVO: routes/auth.js
 * 
 * DESCRIPCIÓN GENERAL:
 * Este archivo define todas las rutas de autenticación para la aplicación Express.js.
 * Implementa un sistema completo de gestión de usuarios con validaciones robustas,
 * rate limiting para prevenir ataques de fuerza bruta, y separación clara entre
 * rutas públicas y protegidas. Incluye funcionalidades como registro, login,
 * verificación de email, recuperación de contraseña, y gestión de perfil de usuario.
 */

// Importación del framework Express para crear el router de rutas
const express = require('express');

// Importación de express-validator para validar y sanitizar datos de entrada
const { body } = require('express-validator');

// Importación de express-rate-limit para implementar limitación de intentos
const rateLimit = require('express-rate-limit');

// Importación del controlador que contiene la lógica de negocio de autenticación
const AuthController = require('../controllers/authController');

// Importación del middleware de autenticación para proteger rutas privadas
const { auth } = require('../middleware/auth');

// Creación de una instancia del router de Express
const router = express.Router();

// Configuración de rate limiting específico para endpoints de autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Ventana de tiempo de 15 minutos (en milisegundos)
  max: 5, // Máximo 5 intentos por IP dentro de la ventana de tiempo
  message: { // Mensaje de respuesta cuando se excede el límite
    success: false,
    message: 'Demasiados intentos de login. Intenta de nuevo en 15 minutos.'
  },
  standardHeaders: true, // Incluye headers estándar de rate limiting en la respuesta
  legacyHeaders: false, // Desactiva headers legacy para mantener respuesta limpia
});

// Array de validaciones para el endpoint de registro de usuario
const registerValidation = [
  body('email') // Valida el campo email del body de la request
    .isEmail() // Verifica que tenga formato de email válido
    .normalizeEmail() // Normaliza el email (lowercase, remove dots, etc.)
    .withMessage('Email no válido'), // Mensaje de error personalizado
  body('password') // Valida el campo password
    .isLength({ min: 6 }) // Requiere mínimo 6 caracteres
    .withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('firstName') // Valida el nombre
    .trim() // Elimina espacios en blanco al inicio y final
    .isLength({ min: 2, max: 50 }) // Longitud entre 2 y 50 caracteres
    .withMessage('El nombre debe tener entre 2 y 50 caracteres'),
  body('lastName') // Valida el apellido
    .trim() // Sanitiza espacios
    .isLength({ min: 2, max: 50 }) // Valida longitud
    .withMessage('El apellido debe tener entre 2 y 50 caracteres'),
  body('phone') // Valida el teléfono
    .optional() // Campo opcional, validación solo si está presente
    .matches(/^[+]?[\d\s\-\(\)]+$/) // Permite números, espacios, guiones, paréntesis y +
    .withMessage('Número de teléfono no válido')
];

// Array de validaciones para el endpoint de login
const loginValidation = [
  body('email') // Valida email de login
    .isEmail() // Formato de email válido
    .normalizeEmail() // Normaliza el formato
    .withMessage('Email no válido'),
  body('password') // Valida contraseña de login
    .notEmpty() // No puede estar vacía
    .withMessage('La contraseña es requerida')
];

// Array de validaciones para actualización de perfil de usuario
const updateProfileValidation = [
  body('firstName') // Nombre (opcional en actualizaciones)
    .optional() // Solo valida si el campo está presente
    .trim() // Sanitiza espacios
    .isLength({ min: 2, max: 50 }), // Valida longitud
  body('lastName') // Apellido (opcional)
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }),
  body('phone') // Teléfono (opcional)
    .optional()
    .matches(/^[+]?[\d\s\-\(\)]+$/), // Misma validación que en registro
];

// Array de validaciones para cambio de contraseña
const changePasswordValidation = [
  body('currentPassword') // Contraseña actual para verificación
    .notEmpty() // Campo obligatorio
    .withMessage('Contraseña actual requerida'),
  body('newPassword') // Nueva contraseña
    .isLength({ min: 6 }) // Mínimo 6 caracteres
    .withMessage('La nueva contraseña debe tener al menos 6 caracteres')
];

// Array de validaciones para reset de contraseña
const resetPasswordValidation = [
  body('token') // Token de recuperación enviado por email
    .notEmpty() // Campo obligatorio
    .withMessage('Token requerido'),
  body('password') // Nueva contraseña
    .isLength({ min: 6 }) // Mínimo 6 caracteres
    .withMessage('La contraseña debe tener al menos 6 caracteres')
];

// RUTAS PÚBLICAS (no requieren autenticación)

// Ruta para registro de nuevos usuarios
router.post('/register', registerValidation, AuthController.register);

// Ruta para login con rate limiting aplicado
router.post('/login', authLimiter, loginValidation, AuthController.login);

// Ruta para verificación de email después del registro
router.post('/verify-email', AuthController.verifyEmail);

// Ruta para solicitar recuperación de contraseña
router.post('/forgot-password', [body('email').isEmail().normalizeEmail()], AuthController.forgotPassword);

// Ruta para resetear contraseña usando token de recuperación
router.post('/reset-password', resetPasswordValidation, AuthController.resetPassword);

// RUTAS PROTEGIDAS (requieren middleware de autenticación)

// Ruta para obtener información del perfil del usuario autenticado
router.get('/me', auth, AuthController.getProfile);

// Ruta para actualizar información del perfil
router.put('/profile', auth, updateProfileValidation, AuthController.updateProfile);

// Ruta para cambiar contraseña (requiere contraseña actual)
router.post('/change-password', auth, changePasswordValidation, AuthController.changePassword);

// Ruta para renovar token de acceso usando refresh token
router.post('/refresh-token', auth, AuthController.refreshToken);

// Ruta para cerrar sesión y invalidar tokens
router.post('/logout', auth, AuthController.logout);

// Exporta el router para ser usado en la aplicación principal
module.exports = router;
```

## Resumen de Funcionalidades por Línea

**Líneas 1-20**: Configuración inicial e importaciones necesarias
**Líneas 21-30**: Configuración de rate limiting para prevenir ataques de fuerza bruta
**Líneas 31-76**: Definición de validaciones específicas para cada endpoint
**Líneas 77-83**: Rutas públicas accesibles sin autenticación
**Líneas 84-90**: Rutas protegidas que requieren token de autenticación válido
**Línea 92**: Exportación del módulo

Este archivo implementa una arquitectura de seguridad por capas con validaciones, rate limiting y autenticación, siguiendo las mejores prácticas de Express.js para