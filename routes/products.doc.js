# Documentación de routes/products.js

## Descripción General del Archivo
Este archivo define las rutas de una API REST para gestión de productos de una tienda de ropa online. Implementa endpoints públicos para consultas de usuarios y rutas administrativas protegidas para el CRUD de productos, gestión de inventario y operaciones por lotes. Incluye validaciones robustas para todos los datos de entrada y separación clara entre funcionalidades públicas y administrativas.

---

## Código Comentado Línea por Línea

```js
// routes/products.js - Rutas de productos actualizadas con controladores

// Importa el framework Express para crear el enrutador
const express = require('express');

// Importa la función de validación body de express-validator para validar datos del cuerpo de la petición
const { body } = require('express-validator');

// Importa el controlador que contiene la lógica de negocio para productos
const ProductController = require('../controllers/productController');

// Importa el middleware de autenticación para rutas administrativas
const { adminAuth } = require('../middleware/auth');

// Crea una nueva instancia del enrutador de Express
const router = express.Router();

// Define las validaciones para la creación y actualización de productos
const productValidation = [
  // Valida el campo 'name': elimina espacios, longitud entre 3-100 caracteres
  body('name')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('El nombre debe tener entre 3 y 100 caracteres'),
  
  // Valida el campo 'description': elimina espacios, longitud entre 10-2000 caracteres
  body('description')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('La descripción debe tener entre 10 y 2000 caracteres'),
  
  // Valida el campo 'price': debe ser un número decimal mayor o igual a 0
  body('price')
    .isFloat({ min: 0 })
    .withMessage('El precio debe ser un número positivo'),
  
  // Valida el campo 'discountPrice': campo opcional, si existe debe ser número positivo
  body('discountPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El precio con descuento debe ser un número positivo'),
  
  // Valida el campo 'category': debe ser uno de los valores permitidos
  body('category')
    .isIn(['hombre', 'mujer', 'deportivos', 'hoodies-sacos', 'chaquetas'])
    .withMessage('Categoría no válida'),
  
  // Valida el campo 'sizes': debe ser un array con al menos un elemento
  body('sizes')
    .isArray({ min: 1 })
    .withMessage('Debe incluir al menos una talla'),
  
  // Valida el campo 'images': debe ser un array con al menos una imagen
  body('images')
    .isArray({ min: 1 })
    .withMessage('Debe incluir al menos una imagen')
];

// Define las validaciones específicas para actualización de stock
const stockUpdateValidation = [
  // Valida el campo 'size': debe ser una de las tallas permitidas
  body('size')
    .isIn(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'])
    .withMessage('Talla no válida'),
  
  // Valida el campo 'quantity': debe ser un número entero positivo o cero
  body('quantity')
    .isInt({ min: 0 })
    .withMessage('La cantidad debe ser un número entero positivo'),
  
  // Valida el campo 'operation': campo opcional, define el tipo de operación de stock
  body('operation')
    .optional()
    .isIn(['set', 'add', 'subtract'])
    .withMessage('Operación no válida')
];

// === RUTAS PÚBLICAS (sin autenticación requerida) ===

// GET / - Obtiene todos los productos (con posibles filtros y paginación)
router.get('/', ProductController.getAllProducts);

// GET /search - Busca productos por término de búsqueda
router.get('/search', ProductController.searchProducts);

// GET /category/:category - Obtiene productos filtrados por categoría específica
router.get('/category/:category', ProductController.getProductsByCategory);

// GET /featured - Obtiene productos destacados o recomendados
router.get('/featured', ProductController.getFeaturedProducts);

// GET /analytics/stats - Obtiene estadísticas de productos (⚠️ VULNERABILIDAD: debería estar protegida)
router.get('/analytics/stats', ProductController.getProductStats);

// GET /export - Exporta datos de productos (⚠️ VULNERABILIDAD: debería estar protegida)
router.get('/export', ProductController.exportProducts);

// GET /:slug - Obtiene un producto específico por su slug (URL amigable)
router.get('/:slug', ProductController.getProductBySlug);

// === RUTAS ADMINISTRATIVAS (requieren autenticación de administrador) ===

// POST / - Crea un nuevo producto (requiere autenticación y validación completa)
router.post('/', adminAuth, productValidation, ProductController.createProduct);

// PUT /:id - Actualiza un producto existente por ID (requiere autenticación y validación)
router.put('/:id', adminAuth, productValidation, ProductController.updateProduct);

// DELETE /:id - Elimina un producto por ID (requiere autenticación)
router.delete('/:id', adminAuth, ProductController.deleteProduct);

// GET /admin/all - Obtiene todos los productos con información administrativa completa
router.get('/admin/all', adminAuth, ProductController.getAllProductsAdmin);

// PUT /:id/stock - Actualiza el stock de un producto específico (requiere validación de stock)
router.put('/:id/stock', adminAuth, stockUpdateValidation, ProductController.updateStock);

// POST /batch - Realiza operaciones por lotes en múltiples productos
router.post('/batch', adminAuth, ProductController.batchOperations);

// Exporta el enrutador para ser usado en la aplicación principal
module.exports = router;
```

## ⚠️ Vulnerabilidades Identificadas

### 1. **Exposición de Datos Sensibles** (Líneas 48-49)
Las rutas `/analytics/stats` y `/export` deberían estar protegidas con autenticación de administrador.

### 2. **Falta de Validación en Rutas Públicas** (Líneas 44-46)
Las rutas de búsqueda y categorías no validan parámetros de entrada, lo que puede causar inyecciones.

### 3. **Validaciones Insuficientes** (Líneas 32-35)
Las validaciones de arrays (`sizes`, `images`) no verifican el contenido interno de los elementos.

### 4. **Falta de Rate Limiting**
No hay protección contra ataques de fuerza bruta o spam en ninguna ruta.