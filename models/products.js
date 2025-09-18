// models/Product.js - Modelo de productos para ATHENA BRAND
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre del producto es requerido'],
    trim: true,
    maxlength: [100, 'El nombre no puede exceder 100 caracteres']
  },
  
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  
  description: {
    type: String,
    required: [true, 'La descripción es requerida'],
    maxlength: [2000, 'La descripción no puede exceder 2000 caracteres']
  },
  
  price: {
    type: Number,
    required: [true, 'El precio es requerido'],
    min: [0, 'El precio no puede ser negativo']
  },
  
  discountPrice: {
    type: Number,
    min: [0, 'El precio con descuento no puede ser negativo'],
    validate: {
      validator: function(v) {
        return !v || v <= this.price;
      },
      message: 'El precio con descuento debe ser menor al precio original'
    }
  },
  
  images: [{
    url: {
      type: String,
      required: true
    },
    alt: {
      type: String,
      default: ''
    },
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  
  // Categorías específicas de ATHENA BRAND
  category: {
    type: String,
    required: [true, 'La categoría es requerida'],
    enum: {
      values: ['hombre', 'mujer', 'deportivos', 'hoodies-sacos', 'chaquetas'],
      message: 'Categoría no válida para ATHENA BRAND'
    }
  },
  
  subcategory: {
    type: String,
    enum: ['camisetas', 'pantalones', 'sudaderas', 'chaquetas', 'accesorios', 'calzado','conjuntos','cortavientos']
  },
  
  // Sistema de tallas colombiano
  sizes: [{
    size: {
      type: String,
      enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
      required: true
    },
    stock: {
      type: Number,
      required: true,
      min: [0, 'El stock no puede ser negativo']
    }
  }],
  
  colors: [{
    name: String,
    hex: String,
    image: String // URL de imagen del producto en este color
  }],
  
  sku: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  
  tags: [String],
  
  // Campos específicos para ropa
  material: {
    type: String,
    default: ''
  },
  
  careInstructions: {
    type: String,
    default: 'Lavar a máquina en agua fría'
  },
  
  // SEO y marketing
  metaTitle: String,
  metaDescription: String,
  
  // Estados del producto
  isActive: {
    type: Boolean,
    default: true
  },
  
  isFeatured: {
    type: Boolean,
    default: false
  },
  
  // Analytics
  views: {
    type: Number,
    default: 0
  },
  
  sales: {
    type: Number,
    default: 0
  },
  
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});



// Virtual para precio efectivo (con o sin descuento)
productSchema.virtual('effectivePrice').get(function() {
  return this.discountPrice && this.discountPrice > 0 ? this.discountPrice : this.price;
});

// Virtual para stock total
productSchema.virtual('totalStock').get(function() {
  return this.sizes.reduce((total, size) => total + size.stock, 0);
});

// Virtual para verificar si hay descuento
productSchema.virtual('hasDiscount').get(function() {
  return this.discountPrice && this.discountPrice > 0 && this.discountPrice < this.price;
});

// Middleware para generar slug antes de guardar
productSchema.pre('save', function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '-');
  }
  next();
});

// Middleware para generar SKU si no existe
productSchema.pre('save', function(next) {
  if (!this.sku) {
    const categoryCode = this.category.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-4);
    this.sku = `ATH-${categoryCode}-${timestamp}`;
  }
  next();
});

// Método estático para buscar productos
productSchema.statics.searchProducts = function(query, category = null, limit = 20) {
  const searchCriteria = {
    isActive: true,
    $text: { $search: query }
  };
  
  if (category) {
    searchCriteria.category = category;
  }
  
  return this.find(searchCriteria)
    .limit(limit)
    .sort({ score: { $meta: 'textScore' } });
};

// Método para decrementar stock
productSchema.methods.decrementStock = function(size, quantity) {
  const sizeIndex = this.sizes.findIndex(s => s.size === size);
  if (sizeIndex !== -1 && this.sizes[sizeIndex].stock >= quantity) {
    this.sizes[sizeIndex].stock -= quantity;
    return this.save();
  }
  throw new Error(`Stock insuficiente para talla ${size}`);
};

// Método para incrementar vistas
productSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

const Product = mongoose.model('Product', productSchema);

module.exports = Product;