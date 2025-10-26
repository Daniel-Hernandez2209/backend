// routes/products.js - Rutas de productos (Versión SEGURA y OPTIMIZADA)
const express = require('express');
const { body, query, param } = require('express-validator');
const ProductController = require('../controllers/productController');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// ----------------------------
// Categorías válidas
// ----------------------------
const VALID_CATEGORIES = ['hombre', 'mujer', 'deportivos', 'hoodies-sacos', 'chaquetas'];

// ----------------------------
// Validaciones de rutas públicas
// ----------------------------
const validateGetAllProducts = [
  query('page').optional().isInt({ min: 1, max: 1000 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('category').optional().isIn(VALID_CATEGORIES),
  query('sizes').optional().toArray(),
  query('inStock').optional().isIn(['true', 'false']),
  query('minPrice').optional().isFloat({ min: 0 }).toFloat(),
  query('maxPrice').optional().isFloat({ min: 0 }).toFloat(),
  query('sort').optional().isIn(['price_asc', 'price_desc', 'newest', 'popular', 'name_asc', 'name_desc'])
];

const validateSearchProducts = [
  query('q')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('La búsqueda debe tener entre 2 y 100 caracteres'),
  query('category').optional().isIn(VALID_CATEGORIES),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt()
];

const validateGetByCategory = [
  param('category').isIn(VALID_CATEGORIES).withMessage('Categoría no válida'),
  query('page').optional().isInt({ min: 1, max: 1000 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('minPrice').optional().isFloat({ min: 0 }).toFloat(),
  query('maxPrice').optional().isFloat({ min: 0 }).toFloat(),
  query('sort').optional().isIn(['price_asc', 'price_desc', 'newest', 'popular', 'name_asc'])
];

const validateGetBySlug = [
  param('slug')
    .trim()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug inválido (solo letras minúsculas, números y guiones)')
];

// ----------------------------
// Validaciones de administrador
// ----------------------------
const validateProductData = [
  body('name').trim().isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres'),
  body('description').trim().isLength({ min: 10, max: 2000 }).withMessage('La descripción debe tener entre 10 y 2000 caracteres'),
  body('price').isFloat({ min: 0 }).withMessage('El precio debe ser positivo'),
  body('discountPrice').optional().isFloat({ min: 0 }).withMessage('El precio con descuento debe ser positivo'),
  body('category').isIn(VALID_CATEGORIES).withMessage('Categoría no válida'),
  body('sizes').isArray({ min: 1 }).withMessage('Debe incluir al menos una talla'),
  body('sizes.*.size').isString().withMessage('Cada talla debe ser texto'),
  body('sizes.*.stock').isInt({ min: 0 }).withMessage('El stock debe ser un número entero positivo'),
  body('images').isArray({ min: 1 }).withMessage('Debe incluir al menos una imagen'),
  body('images.*.url').isURL().withMessage('Cada imagen debe tener una URL válida')
];

const validateUpdateStock = [
  param('id').isMongoId().withMessage('ID de producto inválido'),
  body('size').isString().isLength({ min: 1, max: 10 }).withMessage('Talla inválida'),
  body('quantity').isInt({ min: 0 }).withMessage('Cantidad debe ser un número entero positivo'),
  body('operation').optional().isIn(['set', 'add', 'subtract']).withMessage('Operación no válida')
];

const validateAdminGetAll = [
  query('page').optional().isInt({ min: 1, max: 1000 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('isActive').optional().isIn(['true', 'false']),
  query('category').optional().isIn(VALID_CATEGORIES),
  query('search').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Búsqueda entre 2 y 100 caracteres')
];

// ----------------------------
// Rutas públicas
// ----------------------------
router.get('/', validateGetAllProducts, ProductController.getAllProducts);
router.get('/search', validateSearchProducts, ProductController.searchProducts);
router.get('/category/:category', validateGetByCategory, ProductController.getProductsByCategory);
router.get('/featured', ProductController.getFeaturedProducts);
router.get('/:slug', validateGetBySlug, ProductController.getProductBySlug);

// ----------------------------
// Rutas administrativas
// ----------------------------
router.get('/admin/all', adminAuth, validateAdminGetAll, ProductController.getAllProductsAdmin);
router.post('/', adminAuth, validateProductData, ProductController.createProduct);
router.put('/:id', adminAuth, param('id').isMongoId().withMessage('ID inválido'), validateProductData, ProductController.updateProduct);
router.put('/:id/stock', adminAuth, validateUpdateStock, ProductController.updateStock);
router.delete('/:id', adminAuth, param('id').isMongoId().withMessage('ID inválido'), ProductController.deleteProduct);

module.exports = router;
