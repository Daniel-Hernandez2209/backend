// server.js - Backend principal actualizado para ATHENA BRAND
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

// Helmet para seguridad
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Compresión GZIP
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por ventana
  message: {
    success: false,
    message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter);

// CORS configurado para desarrollo y producción
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:4200',
      'http://localhost:3000',
      'https://athenabrand.co',
      'https://www.athenabrand.co'
    ];
    
    // Permitir requests sin origin (apps móviles, etc.)
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

// Body parsers
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

// Servir archivos estáticos
app.use('/uploads', express.static('uploads', {
  maxAge: '1y',
  etag: true,
  lastModified: true
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'ATHENA BRAND API funcionando correctamente',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: '1.0.0'
  });
});

// ===========================================
// CONEXIÓN A MONGODB
// ===========================================

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`✅ MongoDB conectado: ${conn.connection.host}`);
    
    // Eventos de conexión
    mongoose.connection.on('error', (err) => {
      console.error('❌ Error en MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB desconectado');
    });

    // Cerrar conexión al terminar el proceso
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('🔌 MongoDB desconectado por terminación de app');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
};

connectDB();

// ===========================================
// RUTAS DE LA API
// ===========================================

// Importar rutas
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

// Ruta de información de la API
app.get('/api', (req, res) => {
  res.json({
    message: '🏛️ ATHENA BRAND API',
    tagline: 'MENOS RUIDO MAS ESENCIA',
    location: 'San Pedro, Antioquia - Colombia',
    version: '1.0.0',
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/auth',
      products: '/api/products',
      orders: '/api/orders',
      upload: '/api/upload',
      categories: '/api/categories'
    },
    social: {
      instagram: '@athena.brand.co',
      website: 'https://athenabrand.co'
    }
  });
});

// Ruta de documentación básica
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'ATHENA BRAND API Documentation',
    version: '1.0.0',
    description: 'API para la tienda de streetwear ATHENA BRAND',
    baseURL: req.protocol + '://' + req.get('host') + '/api',
    authentication: 'Bearer Token (JWT)',
    endpoints: {
      'POST /auth/register': 'Registro de usuario',
      'POST /auth/login': 'Login de usuario',
      'GET /auth/me': 'Perfil del usuario (auth required)',
      'GET /products': 'Listar productos',
      'GET /products/search': 'Buscar productos',
      'GET /products/category/:category': 'Productos por categoría',
      'GET /products/:slug': 'Detalle de producto',
      'POST /orders': 'Crear pedido (auth required)',
      'GET /orders': 'Listar pedidos del usuario (auth required)',
      'POST /upload': 'Subir imagen (admin required)'
    },
    categories: ['hombre', 'mujer', 'deportivos', 'hoodies-sacos', 'chaquetas'],
    contact: 'contacto@athenabrand.co'
  });
});

// ===========================================
// MANEJO DE ERRORES
// ===========================================

// Error handler personalizado
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log del error
  console.error('❌ Error:', err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Recurso no encontrado';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Recurso duplicado';
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    error = { message, statusCode: 400 };
  }

  // JWT errors
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

// 404 handler - debe ir al final
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
      'GET /api/products'
    ]
  });
});

// ===========================================
// INICIAR SERVIDOR
// ===========================================

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log('\n🚀 ===================================');
  console.log(`🏛️  ATHENA BRAND API INICIADO`);
  console.log('📍 San Pedro, Antioquia - Colombia');
  console.log('✨ MENOS RUIDO MAS ESENCIA');
  console.log('🌐 Servidor ejecutándose en:');
  console.log(`   http://localhost:${PORT}`);
  console.log(`📚 Documentación: http://localhost:${PORT}/api/docs`);
  console.log(`💚 Health Check: http://localhost:${PORT}/health`);
  console.log('🔧 Modo:', process.env.NODE_ENV || 'development');
  console.log('====================================\n');
});

// Manejo de errores del servidor
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Puerto ${PORT} ya está en uso`);
  } else {
    console.error('❌ Error del servidor:', error);
  }
});

// Graceful shutdown
process.on('unhandledRejection', (err, promise) => {
  console.error('❌ Unhandled Promise Rejection:', err.message);
  server.close(() => {
    process.exit(1);
  });
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  server.close(() => {
    process.exit(1);
  });
});

module.exports = app;