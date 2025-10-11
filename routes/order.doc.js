# 📄 Descripción General del Archivo

Este archivo define el enrutador de pedidos para una aplicación de e-commerce que maneja la creación, consulta y gestión de órdenes. Implementa un sistema de autenticación de tres niveles (público, usuario autenticado, administrador) con validaciones robustas usando express-validator. Las rutas están organizadas por nivel de acceso y cubren el ciclo completo de vida de un pedido desde su creación hasta su entrega.

```js
// routes/order.js - Rutas de pedidos actualizadas con controladores
// Importación del framework Express para crear el enrutador
const express = require('express');
// Importación de express-validator para validaciones de entrada
const { body } = require('express-validator');
// Importación del controlador que contiene la lógica de negocio de pedidos
const OrderController = require('../controllers/orderController');
// Importación de middlewares de autenticación con diferentes niveles de acceso
const { auth, adminAuth, optionalAuth } = require('../middleware/auth');

// Creación del enrutador de Express para manejar las rutas de pedidos
const router = express.Router();

// Validaciones para crear pedido
// Array de validaciones que se ejecutarán al crear un nuevo pedido
const createOrderValidation = [
  // Validación del array de productos: debe contener al menos 1 elemento
  body('items')
    .isArray({ min: 1 })
    .withMessage('Debe incluir al menos un producto'),
  // Validación del ID de producto: debe ser un ObjectId válido de MongoDB
  body('items.*.product')
    .isMongoId()
    .withMessage('ID de producto inválido'),
  // Validación de talla: debe ser una de las opciones predefinidas
  body('items.*.size')
    .isIn(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'])
    .withMessage('Talla no válida'),
  // Validación de cantidad: debe ser un entero entre 1 y 10
  body('items.*.quantity')
    .isInt({ min: 1, max: 10 })
    .withMessage('Cantidad debe ser entre 1 y 10'),
  // Validación del nombre: elimina espacios y verifica longitud
  body('shippingAddress.firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Nombre requerido'),
  // Validación del apellido: elimina espacios y verifica longitud
  body('shippingAddress.lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Apellido requerido'),
  // Validación de dirección: debe ser descriptiva con mínimo 10 caracteres
  body('shippingAddress.street')
    .trim()
    .isLength({ min: 10, max: 200 })
    .withMessage('Dirección completa requerida'),
  // Validación de ciudad: elimina espacios y verifica longitud
  body('shippingAddress.city')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Ciudad requerida'),
  // Validación de departamento/estado: elimina espacios y verifica longitud
  body('shippingAddress.department')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Departamento requerido'),
  // Validación del método de pago: debe ser uno de los métodos soportados
  body('payment.method')
    .isIn(['pse', 'cash_on_delivery', 'bank_transfer'])
    .withMessage('Método de pago no válido')
];

// Validaciones para actualizar el estado de un pedido
const updateStatusValidation = [
  // Validación del estado: debe ser uno de los estados válidos del flujo de pedidos
  body('status')
    .isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'])
    .withMessage('Estado no válido'),
  // Validación de notas opcionales: máximo 500 caracteres
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Las notas no pueden exceder 500 caracteres')
];

// Rutas públicas y protegidas opcionalmente
// Ruta POST para crear un nuevo pedido
// - optionalAuth: permite acceso con o sin autenticación
// - createOrderValidation: aplica todas las validaciones definidas arriba
// - OrderController.createOrder: ejecuta la lógica de creación del pedido
router.post('/', optionalAuth, createOrderValidation, OrderController.createOrder);

// Ruta GET para consultar un pedido específico por número de orden
// - :orderNumber: parámetro de ruta que identifica el pedido
// - optionalAuth: permite consulta con o sin usuario autenticado
router.get('/:orderNumber', optionalAuth, OrderController.getOrderByNumber);

// Ruta POST para confirmar el pago de un pedido
// - Ruta pública que permite confirmar pagos desde pasarelas de pago externas
router.post('/:orderNumber/payment/confirm', OrderController.confirmPayment);

// Rutas de usuario autenticado
// Ruta GET para obtener todos los pedidos del usuario autenticado
// - auth: requiere autenticación válida
router.get('/', auth, OrderController.getUserOrders);

// Ruta DELETE para cancelar un pedido específico
// - Solo el propietario del pedido puede cancelarlo
router.delete('/:id', auth, OrderController.cancelOrder);

// Rutas de administrador
// Ruta GET para que administradores consulten todos los pedidos del sistema
// - adminAuth: requiere permisos de administrador
router.get('/admin/all', adminAuth, OrderController.getAllOrdersAdmin);

// Ruta GET para obtener estadísticas de pedidos (dashboard administrativo)
// - Solo administradores pueden ver métricas globales
router.get('/admin/stats', adminAuth, OrderController.getOrderStats);

// Ruta PUT para actualizar el estado de cualquier pedido
// - Solo administradores pueden cambiar estados
// - updateStatusValidation: valida el nuevo estado y notas
router.put('/:id/status', adminAuth, updateStatusValidation, OrderController.updateOrderStatus);

// Exportación del enrutador para uso en la aplicación principal
module.exports = router;
```

## 🔧 **Funcionalidades Principales**

- **✅ Creación de pedidos** con validación completa de productos y direcciones
- **🔍 Consulta pública** por número de orden para tracking
- **💳 Confirmación de pagos** desde pasarelas externas
- **👤 Gestión personal** de pedidos para usuarios autenticados  
- **🛡️ Panel administrativo** con control total y estadísticas
- **📊 Sistema de estados** que refleja el flujo completo del pedido

## 🚨 **Vulnerabilidades de Seguridad Detectadas**

El código presenta varias vulnerabilidades críticas que requieren atención inmediata para garantizar la seguridad de la aplicación.