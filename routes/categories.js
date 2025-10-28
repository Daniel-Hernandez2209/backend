// ========================================
// routes/categories.js - Rutas públicas (SEGURA)
// ========================================

const express = import('express');
const rateLimit = import('express-rate-limit');
const helmet = import('helmet');
const { param, validationResult } = import('express-validator');
const CategoryController = import('../controllers/categoryController');

const router = express.Router();

// ========================================
// CABECERAS DE SEGURIDAD
// ========================================
router.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'same-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  })
);

// ========================================
// CACHE CONTROL (optimizado para Vercel)
// ========================================
router.use((req, res, next) => {
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=59');
  next();
});

// ========================================
// RATE LIMITERS
// ========================================

// Límite general (rutas públicas)
const publicRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests/IP
  message: { error: 'Demasiadas peticiones, intenta más tarde' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    console.warn(`🚨 IP bloqueada: ${req.ip} - demasiadas peticiones`);
    res.status(options.statusCode).json(options.message);
  },
});

// Límite más estricto para rutas pesadas
const heavyReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Demasiadas peticiones, intenta más tarde' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Límite especial para SEO
const seoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Demasiadas peticiones, intenta más tarde' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ========================================
// VALIDACIÓN DE SLUG
// ========================================
const validateSlug = [
  param('slug')
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-z0-9-]+$/)
    .withMessage(
      'Slug debe contener solo letras minúsculas, números y guiones'
    ),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array(),
      });
    }
    next();
  },
];

// ========================================
// RUTAS PÚBLICAS (ORDEN IMPORTANTE)
// ========================================

// Rutas generales
router.get('/', publicRateLimit, CategoryController.getAllCategories);
router.get('/menu', publicRateLimit, CategoryController.getMenuCategories);
router.get('/sitemap', publicRateLimit, CategoryController.getSitemapData);
router.get('/stats', heavyReadLimiter, CategoryController.getCategoryStats);

// Rutas con slug
router.get(
  '/seo/:slug',
  validateSlug,
  seoLimiter,
  CategoryController.getCategorySEO
);

router.get(
  '/:slug/subcategories',
  validateSlug,
  publicRateLimit,
  CategoryController.getSubcategories
);

// Ruta genérica final
router.get(
  '/:slug',
  validateSlug,
  publicRateLimit,
  CategoryController.getCategoryBySlug
);

// ========================================
// MANEJO GLOBAL DE ERRORES
// ========================================
router.use((err, req, res, next) => {
  console.error('🔥 Error en rutas de categorías:', err.message);

  // Errores de validación (ya procesados)
  if (err.errors && Array.isArray(err.errors)) {
    return res.status(400).json({
      success: false,
      message: 'Errores de validación',
      errors: err.errors,
    });
  }

  // Error genérico
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
  });
});

export default router;
