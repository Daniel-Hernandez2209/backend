// models/Product.js - Modelo optimizado y seguro de productos ATHENA BRAND
import mongoose from "mongoose";
import validator from "validator";

// Función para escapar expresiones regulares (búsquedas seguras)
const escapeRegex = (string) => string?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') || '';

const allowedCategories = ['hombre', 'mujer', 'deportivos', 'hoodies-sacos', 'chaquetas'];
const allowedSubcategories = ['camisetas', 'pantalones', 'sudaderas', 'chaquetas', 'accesorios', 'calzado', 'conjuntos', 'cortavientos'];
const allowedSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const allowedCDNs = ['res.cloudinary.com', 'cdn.athena.com', 'your-trusted-cdn.com'];

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    validate: {
      validator: v => /^[a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ\s\-_.&()]+$/.test(v),
      message: 'Nombre contiene caracteres inválidos',
    },
  },

  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    validate: {
      validator: v => /^[a-z0-9-]+$/.test(v),
      message: 'Slug inválido',
    },
  },

  description: {
    type: String,
    required: true,
    maxlength: 2000,
    set: v => validator.escape(v || '').substring(0, 2000),
  },

  price: { type: Number, required: true, min: 0 },
  discountPrice: {
    type: Number,
    min: 0,
    validate: {
      validator(v) { return !v || v <= this.price; },
      message: 'El precio con descuento debe ser menor o igual al original',
    },
  },

  images: [{
    url: {
      type: String,
      required: true,
      validate: {
        validator: v => validator.isURL(v, { protocols: ['http', 'https'], import_protocol: true, host_whitelist: allowedCDNs }),
        message: 'URL de imagen no válida o no permitida',
      },
    },
    alt: { type: String, maxlength: 200, default: '' },
    isPrimary: { type: Boolean, default: false },
  }],

  category: {
    type: String,
    enum: allowedCategories,
    required: true,
  },

  subcategory: {
    type: String,
    enum: allowedSubcategories,
  },

  sizes: [{
    size: { type: String, enum: allowedSizes, required: true },
    stock: { type: Number, required: true, min: 0 },
  }],

  colors: [{
    name: { type: String, maxlength: 50 },
    hex: { type: String, match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/ },
    image: {
      type: String,
      validate: {
        validator: v => !v || validator.isURL(v, { protocols: ['http', 'https'], import_protocol: true, host_whitelist: allowedCDNs }),
        message: 'URL de color no válida',
      },
    },
  }],

  sku: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    validate: {
      validator: v => /^[A-Z0-9-]+$/.test(v),
      message: 'SKU inválido',
    },
  },

  tags: [{ type: String, maxlength: 50 }],
  material: { type: String, maxlength: 200, default: '' },
  careInstructions: { type: String, default: 'Lavar a máquina en agua fría', maxlength: 500 },

  metaTitle: { type: String, maxlength: 60 },
  metaDescription: { type: String, maxlength: 160 },

  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  views: { type: Number, default: 0, min: 0 },
  sales: { type: Number, default: 0, min: 0 },

  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0, min: 0 },
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// -----------------------------
// Virtuals
// -----------------------------
productSchema.virtual('effectivePrice').get(function () {
  return this.discountPrice && this.discountPrice > 0 ? this.discountPrice : this.price;
});
productSchema.virtual('totalStock').get(function () {
  return this.sizes.reduce((acc, s) => acc + (s.stock || 0), 0);
});
productSchema.virtual('hasDiscount').get(function () {
  return this.discountPrice && this.discountPrice < this.price;
});

// -----------------------------
// Middleware
// -----------------------------
productSchema.pre('save', function (next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
  }
  if (!this.sku) {
    const prefix = this.category?.slice(0, 3).toUpperCase() || 'GEN';
    this.sku = `ATH-${prefix}-${Date.now().toString().slice(-4)}`;
  }
  next();
});

// -----------------------------
// Métodos
// -----------------------------
productSchema.methods.decrementStock = async function (size, quantity) {
  if (!size || quantity <= 0) throw new Error('Parámetros inválidos para decrementar stock');

  const sizeIndex = this.sizes.findIndex(s => s.size === size);
  if (sizeIndex === -1) throw new Error(`Talla ${size} no encontrada`);

  const updated = await mongoose.model('Product').findOneAndUpdate(
    { _id: this._id, [`sizes.${sizeIndex}.stock`]: { $gte: quantity } },
    { $inc: { [`sizes.${sizeIndex}.stock`]: -quantity } },
    { new: true }
  );

  if (!updated) throw new Error(`Stock insuficiente para talla ${size}`);
  return updated;
};

productSchema.methods.incrementViews = function () {
  this.views += 1;
  return this.save();
};

// -----------------------------
// Búsqueda segura
// -----------------------------
productSchema.statics.searchProducts = function (query = '', category = null, limit = 20) {
  const criteria = { isActive: true };

  if (category && allowedCategories.includes(category)) criteria.category = category;

  if (query) {
    const safeRegex = new RegExp(escapeRegex(validator.escape(query.trim())), 'i');
    criteria.$or = [{ name: safeRegex }, { description: safeRegex }, { tags: { $in: [safeRegex] } }];
  }

  return this.find(criteria)
    .limit(Math.min(Math.max(parseInt(limit) || 20, 1), 100))
    .sort({ createdAt: -1 });
};

// -----------------------------
// Índices
// (slug y sku están indexados automáticamente con unique: true)
// -----------------------------
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ isFeatured: 1, createdAt: -1 });

export default  mongoose.model('Product', productSchema);
