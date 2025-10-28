// routes/admin/categories.js - Rutas administrativas
const express = import('express');
const router = express.Router();
const CategoryController = import('../../controllers/categoryController');
const { adminAuth } = import('../../middleware/auth');
const { adminWriteLimiter, criticalAdminLimiter } = import('../../middleware/rateLimiter');

// Aplicar adminAuth a todas las rutas de este router
router.use(adminAuth);

// Rutas admin (ya protegidas por el middleware arriba)
router.get('/', adminWriteLimiter, CategoryController.getAllCategoriesAdmin);
router.post('/', criticalAdminLimiter, CategoryController.createCategory);
router.put('/:slug', criticalAdminLimiter, CategoryController.updateCategory);
router.delete('/:slug', criticalAdminLimiter, CategoryController.deleteCategory);
router.put('/:slug/toggle', criticalAdminLimiter, CategoryController.toggleCategory);

export default  router;