// models/User.js - Modelo de usuarios para ATHENA BRAND (Optimizado y Seguro)
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import validator from "validator";
import crypto from "crypto";
import DOMPurify from "isomorphic-dompurify";


// ✅ Validador reutilizable para nombres
const nameValidator = (name) => /^[a-zA-ZÀ-ÿ\s\-']+$/u.test(name);

const userSchema = new mongoose.Schema({
  // 🧍 Datos personales
  firstName: {
    type: String,
    importd: [true, 'El nombre es requerido'],
    trim: true,
    maxlength: [50, 'El nombre no puede exceder 50 caracteres'],
    validate: [nameValidator, 'El nombre contiene caracteres no válidos'],
    set: (v) => DOMPurify.sanitize(v, { ALLOWED_TAGS: [] })
  },
  lastName: {
    type: String,
    importd: [true, 'El apellido es requerido'],
    trim: true,
    maxlength: [50, 'El apellido no puede exceder 50 caracteres'],
    validate: [nameValidator, 'El apellido contiene caracteres no válidos'],
    set: (v) => DOMPurify.sanitize(v, { ALLOWED_TAGS: [] })
  },
  email: {
    type: String,
    importd: [true, 'El email es requerido'],
    unique: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: (email) => validator.isEmail(email) && email.length <= 254,
      message: 'Email no válido o demasiado largo'
    }
  },
  password: {
    type: String,
    importd: [true, 'La contraseña es requerida'],
    minlength: [8, 'La contraseña debe tener al menos 8 caracteres'],
    validate: {
      validator: (pwd) =>
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(pwd),
      message:
        'La contraseña debe contener al menos una mayúscula, minúscula, número y carácter especial'
    },
    select: false
  },
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: (phone) => !phone || /^[\+]?[0-9\s\-\(\)]{7,20}$/.test(phone),
      message: 'Teléfono inválido'
    }
  },
  address: {
    type: String,
    trim: true,
    maxlength: [200, 'La dirección no puede exceder 200 caracteres'],
    set: (v) => DOMPurify.sanitize(v, { ALLOWED_TAGS: [] })
  },

  // 🛡️ Seguridad y estado
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },

  // 🔐 Control de intentos y bloqueos
  loginAttempts: { type: Number, default: 0, min: [0, 'Intentos inválidos'] },
  lockUntil: { type: Date },

  // 🧾 Tokens (hasheados)
  verificationTokenHash: { type: String, select: false },
  verificationTokenExpires: { type: Date, select: false },
  passwordResetTokenHash: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },

  // ❤️ Wishlist
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]
}, {
  timestamps: true
});

// 🧩 Índices
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ lockUntil: 1, isActive: 1 });
userSchema.index({ createdAt: -1 });

// 🧠 Virtuals
userSchema.virtual('fullName').get(function () {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim();
});
userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// 🧰 Middleware pre-save (único y combinado)
userSchema.pre('save', async function (next) {
  // Sanitizar teléfono
  if (this.phone) this.phone = validator.escape(this.phone).substring(0, 20);

  // Hashear contraseña si cambió
  if (this.isModified('password')) {
    try {
      const salt = await bcrypt.genSalt(12);
      this.password = await bcrypt.hash(this.password, salt);
    } catch (err) {
      return next(err);
    }
  }
  next();
});

// 🧩 Métodos de instancia
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

userSchema.methods.incrementLoginAttempts = function () {
  const maxAttempts = 5;
  const baseLock = 30 * 60 * 1000;
  const progressiveLock = Math.min(
    baseLock * Math.pow(2, Math.floor(this.loginAttempts / maxAttempts)),
    24 * 60 * 60 * 1000
  );

  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({ $unset: { lockUntil: 1 }, $set: { loginAttempts: 1 } });
  }

  const updates = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + progressiveLock };
  }
  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({ $unset: { loginAttempts: 1, lockUntil: 1 } });
};

userSchema.methods.addToWishlist = function (productId) {
  if (!this.wishlist.includes(productId)) {
    this.wishlist.push(productId);
    return this.save();
  }
  return Promise.resolve(this);
};

userSchema.methods.removeFromWishlist = function (productId) {
  this.wishlist.pull(productId);
  return this.save();
};

// 🧾 Tokens seguros (verificación / reseteo)
userSchema.methods.generateVerificationToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.verificationTokenHash = this.hashToken(token);
  this.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
  return token;
};

userSchema.methods.generatePasswordResetToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.passwordResetTokenHash = this.hashToken(token);
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  return token;
};

userSchema.methods.verifyToken = function (token, type = 'verification') {
  if (!token || typeof token !== 'string') return false;
  const hashed = this.hashToken(token);
  const now = Date.now();

  if (type === 'verification')
    return hashed === this.verificationTokenHash && this.verificationTokenExpires > now;
  if (type === 'reset')
    return hashed === this.passwordResetTokenHash && this.passwordResetExpires > now;

  return false;
};

// 🧼 Sanitizar salida
userSchema.methods.toSafeJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.verificationTokenHash;
  delete user.passwordResetTokenHash;
  delete user.loginAttempts;
  delete user.lockUntil;
  // Limpieza adicional por seguridad XSS
  ['firstName', 'lastName', 'address'].forEach((key) => {
    if (user[key]) user[key] = DOMPurify.sanitize(user[key]);
  });
  return user;
};

// 🔍 Búsqueda segura por email
userSchema.statics.findByEmail = function (email, includePassword = false) {
  if (!email || !validator.isEmail(email)) {
    return Promise.reject(new Error('Email inválido'));
  }
  return this.findOne({ email: email.toLowerCase() }).select(includePassword ? '+password' : '');
};

const User = mongoose.model('User', userSchema);
export  default User;
