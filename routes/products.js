// routes/products.js - Rutas de productos optimizadas y seguras
const express = import('express');
const { body, param, query, validationResult } = import('express-validator');
const rateLimit = import('express-rate-limit');
const helmet = import('helmet');
const ProductController = import('../controllers/productController');
const { adminAuth } = import('../middleware/auth');

const router = express.Router();

// ========================================
// HEADERS DE SEGURIDAD
// ========================================
router.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));

// ========================================
// RATE LIMITERS
// ========================================
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 30,
  message: { success: false, message: 'Demasiadas búsquedas, intente más tarde' },
  standardHeaders: true,
  legacyHeaders: false,
});

const adminLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Demasiadas operaciones administrativas, intente más tarde' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ========================================
// MIDDLEWARE DE VALIDACIÓN GLOBAL
// ========================================
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Errores de validación',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  next();
};

// ========================================
// VALIDACIONES
// ========================================
const productValidation = [
  body('name')
    .trim().escape()
    .isLength({ min: 3, max: 100 })
    .matches(/^[a-zA-Z0-9\sáéíóúñÁÉÍÓÚÑ\-\.]+$/)
    .withMessage('El nombre debe tener entre 3 y 100 caracteres y contener solo caracteres válidos'),
  body('description')
    .trim().escape()
    .isLength({ min: 10, max: 2000 })
    .withMessage('La descripción debe tener entre 10 y 2000 caracteres'),
  body('price')
    .isFloat({ min: 0.01, max: 999999 })
    .withMessage('El precio debe ser un número entre 0.01 y 999999'),
  body('discountPrice')
    .optional()
    .isFloat({ min: 0.01, max: 999999 })
    .withMessage('El precio con descuento debe ser un número entre 0.01 y 999999'),
  body('category')
    .isIn(['hombre', 'mujer', 'deportivos', 'hoodies-sacos', 'chaquetas'])
    .withMessage('Categoría no válida'),
  body('sizes')
    .isArray({ min: 1, max: 7 })
    .withMessage('Debe incluir entre 1 y 7 tallas'),
  body('sizes.*.size')
    .isIn(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'])
    .withMessage('Talla no válida'),
  body('sizes.*.stock')
    .isInt({ min: 0, max: 9999 })
    .withMessage('Stock debe ser un número entre 0 y 9999'),
  body('images')
    .isArray({ min: 1, max: 10 })
    .withMessage('Debe incluir entre 1 y 10 imágenes'),
  body('images.*')
    .isURL({ protocols: ['http', 'https'] })
    .matches(/\.(jpg|jpeg|png|webp)(\?.*)?$/i)
    .withMessage('Las imágenes deben ser URLs válidas con formato jpg, jpeg, png o webp')
];

const stockUpdateValidation = [
  body('size')
    .isIn(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'])
    .withMessage('Talla no válida'),
  body('quantity')
    .isInt({ min: 0 })
    .withMessage('La cantidad debe ser un número entero positivo'),
  body('operation')
    .optional()
    .isIn(['set', 'add', 'subtract'])
    .withMessage('Operación no válida')
];

const searchValidation = [
  query('q')
    .trim()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z0-9\sáéíóúñÁÉÍÓÚÑ\-]+$/)
    .withMessage('Término de búsqueda no válido'),
  query('category')
    .optional()
    .isIn(['hombre', 'mujer', 'deportivos', 'hoodies-sacos', 'chaquetas'])
    .withMessage('Categoría no válida'),
  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Precio mínimo no válido'),
  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Precio máximo no válido')
];

const categoryValidation = [
  param('category')
    .isIn(['hombre', 'mujer', 'deportivos', 'hoodies-sacos', 'chaquetas'])
    .withMessage('Categoría no válida')
];

const idValidation = [
  param('id').isMongoId().withMessage('ID de producto no válido')
];

const batchValidation = [
  body('operation')
    .isIn(['update', 'delete', 'updateStock'])
    .withMessage('Operación no válida'),
  body('productIds')
    .isArray({ min: 1, max: 100 })
    .withMessage('Debe especificar entre 1 y 100 productos'),
  body('productIds.*')
    .isMongoId()
    .withMessage('ID de producto no válido'),
  body('data')
    .optional()
    .isObject()
    .withMessage('Los datos deben ser un objeto válido')
];

// ========================================
// RUTAS PÚBLICAS
// ========================================
router.get('/', ProductController.getAllProducts);
router.get('/search', searchLimiter, searchValidation, handleValidation, ProductController.searchProducts);
router.get('/category/:category', categoryValidation, handleValidation, ProductController.getProductsByCategory);
router.get('/featured', ProductController.getFeaturedProducts);
router.get('/:slug', ProductController.getProductBySlug);

// ========================================
// RUTAS DE ADMINISTRADOR
// ========================================
router.get('/admin/analytics/stats', adminAuth, ProductController.getProductStats);
router.get('/admin/export', adminAuth, ProductController.exportProducts);
router.get('/admin/all', adminAuth, ProductController.getAllProductsAdmin);

router.post('/', adminAuth, adminLimiter, productValidation, handleValidation, ProductController.createProduct);
router.put('/:id', adminAuth, adminLimiter, idValidation, productValidation, handleValidation, ProductController.updateProduct);
router.delete('/:id', adminAuth, adminLimiter, idValidation, handleValidation, ProductController.deleteProduct);
router.put('/:id/stock', adminAuth, adminLimiter, idValidation, stockUpdateValidation, handleValidation, ProductController.updateStock);
router.post('/batch', adminAuth, adminLimiter, batchValidation, handleValidation, ProductController.batchOperations);

export default router;
