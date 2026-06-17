// routes/auth.js - Rutas de autenticación con seguridad avanzada
import express from "express";
import { body, validationResult } from "express-validator";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import AuthController from "../controllers/authController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// ========================================
// SEGURIDAD CON HELMET
// ========================================
router.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://tudominiofront.vercel.app"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:", "https://res.cloudinary.com"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
);

// ========================================
// RATE LIMITERS
// ========================================

// Limita intentos de login/registro
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message:
      "Demasiados intentos de autenticación. Intenta de nuevo en 15 minutos.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limita solicitudes de recuperación de contraseña
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    message: "Demasiados intentos de recuperación. Intenta de nuevo en 1 hora.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter general para rutas protegidas
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: "Demasiadas solicitudes. Reduce la velocidad.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ========================================
// VALIDACIONES
// ========================================

const registerValidation = [
  body("email").isEmail().normalizeEmail().withMessage("Email no válido"),
  body("password")
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage(
      "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial",
    ),
  body("firstName")
    .trim()
    .escape()
    .isLength({ min: 2, max: 50 })
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s\-']+$/)
    .withMessage("El nombre solo puede contener letras y espacios"),
  body("lastName")
    .trim()
    .escape()
    .isLength({ min: 2, max: 50 })
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s\-']+$/)
    .withMessage("El apellido solo puede contener letras y espacios"),
  body("phone")
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage("Formato de teléfono no válido"),
];

const loginValidation = [
  body("email").isEmail().normalizeEmail().withMessage("Email no válido"),
  body("password").notEmpty().withMessage("La contraseña es requerida"),
];

const updateProfileValidation = [
  body("firstName")
    .optional()
    .trim()
    .escape()
    .isLength({ min: 2, max: 50 })
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s\-']+$/),
  body("lastName")
    .optional()
    .trim()
    .escape()
    .isLength({ min: 2, max: 50 })
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s\-']+$/),
  body("phone")
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage("Formato de teléfono no válido"),
];

const changePasswordValidation = [
  body("currentPassword").notEmpty().withMessage("Contraseña actual requerida"),
  body("newPassword")
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage(
      "La nueva contraseña debe tener 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial",
    ),
];

const resetPasswordValidation = [
  body("token")
    .notEmpty()
    .isLength({ min: 32, max: 512 })
    .matches(/^[a-zA-Z0-9+/=.-]+$/)
    .withMessage("Token inválido"),
  body("password")
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage("La contraseña debe cumplir los requisitos de seguridad"),
];

const forgotPasswordValidation = [
  body("email").isEmail().normalizeEmail().withMessage("Email no válido"),
];

// ========================================
// MIDDLEWARE DE VALIDACIÓN GLOBAL
// ========================================
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Errores de validación",
      errors: errors.array(),
    });
  }
  next();
};

// ========================================
// RUTAS PÚBLICAS
// ========================================
router.post(
  "/register",
  generalLimiter,
  registerValidation,
  validate,
  AuthController.register,
);

router.post(
  "/login",
  authLimiter,
  loginValidation,
  validate,
  AuthController.login,
);

router.post("/verify-email", generalLimiter, AuthController.verifyEmail);

router.post(
  "/forgot-password",
  passwordResetLimiter,
  forgotPasswordValidation,
  validate,
  AuthController.forgotPassword,
);

router.post(
  "/reset-password",
  passwordResetLimiter,
  resetPasswordValidation,
  validate,
  AuthController.resetPassword,
);

// ========================================
// RUTAS PROTEGIDAS
// ========================================
router.get("/me", generalLimiter, auth, AuthController.getProfile);

router.put(
  "/profile",
  generalLimiter,
  auth,
  updateProfileValidation,
  validate,
  AuthController.updateProfile,
);

router.post(
  "/change-password",
  generalLimiter,
  auth,
  changePasswordValidation,
  validate,
  AuthController.changePassword,
);

router.post(
  "/refresh-token",
  generalLimiter,
  AuthController.refreshToken,
);

router.post("/logout", generalLimiter, auth, AuthController.logout);

// ========================================
// MANEJO DE ERRORES GLOBAL
// ========================================
router.use((error, req, res, next) => {
  return res.status(error.status || 500).json({
    success: false,
    message: error.message || "Error interno del servidor",
  });
});

export default router;
