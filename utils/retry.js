// utils/retry.js - Retry logic with exponential backoff for transient failures
import logger from "./logger.js";

/**
 * Retry async operations with exponential backoff
 * Useful for handling temporary database/network failures
 * 
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} baseDelay - Initial delay in ms (default: 1000)
 * @param {string} context - Context for logging (default: 'Operation')
 * @returns {Promise} Result from the async function
 
 * @example
 * const order = await retryAsync(
 *   () => Order.create(orderData),
 *   3,
 *   1000,
 *   'Create Order'
 * );
 */
export const retryAsync = async (
  fn,
  maxRetries = 3,
  baseDelay = 1000,
  context = "Operation",
) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug(`[${context}] Attempt ${attempt}/${maxRetries}`);
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        // Last attempt failed
        logger.error(`[${context}] All ${maxRetries} attempts failed`, {
          error: error.message,
          context,
          attempts: attempt,
        });
        throw error;
      }

      // Calculate backoff delay with exponential growth
      // Attempt 1: baseDelay, Attempt 2: baseDelay * 2, Attempt 3: baseDelay * 4
      const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);

      // Add jitter (±10%) to prevent thundering herd
      const jitter = exponentialDelay * 0.1 * (Math.random() - 0.5) * 2;
      const totalDelay = Math.max(100, exponentialDelay + jitter);

      logger.warn(
        `[${context}] Attempt ${attempt} failed, retrying in ${Math.round(totalDelay)}ms`,
        {
          error: error.message,
          context,
          attempt,
          delay: Math.round(totalDelay),
        },
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, totalDelay));
    }
  }

  throw lastError;
};

/**
 * Retry with custom backoff strategy
 * @param {Function} fn - Async function to retry
 * @param {object} options - Configuration options
 * @returns {Promise} Result from the async function
 *
 * @example
 * const result = await retryAsyncWithOptions(dbQuery, {
 *   maxRetries: 5,
 *   initialDelay: 500,
 *   maxDelay: 30000,
 *   backoffMultiplier: 1.5,
 *   jitter: true
 * });
 */
export const retryAsyncWithOptions = async (fn, options = {}) => {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 60000,
    backoffMultiplier = 2,
    jitter = true,
    context = "Operation",
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        throw error;
      }

      // Calculate delay with multiplier and max cap
      let delay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);
      delay = Math.min(delay, maxDelay);

      // Add random jitter if enabled
      if (jitter) {
        delay = delay * (0.9 + Math.random() * 0.2);
      }

      logger.warn(
        `[${context}] Attempt ${attempt} failed, retrying in ${Math.round(delay)}ms`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

export default {
  retryAsync,
  retryAsyncWithOptions,
};
