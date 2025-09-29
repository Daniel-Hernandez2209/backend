// db.js - Conexión optimizada para Vercel/Serverless
const mongoose = require("mongoose");

let cachedConnection = null;

const connectDB = async () => {
  // Si ya existe una conexión válida, reutilizarla
  if (cachedConnection && mongoose.connection.readyState === 1) {
    console.log("♻️ Usando conexión existente");
    return cachedConnection;
  }

  try {
    // Construir URI desde variables de entorno
    const user = encodeURIComponent(process.env.MONGO_USER);
    const pass = encodeURIComponent(process.env.MONGO_PASS);
    const cluster = process.env.MONGO_CLUSTER;
    const db = process.env.MONGO_DB;

    if (!user || !pass || !cluster || !db) {
      throw new Error("❌ Faltan variables de entorno de MongoDB");
    }

    const uri = `mongodb+srv://${user}:${pass}@${cluster}/${db}?retryWrites=true&w=majority`;

    // Opciones optimizadas para Vercel/Serverless
    const options = {
      maxPoolSize: 10, // Máximo de conexiones en el pool
      serverSelectionTimeoutMS: 15000, // Timeout para seleccionar servidor
      socketTimeoutMS: 45000, // Timeout para operaciones
      family: 4, // Usar IPv4
      bufferCommands: false, // Desactivar buffering en serverless
    };

    const conn = await mongoose.connect(uri, options);

    // Cachear la conexión
    cachedConnection = conn;

    console.log(`✅ MongoDB conectado: ${conn.connection.host}`);
    console.log(`📦 Base de datos: ${conn.connection.name}`);

    return cachedConnection;
  } catch (error) {
    console.error("❌ Error conectando a MongoDB:", error.message);
    cachedConnection = null;
    throw error;
  }
};

// Manejar eventos de conexión
mongoose.connection.on("connected", () => {
  console.log("🔗 Mongoose conectado a MongoDB");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ Error de conexión Mongoose:", err);
  cachedConnection = null;
});

mongoose.connection.on("disconnected", () => {
  console.log("🔌 Mongoose desconectado");
  cachedConnection = null;
});

// Cerrar conexión al terminar proceso (solo en desarrollo)
if (process.env.NODE_ENV !== "production") {
  process.on("SIGINT", async () => {
    await mongoose.connection.close();
    console.log("🔌 Conexión cerrada por terminación de app");
    process.exit(0);
  });
}

module.exports = connectDB;