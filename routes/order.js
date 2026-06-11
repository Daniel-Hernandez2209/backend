// routes/order.js - Rutas de pedidos (SEGURA y optimizada para producción)
import express from 'express';
import { body, param, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import OrderController from '../controllers/orderController.js';
import { auth, adminAuth, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// ========================================
// 🔒 HEADERS DE SEGURIDAD
// ========================================
router.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      frameAncestors: ["'none'"]
    }
  },
  referrerPolicy: { policy: 'no-referrer' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

// ========================================
// ⚙️ RATE LIMITERS
// ========================================
const createOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5,
  message: { success: false, message: 'Demasiadas creaciones de pedidos. Intenta más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const paymentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 min
  max: 10,
  message: { success: false, message: 'Demasiados intentos de pago. Intenta luego.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 30,
  message: { success: false, message: 'Demasiadas solicitudes. Reduce la velocidad.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, message: 'Demasiadas solicitudes administrativas.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ========================================
// 🧩 VALIDACIONES REUTILIZABLES
// ========================================
const handleValidationErrors = (req, res, next) => {
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

const validateOrderNumber = [
  param('orderNumber')
    .matches(/^[A-Z0-9-]{8,25}$/)
    .withMessage('Número de pedido inválido')
];

const validateOrderId = [
  param('id')
    .isMongoId()
    .withMessage('ID de pedido inválido')
];

const createOrderValidation = [
  body('items').isArray({ min: 1 }).withMessage('Debe incluir al menos un producto'),
  body('items.*.product').isMongoId().withMessage('ID de producto inválido'),
  body('items.*.size')
    .isIn(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'])
    .withMessage('Talla no válida'),
  body('items.*.quantity')
    .isInt({ min: 1, max: 10 })
    .withMessage('Cantidad debe ser entre 1 y 10'),
  body('shippingAddress.firstName')
    .trim().escape()
    .isLength({ min: 2, max: 50 })
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('Nombre inválido'),
  body('shippingAddress.lastName')
    .trim().escape()
    .isLength({ min: 2, max: 50 })
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('Apellido inválido'),
  body('shippingAddress.street')
    .trim().escape()
    .isLength({ min: 10, max: 200 })
    .matches(/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\-#.,]+$/)
    .withMessage('Dirección inválida'),
  body('shippingAddress.city')
    .trim().escape()
    .isLength({ min: 2, max: 100 })
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('Ciudad inválida'),
  body('shippingAddress.department')
    .trim().escape()
    .isLength({ min: 2, max: 100 })
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('Departamento inválido'),
  body('payment.method')
    .isIn(['pse', 'cash_on_delivery', 'bank_transfer'])
    .withMessage('Método de pago no válido')
];

const confirmPaymentValidation = [
  param('orderNumber')
    .matches(/^[A-Z0-9-]{8,25}$/)
    .withMessage('Número de pedido inválido'),
  body('paymentId')
    .isAlphanumeric()
    .isLength({ min: 10, max: 100 })
    .withMessage('ID de pago inválido'),
  body('transactionId')
    .optional()
    .isAlphanumeric()
    .isLength({ max: 100 })
];

const updateStatusValidation = [
  body('status')
    .isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'])
    .withMessage('Estado no válido'),
  body('notes')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 500 })
    .matches(/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\-.,!?]+$/)
    .withMessage('Notas inválidas')
];

// ========================================
// 🧠 RUTAS PÚBLICAS Y OPCIONALES
// ========================================
router.post('/',
  createOrderLimiter,
  optionalAuth,
  createOrderValidation,
  handleValidationErrors,
  OrderController.createOrder
);

router.get('/:orderNumber',
  validateOrderNumber,
  optionalAuth,
  handleValidationErrors,
  OrderController.getOrderByNumber
);

router.post('/:orderNumber/payment/confirm',
  paymentLimiter,
  confirmPaymentValidation,
  handleValidationErrors,
  OrderController.confirmPayment
);

// ========================================
// 👤 RUTAS DE USUARIO AUTENTICADO
// ========================================
router.get('/',
  generalLimiter,
  auth,
  OrderController.getUserOrders
);

router.delete('/:id',
  generalLimiter,
  auth,
  validateOrderId,
  handleValidationErrors,
  OrderController.cancelOrder
);

// ========================================
// 🛠️ RUTAS DE ADMINISTRADOR
// ========================================
router.get('/admin/all',
  adminLimiter,
  auth,
  adminAuth,
  OrderController.getAllOrdersAdmin
);

router.get('/admin/stats',
  adminLimiter,
  auth,
  adminAuth,
  OrderController.getOrderStats
);

router.put('/:id/status',
  adminLimiter,
  auth,
  adminAuth,
  validateOrderId,
  updateStatusValidation,
  handleValidationErrors,
  OrderController.updateOrderStatus
);

// ========================================
// 🚨 MANEJO GLOBAL DE ERRORES DE VALIDACIÓN
// ========================================
router.use((error, req, res, next) => {
  if (error instanceof import('express-validator').ValidationError) {
    return res.status(400).json({
      success: false,
      message: 'Error de validación',
      errors: error.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  next(error);
});

export default router;
