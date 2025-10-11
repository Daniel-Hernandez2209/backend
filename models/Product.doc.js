# Análisis Detallado del Código - Modelo de Productos ATHENA BRAND

## Descripción General del Archivo
Este archivo define un modelo de Mongoose para productos de e-commerce de la marca ATHENA BRAND. Incluye funcionalidades completas para manejo de inventario, categorización de ropa, SEO, analytics y operaciones de stock con validaciones específicas para el mercado colombiano.

## Código Comentado Línea por Línea

```js
// models/Product.js - Modelo de productos para ATHENA BRAND
// Importa la librería mongoose para modelado de datos MongoDB
const mongoose = require('mongoose');

// Define el esquema principal del producto usando mongoose Schema
const productSchema = new mongoose.Schema({
  // Campo nombre del producto con validaciones de requerido, trim y longitud
  name: {
    type: String, // Tipo de dato string
    required: [true, 'El nombre del producto es requerido'], // Campo obligatorio con mensaje de error personalizado
    trim: true, // Elimina espacios en blanco al inicio y final
    maxlength: [100, 'El nombre no puede exceder 100 caracteres'] // Limita la longitud máxima
  },
  
  // Campo slug para URLs amigables (SEO)
  slug: {
    type: String, // Tipo string
    required: true, // Campo obligatorio
    unique: true, // Debe ser único en la base de datos
    lowercase: true // Convierte automáticamente a minúsculas
  },
  
  // Descripción detallada del producto
  description: {
    type: String, // Tipo string
    required: [true, 'La descripción es requerida'], // Campo obligatorio
    maxlength: [2000, 'La descripción no puede exceder 2000 caracteres'] // Límite de caracteres
  },
  
  // Precio base del producto
  price: {
    type: Number, // Tipo numérico
    required: [true, 'El precio es requerido'], // Campo obligatorio
    min: [0, 'El precio no puede ser negativo'] // Validación de valor mínimo
  },
  
  // Precio con descuento (opcional)
  discountPrice: {
    type: Number, // Tipo numérico
    min: [0, 'El precio con descuento no puede ser negativo'], // No puede ser negativo
    validate: { // Validación personalizada
      validator: function(v) {
        return !v || v <= this.price; // El descuento debe ser menor al precio original
      },
      message: 'El precio con descuento debe ser menor al precio original' // Mensaje de error
    }
  },
  
  // Array de imágenes del producto
  images: [{
    url: { // URL de la imagen
      type: String,
      required: true // Campo obligatorio
    },
    alt: { // Texto alternativo para accesibilidad
      type: String,
      default: '' // Valor por defecto vacío
    },
    isPrimary: { // Indica si es la imagen principal
      type: Boolean,
      default: false // Por defecto no es principal
    }
  }],
  
  // Categorías específicas de ATHENA BRAND
  category: {
    type: String,
    required: [true, 'La categoría es requerida'], // Campo obligatorio
    enum: { // Solo acepta valores específicos
      values: ['hombre', 'mujer', 'deportivos', 'hoodies-sacos', 'chaquetas'], // Valores permitidos
      message: 'Categoría no válida para ATHENA BRAND' // Mensaje de error personalizado
    }
  },
  
  // Subcategoría opcional del producto
  subcategory: {
    type: String,
    enum: ['camisetas', 'pantalones', 'sudaderas', 'chaquetas', 'accesorios', 'calzado','conjuntos','cortavientos'] // Valores permitidos
  },
  
  // Sistema de tallas colombiano con control de stock
  sizes: [{
    size: { // Talla específica
      type: String,
      enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'], // Tallas estándar
      required: true // Campo obligatorio
    },
    stock: { // Cantidad disponible para esta talla
      type: Number,
      required: true, // Campo obligatorio
      min: [0, 'El stock no puede ser negativo'] // No puede ser negativo
    }
  }],
  
  // Variaciones de colores disponibles
  colors: [{
    name: String, // Nombre del color
    hex: String, // Código hexadecimal del color
    image: String // URL de imagen del producto en este color específico
  }],
  
  // Código SKU único del producto
  sku: {
    type: String,
    required: true, // Campo obligatorio
    unique: true, // Debe ser único en la base de datos
    uppercase: true // Convierte automáticamente a mayúsculas
  },
  
  tags: [String], // Array de etiquetas para búsqueda y clasificación
  
  // Campos específicos para productos de ropa
  material: { // Material del producto
    type: String,
    default: '' // Valor por defecto vacío
  },
  
  careInstructions: { // Instrucciones de cuidado
    type: String,
    default: 'Lavar a máquina en agua fría' // Instrucciones por defecto
  },
  
  // Campos para optimización SEO
  metaTitle: String, // Título para meta tags
  metaDescription: String, // Descripción para meta tags
  
  // Estados de control del producto
  isActive: { // Indica si el producto está activo
    type: Boolean,
    default: true // Por defecto está activo
  },
  
  isFeatured: { // Indica si el producto es destacado
    type: Boolean,
    default: false // Por defecto no es destacado
  },
  
  // Campos para analytics y estadísticas
  views: { // Número de visualizaciones
    type: Number,
    default: 0 // Inicia en cero
  },
  
  sales: { // Número de ventas
    type: Number,
    default: 0 // Inicia en cero
  },
  
  // Sistema de calificaciones
  rating: {
    average: { // Promedio de calificaciones
      type: Number,
      default: 0, // Inicia en cero
      min: 0, // Mínimo 0
      max: 5 // Máximo 5 estrellas
    },
    count: { // Cantidad de calificaciones
      type: Number,
      default: 0 // Inicia en cero
    }
  }
  
}, {
  timestamps: true, // Añade automáticamente createdAt y updatedAt
  toJSON: { virtuals: true }, // Incluye campos virtuales al convertir a JSON
  toObject: { virtuals: true } // Incluye campos virtuales al convertir a objeto
});

// Campo virtual que calcula el precio efectivo (con o sin descuento)
productSchema.virtual('effectivePrice').get(function() {
  return this.discountPrice && this.discountPrice > 0 ? this.discountPrice : this.price;
  // Si hay precio con descuento y es mayor a 0, usa el descuento, sino usa el precio normal
});

// Campo virtual que calcula el stock total sumando todas las tallas
productSchema.virtual('totalStock').get(function() {
  return this.sizes.reduce((total, size) => total + size.stock, 0);
  // Usa reduce para sumar el stock de todas las tallas
});

// Campo virtual que verifica si el producto tiene descuento activo
productSchema.virtual