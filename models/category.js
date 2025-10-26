// models/Category.js
const mongoose = import('mongoose');

const subcategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre de la subcategoría es requerido'],
    trim: true
  },
  slug: {
    type: String,
    required: [true, 'El slug de la subcategoría es requerido'],
    trim: true,
    lowercase: true,
    match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug inválido']
  },
  description: {
    type: String,
    trim: true
  }
}, { _id: false });

const categorySchema = new mongoose.Schema({
  slug: {
    type: String,
    required: [true, 'El slug es requerido'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug inválido'],
    minlength: [2, 'El slug debe tener al menos 2 caracteres'],
    maxlength: [50, 'El slug no puede exceder 50 caracteres']
  },
  name: {
    type: String,
    required: [true, 'El nombre es requerido'],
    trim: true,
    maxlength: [100, 'El nombre no puede exceder 100 caracteres']
  },
  description: {
    type: String,
    required: [true, 'La descripción es requerida'],
    trim: true,
    maxlength: [500, 'La descripción no puede exceder 500 caracteres']
  },
  image: {
    type: String,
    trim: true,
    default: '/uploads/categories/default-banner.jpg'
  },
  subcategories: {
    type: [subcategorySchema],
    default: [],
    validate: {
      validator: function(v) {
        return v.length <= 20;
      },
      message: 'No se pueden tener más de 20 subcategorías'
    }
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  order: {
    type: Number,
    default: 0,
    min: [0, 'El orden no puede ser negativo']
  },
  seoTitle: {
    type: String,
    trim: true,
    maxlength: [70, 'El título SEO no puede exceder 70 caracteres']
  },
  seoDescription: {
    type: String,
    trim: true,
    maxlength: [160, 'La descripción SEO no puede exceder 160 caracteres']
  },
  keywords: {
    type: [String],
    default: [],
    validate: {
      validator: function(v) {
        return v.length <= 10;
      },
      message: 'No se pueden tener más de 10 keywords'
    }
  }
}, {
  timestamps: true, // Agrega createdAt y updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices compuestos para mejor performance
categorySchema.index({ slug: 1, isActive: 1 });
categorySchema.index({ order: 1, isActive: 1 });
categorySchema.index({ createdAt: -1 });

// Método virtual para obtener la URL completa
categorySchema.virtual('url').get(function() {
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://athenabrand.com' 
    : process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${baseUrl}/categoria/${this.slug}`;
});

// Método de instancia para toggle active
categorySchema.methods.toggleActive = function() {
  this.isActive = !this.isActive;
  return this.save();
};

// Método estático para buscar por slug
categorySchema.statics.findBySlug = function(slug) {
  return this.findOne({ slug, isActive: true });
};

// Método estático para obtener categorías activas ordenadas
categorySchema.statics.findActiveOrdered = function() {
  return this.find({ isActive: true }).sort({ order: 1 });
};

// Middleware pre-save para normalizar datos
categorySchema.pre('save', function(next) {
  // Normalizar slug
  if (this.isModified('slug')) {
    this.slug = this.slug.toLowerCase().trim();
  }
  
  // Normalizar subcategory slugs
  if (this.isModified('subcategories')) {
    this.subcategories = this.subcategories.map(sub => ({
      ...sub,
      slug: sub.slug.toLowerCase().trim()
    }));
  }
  
  next();
});

// Middleware pre-remove para verificar dependencias
categorySchema.pre('remove', async function(next) {
   const Product = mongoose.model('Product');
   const hasProducts = await Product.exists({ category: this._id });
   if (hasProducts) {
     throw new Error('No se puede eliminar una categoría con productos asociados');
   }
  next();
});

const Category = mongoose.model('Category', categorySchema);

export default Category;