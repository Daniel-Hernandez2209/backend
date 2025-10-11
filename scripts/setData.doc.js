```javascript
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📄 ARCHIVO: seedData.js - Script de Población de Base de Datos
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * 🎯 PROPÓSITO:
 * Este script es responsable de poblar la base de datos de MongoDB con datos de 
 * prueba para la aplicación e-commerce "ATHENA BRAND". Incluye productos de ropa
 * streetwear, usuarios de prueba y configuraciones iniciales.
 * 
 * 🔧 FUNCIONALIDADES PRINCIPALES:
 * - Limpia y repuebla la base de datos con datos frescos
 * - Crea catálogo completo de productos con inventario
 * - Genera usuarios de prueba (admin y clientes)
 * - Configura datos realistas para desarrollo y testing
 * 
 * 🚨 ADVERTENCIAS DE SEGURIDAD DETECTADAS:
 * - Contraseñas hardcodeadas en texto plano (CRÍTICO)
 * - Credenciales expuestas en logs de consola (CRÍTICO)
 * - Falta validación de variables de entorno (ALTO)
 * - Datos sin sanitizar en operaciones de BD (MEDIO)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// Cargar variables de entorno desde archivo .env
require('dotenv').config();

// Importar dependencias necesarias
const mongoose = require('mongoose');              // ODM para MongoDB
const bcrypt = require('bcryptjs');               // Para hash de contraseñas (importado pero no usado - PROBLEMA)
const Product = require('../models/Product');     // Modelo de productos
const User = require('../models/User');          // Modelo de usuarios
const slugify = require('slugify');              // Para generar URLs amigables

// Configuración para la generación de slugs URL-friendly
const slugConfig = {
  lower: true,      // Convertir a minúsculas
  strict: true,     // Remover caracteres especiales
  locale: 'es'      // Configuración para español
};

// ⚠️ VULNERABILIDAD CRÍTICA: URI sin validación + fallback inseguro
// Establecer conexión a MongoDB (falta manejo de errores robusto)
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/athena_brand')
  .then(() => console.log('✅ Conectado a MongoDB'))           // Log de conexión exitosa
  .catch(err => console.error('❌ Error conectando:', err));   // Log de error (expone info sensible)

// Array de productos para el catálogo de ATHENA BRAND
const athenaProducts = [
  // === SECCIÓN: PRODUCTOS PARA HOMBRE ===
  {
    name: 'Hoodie Athena Classic Negro',                        // Nombre del producto
    description: 'Sudadera con capucha de algodón premium. Diseño minimalista con logo bordado. Perfecto para el streetwear urbano.',
    price: 89000,                                              // Precio en pesos colombianos
    discountPrice: 71200,                                      // Precio con descuento (20% off)
    category: 'hoodies-sacos',                                 // Categoría principal
    subcategory: 'sudaderas',                                  // Subcategoría
    images: [                                                  // Array de imágenes del producto
      { url: '/uploads/products/hoodie-black-1.jpg', isPrimary: true, alt: 'Hoodie Athena Negro' },
      { url: '/uploads/products/hoodie-black-2.jpg', alt: 'Hoodie Athena Negro - Detalle' }
    ],
    sizes: [                                                   // Tallas disponibles con inventario
      { size: 'S', stock: 15 },
      { size: 'M', stock: 20 },
      { size: 'L', stock: 18 },
      { size: 'XL', stock: 12 }
    ],
    colors: [{ name: 'Negro', hex: '#000000' }],              // Colores disponibles
    tags: ['hoodie', 'streetwear', 'casual', 'algodón'],     // Etiquetas para búsqueda
    material: '80% Algodón, 20% Poliéster',                  // Composición del material
    isFeatured: true,                                         // Producto destacado
    isActive: true                                            // Producto activo en catálogo
  },
  
  {
    name: 'Camiseta Athena Logo Blanca',                       // Segundo producto
    description: 'Camiseta básica de algodón 100% con logo de Athena Brand. Corte regular, perfecta para el día a día.',
    price: 45000,                                             // Precio base
    discountPrice: 36000,                                     // Precio con descuento (20% off)
    category: 'hombre',                                       // Categoría hombre
    subcategory: 'camisetas',                                 // Subcategoría camisetas
    images: [                                                 // Imágenes del producto
      { url: '/uploads/products/tshirt-white-1.jpg', isPrimary: true, alt: 'Camiseta Athena Blanca' },
      { url: '/uploads/products/tshirt-white-2.jpg', alt: 'Camiseta Athena Blanca - Logo' }
    ],
    sizes: [                                                  // Inventario por talla
      { size: 'XS', stock: 8 },
      { size: 'S', stock: 25 },
      { size: 'M', stock: 30 },
      { size: 'L', stock: 25 },
      { size: 'XL', stock: 15 }
    ],
    colors: [{ name: 'Blanco', hex: '#FFFFFF' }],            // Color blanco
    tags: ['camiseta', 'básico', 'algodón', 'logo'],        // Tags de búsqueda
    material: '100% Algodón Peinado',                        // Material premium
    isFeatured: true,                                        // Producto destacado
    isActive: true                                           // Producto activo
  },

  {
    name: 'Jean Athena Slim Fit',                            // Tercer producto - pantalones
    description: 'Jean de corte slim con lavado moderno. Confección premium con detalles únicos de la marca.',
    price: 120000,                                           // Sin descuento
    category: 'hombre',                                      // Categoría masculina
    subcategory: 'pantalones',                              // Subcategoría pantalones
    images: [                                               // Imágenes del jean
      { url: '/uploads/products/jean-slim-1.jpg', isPrimary: true, alt: 'Jean Athena Slim' },
      { url: '/uploads/products/jean-slim-2.jpg', alt: 'Jean Athena Slim - Detalle' }
    ],
    sizes: [                                                // Stock por talla
      { size: 'S', stock: 10 },
      { size: 'M', stock: 15 },
      { size: 'L', stock: 12 },
      { size: 'XL', stock: 8 }
    ],
    colors: [{ name: 'Azul Oscuro', hex: '#1e3a8a' }],     // Color azul oscuro
    tags: ['jean', 'denim', 'slim', 'casual'],             //