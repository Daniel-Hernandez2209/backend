// server.js - Backend principal optimizado para Vercel (SEGURA Y ESTABLE)
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const jwt = require('jsonwebtoken');
const logger = require('./utils/logger');
const connectDB = require('./db');
require('dotenv').config();

const app = express();

// ===========================================
// ⚙️ MIDDLEWARE DE SEGURIDAD Y OPTIMIZACIÓN
// ===========================================

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

app.use(compression());
app.set('trust proxy', 1); // Necesario para Vercel

// Sanitización de datos
app.use(mongoSanitize()); // Prevenir inyección NoSQL
app.use(xss()); // Prevenir ataques XSS

// Logging según entorno
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ===========================================
// 🚦 RATE LIMITING GLOBAL Y ESPECÍFICO
// ===========================================

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Demasiadas solicitudes. Intenta más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Demasiados intentos de login. Intenta más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);

// Limiter adicional para área administrativa
app.use('/api/admin', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Demasiadas solicitudes al área administrativa.' },
}));

// ===========================================
// 🌐 CONFIGURACIÓN DE CORS SEGURA
// ===========================================

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://athenabrand.co',
      'https://www.athenabrand.co'
    ];

    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push('http://localhost:4200', 'http://localhost:3000');
    }

    if (!origin || allowedOrigins.includes(origin)) {
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

// ===========================================
// 🧩 PARSEO DE JSON SEGURO
// ===========================================

app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
      req.rawBody = buf;
    } catch {
      const err = new Error('JSON inválido');
      err.status = 400;
      throw err;
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ===========================================
// 🗂️ ARCHIVOS ESTÁTICOS
// ===========================================

app.use('/uploads', express.static('uploads', {
  maxAge: '1y',
  etag: true,
  lastModified: true
}));

// ===========================================
// 🧠 CONEXIÓN A MONGODB (PERSISTENTE EN VERCEL)
// ===========================================

(async () => {
  try {
    await connectDB();
    console.log('✅ Conectado a MongoDB al iniciar el servidor');
  } catch (error) {
    console.error('❌ Error al conectar la base de datos:', error.message);
  }
})();

// ===========================================
// 🚀 RUTAS DE LA API
// ===========================================

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Importar rutas
const adminRoutes = require('./routes/admin/user');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/order');
const uploadRoutes = require('./routes/upload');
const categoryRoutes = require('./routes/categories');
const adminCategoryRoutes = require('./routes/admin/categories');

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/admin/categories', adminCategoryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/user', adminRoutes);

// ===========================================
// 📘 INFORMACIÓN Y DOCUMENTACIÓN DE LA API
// ===========================================

app.get('/api', (req, res) => {
  res.json({
    message: '🏛️ ATHENA BRAND API',
    tagline: 'MENOS RUIDO MAS ESENCIA',
    version: '1.0.0',
    documentation: '/api/docs',
    features: [
      'Autenticación JWT',
      'Gestión de productos',
      'Sistema de pedidos',
      'Uploads de imágenes',
      'Emails transaccionales',
      'Panel administrativo'
    ],
  });
});

app.get('/api/docs', (req, res) => {
  res.json({
    title: 'ATHENA BRAND API Documentation',
    version: '1.0.0',
    description: 'API REST para la tienda ATHENA BRAND',
    baseURL: req.protocol + '://' + req.get('host') + '/api',
    authentication: 'Bearer Token (JWT)',
  });
});

// ===========================================
// 🧪 TEST DE CONEXIÓN A MONGO ATLAS
// ===========================================

const TestSchema = new mongoose.Schema({
  name: String,
  timestamp: { type: Date, default: Date.now }
});
const TestModel = mongoose.models.Test || mongoose.model("Test", TestSchema);

app.get("/api/test-db", async (req, res) => {
  try {
    const doc = await TestModel.create({ name: "Test Connection" });
    res.json({ success: true, message: "✅ Conexión exitosa a MongoDB", timestamp: doc.timestamp });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// ===========================================
// ⚠️ MANEJO GLOBAL DE ERRORES
// ===========================================

app.use((err, req, res, next) => {
  if (err.message === 'No permitido por CORS') {
    return res.status(403).json({ success: false, message: err.message });
  }

  logger.error(err, req);
  console.error('❌ Error:', err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Error interno del servidor'
  });
});

// 404 handler
app.use('*', (req, res) => {
  const response = {
    success: false,
    message: `Ruta ${req.originalUrl} no encontrada`
  };
  if (process.env.NODE_ENV === 'development') {
    response.availableEndpoints = [
      'GET /api',
      'GET /api/docs',
      'GET /health',
      'GET /api/test-db'
    ];
  }
  res.status(404).json(response);
});

module.exports = app;
