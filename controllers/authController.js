// controllers/authController.js - Controlador de autenticación para ATHENA BRAND
import jwt from "jsonwebtoken";
import { validationResult } from "express-validator";
import User from "../models/User.js";
import { sendEmail } from "../utils/sendEmail.js";
import logger from "../utils/logger.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import validator from "validator";
import xss from "xss";
import {
  getRedisClient,
  storeRefreshToken,
  invalidateUserRefreshTokens,
} from "../utils/redis.js";

// Opciones base de cookie — HttpOnly impide acceso desde JS (inmune a XSS)
const COOKIE_BASE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  // "none" requerido para cookies cross-origin (Vercel frontend → Fly.io API)
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
};

// Setea access_token y refresh_token como cookies HttpOnly
const setAuthCookies = (res, { accessToken, refreshToken }) => {
  res.cookie("access_token", accessToken, {
    ...COOKIE_BASE,
    maxAge: 15 * 60 * 1000,       // 15 minutos — igual que JWT_EXPIRES_IN
    path: "/",
  });
  res.cookie("refresh_token", refreshToken, {
    ...COOKIE_BASE,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    path: "/api/auth/refresh-token",  // solo enviado a ese endpoint
  });
};

// Limpia ambas cookies al hacer logout
const clearAuthCookies = (res) => {
  res.clearCookie("access_token",  { ...COOKIE_BASE, path: "/" });
  res.clearCookie("refresh_token", { ...COOKIE_BASE, path: "/api/auth/refresh-token" });
};

// Función para generar JWT
const generateTokenPair = async (userId, role) => {
  const expiresIn = process.env.JWT_EXPIRES_IN || "15m";
  const accessToken = jwt.sign({ userId, role }, process.env.JWT_SECRET, {
    expiresIn,
    algorithm: "HS256",
  });

  const refreshToken = crypto.randomBytes(40).toString("hex");
  // ✅ Use centralized Redis utility
  await storeRefreshToken(userId.toString(), refreshToken, 604800);

  return { accessToken, refreshToken };
};
// Función para crear respuesta de usuario limpia
const createUserResponse = (user) => {
  const userResponse = user.toObject();
  delete userResponse.password;
  delete userResponse.loginAttempts;
  delete userResponse.lockUntil;
  delete userResponse.verificationToken;
  delete userResponse.verificationTokenExpires;
  delete userResponse.passwordResetToken;
  delete userResponse.passwordResetExpires;
  return userResponse;
};

