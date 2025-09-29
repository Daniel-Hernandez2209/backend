// db.js - Conexión MongoDB con mejor manejo de errores
const mongoose = require("mongoose");

let isConnected = false;

const connectDB = async () => {
  // Si ya está conectado, retornar
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  // Si hay conexión en proceso, esperar
  if (mongoose.connection.readyState === 2) {
    console.log("⏳ Conexión en proceso...");
    await new Promise(resolve => {
      mongoose.connection.once('connected', resolve);
    });
    return;
  }

  try {
    // VALIDAR que todas las variables existan
    const requiredVars = ['MONGO_USER', 'MONGO_PASS', 'MONGO_CLUSTER', 'MONGO_DB'];
    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      throw new Error(`❌ Variables de entorno faltantes: ${missing.join(', ')}`);
    }

    const user = encodeURIComponent(process.env.MONGO_USER);
    const pass = encodeURIComponent(process.env.MONGO_PASS);
    const cluster = process.env.MONGO_CLUSTER;
    const db = process.env.MONGO_DB;

    // Construir URI
    const uri = `mongodb+srv://${user}:${pass}@${cluster}/${db}?retryWrites=true&w=majority&appName=Cluster0`;

    // Log para debug (solo en desarrollo)
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 Intentando conectar a:', cluster);
    }

    // Desconectar si hay conexión previa en mal estado
    if (mongoose.connection.readyState > 0 && mongoose.connection.readyState !== 1) {
      await mongoose.disconnect();
    }

    // Conectar
    await mongoose.connect(uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    console.log(`✅ MongoDB conectado: ${mongoose.connection.host}`);
    
  } catch (error) {
    isConnected = false;
    console.error("❌ Error MongoDB:", error.message);
    
    // Log adicional para debug
    console.error("Variables disponibles:", {
      MONGO_USER: process.env.MONGO_USER ? '✓' : '✗',
      MONGO_PASS: process.env.MONGO_PASS ? '✓' : '✗',
      MONGO_CLUSTER: process.env.MONGO_CLUSTER ? '✓' : '✗',
      MONGO_DB: process.env.MONGO_DB ? '✓' : '✗'
    });
    
    throw error;
  }
};

// Eventos de conexión
mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.log("🔌 MongoDB desconectado");
});

mongoose.connection.on('error', (err) => {
  isConnected = false;
  console.error("❌ Error MongoDB:", err.message);
});

module.exports = connectDB;