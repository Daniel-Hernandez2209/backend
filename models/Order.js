// models/Order.js - Modelo de pedidos para ATHENA BRAND (SEGURA, revisado)
import mongoose from "mongoose";
import validator from "validator";
import DOMPurify from "isomorphic-dompurify";
import crypto from "crypto";


const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    importd: false
  },

  guestInfo: {
    email: {
      type: String,
      validate: {
        validator: function(email) {
          return !email || validator.isEmail(email);
        },
        message: 'Email inválido'
      },
      maxlength: [254, 'Email demasiado largo']
    },
    firstName: {
      type: String,
      maxlength: [50, 'Nombre demasiado largo'],
      validate: {
        validator: function(name) {
          return !name || /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]+$/.test(name);
        },
        message: 'Nombre contiene caracteres inválidos'
      }
    },
    lastName: {
      type: String,
      maxlength: [50, 'Apellido demasiado largo'],
      validate: {
        validator: function(name) {
          return !name || /^[a-zA-ZáéíóúñÁÉÍÓÚÜÑ\s]+$/.test(name);
        },
        message: 'Apellido contiene caracteres inválidos'
      }
    },
    phone: {
      type: String,
      validate: {
        validator: function(phone) {
          return !phone || /^[\+]?[0-9\s\-\(\)]{7,20}$/.test(phone);
        },
        message: 'Teléfono inválido'
      }
    }
  },

  orderNumber: {
    type: String,
    unique: true
  },

  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      importd: true
    },
    productSnapshot: {
      name: String,
      images: [String],
      category: String,
      sku: String
    },
    size: {
      type: String,
      importd: true,
      enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
    },
    quantity: {
      type: Number,
      importd: true,
      min: [1, 'La cantidad debe ser al menos 1']
    },
    unitPrice: {
      type: Number,
      importd: true,
      min: [0, 'El precio unitario no puede ser negativo']
    },
    subtotal: {
      type: Number,
      importd: true,
      min: [0, 'El subtotal no puede ser negativo']
    }
  }],

  shippingAddress: {
    firstName: { 
      type: String, 
      importd: true,
      maxlength: [50, 'Nombre demasiado largo'],
      validate: {
        validator: function(name) {
          return /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]+$/.test(name);
        },
        message: 'Nombre contiene caracteres inválidos'
      }
    },
    lastName: { 
      type: String, 
      importd: true,
      maxlength: [50, 'Apellido demasiado largo'],
      validate: {
        validator: function(name) {
          return /^[a-zA-ZáéíóúñÁÉÍÓÚÜÑ\s]+$/.test(name);
        },
        message: 'Apellido contiene caracteres inválidos'
      }
    },
    street: { 
      type: String, 
      importd: true,
      maxlength: [200, 'Dirección demasiado larga']
    },
    city: { 
      type: String, 
      importd: true,
      maxlength: [100, 'Ciudad demasiado larga']
    },
    department: { 
      type: String, 
      importd: true,
      maxlength: [100, 'Departamento demasiado largo']
    },
    zipCode: { 
      type: String,
      maxlength: [10, 'Código postal demasiado largo']
    },
    country: { 
      type: String, 
      default: 'Colombia',
      maxlength: [50, 'País demasiado largo']
    },
    phone: {
      type: String,
      validate: {
        validator: function(phone) {
          return !phone || /^[\+]?[0-9\s\-\(\)]{7,20}$/.test(phone);
        },
        message: 'Teléfono inválido'
      }
    }
  },

  pricing: {
    subtotal: {
      type: Number,
      importd: true,
      min: [0, 'El subtotal no puede ser negativo']
    },
    shipping: {
      type: Number,
      importd: true,
      min: [0, 'El costo de envío no puede ser negativo']
    },
    tax: {
      type: Number,
      importd: true,
      min: [0, 'Los impuestos no pueden ser negativos'],
      default: 0
    },
    discount: {
      amount: { type: Number, default: 0 },
      code: { type: String, maxlength: [20, 'Código de descuento demasiado largo'] },
      description: { type: String, maxlength: [200, 'Descripción demasiado larga'] }
    },
    total: {
      type: Number,
      importd: true,
      min: [0, 'El total no puede ser negativo']
    }
  },

  status: {
    type: String,
    enum: [
      'pending',
      'confirmed',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
      'returned'
    ],
    default: 'pending'
  },

  statusHistory: [{
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']
    },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: String, maxlength: [100, 'Nombre de admin demasiado largo'] },
    notes: { type: String, maxlength: [500, 'Notas demasiado largas'] }
  }],

  payment: {
    method: {
      type: String,
      enum: ['pse', 'cash_on_delivery', 'bank_transfer'],
      importd: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled', 'refunded'],
      default: 'pending'
    },
    transactionId: String, // cifrado
    pseReference: String,  // cifrado
    paidAt: Date,
    amount: Number
  },

  shipping: {
    method: {
      type: String,
      enum: ['standard', 'express', 'pickup'],
      default: 'standard'
    },
    carrier: { type: String, maxlength: [100, 'Nombre de transportadora demasiado largo'] },
    trackingNumber: { type: String, maxlength: [50, 'Número de seguimiento demasiado largo'] },
    shippedAt: Date,
    estimatedDelivery: Date,
    actualDelivery: Date
  },

  notes: {
    customer: String,
    admin: String,
    delivery: String
  },

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
  }],

  // Campo auxiliar para búsqueda indexada (texto plano, minificado)
  searchableText: { type: String, index: 'text' }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'payment.status': 1 });
