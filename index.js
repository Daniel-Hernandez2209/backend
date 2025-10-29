// index.js - Entry point optimizado para Vercel (SEGURA)
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { connectDB } from './db.js';

const app = express();

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
  crossOriginEmbedderPolicy: false, // necesario para Vercel/Next.js
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
    maxAge: 31536000, // 1 año
    includeSubDomains: true,
    preload: true
  }
}));

// ========================================
// RATE LIMITING GLOBAL
// ========================================
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300, // máximo 300 peticiones por IP
  message: {
    success: false,
    message: "Demasiadas solicitudes, intenta más tarde"
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(globalLimiter);

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

// Inicializar conexión una vez (para dev)
if (process.env.NODE_ENV !== 'production') {
  initializeDB();
}

// Middleware para asegurar conexión en Vercel (serverless)
app.use(async (req, res, next) => {
  try {
    if (!dbInitialized) await initializeDB();

    // Limitar tamaño del body para seguridad
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
