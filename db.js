// db.js - Conexión MongoDB con manejo de errores avanzado (SEGURA)
const mongoose = require("mongoose");

let isConnected = false;
let lastURI = null;

// ========================================
// VALIDACIÓN SEGURA DE VARIABLES
// ========================================
const validateEnvVar = (value, name, pattern = null) => {
  if (!value || value.trim().length === 0) {
    throw new Error(`Variable ${name} requerida`);
  }
  if (pattern && !pattern.test(value.trim())) {
    throw new Error(`Variable ${name} tiene formato inválido`);
  }
  return value.trim();
};

// ========================================
// CONEXIÓN PRINCIPAL
// ========================================
const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) return;

  if (mongoose.connection.readyState === 2) {
    console.log("⏳ Esperando conexión existente...");
    await new Promise((resolve) => mongoose.connection.once("connected", resolve));
    return;
  }

  try {
    // Validar variables
    const requiredVars = ["MONGO_USER", "MONGO_PASS", "MONGO_CLUSTER", "MONGO_DB"];
    const missing = requiredVars.filter((v) => !process.env[v]);
    if (missing.length > 0) {
      throw new Error(`❌ Faltan variables: ${missing.join(", ")}`);
    }

    // Sanitizar
    const user = encodeURIComponent(validateEnvVar(process.env.MONGO_USER, "MONGO_USER", /^[a-zA-Z0-9_-]+$/));
    const pass = encodeURIComponent(validateEnvVar(process.env.MONGO_PASS, "MONGO_PASS"));
    const cluster = validateEnvVar(process.env.MONGO_CLUSTER, "MONGO_CLUSTER", /^[a-zA-Z0-9.-]+$/);
    const db = validateEnvVar(process.env.MONGO_DB, "MONGO_DB", /^[a-zA-Z0-9_-]+$/);

    const uri = `mongodb+srv://${user}:${pass}@${cluster}/${db}?retryWrites=true&w=majority&appName=Cluster0`;

    // Evitar reconectar si ya está en uso el mismo URI
    if (isConnected && uri === lastURI) return;

    // Limpiar conexión previa
    if (mongoose.connection.readyState > 0 && mongoose.connection.readyState !== 1) {
      await mongoose.disconnect();
    }

    console.log("🔍 Intentando conectar a MongoDB...");

    // Conectar con configuración segura
    await mongoose.connect(uri, {
      maxPoolSize: 5,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      ssl: true,
      autoIndex: false,
      authSource: "admin"
    });

    isConnected = true;
    lastURI = uri;
    console.log("✅ MongoDB conectado exitosamente");

  } catch (error) {
    isConnected = false;
    console.error("❌ Error de conexión a MongoDB");

    if (process.env.NODE_ENV === "development") {
      console.error("🔍 Detalle:", error.message);
    }

    // Reintento automático (máximo 3 veces)
    if (!connectDB.retryCount) connectDB.retryCount = 0;
    if (connectDB.retryCount < 3) {
      connectDB.retryCount++;
      console.log(`🔁 Reintentando conexión (${connectDB.retryCount}/3)...`);
      setTimeout(connectDB, 3000);
    } else {
      console.error("🚨 No se pudo conectar a la base de datos tras múltiples intentos.");
    }
  }
};

// ========================================
// MANEJO DE EVENTOS DE CONEXIÓN
// ========================================
mongoose.connection.on("disconnected", () => {
  isConnected = false;
  console.warn("🔌 MongoDB desconectado");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ Error en conexión MongoDB:", err.message);
  isConnected = false;
});

// Cierre limpio (para entornos como Vercel)
process.on("SIGINT", async () => {
  await mongoose.disconnect();
  console.log("🧹 Conexión MongoDB cerrada por SIGINT");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await mongoose.disconnect();
  console.log("🧹 Conexión MongoDB cerrada por SIGTERM");
  process.exit(0);
});

module.exports = connectDB;
