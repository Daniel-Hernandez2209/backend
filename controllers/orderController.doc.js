# Controlador de Pedidos - ATHENA BRAND

Este archivo implementa un **controlador completo de pedidos** para un e-commerce, manejando todo el ciclo de vida desde la creación hasta la entrega, incluyendo compras de usuarios registrados e invitados, gestión de stock, pagos PSE, y panel administrativo con estadísticas.

---

## Código Comentado Línea por Línea

```javascript
// controllers/orderController.js - Controlador de pedidos para ATHENA BRAND
const { validationResult } = require('express-validator'); // Utilidad para validar datos de entrada
const Order = require('../models/Order'); // Modelo de pedidos
const Product = require('../models/Product'); // Modelo de productos
const User = require('../models/User'); // Modelo de usuarios
const sendEmail = require('../utils/sendEmail'); // Utilidad para envío de emails

class OrderController {
  // POST /api/orders - Crear nuevo pedido
  static async createOrder(req, res) {
    try {
      // Verificar errores de validación de express-validator
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos del pedido inválidos',
          errors: errors.array()
        });
      }

      // Extraer datos del cuerpo de la petición
      const { items, shippingAddress, payment, notes, guestInfo } = req.body;

      // Si no hay usuario autenticado, debe ser compra de invitado
      if (!req.userId && !guestInfo) {
        return res.status(400).json({
          success: false,
          message: 'Información de contacto requerida para compras como invitado'
        });
      }

      // Validar productos y calcular precios
      let orderItems = []; // Array para almacenar items validados
      let subtotal = 0; // Variable para calcular subtotal

      // Iterar sobre cada item del pedido
      for (let item of items) {
        // Buscar producto en la base de datos
        const product = await Product.findById(item.product);
        
        // Validar que el producto existe y está activo
        if (!product || !product.isActive) {
          return res.status(400).json({
            success: false,
            message: `Producto ${item.product} no encontrado o no disponible`
          });
        }

        // Verificar stock disponible para la talla solicitada
        const sizeStock = product.sizes.find(s => s.size === item.size);
        if (!sizeStock || sizeStock.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Stock insuficiente para ${product.name} talla ${item.size}`
          });
        }

        // Calcular precio unitario (con descuento si aplica)
        const unitPrice = product.discountPrice || product.price;
        const itemSubtotal = unitPrice * item.quantity; // Subtotal por item

        // Crear snapshot del producto para historial
        orderItems.push({
          product: product._id, // Referencia al producto
          productSnapshot: { // Datos del producto al momento del pedido
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

        subtotal += itemSubtotal; // Sumar al subtotal total
      }

      // Calcular costos de envío basado en ubicación y subtotal
      const shippingCost = OrderController.calculateShippingCost(subtotal, shippingAddress);
      
      // Calcular impuestos (IVA 19% solo en algunos productos)
      const tax = Math.round(subtotal * 0.19);
      const total = subtotal + shippingCost + tax; // Total final

      // Crear el objeto de datos del pedido
      const orderData = {
        items: orderItems,
        shippingAddress,
        pricing: { // Desglose de precios
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
        orderData.user = req.userId; // Usuario registrado
      } else {
        orderData.guestInfo = guestInfo; // Compra como invitado
      }

      // Crear y guardar el pedido en la base de datos
      const order = new Order(orderData);
      await order.save();

      // 🚨 VULNERABILIDAD: Race condition - Reducir stock de los productos
      for (let item of items) {
        await Product.findById(item.product).then(product => {
          return product.decrementStock(item.size, item.quantity);
        });
      }

      // Enviar email de confirmación
      try {
        // Obtener email y nombre del cliente
        const customerEmail = req.userId ? req.user.email : guestInfo.email;
        const customerName = req.userId ? 
          `${req.user.firstName} ${req.user.lastName}` : 
          `${guestInfo.firstName} ${guestInfo.lastName}`;

        // Enviar email de confirmación
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
        // 🚨 VULNERABILIDAD: Log con información sensible
        console.error('Error enviando email de confirmación:', emailError);
      }

      // Respuesta exitosa con datos básicos del pedido
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
      // 🚨 VULNERABILIDAD: Log con información sensible y exposición en desarrollo
      console.error('Error creando pedido:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : {}
      });
    }
  }

  // GET /api/orders - Obtener pedidos del usuario
  static async getUserOrders(req, res) {
    try {
      // 🚨 VULNERABILIDAD: Sin validación de límites
      const page = parseInt(req.query.page) || 1; // Página actual
      const limit = parseInt(req.query.limit) || 10; // Items por página
      const skip = (page - 1) * limit; // Items a saltar

      // Buscar pedidos del usuario con paginación
      const orders = await Order.find({ user: req.userId })
        .populate('items.product', 'name images slug') // Poblar datos del producto
        .sort({ createdAt: -1 }) // Ordenar por fecha descendente
        .skip(skip)
        .limit(limit)
        .select('-__v'); // Excluir campo de versión

      // Contar total de pedidos del usuario
      