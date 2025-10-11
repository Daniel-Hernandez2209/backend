```js
/*
 * models/User.js - Modelo de Usuario para ATHENA BRAND E-commerce
 * 
 * DESCRIPCIÓN GENERAL:
 * Este archivo define el esquema de datos para usuarios en MongoDB usando Mongoose.
 * Incluye funcionalidades completas para un sistema de e-commerce:
 * - Autenticación segura con bcrypt y tokens
 * - Gestión de perfiles y direcciones múltiples
 * - Sistema de wishlist y historial de compras
 * - Control de roles y seguridad de acceso
 * - Validaciones de datos y métodos utilitarios
 */

// Importación de dependencias necesarias
const mongoose = require('mongoose'); // ODM para MongoDB
const bcrypt = require('bcryptjs'); // Librería para hash de contraseñas

// Definición del esquema principal de usuario
const userSchema = new mongoose.Schema({
  
  // === CAMPOS DE AUTENTICACIÓN ===
  email: {
    type: String, // Tipo de dato cadena de texto
    required: [true, 'El email es requerido'], // Campo obligatorio con mensaje de error
    unique: true, // Índice único - no puede haber emails duplicados
    lowercase: true, // Convierte automáticamente a minúsculas
    trim: true, // Elimina espacios en blanco al inicio y final
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email no válido'] // Validación con regex
  },
  
  password: {
    type: String, // Contraseña como cadena de texto
    required: [true, 'La contraseña es requerida'], // Campo obligatorio
    minlength: [6, 'La contraseña debe tener al menos 6 caracteres'], // Longitud mínima
    select: false // Excluye este campo por defecto en las consultas (seguridad)
  },
  
  // === INFORMACIÓN PERSONAL ===
  firstName: {
    type: String, // Nombre como cadena de texto
    required: [true, 'El nombre es requerido'], // Campo obligatorio
    trim: true, // Elimina espacios en blanco
    maxlength: [50, 'El nombre no puede exceder 50 caracteres'] // Longitud máxima
  },
  
  lastName: {
    type: String, // Apellido como cadena de texto
    required: [true, 'El apellido es requerido'], // Campo obligatorio
    trim: true, // Elimina espacios en blanco
    maxlength: [50, 'El apellido no puede exceder 50 caracteres'] // Longitud máxima
  },
  
  phone: {
    type: String, // Teléfono como cadena de texto
    trim: true, // Elimina espacios en blanco
    match: [/^[+]?[\d\s\-\(\)]+$/, 'Número de teléfono no válido'] // Validación con regex para formato telefónico
  },
  
  // === DIRECCIÓN PRINCIPAL (SUBDOCUMENTO) ===
  address: {
    street: {
      type: String, // Calle como cadena de texto
      trim: true, // Elimina espacios en blanco
      maxlength: [200, 'La dirección no puede exceder 200 caracteres'] // Longitud máxima
    },
    city: {
      type: String, // Ciudad como cadena de texto
      trim: true, // Elimina espacios en blanco
      maxlength: [100, 'La ciudad no puede exceder 100 caracteres'] // Longitud máxima
    },
    department: {
      type: String, // Departamento como cadena de texto
      trim: true, // Elimina espacios en blanco
      maxlength: [100, 'El departamento no puede exceder 100 caracteres'] // Longitud máxima
    },
    zipCode: {
      type: String, // Código postal como cadena de texto
      trim: true, // Elimina espacios en blanco
      maxlength: [10, 'El código postal no puede exceder 10 caracteres'] // Longitud máxima
    },
    country: {
      type: String, // País como cadena de texto
      trim: true, // Elimina espacios en blanco
      default: 'Colombia', // Valor por defecto
      maxlength: [50, 'El país no puede exceder 50 caracteres'] // Longitud máxima
    }
  },
  
  // === DIRECCIONES DE ENVÍO MÚLTIPLES (ARRAY DE SUBDOCUMENTOS) ===
  shippingAddresses: [{
    name: String, // Nombre descriptivo de la dirección (ej: "Casa", "Oficina")
    street: String, // Calle de la dirección de envío
    city: String, // Ciudad de la dirección de envío
    department: String, // Departamento de la dirección de envío
    zipCode: String, // Código postal de la dirección de envío
    country: { type: String, default: 'Colombia' }, // País con valor por defecto
    isDefault: { type: Boolean, default: false } // Marca si es la dirección por defecto
  }],
  
  // === INFORMACIÓN DEMOGRÁFICA ADICIONAL ===
  birthDate: Date, // Fecha de nacimiento como tipo Date
  gender: {
    type: String, // Género como cadena de texto
    enum: ['masculino', 'femenino', 'otro', 'prefiero_no_decir'] // Lista de valores permitidos
  },
  
  // === PREFERENCIAS DEL USUARIO (SUBDOCUMENTO) ===
  preferences: {
    newsletter: { type: Boolean, default: true }, // Suscripción a newsletter (por defecto true)
    smsMarketing: { type: Boolean, default: false }, // Marketing por SMS (por defecto false)
    favoriteCategories: [String], // Array de categorías favoritas
    size: {
      type: String, // Talla preferida
      enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] // Tallas permitidas
    }
  },
  
  // === SISTEMA DE ROLES Y PERMISOS ===
  role: {
    type: String, // Rol como cadena de texto
    enum: ['customer', 'admin', 'moderator'], // Roles permitidos en el sistema
    default: 'customer' // Rol por defecto para nuevos usuarios
  },
  
  // === ESTADO Y VERIFICACIÓN DE CUENTA ===
  isActive: {
    type: Boolean, // Estado activo de la cuenta
    default: true // Por defecto las cuentas están activas
  },
  
  isVerified: {
    type: Boolean, // Estado de verificación por email
    default: false // Por defecto las cuentas no están verificadas
  },
  
  // === TOKENS DE SEGURIDAD ===
  verificationToken: String, // Token para verificación de email
  verificationTokenExpires: Date, // Fecha de expiración del token de verificación
  passwordResetToken: String, // Token para reset de contraseña
  passwordResetExpires: Date, // Fecha de expiración del token de reset
  
  // === TRACKING DE ACTIVIDAD Y SEGURIDAD ===
  lastLogin: Date, // Última fecha de inicio de sesión
  loginAttempts: { type: Number, default: 0 }, // Contador de intentos fallidos de login
  lockUntil: Date, // Fecha hasta la cual la cuenta está bloqueada
  
  // === FUNCIONALIDADES DE E-COMMERCE ===
  wishlist: [{
    type: mongoose.Schema.Types.ObjectId, // Array de referencias a productos
    ref: 'Product' // Referencia al modelo Product