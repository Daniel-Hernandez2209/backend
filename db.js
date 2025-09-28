// db.js
const mongoose = require("mongoose");

let isConnected = false; // Estado de conexión

const connectDB = async () => {
  if (isConnected) {
    return; // Ya conectado, no volvemos a conectar
  }

  try {
    const user = encodeURIComponent(process.env.MONGO_USER);
    const pass = encodeURIComponent(process.env.MONGO_PASS);
    const cluster = process.env.MONGO_CLUSTER;
    const db = process.env.MONGO_DB;

    const uri = `mongodb+srv://${user}:${pass}@${cluster}/${db}?retryWrites=true&w=majority`;

    const conn = await mongoose.connect(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    if (process.env.NODE_ENV !== "production") {
      console.log(`✅ MongoDB conectado en ${conn.connection.host}`);
    }
  } catch (error) {
    console.error("❌ Error conectando a MongoDB:", error);
    throw error;
  }
};

module.exports = connectDB;
