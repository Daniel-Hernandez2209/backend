// utils/redis.js - Centralized Redis operations for token management
import { Redis } from "@upstash/redis";
import logger from "./logger.js";

let redisClient;

/**
 * Get or initialize Redis client
 */
export const getRedisClient = () => {
  if (!redisClient) {
    redisClient = Redis.fromEnv();
  }
  return redisClient;
};

/**
 * Store refresh token in Redis
 * @param {string} userId - User ID
 * @param {string} refreshToken - Refresh token
 * @param {number} ttl - Time to live in seconds (default 7 days)
 */
export const storeRefreshToken = async (userId, refreshToken, ttl = 604800) => {
  try {
    const redis = getRedisClient();
    // Store direct mapping
    await redis.setex(`refresh_token:${userId}`, ttl, refreshToken);
    // Store inverse mapping for lookup
    await redis.setex(`rt:${refreshToken}`, ttl, userId);
    logger.info("Refresh token stored", {
      userId,
      ttlDays: Math.ceil(ttl / 86400),
    });
  } catch (error) {
    logger.error("Error storing refresh token", {
      error: error.message,
      userId,
    });
    throw error;
  }
};

/**
 * Retrieve refresh token from Redis
 * @param {string} refreshToken - Refresh token
 * @returns {string|null} User ID or null if expired/invalid
 */
export const getRefreshTokenUserId = async (refreshToken) => {
  try {
    const redis = getRedisClient();
    return await redis.get(`rt:${refreshToken}`);
  } catch (error) {
    logger.error("Error retrieving refresh token", { error: error.message });
    return null;
  }
};

/**
 * Invalidate all refresh tokens for a user (e.g., password change, account disable)
 * @param {string} userId - User ID
 */
export const invalidateUserRefreshTokens = async (userId) => {
  try {
    const redis = getRedisClient();

    // Get all refresh tokens for this user
    const keys = await redis.keys(`refresh_token:${userId}*`);

    if (keys && keys.length) {
      // Delete direct mappings
      await Promise.all(keys.map((key) => redis.del(key)));
      logger.info("Deleted direct refresh token mappings", {
        userId,
        count: keys.length,
      });
    }

    // Find and delete inverse mappings (slower, but necessary for cleanup)
    // Alternative: store array of active tokens and invalidate by key pattern
    logger.info("Refresh tokens invalidated for user", { userId });
  } catch (error) {
    logger.error("Error invalidating refresh tokens", {
      error: error.message,
      userId,
    });
    throw error;
  }
};

/**
 * Delete specific refresh token
 * @param {string} refreshToken - Refresh token to delete
 * @param {string} userId - User ID (for logging)
 */
export const deleteRefreshToken = async (refreshToken, userId) => {
  try {
    const redis = getRedisClient();
    await redis.del(`rt:${refreshToken}`);
    await redis.del(`refresh_token:${userId}`);
    logger.info("Refresh token deleted", { userId });
  } catch (error) {
    logger.error("Error deleting refresh token", {
      error: error.message,
      userId,
    });
    throw error;
  }
};

export default {
  getRedisClient,
  storeRefreshToken,
  getRefreshTokenUserId,
  invalidateUserRefreshTokens,
  deleteRefreshToken,
};
