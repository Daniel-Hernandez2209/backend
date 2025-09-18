// routes/orders.js - Rutas de pedidos para ATHENA BRAND
const express = require('express');
const { body, validationResult } = require('express-validator');
const Order = require('../models/Order');
const Product = require('../models/Products');
const User = require('../models/User');
const { auth, adminAuth, optionalAuth } = require('../middleware/auth');
const sendEmail = require('../utils/sendEmail');

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

// POST /api/orders - Crear nuevo pedido
router.post('/', optionalAuth, createOrderValidation, async (req, res) => {
  try {
    // Verificar errores de validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos del pedido inválidos',
        errors: errors.array()
      });
    }

    const { items, shippingAddress, payment, notes, guestInfo } = req.body;

    // Si no hay usuario autenticado, debe ser compra de invitado
    if (!req.userId && !guestInfo) {
      return res.status(400).json({
        success: false,
        message: 'Información de contacto requerida para compras como invitado'
      });
    }

    // Validar productos y calcular precios
    let orderItems = [];
    let subtotal = 0;

    for (let item of items) {
      const product = await Product.findById(item.product);
      
      if (!product || !product.isActive) {
        return res.status(400).json({
          success: false,
          message: `Producto ${item.product} no encontrado o no disponible`
        });
      }

      // Verificar stock
      const sizeStock = product.sizes.find(s => s.size === item.size);
      if (!sizeStock || sizeStock.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Stock insuficiente para ${product.name} talla ${item.size}`
        });
      }

      // Calcular precio unitario (con descuento si aplica)
      const unitPrice = product.discountPrice || product.price;
      const itemSubtotal = unitPrice * item.quantity;

      orderItems.push({
        product: product._id,
        productSnapshot: {
          name: product.name,
          images: product.images.map(img => img.url),
          category: product.category,
          sku: product.sku
        },
        size: item.size,
        quantity: item.quantity,
        unitPrice,
        subtotal: itemSubtotal
      });

      subtotal += itemSubtotal;
    }

    // Calcular costos de envío
    const freeShippingThreshold = 150000;
    let shippingCost = 0;

    if (subtotal < freeShippingThreshold) {
      // Determinar costo de envío por ubicación
      const localCities = ['medellín', 'bello', 'itagüí', 'envigado', 'sabaneta', 'san pedro'];
      const isLocal = localCities.some(city => 
        shippingAddress.city.toLowerCase().includes(city)
      );
      
      if (isLocal) {
        shippingCost = 8000; // Área metropolitana
      } else if (shippingAddress.department.toLowerCase() === 'antioquia') {
        shippingCost = 12000; // Antioquia
      } else {
        shippingCost = 15000; // Resto del país
      }
    }

    // Calcular impuestos (IVA 19% solo en algunos productos)
    const tax = Math.round(subtotal * 0.19);
    const total = subtotal + shippingCost + tax;

    // Crear el pedido
    const orderData = {
      items: orderItems,
      shippingAddress,
      pricing: {
        subtotal,
        shipping: shippingCost,
        tax,
        total
      },
      payment: {
        method: payment.method,
        amount: total
      },
      notes: {
        customer: notes?.customer || ''
      }
    };

    // Agregar información del usuario o invitado
    if (req.userId) {
      orderData.user = req.userId;
    } else {
      orderData.guestInfo = guestInfo;
    }

    const order = new Order(orderData);
    await order.save();

    // Reducir stock de los productos
    for (let item of items) {
      await Product.findById(item.product).then(product => {
        return product.decrementStock(item.size, item.quantity);
      });
    }

    // Enviar email de confirmación
    try {
      const customerEmail = req.userId ? req.user.email : guestInfo.email;
      const customerName = req.userId ? 
        `${req.user.firstName} ${req.user.lastName}` : 
        `${guestInfo.firstName} ${guestInfo.lastName}`;

      await sendEmail({
        to: customerEmail,
        subject: `Pedido confirmado #${order.orderNumber} - ATHENA BRAND`,
        template: 'order-confirmation',
        data: {
          customerName,
          order,
          items: orderItems,
          trackingUrl: `${process.env.FRONTEND_URL}/pedido/${order.orderNumber}`
        }
      });
    } catch (emailError) {
      console.error('Error enviando email de confirmación:', emailError);
    }

    // Respuesta exitosa
    res.status(201).json({
      success: true,
      message: 'Pedido creado exitosamente',
      data: {
        orderNumber: order.orderNumber,
        total: order.pricing.total,
        status: order.status,
        estimatedDelivery: order.calculateEstimatedDelivery()
      }
    });

  } catch (error) {
    console.error('Error creando pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
});