class AuthController {
  static async refreshToken(req, res) {
    try {
      // Leer de cookie HttpOnly (preferido) o body (compatibilidad con clientes API)
      const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;
      if (!refreshToken) {
        return res
          .status(400)
          .json({ success: false, message: "Refresh token requerido" });
      }

      // ✅ Obtener userId directamente desde el índice inverso
      const userId = await getRedisClient().get(`rt:${refreshToken}`);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Refresh token inválido o expirado",
        });
      }

      const user = await User.findById(userId);
      if (!user || !user.isActive) {
        // Opcional: limpiar token huérfano
        await getRedisClient().del(`rt:${refreshToken}`);
        return res
          .status(401)
          .json({ success: false, message: "Usuario no válido" });
      }

      const newTokens = await generateTokenPair(user._id, user.role);

      // Rotar refresh token — eliminar el anterior
      await getRedisClient().del(`rt:${refreshToken}`);
      await getRedisClient().del(`refresh_token:${userId}`);

      setAuthCookies(res, newTokens);

      res.json({ success: true, message: "Token renovado" });
    } catch (error) {
      logger.error("Error en refreshToken:", error);
      res.status(500).json({ success: false, message: "Error interno" });
    }
  }

  // POST /api/auth/register - Registro de usuario
  static async register(req, res) {
    try {
      // Verificar errores de validación
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Datos de registro inválidos",
          errors: errors.array(),
        });
      }

      const { email, password, firstName, lastName, phone, address } = req.body;

      // Verificar si el usuario ya existe
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Ya existe una cuenta con este email",
        });
      }

      // Crear nuevo usuario
      const user = new User({
        email,
        password,
        firstName,
        lastName,
        phone,
        address,
      });

      // Generar token de verificación
      const verificationToken = user.generateVerificationToken();

      await user.save();

      // Enviar email de verificación
      try {
        await sendEmail({
          to: user.email,
          subject: "Verificar cuenta - ATHENA BRAND",
          template: "verification",
          data: {
            firstName: user.firstName,
            verificationToken,
            verificationUrl: `${process.env.FRONTEND_URL}/verificar-cuenta?token=${verificationToken}`,
          },
        });
      } catch (emailError) {
        logger.warn("Error enviando email de verificación", { error: emailError.message, userId: user._id });
      }

      const token = await generateTokenPair(user._id, user.role);
      setAuthCookies(res, token);
      const userResponse = createUserResponse(user);

      res.status(201).json({
        success: true,
        message: "Usuario registrado exitosamente. Revisa tu email para verificar tu cuenta.",
        user: userResponse,
      });
    } catch (error) {
      // Log interno sin exposición al cliente
      logger.error("Error en registro:", {
        error: error.message,
        stack: error.stack,
        userId: req.userId,
      });
      return res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  }

  // POST /api/auth/login - Login de usuario
  static async login(req, res) {
    try {
      const { email, password } = req.body;
      let user = await User.findOne({ email }).select("+password");

      // Simular hash comparison aunque el usuario no exista
      const dummyHash =
        "$2b$12$dummy.hash.to.prevent.timing.attacks.abcdefghijklmnopqrstuvwxyz";
      const passwordToCheck = user ? user.password : dummyHash;

      const isPasswordValid = await bcrypt.compare(password, passwordToCheck);
      // Si no existe usuario o la contraseña es inválida
      if (!user || !isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Credenciales inválidas",
        });
      }
      const token = await generateTokenPair(user._id, user.role);
      setAuthCookies(res, token);
      const userResponse = createUserResponse(user);

      return res.json({
        success: true,
        message: "Inicio de sesión exitoso",
        user: userResponse,
      });
    } catch (error) {
      logger.error("Error en login", { error: error.message, stack: error.stack, ip: req.ip });
      res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  }

  // GET /api/auth/me - Obtener perfil del usuario logueado
  static async getProfile(req, res) {
    try {
      const user = await User.findById(req.userId)
        .select(
          "-password -loginAttempts -lockUntil -verificationToken -passwordResetToken",
        )
        .populate("wishlist", "name slug images price discountPrice");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      res.json({
        success: true,
        user,
      });
    } catch (error) {
      logger.error("Error obteniendo perfil", { error: error.message, userId: req.userId });
      res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  }

  // PUT /api/auth/profile - Actualizar perfil
  static async updateProfile(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Datos inválidos",
          errors: errors.array(),
        });
      }

      const allowedUpdates = [
        "firstName",
        "lastName",
        "phone",
        "address",
        "birthDate",
        "gender",
        "preferences",
      ];
      const updates = {};

      allowedUpdates.forEach((field) => {
        if (req.body[field] !== undefined) {
          let value = req.body[field];

          // Sanitizar strings
          if (typeof value === "string") {
            value = xss(value.trim());

            // Validaciones específicas por campo
            if (field === "phone" && !validator.isMobilePhone(value)) {
              throw new Error("Número de teléfono inválido");
            }
          }

          updates[field] = value;
        }
      });

      const user = await User.findByIdAndUpdate(req.userId, updates, {
        new: true,
        runValidators: true,
      }).select(
        "-password -loginAttempts -lockUntil -verificationToken -passwordResetToken",
      );

      res.json({
        success: true,
        message: "Perfil actualizado exitosamente",
        user,
      });
    } catch (error) {
      logger.error("Error actualizando perfil", { error: error.message, userId: req.userId });
      res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  }

  // POST /api/auth/verify-email - Verificar email
  static async verifyEmail(req, res) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: "Token de verificación requerido",
        });
      }

      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      const user = await User.findOne({
        verificationTokenHash: hashedToken,
        verificationTokenExpires: { $gt: Date.now() },
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: "Token de verificación inválido o expirado",
        });
      }

      user.isVerified = true;
      user.verificationTokenHash = undefined;
      user.verificationTokenExpires = undefined;

      await user.save();

      res.json({
        success: true,
        message: "Email verificado exitosamente",
      });
    } catch (error) {
      logger.error("Error verificando email", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  }

  // POST /api/auth/forgot-password - Solicitar reseteo de contraseña
  static async forgotPassword(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Email no válido",
        });
      }

      const { email } = req.body;
      const user = await User.findByEmail(email);

      if (!user) {
        // Por seguridad, siempre responder success
        return res.json({
          success: true,
          message:
            "Si el email existe, se ha enviado un enlace de recuperación",
        });
      }

      const resetToken = user.generatePasswordResetToken();
      await user.save();

      try {
        await sendEmail({
          to: user.email,
          subject: "Resetear contraseña - ATHENA BRAND",
          template: "password-reset",
          data: {
            firstName: user.firstName,
            resetToken,
            resetUrl: `${process.env.FRONTEND_URL}/auth/reset-password?token=${resetToken}`,
          },
        });
      } catch (emailError) {
        logger.error("Error enviando email de reset", { error: emailError.message, userId: user._id });
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        return res.status(500).json({
          success: false,
          message: "Error enviando email de recuperación",
        });
      }

      res.json({
        success: true,
        message: "Se ha enviado un enlace de recuperación a tu email",
      });
    } catch (error) {
      logger.error("Error en forgot password", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  }

  // POST /api/auth/reset-password - Resetear contraseña
  static async resetPassword(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Datos inválidos",
          errors: errors.array(),
        });
      }

      const { token, password } = req.body;

      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      const user = await User.findOne({
        passwordResetTokenHash: hashedToken,
        passwordResetExpires: { $gt: Date.now() },
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: "Token de reset inválido o expirado",
        });
      }

      user.password = password;
      user.passwordResetTokenHash = undefined;
      user.passwordResetExpires = undefined;

      await user.save();

      // ✅ INVALIDATE ALL REFRESH TOKENS after password reset
      try {
        await invalidateUserRefreshTokens(user._id.toString());
      } catch (error) {
        logger.error("Error invalidating tokens on password reset", {
          userId: user._id,
          error: error.message,
        });
        // Don't fail the password reset if token invalidation fails
      }

      res.json({
        success: true,
        message:
          "Contraseña restablecida exitosamente. Por favor inicia sesión nuevamente.",
      });
    } catch (error) {
      logger.error("Error en reset password", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  }

  // POST /api/auth/logout - Logout
  static async logout(req, res) {
    try {
      if (!req.userId) {
        return res
          .status(400)
          .json({ success: false, message: "Usuario no autenticado" });
      }
      const userId = req.userId;

      // Obtener el refresh token actual (si lo guardaste en el login)
      const currentRefreshToken = await getRedisClient().get(`refresh_token:${userId}`);

      if (currentRefreshToken) {
        await getRedisClient().del(`rt:${currentRefreshToken}`);
      }

      await getRedisClient().del(`refresh_token:${userId}`);

      clearAuthCookies(res);
      res.json({ success: true, message: "Sesión cerrada correctamente" });
    } catch (error) {
      logger.error("Error en logout:", error);
      res
        .status(500)
        .json({ success: false, message: "Error al cerrar sesión" });
    }
  }

  // POST /api/auth/change-password - Cambiar contraseña (usuario logueado)
  static async changePassword(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Datos inválidos",
          errors: errors.array(),
        });
      }

      const { currentPassword, newPassword } = req.body;

      const user = await User.findById(req.userId).select("+password");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      // Verificar contraseña actual
      const isCurrentPasswordValid =
        await user.comparePassword(currentPassword);

      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: "Contraseña actual incorrecta",
        });
      }

      // Cambiar contraseña
      user.password = newPassword;
      await user.save();

      // ✅ INVALIDATE ALL REFRESH TOKENS after password change
      try {
        await invalidateUserRefreshTokens(user._id.toString());
        logger.info("User tokens invalidated after password change", {
          userId: user._id,
        });
      } catch (error) {
        logger.error("Error invalidating tokens on password change", {
          userId: user._id,
          error: error.message,
        });
        // Don't fail the password change if token invalidation fails
      }

      res.json({
        success: true,
        message:
          "Contraseña cambiada exitosamente. Por favor inicia sesión nuevamente.",
      });
    } catch (error) {
      logger.error("Error cambiando contraseña", { error: error.message, userId: req.userId });
      res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  }
}

export default AuthController;
