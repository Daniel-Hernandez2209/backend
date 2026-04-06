// utils/circuitBreaker.js - Circuit breaker pattern for external service calls
import logger from "./logger.js";

/**
 * Circuit Breaker states
 */
const CircuitState = {
  CLOSED: "CLOSED", // Normal operation
  OPEN: "OPEN", // Failing, all requests rejected
  HALF_OPEN: "HALF_OPEN", // Testing if service recovered
};

/**
 * Circuit Breaker implementation for protecting against cascading failures
 *
 * @example
 * const uploadBreaker = new CircuitBreaker({
 *   name: 'Cloudinary Upload',
 *   timeout: 10000,
 *   errorThresholdPercentage: 50,
 *   resetTimeout: 30000
 * });
 *
 * const result = await uploadBreaker.call(
 *   () => uploadToCloudinary(buffer, folder)
 * );
 */
export class CircuitBreaker {
  constructor(options = {}) {
    this.name = options.name || "CircuitBreaker";
    this.timeout = options.timeout || 10000; // Request timeout
    this.errorThresholdPercentage = options.errorThresholdPercentage || 50; // % errors to trip
    this.resetTimeout = options.resetTimeout || 30000; // Time before half-open
    this.volumeThreshold = options.volumeThreshold || 10; // Min requests before triggering

    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;

    this.fallback = options.fallback || null;
  }

  /**
   * Call external service through circuit breaker
   * @param {Function} fn - Async function to call
   * @returns {Promise} Result or fallback value
   */
  async call(fn) {
    if (this.state === CircuitState.OPEN) {
      return this._handleOpen();
    }

    if (this.state === CircuitState.HALF_OPEN) {
      return this._callWithTimeout(fn);
    }

    return this._callWithTimeout(fn);
  }

  async _callWithTimeout(fn) {
    try {
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(`Circuit breaker timeout after ${this.timeout}ms`),
              ),
            this.timeout,
          ),
        ),
      ]);

      this._onSuccess();
      return result;
    } catch (error) {
      this._onFailure();

      if (this.fallback) {
        logger.warn(
          `${this.name}: Using fallback due to error: ${error.message}`,
        );
        return this.fallback();
      }

      throw error;
    }
  }

  _onSuccess() {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;

      // If 3 consecutive successes, reset to CLOSED
      if (this.successCount >= 3) {
        logger.info(
          `${this.name}: Circuit breaker recovered and reset to CLOSED`,
        );
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  _onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0; // Reset success counter on failure

    if (this.state === CircuitState.HALF_OPEN) {
      // Failure during half-open, go back to open
      logger.warn(
        `${this.name}: Failed during recovery attempt, returning to OPEN state`,
      );
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.resetTimeout;
      return;
    }

    // Check if error threshold reached
    const totalRequests = this.failureCount + this.successCount;
    if (totalRequests >= this.volumeThreshold) {
      const errorPercentage = (this.failureCount / totalRequests) * 100;

      if (errorPercentage >= this.errorThresholdPercentage) {
        logger.error(
          `${this.name}: Error threshold exceeded (${errorPercentage.toFixed(1)}%). Opening circuit breaker.`,
          {
            errorPercentage,
            threshold: this.errorThresholdPercentage,
            failureCount: this.failureCount,
            totalRequests,
          },
        );
        this.state = CircuitState.OPEN;
        this.nextAttemptTime = Date.now() + this.resetTimeout;
      }
    }
  }

  _handleOpen() {
    // Check if it's time to try again (enter half-open state)
    if (Date.now() >= this.nextAttemptTime) {
      logger.info(
        `${this.name}: Circuit breaker entering HALF_OPEN state to test recovery`,
      );
      this.state = CircuitState.HALF_OPEN;
      this.successCount = 0;
      this.failureCount = 0;

      throw new Error(
        `${this.name}: Circuit breaker is OPEN. Retrying in ${this.resetTimeout}ms`,
      );
    }

    throw new Error(
      `${this.name}: Circuit breaker is OPEN. Service unavailable. Retry after ${Math.round(
        (this.nextAttemptTime - Date.now()) / 1000,
      )}s`,
    );
  }

  /**
   * Manually reset the circuit breaker
   */
  reset() {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    logger.info(`${this.name}: Circuit breaker manually reset to CLOSED`);
  }

  /**
   * Get circuit breaker status
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      isHealthy: this.state === CircuitState.CLOSED,
    };
  }
}

export default CircuitBreaker;
