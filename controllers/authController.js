// controllers/authController.js - Controlador de autenticación para ATHENA BRAND
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { Redis} = require('@upstash/redis');
const redis = Redis.fromEnv();
const validator = require('validator');
const xss = require('xss');

// Función para generar JWT
const generateTokenPair = async (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: '15m' // Token corto
  });
  
  const refreshToken = crypto.randomBytes(40).toString('hex');
  
  // Guardar refresh token en Redis con expiración
  await redis.setex(`refresh_token:${userId}`, 604800, refreshToken); // 7 días
  //indice inverso para buscar userId por refreshToken
  await redis.setex(`rt:${refreshToken}`, 604800, userId); // 7 días

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
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token requerido' });
    }

    // ✅ Obtener userId directamente desde el índice inverso
    const userId = await redis.get(`rt:${refreshToken}`);
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Refresh token inválido o expirado' });
    }

    const user = await User.findById(userId);
    if (!user || !user.isActive) {
      // Opcional: limpiar token huérfano
      await redis.del(`rt:${refreshToken}`);
      return res.status(401).json({ success: false, message: 'Usuario no válido' });
    }

    // Generar nuevos tokens
    const newTokens = await generateTokenPair(user._id);

    // Opcional: eliminar el refresh token antiguo (mejor seguridad)
    await redis.del(`rt:${refreshToken}`);
    await redis.del(`refresh_token:${userId}`);

    res.json({
      success: true,
      message: 'Token renovado',
      token: newTokens
    });

  } catch (error) {
    logger.error('Error en refreshToken:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
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
          message: 'Datos de registro inválidos',
          errors: errors.array()
        });
      }

      const { email, password, firstName, lastName, phone, address } = req.body;

      // Verificar si el usuario ya existe
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe una cuenta con este email'
        });
      }

      // Crear nuevo usuario
      const user = new User({
        email,
        password,
        firstName,
        lastName,
        phone,
        address
      });

      // Generar token de verificación
      const verificationToken = user.generateVerificationToken();
      
      await user.save();

      // Enviar email de verificación
      try {
        await sendEmail({
          to: user.email,
          subject: 'Verificar cuenta - ATHENA BRAND',
          template: 'verification',
          data: {
            firstName: user.firstName,
            verificationToken,
            verificationUrl: `${process.env.FRONTEND_URL}/verificar-cuenta?token=${verificationToken}`
          }
        });
      } catch (emailError) {
        console.error('Error enviando email de verificación:', emailError);
        // No fallar el registro si el email falla
      }

      // Generar JWT
      const token = generateTokenPair(user._id);

      // Respuesta sin datos sensibles
      const userResponse = createUserResponse(user);

      res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente. Revisa tu email para verificar tu cuenta.',
        token,
        user: userResponse
      });

    } catch (error) {
       // Log interno sin exposición al cliente
      logger.error('Error en registro:', {
            error: error.message,
            stack: error.stack,
            userId: req.userId
          });
            return res.status(500).json({
              success: false,
              message: 'Error interno del servidor'
            });
    }
  }

  // POST /api/auth/login - Login de usuario
  static async login(req, res) {
    try {
    const { email, password } = req.body;
    let user = await User.findOne({ email }).select('+password');
    
    // Simular hash comparison aunque el usuario no exista
    const dummyHash = '$2b$12$dummy.hash.to.prevent.timing.attacks.abcdefghijklmnopqrstuvwxyz';
    const passwordToCheck = user ? user.password : dummyHash;
    
    const isPasswordValid = await bcrypt.compare(password, passwordToCheck);
    // Si no existe usuario o la contraseña es inválida
    if (!user || !isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }
        const token = await generateTokenPair(user._id);
    const userResponse = createUserResponse(user);

    // Respuesta exitosa
    return res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      token,
      user: userResponse
    });

    } catch (error) {
      console.error('Error en login:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : {}
      });
    }
  }

  // GET /api/auth/me - Obtener perfil del usuario logueado
  static async getProfile(req, res) {
    try {
      const user = await User.findById(req.userId)
        .select('-password -loginAttempts -lockUntil -verificationToken -passwordResetToken')
        .populate('wishlist', 'name slug images price discountPrice');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      res.json({
        success: true,
        user
      });

    } catch (error) {
      console.error('Error obteniendo perfil:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
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
          message: 'Datos inválidos',
          errors: errors.array()
        });
      }

      const allowedUpdates = ['firstName', 'lastName', 'phone', 'address', 'birthDate', 'gender', 'preferences'];
      const updates = {};
      