// GET /api/orders - Obtener pedidos del usuario
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const orders = await Order.find({ user: req.userId })
      .populate('items.product', 'name images slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v');

    const total = await Order.countDocuments({ user: req.userId });

    res.json({
      success: true,
      data: orders,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });

  } catch (error) {
    console.error('Error obteniendo pedidos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// GET /api/orders/:orderNumber - Obtener detalle de pedido específico
router.get('/:orderNumber', optionalAuth, async (req, res) => {
  try {
    const { orderNumber } = req.params;

    const query = { orderNumber };
    
    // Si hay usuario autenticado, solo sus pedidos
    if (req.userId) {
      query.user = req.userId;
    }

    const order = await Order.findOne(query)
      .populate('items.product', 'name images slug category')
      .populate('user', 'firstName lastName email')
      .select('-__v');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    // Si no hay usuario autenticado, verificar que sea el email correcto (para invitados)
    if (!req.userId && req.query.email) {
      if (order.guestInfo?.email !== req.query.email) {
        return res.status(403).json({
          success: false,
          message: 'No autorizado para ver este pedido'
        });
      }
    }

    res.json({
      success: true,
      data: order
    });

  } catch (error) {
    console.error('Error obteniendo detalle del pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// PUT /api/orders/:id/status - Actualizar estado del pedido (solo admin)
router.put('/:id/status', adminAuth, [
  body('status')
    .isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'])
    .withMessage('Estado no válido'),
  body('notes').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos inválidos',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { status, notes, trackingNumber } = req.body;

    const order = await Order.findById(id)
      .populate('user', 'firstName lastName email')
      .populate('items.product', 'name');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    // Actualizar estado
    await order.updateStatus(
      status, 
      `${req.user.firstName} ${req.user.lastName}`, 
      notes
    );

    // Si se proporciona número de seguimiento
    if (trackingNumber && status === 'shipped') {
      order.shipping.trackingNumber = trackingNumber;
      await order.save();
    }

    // Enviar notificación al cliente
    try {
      const customerEmail = order.user?.email || order.guestInfo?.email;
      const customerName = order.user ? 
        `${order.user.firstName} ${order.user.lastName}` : 
        `${order.guestInfo.firstName} ${order.guestInfo.lastName}`;

      if (customerEmail) {
        await sendEmail({
          to: customerEmail,
          subject: `Actualización de pedido #${order.orderNumber} - ATHENA BRAND`,
          template: 'order-status-update',
          data: {
            customerName,
            orderNumber: order.orderNumber,
            status,
            statusText: getStatusText(status),
            trackingNumber: order.shipping.trackingNumber,
            trackingUrl: `${process.env.FRONTEND_URL}/pedido/${order.orderNumber}`
          }
        });
      }
    } catch (emailError) {
      console.error('Error enviando notificación:', emailError);
    }

    res.json({
      success: true,
      message: 'Estado del pedido actualizado exitosamente',
      data: {
        orderNumber: order.orderNumber,
        status: order.status,
        trackingNumber: order.shipping.trackingNumber
      }
    });

  } catch (error) {
    console.error('Error actualizando estado:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// GET /api/orders/admin/all - Obtener todos los pedidos (solo admin)
router.get('/admin/all', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const search = req.query.search;

    // Construir query
    let query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }

    let orders;
    let total;

    if (search) {
      // Búsqueda
      orders = await Order.searchOrders(search)
        .skip(skip)
        .limit(limit);
      total = (await Order.searchOrders(search)).length;
    } else {
      // Lista normal
      orders = await Order.find(query)
        .populate('user', 'firstName lastName email')
        .populate('items.product', 'name images sku')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-__v');
      
      total = await Order.countDocuments(query);
    }

    res.json({
      success: true,
      data: orders,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });

  } catch (error) {
    console.error('Error obteniendo pedidos (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// GET /api/orders/admin/stats - Estadísticas de ventas (solo admin)
router.get('/admin/stats', adminAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Estadísticas generales
    const stats = await Order.getSalesStats(start, end);
    
    // Pedidos por estado
    const statusStats = await Order.aggregate([
      { 
        $match: { 
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$pricing.total' }
        }
      }
    ]);

    // Productos más vendidos
    const topProducts = await Order.aggregate([
      { 
        $match: { 
          createdAt: { $gte: start, $lte: end },
          status: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalSold: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.subtotal' }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          name: '$product.name',
          sku: '$product.sku',
          totalSold: 1,
          revenue: 1
        }
      }
    ]);

    // Ventas por día
    const dailySales = await Order.aggregate([
      { 
        $match: { 
          createdAt: { $gte: start, $lte: end },
          status: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          orders: { $sum: 1 },
          revenue: { $sum: '$pricing.total' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        summary: stats[0] || {
          totalOrders: 0,
          totalRevenue: 0,
          averageOrder: 0,
          totalItems: 0
        },
        statusBreakdown: statusStats,
        topProducts,
        dailySales,
        period: {
          startDate: start,
          endDate: end
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// POST /api/orders/:orderNumber/payment/confirm - Confirmar pago PSE
router.post('/:orderNumber/payment/confirm', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { transactionId, pseReference, status } = req.body;

    const order = await Order.findOne({ orderNumber })
      .populate('user', 'firstName lastName email');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    if (status === 'approved') {
      await order.markAsPaid(transactionId, pseReference);
      
      res.json({
        success: true,
        message: 'Pago confirmado exitosamente'
      });
    } else {
      // Pago rechazado o cancelado
      order.payment.status = status;
      if (status === 'rejected' || status === 'cancelled') {
        order.status = 'cancelled';
      }
      await order.save();

      res.json({
        success: true,
        message: 'Estado de pago actualizado',
        data: { status }
      });
    }

  } catch (error) {
    console.error('Error confirmando pago:', error);
    res.status(500).json({
      success: false,
      message: 'Error procesando confirmación de pago'
    });
  }
});

// Función helper para traducir estados
function getStatusText(status) {
  const statusMap = {
    pending: 'Pendiente',
    confirmed: 'Confirmado',
    processing: 'En preparación',
    shipped: 'Enviado',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
    returned: 'Devuelto'
  };
  
  return statusMap[status] || status;
}

module.exports = router;