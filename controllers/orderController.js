// controllers/orderController.js - Controlador de pedidos para ATHENA BRAND
import { validationResult, query } from "express-validator";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import logger from "../utils/logger.js";
import crypto from "crypto";
import sendEmail from "../utils/sendEmail.js";
import mongoose from "mongoose";


class OrderController {
  // POST /api/orders - Crear nuevo pedido
  static async createOrder(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos del pedido inválidos',
          errors: errors.array()
        });
      }

      const { items, shippingAddress, payment, notes, guestInfo } = req.body;

      if (!req.userId && !guestInfo) {
        return res.status(400).json({
          success: false,
          message: 'Información de contacto requerida para compras como invitado'
        });
      }

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

        const sizeStock = product.sizes.find(s => s.size === item.size);
        if (!sizeStock || sizeStock.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Stock insuficiente para ${product.name} talla ${item.size}`
          });
        }

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

      const shippingCost = OrderController.calculateShippingCost(subtotal, shippingAddress);
      const tax = Math.round(subtotal * 0.19);
      const total = subtotal + shippingCost + tax;

      let guestAccessToken = undefined;
      let accessToken = null;
      if (!req.userId) {
        accessToken = crypto.randomBytes(32).toString('hex');
        guestAccessToken = crypto.createHash('sha256').update(accessToken).digest('hex');
      }

      const orderData = {
        items: orderItems,
        shippingAddress,
        pricing: { subtotal, shipping: shippingCost, tax, total },
        payment: { method: payment.method, amount: total },
        notes: { customer: notes?.customer || '' },
        guestAccessToken
      };

      if (req.userId) {
        orderData.user = req.userId;
      } else {
        orderData.guestInfo = guestInfo;
      }

      const session = await mongoose.startSession();
      let order;

      try {
        await session.withTransaction(async () => {
          for (let item of items) {
            const result = await Product.findOneAndUpdate(
              { 
                _id: item.product,
                'sizes.size': item.size,
                'sizes.stock': { $gte: item.quantity }
              },
              { $inc: { 'sizes.$.stock': -item.quantity } },
              { session, new: true }
            );
            if (!result) throw new Error(`Stock insuficiente para ${item.product}`);
          }

          order = new Order(orderData);
          await order.save({ session });
        });
      } finally {
        await session.endSession();
      }

      // Enviar email
      try {
        const customerEmail = req.userId ? req.user.email : guestInfo.email;
        const customerName = req.userId 
          ? `${req.user.firstName} ${req.user.lastName}` 
          : `${guestInfo.firstName} ${guestInfo.lastName}`;

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
        logger.error('Email confirmation failed', {
          orderId: order._id,
          error: emailError.message,
          timestamp: new Date().toISOString()
        });
      }

      res.status(201).json({
        success: true,
        message: 'Pedido creado exitosamente',
        data: {
          orderNumber: order.orderNumber,
          total: order.pricing.total,
          status: order.status,
          estimatedDelivery: order.calculateEstimatedDelivery(),
          guestToken: accessToken
        }
      });

    } catch (error) {
      logger.error('Error creando pedido', { 
        userId: req.userId,
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  // GET /api/orders - Obtener pedidos del usuario
  static async getUserOrders(req, res) {
    try {
      // ⚠️ Las validaciones deben estar en las rutas, no aquí
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 10, 50);
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
      logger.error('Error en getUserOrders', { userId: req.userId, error: error.message });
      res.status(500).json({ success: false, message: 'Error al obtener pedidos' });
    }
  }

  // GET /api/orders/:orderNumber
  static async getOrderByNumber(req, res) {
    try {
      const { orderNumber } = req.params;
      const { token } = req.query;

      let filter = { orderNumber };

      if (req.userId) {
        filter.user = req.userId;
      } else {
        if (!token) {
          return res.status(401).json({ success: false, message: 'Token de acceso requerido' });
        }
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        if (!hashedToken) {
          return res.status(400).json({ success: false, message: 'Token inválido' });
        }
        filter.guestAccessToken = hashedToken;
      }

      const order = await Order.findOne(filter)
        .populate('items.product', 'name images slug category')
        .populate('user', 'firstName lastName email')
        .select('-__v');

      if (!order) {
        return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
      }

      res.json({ success: true, data: order });
    } catch (error) {
      logger.error('Error en getOrderByNumber', { error: error.message });
      res.status(500).json({ success: false, message: 'Error al obtener el pedido' });
    }
  }

  // PUT /api/orders/:id/status - Solo admin
  static async updateOrderStatus(req, res) {
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
        return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
      }

      await order.updateStatus(status, `${req.user.firstName} ${req.user.lastName}`, notes);

      if (trackingNumber && status === 'shipped') {
        order.shipping.trackingNumber = trackingNumber;
        await order.save();
      }

      // Enviar email
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
              statusText: OrderController.getStatusText(status),
              trackingNumber: order.shipping.trackingNumber,
              trackingUrl: `${process.env.FRONTEND_URL}/pedido/${order.orderNumber}`
            }
          });
        }
      } catch (emailError) {
        logger.error('Email de actualización fallido', {
          orderId: order._id,
          error: emailError.message
        });
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
      logger.error('Error en updateOrderStatus', { error: error.message, orderId: req.params.id });
      res.status(500).json({ success: false, message: 'Error al actualizar el pedido' });
    }
  }

  // GET /api/orders/admin/all - Solo admin
  static async getAllOrdersAdmin(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 20, 50);
      const skip = (page - 1) * limit;
      const { status, search } = req.query;

      let filter = {};
      if (status) filter.status = status;

      let orders, total;

      if (search) {
        // Asumiendo que `searchOrders` es un método estático en el modelo
        const searchResults = await Order.searchOrders(search);
        total = searchResults.length;
        orders = searchResults.slice(skip, skip + limit);
      } else {
        orders = await Order.find(filter)
          .populate('user', 'firstName lastName email')
          .populate('items.product', 'name images sku')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .select('-__v');
        total = await Order.countDocuments(filter);
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
      logger.error('Error en getAllOrdersAdmin', { error: error.message });
      res.status(500).json({ success: false, message: 'Error al obtener pedidos' });
    }
  }

  // GET /api/orders/admin/stats - Solo admin
  static async getOrderStats(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const stats = await Order.getSalesStats(start, end);
      
      const statusStats = await Order.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$pricing.total' }
          }
        }
      ]);

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
          period: { startDate: start, endDate: end }
        }
      });

    } catch (error) {
      logger.error('Error en getOrderStats', { error: error.message });
      res.status(500).json({ success: false, message: 'Error al obtener estadísticas' });
    }
  }

  // POST /api/orders/:orderNumber/payment/confirm
  static async confirmPayment(req, res) {
    try {
      const { orderNumber } = req.params;
      const { transactionId, pseReference, status } = req.body;

      const order = await Order.findOne({ orderNumber });
      if (!order) {
        return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
      }

      if (status === 'approved') {
        await order.markAsPaid(transactionId, pseReference);
        res.json({ success: true, message: 'Pago confirmado exitosamente' });
      } else {
        order.payment.status = status;
        if (['rejected', 'cancelled'].includes(status)) {
          order.status = 'cancelled';
        }
        await order.save();
        res.json({ success: true, message: 'Estado de pago actualizado', data: { status } });
      }

    } catch (error) {
      logger.error('Error en confirmPayment', { error: error.message, orderNumber: req.params.orderNumber });
      res.status(500).json({ success: false, message: 'Error al confirmar el pago' });
    }
  }

  // DELETE /api/orders/:id - Cancelar pedido
  static async cancelOrder(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const order = await Order.findById(id);
      if (!order) {
        return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
      }

      if (!['pending', 'confirmed'].includes(order.status)) {
        return res.status(400).json({ success: false, message: 'No se puede cancelar un pedido en este estado' });
      }

      if (order.user && order.user.toString() !== req.userId && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'No autorizado' });
      }

      // Restaurar stock
      for (let item of order.items) {
        await Product.updateOne(
          { _id: item.product },
          { $inc: { [`sizes.$[elem].stock`]: item.quantity } },
          { arrayFilters: [{ 'elem.size': item.size }] }
        );
      }

      await order.updateStatus(
        'cancelled',
        req.user ? `${req.user.firstName} ${req.user.lastName}` : 'Sistema',
        reason || 'Pedido cancelado'
      );

      res.json({ success: true, message: 'Pedido cancelado exitosamente' });

    } catch (error) {
      logger.error('Error en cancelOrder', { error: error.message, orderId: req.params.id });
      res.status(500).json({ success: false, message: 'Error al cancelar el pedido' });
    }
  }

  // Métodos auxiliares
  static calculateShippingCost(subtotal, shippingAddress) {
    const freeShippingThreshold = 150000;
    if (subtotal >= freeShippingThreshold) return 0;

    const localCities = ['medellín', 'bello', 'itagüí', 'envigado', 'sabaneta', 'san pedro'];
    const city = (shippingAddress.city || '').toLowerCase();
    const department = (shippingAddress.department || '').toLowerCase();

    if (localCities.some(c => city.includes(c))) return 8000;
    if (department === 'antioquia') return 12000;
    return 15000;
  }

  static getStatusText(status) {
    const map = {
      pending: 'Pendiente',
      confirmed: 'Confirmado',
      processing: 'En preparación',
      shipped: 'Enviado',
      delivered: 'Entregado',
      cancelled: 'Cancelado',
      returned: 'Devuelto'
    };
    return map[status] || status;
  }
}

export default OrderController;