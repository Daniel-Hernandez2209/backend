// routes/categories.js - Rutas públicas
const express = require('express');
const router = express.Router();
const CategoryController = require('../controllers/categoryController');
const {   publicReadLimiter,
  heavyReadLimiter,
  seoLimiter } = require('../middleware/rateLimiter');

// Rutas públicas ordenadas correctamente
router.get('/', publicReadLimiter, CategoryController.getAllCategories);
router.get('/menu', CategoryController.getMenuCategories, publicReadLimiter);
router.get('/sitemap', CategoryController.getSitemapData, publicReadLimiter);
router.get('/stats', CategoryController.getCategoryStats, heavyReadLimiter);

router.get('/seo/:slug', 
  CategoryController.validateSlugParam,
  CategoryController.getCategorySEO,
    seoLimiter
);

router.get('/:slug/subcategories', 
  CategoryController.validateSlugParam,
  CategoryController.getSubcategories,
  publicReadLimiter

);

router.get('/:slug', 
  CategoryController.validateSlugParam,
  CategoryController.getCategoryBySlug,
  publicReadLimiter
);

module.exports = router;