orderSchema.index({ 'guestInfo.email': 1 });
orderSchema.index({ orderNumber: 1 }, { unique: true });

// Virtuals
orderSchema.virtual('customerName').get(function() {
  if (this.user && this.populated && this.user.firstName) {
    return `${this.user.firstName || ''} ${this.user.lastName || ''}`.trim();
  }
  return `${this.guestInfo.firstName || ''} ${this.guestInfo.lastName || ''}`.trim();
});

orderSchema.virtual('customerEmail').get(function() {
  if (this.user && this.populated && this.user.email) {
    return this.user.email;
  }
  return this.guestInfo.email;
});

orderSchema.virtual('isGuestOrder').get(function() {
  return !this.user;
});

orderSchema.virtual('totalItems').get(function() {
  return (this.items || []).reduce((total, item) => total + (item.quantity || 0), 0);
});

// Helpers
const escapeRegex = (string) => {
  if (typeof string !== 'string') return '';
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const sanitizeText = (text) => {
  if (!text) return '';
  return DOMPurify.sanitize(String(text), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
};

// Cifrado AES-256-GCM correcto: createCipheriv / createDecipheriv
orderSchema.methods.encryptSensitiveData = function(data) {
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY no configurada');
  }
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY inválida: debe tener 32 bytes (64 hex chars)');

  const iv = crypto.randomBytes(12); // 12 bytes recomendado para GCM
  const algorithm = 'aes-256-gcm';

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(data), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
};

orderSchema.methods.decryptSensitiveData = function(encrypted) {
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY no configurada');
  }
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY inválida: debe tener 32 bytes (64 hex chars)');

  const [ivHex, authTagHex, dataHex] = String(encrypted).split(':');
  if (!ivHex || !authTagHex || !dataHex) return null;

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encryptedData = Buffer.from(dataHex, 'hex');

  const algorithm = 'aes-256-gcm';
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  return decrypted.toString('utf8');
};

