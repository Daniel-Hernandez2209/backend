// middleware/rateLimiter.js
import rateLimit from 'express-rate-limit';


// ============================================
// RATE LIMITERS POR TIPO DE OPERACIÓN
// ============================================
// Limitador global básico
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Demasiadas solicitudes. Intenta más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }
});

// Para rutas públicas generales (lectura)
const publicReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por IP
  message: {
    success: false,
    message: 'Demasiadas solicitudes. Intenta nuevamente en 15 minutos.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
   validate: { xForwardedForHeader: false } 
});

// Para endpoints que consumen más recursos (búsquedas, stats)
const heavyReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // Más restrictivo
  message: {
    success: false,
    message: 'Límite de consultas excedido. Intenta en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
   validate: { xForwardedForHeader: false } 
});

// Para rutas administrativas (escritura)
const adminWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    message: 'Demasiadas solicitudes al área administrativa. Intenta en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  validate: { xForwardedForHeader: false }
});
// Para rutas de autenticación (login, registro)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Demasiados intentos de login. Intenta más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }
});

// Para operaciones críticas de admin (toggle, delete)
const criticalAdminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20,
  message: {
    success: false,
    message: 'Límite de operaciones críticas alcanzado. Intenta en 1 hora.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }
});

// Rate limiter específico para SEO/bots (más permisivo)
const seoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // Más permisivo para crawlers legítimos
  message: {
    success: false,
    message: 'Límite de solicitudes SEO excedido.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Permitir bots conocidos sin límite estricto
    const userAgent = req.get('user-agent') || '';
    return /googlebot|bingbot|yandex/i.test(userAgent);
  },
   validate: { xForwardedForHeader: false } 
});

export default  {
  publicReadLimiter,
  authLimiter,
  globalLimiter,
  heavyReadLimiter,
  adminWriteLimiter,
  criticalAdminLimiter,
  seoLimiter
};

export  {
  publicReadLimiter,
  authLimiter,
  globalLimiter,
  heavyReadLimiter,
  adminWriteLimiter,
  criticalAdminLimiter,
  seoLimiter
};