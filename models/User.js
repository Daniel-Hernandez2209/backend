// models/User.js - Modelo de usuarios para ATHENA BRAND
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'El email es requerido'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email no válido']
  },
  
  password: {
    type: String,
    required: [true, 'La contraseña es requerida'],
    minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
    select: false // No incluir por defecto en consultas
  },
  
  firstName: {
    type: String,
    required: [true, 'El nombre es requerido'],
    trim: true,
    maxlength: [50, 'El nombre no puede exceder 50 caracteres']
  },
  
  lastName: {
    type: String,
    required: [true, 'El apellido es requerido'],
    trim: true,
    maxlength: [50, 'El apellido no puede exceder 50 caracteres']
  },
  
  phone: {
    type: String,
    trim: true,
    match: [/^[+]?[\d\s\-\(\)]+$/, 'Número de teléfono no válido']
  },
  
  // Dirección principal
  address: {
    street: {
      type: String,
      trim: true,
      maxlength: [200, 'La dirección no puede exceder 200 caracteres']
    },
    city: {
      type: String,
      trim: true,
      maxlength: [100, 'La ciudad no puede exceder 100 caracteres']
    },
    department: {
      type: String,
      trim: true,
      maxlength: [100, 'El departamento no puede exceder 100 caracteres']
    },
    zipCode: {
      type: String,
      trim: true,
      maxlength: [10, 'El código postal no puede exceder 10 caracteres']
    },
    country: {
      type: String,
      trim: true,
      default: 'Colombia',
      maxlength: [50, 'El país no puede exceder 50 caracteres']
    }
  },
  
  // Múltiples direcciones para envío
  shippingAddresses: [{
    name: String, // Ej: "Casa", "Oficina"
    street: String,
    city: String,
    department: String,
    zipCode: String,
    country: { type: String, default: 'Colombia' },
    isDefault: { type: Boolean, default: false }
  }],
  
  // Información adicional
  birthDate: Date,
  gender: {
    type: String,
    enum: ['masculino', 'femenino', 'otro', 'prefiero_no_decir']
  },
  
  // Preferencias
  preferences: {
    newsletter: { type: Boolean, default: true },
    smsMarketing: { type: Boolean, default: false },
    favoriteCategories: [String],
    size: {
      type: String,
      enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
    }
  },
  
  // Sistema de roles
  role: {
    type: String,
    enum: ['customer', 'admin', 'moderator'],
    default: 'customer'
  },
  
  // Estado de la cuenta
  isActive: {
    type: Boolean,
    default: true
  },
  
  isVerified: {
    type: Boolean,
    default: false
  },
  
  // Tokens para verificación y reseteo
  verificationToken: String,
  verificationTokenExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  
  // Tracking de actividad
  lastLogin: Date,
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  
  // Wishlist - productos favoritos
  wishlist: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  
  // Historial de compras (referencia)
  totalOrders: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  
  // Avatar del usuario
  avatar: {
    url: String,
    cloudinaryId: String
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para optimización
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ verificationToken: 1 });
userSchema.index({ passwordResetToken: 1 });

// Virtual para nombre completo
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual para verificar si la cuenta está bloqueada
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Hash password antes de guardar
userSchema.pre('save', async function(next) {
  // Solo hash si la contraseña fue modificada
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password con cost de 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Método para comparar contraseñas
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Método para incrementar intentos de login fallidos
userSchema.methods.incrementLoginAttempts = function() {
  // Si ya tenemos un previous lock que ha expirado, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Si llegamos al máximo de intentos y no estamos bloqueados, bloquear
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + (30 * 60 * 1000) }; // 30 minutos
  }
  
  return this.updateOne(updates);
};

// Método para resetear intentos de login
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Método para agregar producto a wishlist
userSchema.methods.addToWishlist = function(productId) {
  if (!this.wishlist.includes(productId)) {
    this.wishlist.push(productId);
    return this.save();
  }
  return Promise.resolve(this);
};

// Método para remover producto de wishlist
userSchema.methods.removeFromWishlist = function(productId) {
  this.wishlist.pull(productId);
  return this.save();
};

// Método para generar token de verificación
userSchema.methods.generateVerificationToken = function() {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  
  this.verificationToken = token;
  this.verificationTokenExpires = Date.now() + (24 * 60 * 60 * 1000); // 24 horas
  
  return token;
};

// Método para generar token de reset de contraseña
userSchema.methods.generatePasswordResetToken = function() {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  
  this.passwordResetToken = token;
  this.passwordResetExpires = Date.now() + (10 * 60 * 1000); // 10 minutos
  
  return token;
};

// Método estático para buscar usuarios
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

const User = mongoose.model('User', userSchema);

module.exports = User;