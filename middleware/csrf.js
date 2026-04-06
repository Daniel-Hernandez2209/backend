// middleware/csrf.js - CSRF Protection middleware
import csrf from "csurf";
import logger from "../utils/logger.js";

// Create CSRF protection middleware using cookie storage
 export const csrfProtection = csrf({
  cookie: true, // Store CSRF token in cookie
  field: "_csrf", // Field name in request body for token
});

/**
 * Middleware to return CSRF token to client
 * Use this on GET endpoints to provide token for state-changing requests
 */
export const getCsrfToken = (req, res, next) => {
  try {
    const token = req.csrfToken();
    res.set("X-CSRF-Token", token);
    // Also add to local for response
    res.locals.csrfToken = token;
    next();
  } catch (error) {
    logger.error("Error generating CSRF token", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Error generating CSRF token",
    });
  }
};

/**
 * Error handler for CSRF validation failures
 */
export const csrfErrorHandler = (err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN") {
    // CSRF token errors
    logger.warn("CSRF token validation failed", {
      ip: req.ip,
      method: req.method,
      path: req.path,
      userId: req.user?.id,
    });

    res.status(403).json({
      success: false,
      message: "Invalid CSRF token. Please refresh and try again.",
      errorCode: "CSRF_INVALID",
    });
  } else {
    // Pass other errors to default Express error handler
    next(err);
  }
};

export default {
  csrfProtection,
  getCsrfToken,
  csrfErrorHandler,
};
