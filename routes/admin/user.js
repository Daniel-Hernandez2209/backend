// routes/admin.js - Rutas de administrador
const express = require('express');
const router = express.Router();
const { auth, adminAuth } = require('../../middleware/auth');
const rateLimit = require('express-rate-limit');
const AdminController = require('../../controllers/adminController');

// Rate limiter para admin
const adminLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 20, // 20 requests por minuto
  message: {
    success: false,
    message: 'Demasiadas solicitudes. Reduce la velocidad.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ========================================
// RUTAS DE ADMINISTRADOR
// ========================================

// GET /api/admin/users - Obtener todos los usuarios
router.get('/users', 
  adminLimiter,           // 1. Rate limiter
  auth,                   // 2. Autenticación (verifica token)
  adminAuth,              // 3. Verificar rol admin
  AdminController.getUsers // 4. Controlador
  // auth se ejecuta primero, luego adminAuth
  // Solo llegas aquí si ambos pasan
);

// GET /api/admin/users/:id - Obtener un usuario
router.get('/users/:id', 
  adminLimiter,
  auth,
  adminAuth,
  AdminController.getUserById
);

// PUT /api/admin/users/:id - Actualizar usuario
router.put('/users/:id', 
  adminLimiter,
  auth,
  adminAuth,
  AdminController.updateUser
);

// DELETE /api/admin/users/:id - Eliminar usuario
router.delete('/users/:id', 
  adminLimiter,
  auth,
  adminAuth,
  AdminController.deleteUser
);

// PUT /api/admin/users/:id/activate - Activar/desactivar usuario
router.put('/users/:id/activate', 
  adminLimiter,
  auth,
  adminAuth,
  AdminController.toggleUserStatus
);

// GET /api/admin/stats - Estadísticas del sistema
router.get('/stats', 
  adminLimiter,
  auth,
  adminAuth,
  AdminController.getStats
);

module.exports = router;