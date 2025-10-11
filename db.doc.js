# 📄 Descripción General del Archivo

Este módulo gestiona la conexión a MongoDB utilizando Mongoose con un patrón singleton para evitar múltiples conexiones simultáneas. Implementa validación de variables de entorno, manejo robusto de errores, control de estados de conexión y configuración optimizada con timeouts y pool de conexiones.

---

## 💻 Código Comentado Línea por Línea

```js
// db.js - Conexión MongoDB con mejor manejo de errores
const mongoose = require("mongoose");
// ↳ Importa la librería Mongoose para interactuar con MongoDB

let isConnected = false;
// ↳ Variable de estado para controlar si ya existe una conexión activa (patrón singleton)

const connectDB = async () => {
  // ↳ Función asíncrona principal que gestiona la conexión a MongoDB

  // Si ya está conectado, retornar
  if (isConnected && mongoose.connection.readyState === 1) {
    // ↳ Verifica si ya hay conexión activa (readyState 1 = conectado)
    return;
    // ↳ Sale de la función si ya está conectado para evitar conexiones duplicadas
  }

  // Si hay conexión en proceso, esperar
  if (mongoose.connection.readyState === 2) {
    // ↳ readyState 2 significa "conectando" - conexión en progreso
    console.log("⏳ Conexión en proceso...");
    // ↳ Informa al usuario que la conexión está en progreso
    await new Promise(resolve => {
      mongoose.connection.once('connected', resolve);
    });
    // ↳ Espera a que se complete la conexión existente usando un Promise
    return;
    // ↳ Sale una vez que la conexión existente se complete
  }

  try {
    // ↳ Inicia bloque try-catch para manejo de errores durante la conexión

    // VALIDAR que todas las variables existan
    const requiredVars = ['MONGO_USER', 'MONGO_PASS', 'MONGO_CLUSTER', 'MONGO_DB'];
    // ↳ Array con los nombres de las variables de entorno requeridas para la conexión
    
    const missing = requiredVars.filter(varName => !process.env[varName]);
    // ↳ Filtra las variables que no están definidas en el entorno
    
    if (missing.length > 0) {
      // ↳ Verifica si hay variables faltantes
      throw new Error(`❌ Variables de entorno faltantes: ${missing.join(', ')}`);
      // ↳ ⚠️ VULNERABILIDAD: Expone nombres específicos de variables en el error
    }

    const user = encodeURIComponent(process.env.MONGO_USER);
    // ↳ ✅ SEGURO: Codifica el usuario para uso seguro en URI (previene inyección)
    
    const pass = encodeURIComponent(process.env.MONGO_PASS);
    // ↳ ✅ SEGURO: Codifica la contraseña para caracteres especiales en URI
    
    const cluster = process.env.MONGO_CLUSTER;
    // ↳ ⚠️ RIESGO: No valida el formato del cluster (podría ser malicioso)
    
    const db = process.env.MONGO_DB;
    // ↳ ⚠️ RIESGO: No valida el formato del nombre de base de datos

    // Construir URI
    const uri = `mongodb+srv://${user}:${pass}@${cluster}/${db}?retryWrites=true&w=majority&appName=Cluster0`;
    // ↳ Construye la URI de conexión MongoDB con credenciales codificadas y configuraciones de seguridad

    // Log para debug (solo en desarrollo)
    if (process.env.NODE_ENV !== 'production') {
      // ↳ Condiciona los logs de debug solo para entornos que NO son producción
      console.log('🔍 Intentando conectar a:', cluster);
      // ↳ ⚠️ VULNERABILIDAD: Expone información del cluster en logs
    }

    // Desconectar si hay conexión previa en mal estado
    if (mongoose.connection.readyState > 0 && mongoose.connection.readyState !== 1) {
      // ↳ Verifica si hay conexión en estado inválido (no desconectado ni conectado)
      await mongoose.disconnect();
      // ↳ Desconecta limpiamente antes de intentar nueva conexión
    }

    // Conectar
    await mongoose.connect(uri, {
      // ↳ Inicia conexión asíncrona a MongoDB con la URI construida
      
      maxPoolSize: 5,
      // ↳ Limita a 5 conexiones simultáneas en el pool (optimización de recursos)
      
      serverSelectionTimeoutMS: 10000,
      // ↳ Timeout de 10 segundos para seleccionar servidor (previene esperas infinitas)
      
      socketTimeoutMS: 45000,
      // ↳ Timeout de 45 segundos para operaciones de socket (previene conexiones colgadas)
    });

    isConnected = true;
    // ↳ Marca la conexión como exitosa en la variable de estado

    console.log(`✅ MongoDB conectado: ${mongoose.connection.host}`);
    // ↳ 🚨 VULNERABILIDAD CRÍTICA: Expone el host real en logs (información sensible)
    
  } catch (error) {
    // ↳ Captura cualquier error durante el proceso de conexión
    
    isConnected = false;
    // ↳ Resetea el estado de conexión en caso de error
    
    console.error("❌ Error MongoDB:", error.message);
    // ↳ ⚠️ RIESGO: Podría exponer información sensible del error
    
    // Log adicional para debug
    console.error("Variables disponibles:", {
      // ↳ 🚨 VULNERABILIDAD CRÍTICA: Expone estructura de credenciales en logs
      MONGO_USER: process.env.MONGO_USER ? '✓' : '✗',
      // ↳ Indica si la variable MONGO_USER existe (información de reconocimiento)
      MONGO_PASS: process.env.MONGO_PASS ? '✓' : '✗',
      // ↳ Indica si la variable MONGO_PASS existe (información de reconocimiento)
      MONGO_CLUSTER: process.env.MONGO_CLUSTER ? '✓' : '✗',
      // ↳ Indica si la variable MONGO_CLUSTER existe (información de reconocimiento)
      MONGO_DB: process.env.MONGO_DB ? '✓' : '✗'
      // ↳ Indica si la variable MONGO_DB existe (información de reconocimiento)
    });
    
    throw error;
    // ↳ Re-lanza el error para que sea manejado por el código que llama esta función
  }
};

// Eventos de conexión
mongoose.connection.on('disconnected', () => {
  // ↳ Event listener para cuando se pierde la conexión a MongoDB
  isConnected = false;
  // ↳ Actualiza el estado interno cuando se desconecta
  console.log("🔌 MongoDB desconectado");
  // ↳ ✅ SEGURO: Log informativo sin datos sensibles
});

mongoose.connection.on('error', (err) => {
  // ↳ Event listener para errores de conexión en tiempo de ejecución
  isConnected = false;
  // ↳ Actualiza el estado interno