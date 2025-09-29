// index.js - Entry point optimizado para Vercel
const app = require('./server');
const connectDB = require('./db');

// Conectar a MongoDB antes de cada request (serverless)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("❌ Error de conexión DB:", error);
    res.status(503).json({
      success: false,
      message: "Error de conexión a base de datos",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Para entornos serverless (Vercel)
module.exports = app;

// Para desarrollo local
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  });
}