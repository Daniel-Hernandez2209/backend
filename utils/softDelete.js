// utils/softDelete.js - Soft delete utilities for data preservation
import logger from "./logger.js";

/**
 * Add soft delete functionality to a Mongoose schema
 * Adds deletedAt field and filters out soft-deleted documents by default
 *
 * @param {mongoose.Schema} schema - The schema to add soft delete to
 * @param {object} options - Configuration options
 *
 * @example
 * // In models/User.js
 * import { configureSoftDelete } from '../utils/softDelete.js';
 *
 * const userSchema = new mongoose.Schema({ ... });
 * configureSoftDelete(userSchema);
 * const User = mongoose.model('User', userSchema);
 *
 * // Usage:
 * await User.softDelete(userId);  // Soft delete
 * await User.hardDelete(userId);  // Hard delete (permanent)
 * await User.findWithDeleted();   // Find all including deleted
 * await User.findDeleted();       // Find only deleted documents
 */
export const configureSoftDelete = (schema, options = {}) => {
  const { timestamps = true, paranoid = false } = options;

  // Add deletedAt field to schema
  schema.add({
    deletedAt: {
      type: Date,
      default: null,
      select: false, // Don't include by default in queries
      index: true,
    },
  });

  // Add isDeleted virtual for convenience
  schema.virtual("isDeleted").get(function () {
    return this.deletedAt !== null && this.deletedAt !== undefined;
  });

  // ========================================
  // Query Middleware - Automatically exclude soft-deleted docs
  // ========================================

  // Exclude soft-deleted documents in find queries
  schema.pre(/^find/, function (next) {
    // Skip if we explicitly want deleted documents
    if (this.getOptions()._recursed) {
      return next();
    }

    // Only apply filter if deletedAt is not already in the query
    if (!this.getFilter().deletedAt) {
      this.where({ deletedAt: { $eq: null } });
    }

    next();
  });

  // Exclude soft-deleted documents in aggregation
  schema.pre(/^aggregate/, function (next) {
    if (!this.pipeline()[0].$match || !this.pipeline()[0].$match.deletedAt) {
      this.unshift({ $match: { deletedAt: null } });
    }
    next();
  });

  // ========================================
  // Instance Methods
  // ========================================

  /**
   * Soft delete this document
   */
  schema.methods.softDelete = async function () {
    try {
      this.deletedAt = new Date();
      await this.save();
      logger.info(`Soft deleted ${this.constructor.name}`, {
        id: this._id,
        modelName: this.constructor.name,
        deletedAt: this.deletedAt,
      });
      return this;
    } catch (error) {
      logger.error(`Error soft deleting ${this.constructor.name}`, {
        id: this._id,
        error: error.message,
      });
      throw error;
    }
  };

  /**
   * Permanently delete this document
   */
  schema.methods.hardDelete = async function () {
    try {
      const result = await this.deleteOne();
      logger.warn(`Hard deleted ${this.constructor.name}`, {
        id: this._id,
        modelName: this.constructor.name,
      });
      return result;
    } catch (error) {
      logger.error(`Error hard deleting ${this.constructor.name}`, {
        id: this._id,
        error: error.message,
      });
      throw error;
    }
  };

  /**
   * Restore a soft-deleted document
   */
  schema.methods.restore = async function () {
    try {
      if (!this.isDeleted) {
        throw new Error(`${this.constructor.name} is not deleted`);
      }
      this.deletedAt = null;
      await this.save();
      logger.info(`Restored ${this.constructor.name}`, {
        id: this._id,
        modelName: this.constructor.name,
      });
      return this;
    } catch (error) {
      logger.error(`Error restoring ${this.constructor.name}`, {
        id: this._id,
        error: error.message,
      });
      throw error;
    }
  };

  // ========================================
  // Static Methods
  // ========================================

  /**
   * Find with soft-deleted documents included
   */
  schema.statics.findWithDeleted = function (filter = {}) {
    return this.find(filter).setOptions({ _recursed: true });
  };

  /**
   * Find only soft-deleted documents
   */
  schema.statics.findDeleted = function (filter = {}) {
    return this.find({ ...filter, deletedAt: { $ne: null } }).setOptions({
      _recursed: true,
    });
  };

  /**
   * Find by ID including soft-deleted documents
   */
  schema.statics.findByIdWithDeleted = function (id) {
    return this.findById(id).setOptions({ _recursed: true });
  };

  /**
   * Soft delete by ID
   */
  schema.statics.softDelete = async function (id) {
    try {
      const doc = await this.findByIdAndUpdate(
        id,
        { deletedAt: new Date() },
        { new: true },
      );
      logger.info(`Soft deleted ${this.modelName} by ID`, {
        id,
        modelName: this.modelName,
      });
      return doc;
    } catch (error) {
      logger.error(`Error soft deleting ${this.modelName}`, {
        id,
        error: error.message,
      });
      throw error;
    }
  };

  /**
   * Permanently delete by ID
   */
  schema.statics.hardDelete = async function (id) {
    try {
      const result = await this.findByIdAndRemove(id);
      logger.warn(`Hard deleted ${this.modelName} by ID`, {
        id,
        modelName: this.modelName,
      });
      return result;
    } catch (error) {
      logger.error(`Error hard deleting ${this.modelName}`, {
        id,
        error: error.message,
      });
      throw error;
    }
  };

  /**
   * Restore soft-deleted document by ID
   */
  schema.statics.restore = async function (id) {
    try {
      const doc = await this.findByIdAndUpdate(
        id,
        { deletedAt: null },
        { new: true },
      ).setOptions({ _recursed: true });
      logger.info(`Restored ${this.modelName} by ID`, {
        id,
        modelName: this.modelName,
      });
      return doc;
    } catch (error) {
      logger.error(`Error restoring ${this.modelName}`, {
        id,
        error: error.message,
      });
      throw error;
    }
  };

  /**
   * Count of non-deleted documents
   */
  schema.statics.countActive = function (filter = {}) {
    return this.countDocuments({ ...filter, deletedAt: null });
  };

  /**
   * Count of soft-deleted documents
   */
  schema.statics.countDeleted = function (filter = {}) {
    return this.countDocuments({ ...filter, deletedAt: { $ne: null } });
  };
};

