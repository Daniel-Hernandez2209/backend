// server.js - Backend principal con controladores implementados
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// ===========================================
// MIDDLEWARE DE SEGURIDAD Y OPTIMIZACIÓN
// ===========================================

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(compression());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter);

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:4200',
      'http://localhost:3000',
      'https://athenabrand.co',
      'https://www.athenabrand.co'
    ];
    
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

app.use('/uploads', express.static('uploads', {
  maxAge: '1y',
  etag: true,
  lastModified: true
}));

// ===========================================
// CONEXIÓN A MONGODB
// ===========================================
const connectDB = require("./db");

// Conectar a Mongo solo cuando la función se invoque
connectDB();


// ===========================================
// RUTAS DE LA API
// ===========================================

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'ATHENA BRAND API funcionando correctamente',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: '1.0.0',
    controllers: 'Implementados'
  });
});

// Importar rutas actualizadas con controladores
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/order');
const uploadRoutes = require('./routes/upload');
const categoryRoutes = require('./routes/categories');

// Usar rutas
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/categories', categoryRoutes);

// Información de la API
app.get('/api', (req, res) => {
  res.json({
    message: '🏛️ ATHENA BRAND API',
    tagline: 'MENOS RUIDO MAS ESENCIA',
    location: 'San Pedro, Antioquia - Colombia',
    version: '1.0.0',
    architecture: 'MVC con Controladores',
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/auth',
      products: '/api/products',
      orders: '/api/orders',
      upload: '/api/upload',
      categories: '/api/categories'
    },
    features: [
      'Autenticación JWT',
      'Gestión de productos',
      'Sistema de pedidos',
      'Upload de imágenes',
      'Emails transaccionales',
      'Panel de administrador'
    ],
    social: {
      instagram: '@athena.brand.co',
      website: 'https://athenabrand.co'
    }
  });
});

// Documentación de la API
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'ATHENA BRAND API Documentation',
    version: '1.0.0',
    description: 'API para la tienda de streetwear ATHENA BRAND con arquitectura MVC',
    baseURL: req.protocol + '://' + req.get('host') + '/api',
    authentication: 'Bearer Token (JWT)',
    controllers: {
      AuthController: 'Manejo de autenticación y usuarios',
      ProductController: 'Gestión de productos y búsqueda',
      OrderController: 'Procesamiento de pedidos',
      UploadController: 'Manejo de archivos e imágenes',
      CategoryController: 'Gestión de categorías'
    },
    endpoints: {
      'POST /auth/register': 'Registro de usuario',
      'POST /auth/login': 'Login de usuario',
      'GET /auth/me': 'Perfil del usuario (auth required)',
      'GET /products': 'Listar productos',
      'GET /products/search': 'Buscar productos',
      'GET /products/category/:category': 'Productos por categoría',
      'GET /products/:slug': 'Detalle de producto',
      'POST /orders': 'Crear pedido',
      'GET /orders': 'Listar pedidos del usuario (auth required)',
      'POST /upload/products': 'Subir imagen de producto (admin required)',
      'GET /categories': 'Listar categorías',
      'GET /categories/:slug': 'Detalle de categoría'
    },
    categories: ['hombre', 'mujer', 'deportivos', 'hoodies-sacos', 'chaquetas'],
    contact: 'contacto@athenabrand.co'
  });
});

// ===========================================
// MANEJO DE ERRORES
// ===========================================

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  console.error('❌ Error:', err);

  if (err.name === 'CastError') {
    const message = 'Recurso no encontrado';
    error = { message, statusCode: 404 };
  }

  if (err.code === 11000) {
    const message = 'Recurso duplicado';
    error = { message, statusCode: 400 };
  }

  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    error = { message, statusCode: 400 };
  }

  if (err.name === 'JsonWebTokenError') {
    const message = 'Token inválido';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expirado';
    error = { message, statusCode: 401 };
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      error: err 
    })
  });
};

app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta ${req.originalUrl} no encontrada`,
    availableEndpoints: [
      'GET /api',
      'GET /api/docs',
      'GET /health',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/products',
      'GET /api/categories'
    ]
  });
});

module.exports = app;