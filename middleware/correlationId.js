// middleware/correlationId.js - Request correlation tracking for distributed tracing
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

/**
 * Middleware to add correlation ID to all requests
 * Enables tracking of requests across multiple services/logs
 */
export const correlationIdMiddleware = (req, res, next) => {
  // Get correlation ID from header or generate new one
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  
  // Store in request and response
  req.correlationId = correlationId;
  res.set('X-Correlation-ID', correlationId);
  
  // Log request with correlation ID
  logger.info(`[${correlationId}] ${req.method} ${req.path}`, {
    correlationId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userId: req.user?.id
  });
  
  // On response finish, log completion
  const originalJson = res.json;
  res.json = function(data) {
    logger.info(`[${correlationId}] Response ${res.statusCode}`, {
      correlationId,
      statusCode: res.statusCode,
      method: req.method,
      path: req.path,
      userId: req.user?.id,
      duration: Date.now() - req.startTime
    });
    return originalJson.call(this, data);
  };
  
  req.startTime = Date.now();
  next();
};

export default correlationIdMiddleware;