/**
 * Restore multiple soft-deleted documents
 */
export const restoreMultiple = async (Model, ids) => {
  try {
    const result = await Model.updateMany(
      { _id: { $in: ids } },
      { deletedAt: null },
    );
    logger.info(
      `Restored ${result.modifiedCount} ${Model.modelName} documents`,
      {
        count: result.modifiedCount,
        modelName: Model.modelName,
      },
    );
    return result;
  } catch (error) {
    logger.error(`Error restoring multiple ${Model.modelName} documents`, {
      error: error.message,
    });
    throw error;
  }
};

/**
 * Permanently delete multiple soft-deleted documents (cleanup)
 */
export const hardDeleteMultiple = async (Model, ids) => {
  try {
    const result = await Model.deleteMany({
      _id: { $in: ids },
      deletedAt: { $ne: null },
    });
    logger.warn(
      `Hard deleted ${result.deletedCount} ${Model.modelName} documents`,
      {
        count: result.deletedCount,
        modelName: Model.modelName,
      },
    );
    return result;
  } catch (error) {
    logger.error(`Error hard deleting multiple ${Model.modelName} documents`, {
      error: error.message,
    });
    throw error;
  }
};

/**
 * Permanently delete ALL soft-deleted documents older than date (for storage cleanup)
 * Use with caution - this is permanent!
 */
export const purgeOldDeleted = async (Model, olderThanDays = 90) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await Model.deleteMany({
      deletedAt: { $lt: cutoffDate, $ne: null },
    });

    logger.warn(
      `Purged ${result.deletedCount} old deleted ${Model.modelName} documents`,
      {
        count: result.deletedCount,
        olderThanDays,
        modelName: Model.modelName,
      },
    );

    return result;
  } catch (error) {
    logger.error(`Error purging old deleted ${Model.modelName} documents`, {
      error: error.message,
    });
    throw error;
  }
};

export default {
  configureSoftDelete,
  restoreMultiple,
  hardDeleteMultiple,
  purgeOldDeleted,
};
