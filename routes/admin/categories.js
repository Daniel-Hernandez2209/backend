// routes/admin/categories.js - Rutas administrativas
const express = require('express');
const router = express.Router();
const CategoryController = require('../../controllers/categoryController');
const { adminAuth } = require('../../middleware/auth');
const { adminWriteLimiter, criticalAdminLimiter } = require('../../middleware/rateLimiter');

// Aplicar adminAuth a todas las rutas de este router
router.use(adminAuth);

// Rutas admin (ya protegidas por el middleware arriba)
router.get('/', adminWriteLimiter, CategoryController.getAllCategoriesAdmin);
router.post('/', criticalAdminLimiter, CategoryController.createCategory);
router.put('/:slug', criticalAdminLimiter, CategoryController.updateCategory);
router.delete('/:slug', criticalAdminLimiter, CategoryController.deleteCategory);
router.put('/:slug/toggle', criticalAdminLimiter, CategoryController.toggleCategory);

module.exports = router;