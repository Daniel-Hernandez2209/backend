// utils/pagination.js - Pagination helper with DOS protection and bounds checking
import logger from "./logger.js";

/**
 * Parse and validate pagination parameters
 * Prevents DOS attacks via huge page/limit values
 *
 * @param {object} query - Express query parameters
 * @param {object} options - Custom bounds
 * @returns {object} Validated pagination object { page, limit, skip }
 *
 * @example
 * const { page, limit, skip } = parsePagination(req.query);
 * const items = await Product.find().skip(skip).limit(limit);
 */
export const parsePagination = (query, options = {}) => {
  const {
    defaultPage = 1,
    defaultLimit = 10,
    maxPage = 10000,
    maxLimit = 100,
    minLimit = 1,
  } = options;

  // Parse page number
  let page = parseInt(query.page, 10);
  if (isNaN(page) || page < 1) {
    page = defaultPage;
  }
  // Clamp page value to prevent scanning entire DB
  page = Math.min(page, maxPage);

  // Parse limit
  let limit = parseInt(query.limit, 10);
  if (isNaN(limit) || limit < minLimit) {
    limit = defaultLimit;
  }
  // Clamp limit to reasonable range
  limit = Math.max(minLimit, Math.min(limit, maxLimit));

  // Calculate skip (but prevent huge skip values from slow queries)
  const skip = (page - 1) * limit;

  // Log suspicious pagination requests
  if (query.page && page > 1000) {
    logger.warn("Suspicious pagination request detected", {
      originalPage: query.page,
      clampedPage: page,
      maxPage,
      requestedPage: parseInt(query.page, 10),
    });
  }

  return { page, limit, skip };
};

/**
 * Validate pagination parameters without returning them
 * Useful for parameter validation before queries
 *
 * @param {object} query - express query parameters
 * @param {object} options - custom bounds
 * @returns {object} Validation result { valid: boolean, error?: string }
 */
export const validatePagination = (query, options = {}) => {
  const { maxPage = 10000, maxLimit = 100, minLimit = 1 } = options;

  if (query.page) {
    const page = parseInt(query.page, 10);
    if (isNaN(page) || page < 1 || page > maxPage) {
      return {
        valid: false,
        error: `Page must be between 1 and ${maxPage}`,
      };
    }
  }

  if (query.limit) {
    const limit = parseInt(query.limit, 10);
    if (isNaN(limit) || limit < minLimit || limit > maxLimit) {
      return {
        valid: false,
        error: `Limit must be between ${minLimit} and ${maxLimit}`,
      };
    }
  }

  return { valid: true };
};

/**
 * Middleware for automatic pagination validation
 * Rejects requests with invalid pagination parameters
 */
export const paginationValidationMiddleware = (options = {}) => {
  return (req, res, next) => {
    const validation = validatePagination(req.query, options);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
        error: validation.error,
      });
    }

    next();
  };
};

export default {
  parsePagination,
  validatePagination,
  paginationValidationMiddleware,
};
