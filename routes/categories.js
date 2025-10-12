// routes/categories.js - Rutas públicas
const express = require('express');
const CategoryController = require('../controllers/categoryController');
const { default: rateLimit } = require('express-rate-limit');
const  { categoryRateLimit, heavyReadLimiter, seoLimiter } = require('../middleware/security');
const { publicReadLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

app.use(rateLimit)

// Rutas públicas ordenadas correctamente
router.get('/', CategoryController.getAllCategories, categoryRateLimit);
router.get('/menu', CategoryController.getMenuCategories, categoryRateLimit);
router.get('/sitemap', CategoryController.getSitemapData, categoryRateLimit);
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