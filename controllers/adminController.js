// controllers/adminController.js - Controlador de administración para ATHENA BRAND
import User from "../models/User.js";
import logger from "../utils/logger.js";
import mongoose from "mongoose";

const AdminController = {
  // Helper para manejo de errores
  handleError(res, error, context) {
    logger.error(`Error en ${context}`, {
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  },

  // Helper para validar ObjectId
  isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
  },

  // ============================================
  // GESTIÓN DE USUARIOS
  // ============================================

  // GET /api/admin/users - Obtener todos los usuarios
  getUsers: async (req, res) => {
    try {
      // Parámetros de paginación y filtrado
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      // Filtros opcionales
      const filters = {};

      // Filtrar por rol
      if (req.query.role) {
        filters.role = req.query.role;
      }

      // Filtrar por estado activo
      if (req.query.isActive !== undefined) {
        filters.isActive = req.query.isActive === "true";
      }

      // Filtrar por verificación
      if (req.query.isVerified !== undefined) {
        filters.isVerified = req.query.isVerified === "true";
      }

      // Búsqueda por nombre o email
      if (req.query.search) {
        const searchRegex = new RegExp(req.query.search, "i");
        filters.$or = [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
        ];
      }

      // Ordenamiento
      const sortBy = req.query.sortBy || "createdAt";
      const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
      const sort = { [sortBy]: sortOrder };

      // Consulta con paginación
      const [users, totalUsers] = await Promise.all([
        User.find(filters)
          .select("-password -verificationToken -passwordResetToken")
          .sort(sort)
          .limit(limit)
          .skip(skip)
          .lean(),
        User.countDocuments(filters),
      ]);

      // Calcular estadísticas de la página
      const totalPages = Math.ceil(totalUsers / limit);

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            currentPage: page,
            totalPages,
            totalUsers,
            usersPerPage: limit,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
          },
        },
      });
    } catch (error) {
      return AdminController.handleError(res, error, "getUsers");
    }
  },

  // GET /api/admin/users/:id - Obtener usuario específico
  getUserById: async (req, res) => {
    try {
      const { id } = req.params;

      // Validar ObjectId
      if (!AdminController.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "ID de usuario inválido",
        });
      }

      const user = await User.findById(id)
        .select("-password -verificationToken -passwordResetToken")
        .populate("wishlist", "name price images")
        .lean();

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      // Agregar información adicional
      const userWithStats = {
        ...user,
        stats: {
          totalOrders: user.totalOrders || 0,
          totalSpent: user.totalSpent || 0,
          wishlistCount: user.wishlist?.length || 0,
          accountAge: Math.floor(
            (Date.now() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24),
          ),
        },
      };

      res.json({
        success: true,
        data: userWithStats,
      });
    } catch (error) {
      return AdminController.handleError(res, error, "getUserById");
    }
  },
  // POST /api/admin/users - Crear usuario
  createUser: async (req, res) => {
    try {
      const { firstName, lastName, email, password, role, phone } = req.body;

      // Verificar si el email ya existe
      const existingUser = await User.findOne({
        email: email.toLowerCase().trim(),
      });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "El email ya está registrado",
        });
      }

      const user = new User({
        firstName,
        lastName,
        email: email.toLowerCase().trim(),
        password,
        role: role || "customer",
        phone,
        isVerified: true, // Admin crea usuarios ya verificados
        isActive: true,
      });

      await user.save();

      const userResponse = user.toObject();
      delete userResponse.password;

      logger.info(`Usuario creado por admin ${req.user.id}`, {
        newUserId: user._id,
      });

      res.status(201).json({
        success: true,
        message: "Usuario creado exitosamente",
        data: userResponse,
      });
    } catch (error) {
      if (error.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message: "Datos inválidos",
          errors: Object.values(error.errors).map((e) => e.message),
        });
      }
      return AdminController.handleError(res, error, "createUser");
    }
  },

  // PUT /api/admin/users/:id - Actualizar usuario
  updateUser: async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Validar ObjectId
      if (!AdminController.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "ID de usuario inválido",
        });
      }

      // Campos que NO se pueden actualizar directamente
      const restrictedFields = [
        "password",
        "verificationToken",
        "passwordResetToken",
        "loginAttempts",
        "lockUntil",
        "totalOrders",
        "totalSpent",
      ];

      // Remover campos restringidos
      restrictedFields.forEach((field) => delete updates[field]);

      // Validaciones adicionales
      if (updates.email) {
        updates.email = updates.email.toLowerCase().trim();

        // Verificar si el email ya existe
        const existingUser = await User.findOne({
          email: updates.email,
          _id: { $ne: id },
        });

        if (existingUser) {
          return res.status(409).json({
            success: false,
            message: "El email ya está en uso por otro usuario",
          });
        }
      }

      // Validar rol
      if (
        updates.role &&
        !["customer", "admin", "moderator"].includes(updates.role)
      ) {
        return res.status(400).json({
          success: false,
          message: "Rol inválido",
        });
      }

      // Prevenir que el último admin se quite su propio rol
      if (updates.role === "customer" && id === req.user.id) {
        const adminCount = await User.countDocuments({
          role: "admin",
          isActive: true,
        });
        if (adminCount <= 1) {
          return res.status(400).json({
            success: false,
            message:
              "No puedes quitarte el rol de admin siendo el último administrador",
          });
        }
      }

      // Actualizar usuario
      const user = await User.findByIdAndUpdate(
        id,
        { $set: updates },
        {
          new: true,
          runValidators: true,
          select: "-password -verificationToken -passwordResetToken",
        },
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      logger.info(`Usuario ${id} actualizado por admin ${req.user.id}`, {
        updatedFields: Object.keys(updates),
      });

      res.json({
        success: true,
        message: "Usuario actualizado exitosamente",
        data: user,
      });
    } catch (error) {
      if (error.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message: "Datos de usuario inválidos",
          errors: Object.values(error.errors).map((e) => e.message),
        });
      }

      return AdminController.handleError(res, error, "updateUser");
    }
  },

  // DELETE /api/admin/users/:id - Eliminar usuario (soft delete)
  deleteUser: async (req, res) => {
    try {
      const { id } = req.params;

      // Validar ObjectId
      if (!AdminController.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "ID de usuario inválido",
        });
      }

      // No permitir que un admin se elimine a sí mismo
      if (id === req.user.id) {
        return res.status(400).json({
          success: false,
          message: "No puedes eliminar tu propia cuenta",
        });
      }

      const user = await User.findById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      // Verificar que no sea el último admin
      if (user.role === "admin") {
        const adminCount = await User.countDocuments({
          role: "admin",
          isActive: true,
          _id: { $ne: id },
        });

        if (adminCount === 0) {
          return res.status(400).json({
            success: false,
            message: "No puedes eliminar al único administrador activo",
          });
        }
      }

      // Soft delete: marcar como inactivo en lugar de eliminar
      user.isActive = false;
      user.email = `deleted_${Date.now()}_${user.email}`; // Liberar email
      await user.save();

      logger.warn(`Usuario ${id} eliminado por admin ${req.user.id}`, {
        deletedUser: {
          email: user.email,
          role: user.role,
        },
      });

      res.json({
        success: true,
        message: "Usuario eliminado exitosamente",
      });
    } catch (error) {
      return AdminController.handleError(res, error, "deleteUser");
    }
  },

  // PUT /api/admin/users/:id/activate - Activar/desactivar usuario
  toggleUserStatus: async (req, res) => {
    try {
      const { id } = req.params;

      // Validar ObjectId
      if (!AdminController.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "ID de usuario inválido",
        });
      }

      // No permitir que un admin se desactive a sí mismo
      if (id === req.user.id) {
        return res.status(400).json({
          success: false,
          message: "No puedes desactivar tu propia cuenta",
        });
      }

      const user = await User.findById(id).select(
        "-password -verificationToken -passwordResetToken",
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      // Verificar que no sea el último admin activo
      if (user.role === "admin" && user.isActive) {
        const adminCount = await User.countDocuments({
          role: "admin",
          isActive: true,
          _id: { $ne: id },
        });

        if (adminCount === 0) {
          return res.status(400).json({
            success: false,
            message: "No puedes desactivar al único administrador activo",
          });
        }
      }

      // Toggle estado
      user.isActive = !user.isActive;
      await user.save();

      // Resetear intentos de login si se activa
      if (user.isActive) {
        await user.resetLoginAttempts();
      }

      logger.info(
        `Usuario ${id} ${user.isActive ? "activado" : "desactivado"} por admin ${req.user.id}`,
      );

      res.json({
        success: true,
        message: `Usuario ${user.isActive ? "activado" : "desactivado"} exitosamente`,
        data: {
          id: user._id,
          email: user.email,
          isActive: user.isActive,
        },
      });
    } catch (error) {
      return AdminController.handleError(res, error, "toggleUserStatus");
    }
  },

  // ============================================
  // ESTADÍSTICAS
  // ============================================

  // GET /api/admin/stats - Estadísticas del sistema
  getStats: async (req, res) => {
    try {
      const timeRange = req.query.range || "30d"; // 7d, 30d, 90d, 1y

      // Calcular fecha de inicio según el rango
      const now = new Date();
      let startDate;

      switch (timeRange) {
        case "7d":
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case "90d":
          startDate = new Date(now.setDate(now.getDate() - 90));
          break;
        case "1y":
          startDate = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
        default: // 30d
          startDate = new Date(now.setDate(now.getDate() - 30));
      }

      // Ejecutar todas las consultas en paralelo
      const [
        totalUsers,
        activeUsers,
        verifiedUsers,
        newUsers,
        usersByRole,
        recentUsers,
      ] = await Promise.all([
        // Total de usuarios
        User.countDocuments(),

        // Usuarios activos
        User.countDocuments({ isActive: true }),

        // Usuarios verificados
        User.countDocuments({ isVerified: true }),

        // Nuevos usuarios en el rango de tiempo
        User.countDocuments({
          createdAt: { $gte: startDate },
        }),

        // Usuarios por rol
        User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),

        // Últimos 10 usuarios registrados
        User.find()
          .select("firstName lastName email role createdAt isVerified")
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
      ]);

      // Formatear usuarios por rol
      const roleStats = {
        customer: 0,
        admin: 0,
        moderator: 0,
      };

      usersByRole.forEach((item) => {
        roleStats[item._id] = item.count;
      });

      // Calcular tasas
      const verificationRate =
        totalUsers > 0 ? ((verifiedUsers / totalUsers) * 100).toFixed(2) : 0;

      const activeRate =
        totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(2) : 0;

      // Calcular crecimiento (comparar con período anterior)
      const previousStartDate = new Date(startDate);
      previousStartDate.setDate(
        previousStartDate.getDate() - (now - startDate) / (1000 * 60 * 60 * 24),
      );

      const previousPeriodUsers = await User.countDocuments({
        createdAt: {
          $gte: previousStartDate,
          $lt: startDate,
        },
      });

      const growthRate =
        previousPeriodUsers > 0
          ? (
              ((newUsers - previousPeriodUsers) / previousPeriodUsers) *
              100
            ).toFixed(2)
          : 0;

      res.json({
        success: true,
        data: {
          overview: {
            totalUsers,
            activeUsers,
            verifiedUsers,
            inactiveUsers: totalUsers - activeUsers,
            newUsers,
            growthRate: parseFloat(growthRate),
            verificationRate: parseFloat(verificationRate),
            activeRate: parseFloat(activeRate),
          },
          usersByRole: roleStats,
          recentUsers,
          timeRange,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      return AdminController.handleError(res, error, "getStats");
    }
  },

  // ============================================
  // ACCIONES ADICIONALES
  // ============================================

  // PUT /api/admin/users/:id/verify - Verificar manualmente un usuario
  verifyUser: async (req, res) => {
    try {
      const { id } = req.params;

      if (!AdminController.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "ID de usuario inválido",
        });
      }

      const user = await User.findByIdAndUpdate(
        id,
        {
          isVerified: true,
          $unset: {
            verificationToken: 1,
            verificationTokenExpires: 1,
          },
        },
        { new: true, select: "-password" },
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      logger.info(
        `Usuario ${id} verificado manualmente por admin ${req.user.id}`,
      );

      res.json({
        success: true,
        message: "Usuario verificado exitosamente",
        data: user,
      });
    } catch (error) {
      return AdminController.handleError(res, error, "verifyUser");
    }
  },

  // PUT /api/admin/users/:id/unlock - Desbloquear cuenta
  unlockUser: async (req, res) => {
    try {
      const { id } = req.params;

      if (!AdminController.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "ID de usuario inválido",
        });
      }

      const user = await User.findById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      await user.resetLoginAttempts();

      logger.info(`Usuario ${id} desbloqueado por admin ${req.user.id}`);

      res.json({
        success: true,
        message: "Usuario desbloqueado exitosamente",
      });
    } catch (error) {
      return AdminController.handleError(res, error, "unlockUser");
    }
  },

  // PUT /api/admin/users/:id/role - Cambiar rol de usuario
  changeUserRole: async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!AdminController.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "ID de usuario inválido",
        });
      }

      if (!["customer", "admin", "moderator"].includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Rol inválido",
        });
      }

      // No permitir que un admin se quite su propio rol
      if (id === req.user.id && role !== "admin") {
        const adminCount = await User.countDocuments({
          role: "admin",
          isActive: true,
          _id: { $ne: id },
        });

        if (adminCount === 0) {
          return res.status(400).json({
            success: false,
            message:
              "No puedes quitarte el rol de admin siendo el último administrador",
          });
        }
      }

      const user = await User.findByIdAndUpdate(
        id,
        { role },
        { new: true, select: "-password" },
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      logger.info(
        `Rol de usuario ${id} cambiado a ${role} por admin ${req.user.id}`,
      );

      res.json({
        success: true,
        message: "Rol actualizado exitosamente",
        data: {
          id: user._id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      return AdminController.handleError(res, error, "changeUserRole");
    }
  },

  // GET /api/admin/users/export - Exportar usuarios a CSV
  exportUsers: async (req, res) => {
    try {
      const users = await User.find()
        .select(
          "firstName lastName email role isActive isVerified createdAt totalOrders totalSpent",
        )
        .lean();

      // Convertir a CSV
      const csvHeader =
        "ID,Nombre,Apellido,Email,Rol,Activo,Verificado,Fecha Registro,Total Órdenes,Total Gastado\n";
      const csvData = users
        .map(
          (user) =>
            `${user._id},${user.firstName},${user.lastName},${user.email},${user.role},${user.isActive},${user.isVerified},${user.createdAt},${user.totalOrders || 0},${user.totalSpent || 0}`,
        )
        .join("\n");

      const csv = csvHeader + csvData;

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=usuarios-${Date.now()}.csv`,
      );
      res.send(csv);

      logger.info(`Usuarios exportados por admin ${req.user.id}`);
    } catch (error) {
      return AdminController.handleError(res, error, "exportUsers");
    }
  },
};

export default AdminController;