// Pre-save: sanitizar, cifrar, generar orderNumber y searchableText, y mantener statusHistory ordenado
orderSchema.pre('save', async function(next) {
  try {
    // Sanitizar notas
    if (this.notes) {
      this.notes.customer = sanitizeText(this.notes.customer);
      this.notes.admin = sanitizeText(this.notes.admin);
      this.notes.delivery = sanitizeText(this.notes.delivery);
    }

    // Sanitizar notificaciones
    if (Array.isArray(this.notifications)) {
      this.notifications = this.notifications.map(n => {
        if (n && n.content) n.content = sanitizeText(n.content);
        return n;
      });
    }

    // Cifrar campos de pago si se modificaron
    if (this.isModified('payment.transactionId') && this.payment.transactionId) {
      this.payment.transactionId = this.encryptSensitiveData(this.payment.transactionId);
    }
    if (this.isModified('payment.pseReference') && this.payment.pseReference) {
      this.payment.pseReference = this.encryptSensitiveData(this.payment.pseReference);
    }

    // Generar orderNumber anual incremental seguro
    if (!this.orderNumber) {
      const currentYear = new Date().getFullYear();
      const startOfYear = new Date(currentYear, 0, 1);
      const endOfYear = new Date(currentYear + 1, 0, 1);

      // Usamos countDocuments con filtro por prefijo y rango de fechas (es eficiente si existe índice createdAt)
      const count = await mongoose.model('Order').countDocuments({
        orderNumber: { $regex: `^ATH-${currentYear}-` },
        createdAt: { $gte: startOfYear, $lt: endOfYear }
      });

      this.orderNumber = `ATH-${currentYear}-${String(count + 1).padStart(6, '0')}`;
    }

    // Agregar al historial si cambió el estado
    if (this.isModified('status')) {
      this.statusHistory = this.statusHistory || [];
      this.statusHistory.push({
        status: this.status,
        changedAt: new Date()
      });
    }

    // Mantener statusHistory ordenado por fecha (defensa adicional)
    if (Array.isArray(this.statusHistory) && this.statusHistory.length > 1) {
      this.statusHistory.sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt));
    }

    // Construir searchableText (minimizar y lower-case) para búsquedas rápidas
    const parts = [];
    if (this.orderNumber) parts.push(this.orderNumber);
    if (this.guestInfo?.email) parts.push(this.guestInfo.email);
    if (this.shippingAddress?.firstName) parts.push(this.shippingAddress.firstName);
    if (this.shippingAddress?.lastName) parts.push(this.shippingAddress.lastName);
    this.searchableText = parts.join(' ').toLowerCase();

    next();
  } catch (err) {
    next(err);
  }
});

// Métodos de instancia
orderSchema.methods.updateStatus = function(newStatus, changedBy = 'system', notes) {
  this.status = newStatus;
  this.statusHistory = this.statusHistory || [];
  this.statusHistory.push({
    status: newStatus,
    changedBy,
    notes: sanitizeText(notes),
    changedAt: new Date()
  });

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

orderSchema.methods.markAsPaid = function(transactionId, pseReference) {
  this.payment.status = 'approved';
  this.payment.paidAt = new Date();
  this.payment.transactionId = transactionId;
  this.payment.pseReference = pseReference;

  if (this.status === 'pending') {
    // usar updateStatus para historial y guardado
    return this.updateStatus('confirmed', 'system', 'Pago confirmado automáticamente');
  }

  return this.save();
};

orderSchema.methods.calculateEstimatedDelivery = function() {
  const now = new Date();
  let deliveryDays = 3;
  const localCities = ['medellín', 'bello', 'itagüí', 'envigado', 'sabaneta'];
  const city = String(this.shippingAddress?.city || '').toLowerCase();
  const department = String(this.shippingAddress?.department || '').toLowerCase();

  const isLocal = localCities.some(c => city.includes(c));
  if (isLocal) deliveryDays = 1;
  else if (department === 'antioquia') deliveryDays = 2;
  else deliveryDays = 5;

  const estimatedDate = new Date(now);
  estimatedDate.setDate(now.getDate() + deliveryDays);
  return estimatedDate;
};

// Estadísticas de ventas (estabilidad y precisión)
orderSchema.statics.getSalesStats = async function(startDate, endDate) {
  const match = {
    createdAt: { $gte: startDate, $lte: endDate },
    status: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] }
  };

  // Resumen de pedidos (totalOrders, totalRevenue, averageOrder)
  const summaryAgg = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$pricing.total' },
        averageOrder: { $avg: '$pricing.total' }
      }
    }
  ]);

  // Total items vendidos (unwind + group)
  const itemsAgg = await this.aggregate([
    { $match: match },
    { $unwind: '$items' },
    {
      $group: {
        _id: null,
        totalItems: { $sum: '$items.quantity' }
      }
    }
  ]);

  const summary = summaryAgg[0] || { totalOrders: 0, totalRevenue: 0, averageOrder: 0 };
  const totalItems = (itemsAgg[0] && itemsAgg[0].totalItems) || 0;

  return [{
    totalOrders: summary.totalOrders,
    totalRevenue: summary.totalRevenue,
    averageOrder: summary.averageOrder,
    totalItems
  }];
};

// Búsqueda segura de pedidos
orderSchema.statics.searchOrders = function(query) {
  if (!query || typeof query !== 'string') {
    return this.find({}).populate('user', 'firstName lastName email').populate('items.product', 'name images sku').sort({ createdAt: -1 });
  }

  const sanitizedQuery = escapeRegex(query);
  const searchRegex = new RegExp(sanitizedQuery, 'i');

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

export default Order;
