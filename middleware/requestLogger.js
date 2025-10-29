// middleware/requestLogger.js
import logger from '../utils/logger';

const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Capturar cuando termina la respuesta
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.logRequest(req, res, duration);
  });

  next();
};

export default  requestLogger;