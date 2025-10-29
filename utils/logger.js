// utils/logger.js - Configuración avanzada de Winston con filtrado de datos sensibles
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'athena-auth' },
  transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            ),
        })
  ],
});
// Filtrar datos sensibles
const filterSensitiveData = winston.format((info) => {
  if (info.password) delete info.password;
  if (info.token) delete info.token;
  return info;
});
logger.format = winston.format.combine(
  filterSensitiveData(),
  logger.format
);


export default logger;