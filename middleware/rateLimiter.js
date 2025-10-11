const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 intentos
  message: {
    success: false,
    message: 'Demasiados intentos de login. Intenta en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 2,
  delayMs: 500
});

module.exports = { authLimiter, speedLimiter };