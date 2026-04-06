// middleware/auditLog.js - Audit logging for sensitive operations
import logger from "../utils/logger.js";

/**
 * Middleware factory to log sensitive operations
 * Creates an immutable audit trail for compliance
 *
 * @param {string} action - Action name for audit log (e.g., 'DELETE_USER', 'UPDATE_INVENTORY')
 * @param {object} options - Additional options
 * @returns {Function} Express middleware
 *
 * @example
 * router.delete('/users/:id',
 *   logSensitiveAction('DELETE_USER'),
 *   auth,
 *   adminAuth,
 *   UserController.deleteUser
 * );
 */
export const logSensitiveAction = (action, options = {}) => {
  const { includeRequestBody = false, includeResponseData = false } = options;

  return (req, res, next) => {
    // Capture original json method
    const originalJson = res.json;

    res.json = function (data) {
      // Only log on successful operations (status < 400)
      if (res.statusCode < 400) {
        const auditEntry = {
          action,
          timestamp: new Date().toISOString(),
          userId: req.user?.id || req.userId,
          userEmail: req.user?.email,
          userRole: req.user?.role,
          adminId: req.user?.id, // For operations performed by admin
          targetId: req.params.id || req.body?.id,
          method: req.method,
          path: req.path,
          ip: req.ip,
          correlationId: req.correlationId,
          statusCode: res.statusCode,
        };

        if (includeRequestBody && req.body) {
          // Sanitize sensitive fields before logging
          const sanitizedBody = { ...req.body };
          ["password", "token", "secret", "key", "creditCard"].forEach(
            (field) => {
              if (sanitizedBody[field]) {
                sanitizedBody[field] = "[REDACTED]";
              }
            },
          );
          auditEntry.requestBody = sanitizedBody;
        }

        if (includeResponseData && data) {
          // Only include non-sensitive response data
          auditEntry.responseStatus = data.success ? "success" : "failed";
          auditEntry.responseMessage = data.message;
        }

        // Log to audit system (could be sent to external audit service)
        logger.info(`AUDIT: ${action}`, auditEntry);
      }

      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Enhanced audit logger with structured data
 * Use this for complex audit scenarios requiring detailed tracking
 */
export const auditLog = (action, auditData) => {
  const entry = {
    action,
    timestamp: new Date().toISOString(),
    severity: auditData.severity || "info", // info, warning, critical
    actor: auditData.actor, // User performing the action
    target: auditData.target, // What was affected
    details: auditData.details, // Contextual information
    correlationId: auditData.correlationId,
    ip: auditData.ip,
    userAgent: auditData.userAgent,
    status: auditData.status || "success", // success, failed, partial
  };

  // Log with appropriate level
  if (entry.severity === "critical") {
    logger.error(`AUDIT: ${action}`, entry);
  } else if (entry.severity === "warning") {
    logger.warn(`AUDIT: ${action}`, entry);
  } else {
    logger.info(`AUDIT: ${action}`, entry);
  }
};

export default {
  logSensitiveAction,
  auditLog,
};
