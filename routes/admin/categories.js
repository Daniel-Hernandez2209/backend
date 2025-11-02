// routes/admin/categories.js - Rutas administrativas
import express from 'express';
import CategoryController from '../../controllers/categoryController.js';
import { adminAuth,auth } from '../../middleware/auth.js';
import { adminWriteLimiter, criticalAdminLimiter } from '../../middleware/rateLimiter.js';

const router = express.Router();



// Aplicar adminAuth a todas las rutas de este router
router.use(auth,adminAuth);

// Rutas admin (ya protegidas por el middleware arriba)
router.get('/', adminWriteLimiter, CategoryController.getAllCategoriesAdmin);
router.post('/', criticalAdminLimiter, CategoryController.createCategory);
router.put('/:slug', criticalAdminLimiter, CategoryController.updateCategory);
router.delete('/:slug', criticalAdminLimiter, CategoryController.deleteCategory);
router.put('/:slug/toggle', criticalAdminLimiter, CategoryController.toggleCategory);

export default  router;