allowedUpdates.forEach(field => {
  if (req.body[field] !== undefined) {
    let value = req.body[field];
    
    // Sanitizar strings
    if (typeof value === 'string') {
      value = xss(value.trim());
      
      // Validaciones específicas por campo
      if (field === 'phone' && !validator.isMobilePhone(value)) {
        throw new Error('Número de teléfono inválido');
      }
    }
    
    updates[field] = value;
  }
});

      const user = await User.findByIdAndUpdate(
        req.userId,
        updates,
        { new: true, runValidators: true }
      ).select('-password -loginAttempts -lockUntil -verificationToken -passwordResetToken');

      res.json({
        success: true,
        message: 'Perfil actualizado exitosamente',
        user
      });

    } catch (error) {
      console.error('Error actualizando perfil:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
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
          message: 'Token de verificación requerido'
        });
      }
      

      const user = await User.findOne({
        verificationToken: token,
        verificationTokenExpires: { $gt: Date.now() }
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Token de verificación inválido o expirado'
        });
      }

      user.isVerified = true;
      user.verificationToken = undefined;
      user.verificationTokenExpires = undefined;
      
      await user.save();

      res.json({
        success: true,
        message: 'Email verificado exitosamente'
      });

    } catch (error) {
      console.error('Error verificando email:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
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
          message: 'Email no válido'
        });
      }

      const { email } = req.body;
      const user = await User.findByEmail(email);

      if (!user) {
        // Por seguridad, siempre responder success
        return res.json({
          success: true,
          message: 'Si el email existe, se ha enviado un enlace de recuperación'
        });
      }

      const resetToken = user.generatePasswordResetToken();
      await user.save();

      try {
        await sendEmail({
          to: user.email,
          subject: 'Resetear contraseña - ATHENA BRAND',
          template: 'password-reset',
          data: {
            firstName: user.firstName,
            resetToken,
            resetUrl: `${process.env.FRONTEND_URL}/resetear-password?token=${resetToken}`
          }
        });
      } catch (emailError) {
        console.error('Error enviando email de reset:', emailError);
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        
        return res.status(500).json({
          success: false,
          message: 'Error enviando email de recuperación'
        });
      }

      res.json({
        success: true,
        message: 'Se ha enviado un enlace de recuperación a tu email'
      });

    } catch (error) {
      console.error('Error en forgot password:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
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
          message: 'Datos inválidos',
          errors: errors.array()
        });
      }

      const { token, password } = req.body;

      const user = await User.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: Date.now() }
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Token de reset inválido o expirado'
        });
      }

      user.password = password;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      
      await user.save();

      res.json({
        success: true,
        message: 'Contraseña restablecida exitosamente'
      });

    } catch (error) {
      console.error('Error en reset password:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // POST /api/auth/logout - Logout
   static async logout(req, res) {
  try {
    if (!req.userId) {
      return res.status(400).json({ success: false, message: 'Usuario no autenticado' });
    }
    const userId = req.userId;
    
    // Obtener el refresh token actual (si lo guardaste en el login)
    const currentRefreshToken = await redis.get(`refresh_token:${userId}`);
    
    if (currentRefreshToken) {
      await redis.del(`rt:${currentRefreshToken}`);
    }
    
    await redis.del(`refresh_token:${userId}`);

    res.json({ success: true, message: 'Sesión cerrada correctamente' });
  } catch (error) {
    logger.error('Error en logout:', error);
    res.status(500).json({ success: false, message: 'Error al cerrar sesión' });
  }
}
  

  // POST /api/auth/change-password - Cambiar contraseña (usuario logueado)
  static async changePassword(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          errors: errors.array()
        });
      }

      const { currentPassword, newPassword } = req.body;

      const user = await User.findById(req.userId).select('+password');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // Verificar contraseña actual
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Contraseña actual incorrecta'
        });
      }

      // Cambiar contraseña
      user.password = newPassword;
      await user.save();

      res.json({
        success: true,
        message: 'Contraseña cambiada exitosamente'
      });

    } catch (error) {
      console.error('Error cambiando contraseña:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}

module.exports = AuthController;