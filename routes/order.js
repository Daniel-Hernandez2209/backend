// routes/order.js - Rutas de pedidos actualizadas con controladores
const express = require('express');
const { body } = require('express-validator');
const OrderController = require('../controllers/orderController');
const { auth, adminAuth, optionalAuth } = require('../middleware/auth');
const { default: rateLimit } = require('express-rate-limit');

const router = express.Router();

// Validaciones para crear pedido
const createOrderValidation = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Debe incluir al menos un producto'),
  body('items.*.product')
    .isMongoId()
    .withMessage('ID de producto inválido'),
  body('items.*.size')
    .isIn(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'])
    .withMessage('Talla no válida'),
  body('items.*.quantity')
    .isInt({ min: 1, max: 10 })
    .withMessage('Cantidad debe ser entre 1 y 10'),
  body('shippingAddress.firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Nombre requerido'),
  body('shippingAddress.lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Apellido requerido'),
  body('shippingAddress.street')
    .trim()
    .isLength({ min: 10, max: 200 })
    .withMessage('Dirección completa requerida'),
  body('shippingAddress.city')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Ciudad requerida'),
  body('shippingAddress.department')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Departamento requerido'),
  body('payment.method')
    .isIn(['pse', 'cash_on_delivery', 'bank_transfer'])
    .withMessage('Método de pago no válido')
];

const updateStatusValidation = [
  body('status')
    .isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'])
    .withMessage('Estado no válido'),
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Las notas no pueden exceder 500 caracteres')
];

// Rutas públicas y protegidas opcionalmente
router.post('/', optionalAuth, createOrderValidation, rateLimit,OrderController.createOrder);
router.get('/:orderNumber', optionalAuth, OrderController.getOrderByNumber);
router.post('/:orderNumber/payment/confirm', OrderController.confirmPayment);

// Rutas de usuario autenticado
router.get('/', auth, OrderController.getUserOrders);
router.delete('/:id', auth, OrderController.cancelOrder);

// Rutas de administrador
router.get('/admin/all', adminAuth, OrderController.getAllOrdersAdmin);
router.get('/admin/stats', adminAuth, OrderController.getOrderStats);
router.put('/:id/status', adminAuth, updateStatusValidation, OrderController.updateOrderStatus);

module.exports = router;