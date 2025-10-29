// index.js - Entry point optimizado para Vercel (SEGURA)
import express from 'express';
import rateLimiters from './middleware/rateLimiter.js';
import helmet from 'helmet';
import connectDB from "./db.js";  

const app = express();
app.set('trust proxy', 1); // ⚠️ CRÍTICO PRIMERO

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========================================
// UTILIDADES DE ERRORES
// ========================================
const generateErrorId = () => `ERR_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

const sanitizeError = (error) => ({
  name: error.name,
  message: error.message,
  stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
});

// ========================================
// SEGURIDAD GLOBAL
// ========================================
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      upgradeInsecureRequests: []
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// ========================================
// RATE LIMITING GLOBAL
app.use(rateLimiters.globalLimiter);
// ========================================

// ========================================
// CONEXIÓN A BASE DE DATOS
// ========================================
let dbInitialized = false;

const initializeDB = async () => {
  try {
    if (!dbInitialized) {
      await connectDB();
      dbInitialized = true;
      console.log("🧠 Conexión inicial a MongoDB establecida");
    }
  } catch (error) {
    console.error("❌ Error inicializando MongoDB:", sanitizeError(error));
  }
};

if (process.env.NODE_ENV !== 'production') {
  initializeDB();
}

app.use(async (req, res, next) => {
  try {
    if (!dbInitialized) await initializeDB();

    if (req.body && JSON.stringify(req.body).length > 100000) {
      return res.status(413).json({
        success: false,
        message: "Payload demasiado grande"
      });
    }

    next();
  } catch (error) {
    const errorId = generateErrorId();

    if (process.env.NODE_ENV === 'development') {
      console.error(`❌ [${errorId}] Error DB:`, sanitizeError(error));
    } else {
      console.error(`❌ [${errorId}] Database connection failed`);
    }

    res.status(503).json({
      success: false,
      message: "Servicio temporalmente no disponible",
      errorId
    });
  }
});

// ========================================
// 🚀 RUTAS DE LA API
// ========================================

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Importar rutas
import adminRoutes from './routes/admin/user.js';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/order.js';
import uploadRoutes from './routes/upload.js';
import categoryRoutes from './routes/categories.js';
import adminCategoryRoutes from './routes/admin/categories.js';

// Usar rutas
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/admin/categories', adminCategoryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/user', adminRoutes);

// Ruta raíz de la API
app.get('/api', (req, res) => {
  res.json({
    message: '🏛️ ATHENA BRAND API',
    tagline: 'MENOS RUIDO MAS ESENCIA',
    version: '1.0.0',
    status: 'online'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta ${req.originalUrl} no encontrada`
  });
});

// ========================================
// EXPORTACIÓN PARA VERCEL
// ========================================
export default app;

// ========================================
// SERVIDOR LOCAL (DESARROLLO)
// ========================================
if (process.env.NODE_ENV !== 'production') {
  const PORT = parseInt(process.env.PORT) || 5000;

  if (PORT < 1024 || PORT > 65535) {
    console.error('❌ Puerto inválido');
    process.exit(1);
  }

  app.listen(PORT, '127.0.0.1', () => {
    console.log(`🚀 Servidor corriendo en http://127.0.0.1:${PORT}`);
    console.log(`📍 Entorno: desarrollo`);
  });
}