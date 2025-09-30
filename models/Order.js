// models/Order.js - Modelo de pedidos para ATHENA BRAND
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  // Información del usuario
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Permitir compras como invitado
  },
  
  // Para compras como invitado
  guestInfo: {
    email: String,
    firstName: String,
    lastName: String,
    phone: String
  },
  
  // Número único del pedido
  orderNumber: {
    type: String,
    unique: true
  },
  
  // Items del pedido
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    productSnapshot: {
      name: String,
      images: [String],
      category: String,
      sku: String
    },
    size: {
      type: String,
      required: true,
      enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'La cantidad debe ser al menos 1']
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, 'El precio unitario no puede ser negativo']
    },
    subtotal: {
      type: Number,
      required: true,
      min: [0, 'El subtotal no puede ser negativo']
    }
  }],
  
  // Dirección de envío
  shippingAddress: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    department: { type: String, required: true },
    zipCode: String,
    country: { type: String, default: 'Colombia' },
    phone: String
  },
  
  // Información de precios
  pricing: {
    subtotal: {
      type: Number,
      required: true,
      min: [0, 'El subtotal no puede ser negativo']
    },
    shipping: {
      type: Number,
      required: true,
      min: [0, 'El costo de envío no puede ser negativo']
    },
    tax: {
      type: Number,
      required: true,
      min: [0, 'Los impuestos no pueden ser negativos'],
      default: 0
    },
    discount: {
      amount: { type: Number, default: 0 },
      code: String,
      description: String
    },
    total: {
      type: Number,
      required: true,
      min: [0, 'El total no puede ser negativo']
    }
  },
  
  // Estado del pedido
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
    default: 'pending'
  },
  
  // Historial de estados
  statusHistory: [{
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']
    },
    changedAt: { type: Date, default: Date.now },
    changedBy: String, // Admin que cambió el estado
    notes: String
  }],
  
  // Información de pago
  payment: {
    method: {
      type: String,
      enum: ['pse', 'cash_on_delivery', 'bank_transfer'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled', 'refunded'],
      default: 'pending'
    },
    transactionId: String,
    pseReference: String,
    paidAt: Date,
    amount: Number
  },
  
  // Información de envío
  shipping: {
    method: {
      type: String,
      enum: ['standard', 'express', 'pickup'],
      default: 'standard'
    },
    carrier: String,
    trackingNumber: String,
    shippedAt: Date,
    estimatedDelivery: Date,
    actualDelivery: Date
  },
  
  // Notas del cliente y admin
  notes: {
    customer: String,
    admin: String,
    delivery: String
  },
  
  // Comunicaciones
  notifications: [{
    type: {
      type: String,
      enum: ['email', 'sms', 'whatsapp']
    },
    content: String,
    sentAt: Date,
    status: {
      type: String,
      enum: ['sent', 'delivered', 'failed']
    }
  }]
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para optimización
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'payment.status': 1 });
orderSchema.index({ 'guestInfo.email': 1 });

// Virtual para el nombre completo del cliente
orderSchema.virtual('customerName').get(function() {
  if (this.user) {
    return `${this.user.firstName} ${this.user.lastName}`;
  }
  return `${this.guestInfo.firstName} ${this.guestInfo.lastName}`;
});

// Virtual para el email del cliente
orderSchema.virtual('customerEmail').get(function() {
  if (this.user) {
    return this.user.email;
  }
  return this.guestInfo.email;
});

// Virtual para verificar si es compra de invitado
orderSchema.virtual('isGuestOrder').get(function() {
  return !this.user;
});

// Virtual para cantidad total de items
orderSchema.virtual('totalItems').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Middleware para generar número de pedido antes de guardar
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const count = await mongoose.model('Order').countDocuments();
    const year = new Date().getFullYear();
    this.orderNumber = `ATH-${year}-${String(count + 1).padStart(6, '0')}`;
  }
  
  // Agregar al historial de estados si el estado cambió
  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      changedAt: new Date()
    });
  }
  
  next();
});

// Método para actualizar estado
orderSchema.methods.updateStatus = function(newStatus, changedBy, notes) {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    changedBy,
    notes,
    changedAt: new Date()
  });
  
  // Actualizar fechas específicas según el estado
  if (newStatus === 'shipped' && !this.shipping.shippedAt) {
    this.shipping.shippedAt = new Date();
  }
  
  if (newStatus === 'delivered' && !this.shipping.actualDelivery) {
    this.shipping.actualDelivery = new Date();
  }
  
  if (newStatus === 'confirmed' && !this.payment.paidAt) {
    this.payment.paidAt = new Date();
    this.payment.status = 'approved';
  }
  
  return this.save();
};

// Método para marcar como pagado
orderSchema.methods.markAsPaid = function(transactionId, pseReference) {
  this.payment.status = 'approved';
  this.payment.paidAt = new Date();
  this.payment.transactionId = transactionId;
  this.payment.pseReference = pseReference;
  
  if (this.status === 'pending') {
    this.updateStatus('confirmed', 'system', 'Pago confirmado automáticamente');
  }
  
  return this.save();
};

// Método para calcular tiempo de entrega estimado
orderSchema.methods.calculateEstimatedDelivery = function() {
  const now = new Date();
  let deliveryDays = 3; // Por defecto 3 días
  
  // Ajustar según la ciudad
  const localCities = ['medellín', 'bello', 'itagüí', 'envigado', 'sabaneta'];
  const isLocal = localCities.some(city => 
    this.shippingAddress.city.toLowerCase().includes(city)
  );
  
  if (isLocal) {
    deliveryDays = 1; // 1-2 días para área metropolitana
  } else if (this.shippingAddress.department.toLowerCase() === 'antioquia') {
    deliveryDays = 2; // 2-3 días para Antioquia
  } else {
    deliveryDays = 5; // 3-5 días para resto del país
  }
  
  const estimatedDate = new Date(now);
  estimatedDate.setDate(now.getDate() + deliveryDays);
  
  return estimatedDate;
};

// Método estático para obtener estadísticas de ventas
orderSchema.statics.getSalesStats = async function(startDate, endDate) {
  const match = {
    createdAt: { $gte: startDate, $lte: endDate },
    status: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] }
  };
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$pricing.total' },
        averageOrder: { $avg: '$pricing.total' },
        totalItems: { $sum: { $sum: '$items.quantity' } }
      }
    }
  ]);
};

// Método estático para buscar pedidos
orderSchema.statics.searchOrders = function(query) {
  const searchRegex = new RegExp(query, 'i');
  
  return this.find({
    $or: [
      { orderNumber: searchRegex },
      { 'shippingAddress.firstName': searchRegex },
      { 'shippingAddress.lastName': searchRegex },
      { 'guestInfo.firstName': searchRegex },
      { 'guestInfo.lastName': searchRegex },
      { 'guestInfo.email': searchRegex }
    ]
  }).populate('user', 'firstName lastName email')
    .populate('items.product', 'name images sku')
    .sort({ createdAt: -1 });
};

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;// middleware/auth.js - Middleware de autenticación y autorización