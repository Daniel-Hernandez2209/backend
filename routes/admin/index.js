// routes/admin/index.js - Router principal de admin
const express = require('express');
const AdminController = require('../../controllers/adminController');
const { auth, adminAuth } = require('../../middleware/auth');
const { adminWriteLimiter } = require('../../middleware/rateLimiter');

const router = express.Router();

// Sub-routers
const usersRouter = require('./users');
const categoriesRouter = require('./categories');

// Aplicar auth global a todas las rutas admin
router.use(auth);
router.use(adminAuth);

// Montar sub-routers
router.use('/users', usersRouter);
router.use('/categories', categoriesRouter);

// ============================================
// ESTADÍSTICAS GENERALES
// ============================================

// GET /api/admin/stats - Estadísticas del sistema
router.get('/stats', 
  adminWriteLimiter,
  AdminController.getStats
);

// GET /api/admin/dashboard - Dashboard principal
router.get('/dashboard', 
  adminWriteLimiter,
  async (req, res) => {
    res.json({
      success: true,
      message: 'Dashboard admin',
      data: {
        user: {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role
        }
      }
    });
  }
);

module.exports = router;