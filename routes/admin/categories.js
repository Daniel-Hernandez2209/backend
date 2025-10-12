// routes/admin/categories.js - Rutas administrativas
const express = require('express');
const CategoryController = require('../../controllers/categoryController');
const { adminAuth } = require('../../middleware/auth');
const { adminWriteLimiter , criticalAdminLimiter } = require('../../middleware/rateLimiter');

const router = express.Router();

// Aplicar adminAuth a todas las rutas de este router
router.use(adminAuth);

// Rutas admin (ya protegidas por el middleware arriba)
router.get('/', CategoryController.getAllCategoriesAdmin, adminWriteLimiter);

router.put('/:slug/toggle', 
    criticalAdminLimiter, // Rate limiter más restrictivo
  CategoryController.validateSlugParam,
  CategoryController.toggleCategory
);

// Futuras rutas admin
router.post('/', CategoryController.createCategory, criticalAdminLimiter); // Por implementar
router.put('/:slug', CategoryController.updateCategory, criticalAdminLimiter); // Por implementar
router.delete('/:slug', CategoryController.deleteCategory, criticalAdminLimiter); // Por implementar

module.exports = router;