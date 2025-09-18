// routes/products.js - Rutas de productos actualizadas con controladores
const express = require('express');
const { body } = require('express-validator');
const ProductController = require('../controllers/productController');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// Validaciones para productos
const productValidation = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('El nombre debe tener entre 3 y 100 caracteres'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('La descripción debe tener entre 10 y 2000 caracteres'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('El precio debe ser un número positivo'),
  body('discountPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El precio con descuento debe ser un número positivo'),
  body('category')
    .isIn(['hombre', 'mujer', 'deportivos', 'hoodies-sacos', 'chaquetas'])
    .withMessage('Categoría no válida'),
  body('sizes')
    .isArray({ min: 1 })
    .withMessage('Debe incluir al menos una talla'),
  body('images')
    .isArray({ min: 1 })
    .withMessage('Debe incluir al menos una imagen')
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

// Rutas públicas
router.get('/', ProductController.getAllProducts);
router.get('/search', ProductController.searchProducts);
router.get('/category/:category', ProductController.getProductsByCategory);
router.get('/featured', ProductController.getFeaturedProducts);
router.get('/analytics/stats', ProductController.getProductStats);
router.get('/export', ProductController.exportProducts);
router.get('/:slug', ProductController.getProductBySlug);

// Rutas de administrador
router.post('/', adminAuth, productValidation, ProductController.createProduct);
router.put('/:id', adminAuth, productValidation, ProductController.updateProduct);
router.delete('/:id', adminAuth, ProductController.deleteProduct);
router.get('/admin/all', adminAuth, ProductController.getAllProductsAdmin);
router.put('/:id/stock', adminAuth, stockUpdateValidation, ProductController.updateStock);
router.post('/batch', adminAuth, ProductController.batchOperations);

module.exports = router;