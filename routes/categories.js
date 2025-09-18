// routes/categories.js - Rutas de categorías actualizadas con controladores
const express = require('express');
const CategoryController = require('../controllers/categoryController');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// Rutas públicas
router.get('/', CategoryController.getAllCategories);
router.get('/menu', CategoryController.getMenuCategories);
router.get('/sitemap', CategoryController.getSitemapData);
router.get('/stats', CategoryController.getCategoryStats);
router.get('/seo/:slug', CategoryController.getCategorySEO);
router.get('/:slug', CategoryController.getCategoryBySlug);
router.get('/:slug/subcategories', CategoryController.getSubcategories);

// Rutas de administrador
router.get('/admin/all', adminAuth, CategoryController.getAllCategoriesAdmin);
router.put('/:slug/toggle', adminAuth, CategoryController.toggleCategory);

module.exports = router;