const helmet = import('helmet');
const rateLimit = import('express-rate-limit');

// Create rate limit configuration
const categoryRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit of 100 requests per IP
  message: {
    success: false,
    message: 'Demasiadas solicitudes, intenta más tarde'
  }
});

// Configure security middleware
const configSecurity = (app) => {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  // Apply rate limiting globally if needed
  // app.use(categoryRateLimit);
};

export default  {
  configSecurity,
  categoryRateLimit
};