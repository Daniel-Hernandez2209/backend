// routes/admin/index.js - Router principal de admin
import express from 'express';
import AdminController from '../../controllers/adminController.js';
import { auth, adminAuth } from '../../middleware/auth.js';
import { adminWriteLimiter } from '../../middleware/rateLimiter.js';

const router = express.Router();

// Sub-routers
const usersRouter = import('./user');
const categoriesRouter = import('./categories');

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

export default router;