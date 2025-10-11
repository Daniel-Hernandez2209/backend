# Modelo de Pedidos para E-commerce - ATHENA BRAND

Este archivo define el esquema de MongoDB usando Mongoose para gestionar pedidos de un sistema de e-commerce. Incluye funcionalidades completas para usuarios registrados y compras como invitado, gestión de pagos (PSE, contraentrega, transferencias), seguimiento de envíos, historial de estados y estadísticas de ventas.

```js
// models/Order.js - Modelo de pedidos para ATHENA BRAND
const mongoose = require('mongoose'); // Importa Mongoose para modelado de datos MongoDB

// Define el esquema principal del pedido
const orderSchema = new mongoose.Schema({
  // Información del usuario
  user: {
    type: mongoose.Schema.Types.ObjectId, // Referencia al modelo User mediante ObjectId
    ref: 'User', // Establece la relación con el modelo User
    required: false // No es obligatorio para permitir compras como invitado
  },
  
  // Para compras como invitado - información temporal del cliente
  guestInfo: {
    email: String, // Email del invitado (sin validación - VULNERABILIDAD)
    firstName: String, // Nombre del invitado (sin límites - VULNERABILIDAD)
    lastName: String, // Apellido del invitado (sin límites - VULNERABILIDAD) 
    phone: String // Teléfono del invitado (sin validación - VULNERABILIDAD)
  },
  
  // Número único del pedido generado automáticamente
  orderNumber: {
    type: String,
    unique: true // Garantiza unicidad en la base de datos
  },
  
  // Array de productos en el pedido
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId, // Referencia al producto
      ref: 'Product', // Relación con el modelo Product
      required: true // Obligatorio tener al menos un producto
    },
    // Snapshot del producto al momento de la compra (evita cambios posteriores)
    productSnapshot: {
      name: String, // Nombre del producto cuando se hizo el pedido
      images: [String], // URLs de las imágenes del producto
      category: String, // Categoría del producto
      sku: String // Código único del producto
    },
    size: {
      type: String,
      required: true, // Talla obligatoria
      enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] // Tallas permitidas
    },
    quantity: {
      type: Number,
      required: true, // Cantidad obligatoria
      min: [1, 'La cantidad debe ser al menos 1'] // Validación mínima
    },
    unitPrice: {
      type: Number,
      required: true, // Precio unitario obligatorio
      min: [0, 'El precio unitario no puede ser negativo'] // No permite precios negativos
    },
    subtotal: {
      type: Number,
      required: true, // Subtotal por item obligatorio
      min: [0, 'El subtotal no puede ser negativo'] // Validación de valor positivo
    }
  }],
  
  // Dirección completa de envío del pedido
  shippingAddress: {
    firstName: { type: String, required: true }, // Nombre del destinatario
    lastName: { type: String, required: true }, // Apellido del destinatario
    street: { type: String, required: true }, // Dirección de la calle
    city: { type: String, required: true }, // Ciudad de destino
    department: { type: String, required: true }, // Departamento/Estado
    zipCode: String, // Código postal (opcional)
    country: { type: String, default: 'Colombia' }, // País con valor por defecto
    phone: String // Teléfono de contacto para entrega
  },
  
  // Desglose completo de precios del pedido
  pricing: {
    subtotal: {
      type: Number,
      required: true, // Subtotal antes de impuestos y envío
      min: [0, 'El subtotal no puede ser negativo']
    },
    shipping: {
      type: Number,
      required: true, // Costo de envío
      min: [0, 'El costo de envío no puede ser negativo']
    },
    tax: {
      type: Number,
      required: true, // Impuestos aplicados
      min: [0, 'Los impuestos no pueden ser negativos'],
      default: 0 // Por defecto sin impuestos
    },
    discount: {
      amount: { type: Number, default: 0 }, // Monto del descuento aplicado
      code: String, // Código de cupón usado
      description: String // Descripción del descuento
    },
    total: {
      type: Number,
      required: true, // Total final a pagar
      min: [0, 'El total no puede ser negativo']
    }
  },
  
  // Estado actual del pedido en el flujo de trabajo
  status: {
    type: String,
    enum: [
      'pending',     // Pendiente de confirmación
      'confirmed',   // Confirmado y pagado
      'processing',  // En proceso de preparación
      'shipped',     // Enviado
      'delivered',   // Entregado
      'cancelled',   // Cancelado
      'returned'     // Devuelto
    ],
    default: 'pending' // Estado inicial por defecto
  },
  
  // Historial completo de cambios de estado para auditoría
  statusHistory: [{
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']
    },
    changedAt: { type: Date, default: Date.now }, // Timestamp del cambio
    changedBy: String, // Usuario admin que realizó el cambio
    notes: String // Notas adicionales sobre el cambio
  }],
  
  // Información completa del método y estado de pago
  payment: {
    method: {
      type: String,
      enum: ['pse', 'cash_on_delivery', 'bank_transfer'], // Métodos de pago disponibles
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled', 'refunded'], // Estados de pago
      default: 'pending'
    },
    transactionId: String, // ID de transacción del procesador (SIN CIFRAR - VULNERABILIDAD)
    pseReference: String, // Referencia específica de PSE (SIN CIFRAR - VULNERABILIDAD)
    paidAt: Date, // Fecha y hora del pago confirmado
    amount: Number // Monto pagado
  },
  
  // Información detallada del envío y tracking
  shipping: {
    method: {
      type: String,
      enum: ['standard', 'express', 'pickup'], // Tipos de envío disponibles
      default: 'standard'
    },
    carrier: String, // Empresa transportadora
    trackingNumber: String, // Número de seguimiento del envío
    shippedAt: Date, // Fecha de envío
    estimatedDelivery: Date, // Fecha estimada de entrega
    actualDelivery: Date // Fecha real de entrega
  },
  
  // Notas internas y del cliente sobre el pedido
  notes: {
    customer: String, // Notas del cliente (SIN SANITIZACIÓN - VULNERABILIDAD XSS)
    admin: String, // Notas internas del admin (SIN SANITIZACIÓN - VULNERABILIDAD XSS)
    delivery: String // Notas para el delivery (SIN SANITIZACIÓN - VULNERABILIDAD XSS)
  },
  
  // Registro de comunic