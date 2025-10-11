```javascript
// server.js - Backend principal optimizado para Vercel
// 
// DESCRIPCIÓN GENERAL:
// Este archivo implementa un servidor Express.js para la API REST de ATHENA BRAND,
// una tienda de streetwear. Utiliza arquitectura MVC con controladores separados,
// está optimizado para deployment en Vercel con middleware de conexión DB por request,
// e incluye seguridad robusta, documentación integrada y health checks.

// Importación de dependencias principales
const express = require('express');           // Framework web para Node.js
const mongoose = require('mongoose');         // ODM para MongoDB
const cors = require('cors');                 // Middleware para Cross-Origin Resource Sharing
const helmet = require('helmet');             // Middleware de seguridad HTTP
const morgan = require('morgan');             // Logger de requests HTTP
const compression = require('compression');   // Middleware de compresión gzip
const rateLimit = require('express-rate-limit'); // Middleware para rate limiting
const connectDB = require('./db');            // Función personalizada para conectar a MongoDB
require('dotenv').config();                   // Cargar variables de entorno desde archivo .env

const app = express(); // Crear instancia de la aplicación Express

// ===========================================
// MIDDLEWARE DE SEGURIDAD Y OPTIMIZACIÓN
// ===========================================

// Configurar helmet para seguridad HTTP (previene XSS, clickjacking, etc.)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" } // Permite recursos cross-origin
}));

// Habilitar compresión gzip para mejorar performance
app.use(compression());

// Configurar confianza en proxies (necesario para Vercel y rate limiting)
app.set('trust proxy', 1);

// Configurar logger Morgan basado en el entorno
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev')); // Formato conciso para desarrollo
} else {
  app.use(morgan('combined')); // Formato completo para producción
}

// Configurar rate limiting global para prevenir abuso de API
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Ventana de 15 minutos
  max: 100,                  // Máximo 100 requests por ventana por IP
  message: {
    success: false,
    message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.'
  },
  standardHeaders: true,  // Incluir headers estándar de rate limit
  legacyHeaders: false,   // No incluir headers legacy
});
app.use('/api', globalLimiter); // Aplicar rate limiting solo a rutas de API

// Configurar CORS (Cross-Origin Resource Sharing)
const corsOptions = {
  origin: function (origin, callback) {
    // Lista de dominios permitidos
    const allowedOrigins = [
      'http://localhost:4200',      // Angular dev server
      'http://localhost:3000',      // React dev server
      'https://athenabrand.co',     // Dominio principal producción
      'https://www.athenabrand.co'  // Dominio con www
    ];
    
    // ⚠️ VULNERABILIDAD: Permitir requests sin origin (Postman, apps móviles)
    if (!origin) return callback(null, true);
    
    // Verificar si el origin está en la lista permitida
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);  // Permitir origin
    } else {
      callback(new Error('No permitido por CORS')); // Rechazar origin
    }
  },
  credentials: true,    // Permitir cookies y headers de autenticación
  optionsSuccessStatus: 200, // Status para requests OPTIONS exitosos
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Métodos HTTP permitidos
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'] // Headers permitidos
};

app.use(cors(corsOptions)); // Aplicar configuración CORS

// Configurar parsing de JSON con límite de tamaño
// ⚠️ VULNERABILIDAD: Límite muy alto (10mb) puede causar DoS
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf; // Guardar buffer raw para webhooks que lo necesiten
  }
}));

// Configurar parsing de datos URL-encoded con límite de tamaño
app.use(express.urlencoded({ 
  extended: true,  // Usar qs library para parsing avanzado
  limit: '10mb'    // ⚠️ VULNERABILIDAD: Límite muy alto
}));

// Servir archivos estáticos desde directorio uploads con cache optimization
app.use('/uploads', express.static('uploads', {
  maxAge: '1y',        // Cache por 1 año
  etag: true,          // Habilitar ETags para cache condicional
  lastModified: true   // Incluir header Last-Modified
}));

// ===========================================
// ✅ MIDDLEWARE DE CONEXIÓN DB (CRÍTICO PARA VERCEL)
// ===========================================

// Middleware global para asegurar conexión DB en cada request
// Necesario en Vercel porque las conexiones pueden cerrarse entre requests
app.use(async (req, res, next) => {
  try {
    await connectDB(); // Conectar/verificar conexión a MongoDB
    next();            // Continuar al siguiente middleware
  } catch (error) {
    console.error("❌ Error conectando a DB:", error.message);
    // ⚠️ VULNERABILIDAD: Exposición de detalles del error en desarrollo
    return res.status(503).json({
      success: false,
      message: "Error de conexión a base de datos",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ===========================================
// RUTAS DE LA API
// ===========================================

// Endpoint de health check para monitoreo del servidor
app.get('/health', (req, res) => {
  // ⚠️ VULNERABILIDAD: Exposición de información sensible del sistema
  res.status(200).json({
    status: 'OK',
    message: 'ATHENA BRAND API funcionando correctamente',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),           // ⚠️ Tiempo de actividad del servidor
    environment: process.env.NODE_ENV,  // ⚠️ Información del entorno
    version: '1.0.0',
    database: mongoose.connection.readyState === 1 ? 'Conectado' : 'Desconectado' // ⚠️ Estado de DB
  });
});

// Importar módulos de rutas con controladores separados (Arquitectura MVC)
const authRoutes = require('./routes/auth');           // Rutas de autenticación
const productRoutes = require('./routes/products');   // Rutas de productos
const orderRoutes = require('./routes/order');        // Rutas de pedidos
const uploadRoutes = require('./routes/upload');      // Rutas de upload de archivos
const categoryRoutes = require('./routes/categories'); // Rutas de categorías

// Registrar rutas con prefijos específicos
app.use('/api/auth', authRoutes);         // Rutas de autenticación y usuarios
app.use('/api/products', productRoutes);  // Rutas de gestión de productos
app.use('/api/orders', orderRoutes);      // Rutas de gestión de pedidos
app.use('/api/upload', uploadRoutes);     // Rutas de subida de archivos
app.use('/api/categories', categoryRoutes); //