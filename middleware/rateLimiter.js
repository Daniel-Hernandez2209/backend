// middleware/rateLimiter.js
const rateLimit = import('express-rate-limit');

// ============================================
// RATE LIMITERS POR TIPO DE OPERACIÓN
// ============================================

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
  // Excluir del rate limit si es necesario
  skip: (req) => {
    // Ejemplo: no aplicar rate limit a IPs internas
    return req.ip === '127.0.0.1';
  }
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
  legacyHeaders: false
});

// Para rutas administrativas (escritura)
const adminWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // Moderado para admins
  message: {
    success: false,
    message: 'Demasiadas operaciones administrativas. Intenta en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Puedes usar un keyGenerator personalizado para identificar por usuario
  keyGenerator: (req) => {
    // Si tienes el user ID del admin autenticado
    return req.user?.id || req.ip;
  }
});

// Para operaciones críticas de admin (toggle, delete)
const criticalAdminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20, // Muy restrictivo
  message: {
    success: false,
    message: 'Límite de operaciones críticas alcanzado. Intenta en 1 hora.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip
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
  }
});

export default  {
  publicReadLimiter,
  heavyReadLimiter,
  adminWriteLimiter,
  criticalAdminLimiter,
  seoLimiter
};