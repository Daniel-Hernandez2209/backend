const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'athena-auth' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ],
});
// Filtrar datos sensibles
logger.addFilter((info) => {
  if (info.password) delete info.password;
  if (info.token) delete info.token;
  return info;
});

module.exports = logger;