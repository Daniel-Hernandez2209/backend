```js
/**
 * 📋 DESCRIPCIÓN GENERAL DEL ARCHIVO
 * ====================================
 * Este es el punto de entrada principal de una aplicación Node.js optimizada para 
 * despliegue serverless en Vercel. Configura la conexión a MongoDB, maneja errores
 * de conexión y permite ejecución tanto en modo serverless como desarrollo local.
 * 
 * ⚠️  ADVERTENCIAS DE SEGURIDAD:
 * - Exposición potencial de información sensible en errores
 * - Falta de rate limiting y validaciones de entrada
 * - Reconexión DB en cada request puede causar problemas de rendimiento
 */

// Importa la aplicación Express principal desde el archivo server.js
const app = require('./server');

// Importa la función de conexión a MongoDB desde el archivo de configuración DB
const connectDB = require('./db');

// 🔧 MIDDLEWARE GLOBAL: Conexión a MongoDB antes de cada request
// ⚠️  PROBLEMA DE RENDIMIENTO: Conectar en cada request es ineficiente para serverless
app.use(async (req, res, next) => {
  try {
    // Establece conexión a MongoDB de forma asíncrona
    await connectDB();
    
    // Continúa al siguiente middleware si la conexión es exitosa
    next();
  } catch (error) {
    // 📝 LOG INTERNO: Registra el error completo en consola del servidor
    // ⚠️  RIESGO: Puede exponer credenciales o información sensible en logs
    console.error("❌ Error de conexión DB:", error);
    
    // 🚨 RESPUESTA DE ERROR: Envía respuesta HTTP 503 (Service Unavailable)
    res.status(503).json({
      // Indica que la operación falló
      success: false,
      
      // Mensaje genérico para el usuario
      message: "Error de conexión a base de datos",
      
      // 🔴 VULNERABILIDAD CRÍTICA: Expone detalles del error en desarrollo
      // Puede filtrar información sensible como credenciales, rutas del sistema, etc.
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 🚀 EXPORTACIÓN PARA SERVERLESS: Vercel usa este export como función lambda
// Permite que Vercel maneje automáticamente las requests HTTP
module.exports = app;

// 🔧 CONFIGURACIÓN PARA DESARROLLO LOCAL
// Solo ejecuta servidor HTTP cuando NO está en producción (evita conflictos en Vercel)
if (process.env.NODE_ENV !== 'production') {
  
  // Define el puerto: usa variable de entorno PORT o 5000 por defecto
  const PORT = process.env.PORT || 5000;
  
  // Inicia el servidor HTTP en el puerto especificado
  app.listen(PORT, () => {
    // 📝 LOG DE INICIO: Confirma que el servidor está corriendo
    // ⚠️  POTENCIAL EXPOSICIÓN: Muestra información del sistema en logs
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    
    // 📝 LOG DE AMBIENTE: Muestra el entorno actual de ejecución
    // Útil para debugging pero puede exponer configuración interna
    console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  });
}

/**
 * 🔒 MEJORAS DE SEGURIDAD RECOMENDADAS:
 * =====================================
 * 
 * 1. FILTRADO DE ERRORES:
 *    - Nunca exponer error.message en producción
 *    - Usar IDs de error únicos para tracking interno
 * 
 * 2. RATE LIMITING:
 *    - Implementar límites de requests por IP
 *    - Prevenir ataques de denegación de servicio
 * 
 * 3. VALIDACIÓN DE ENTRADA:
 *    - Validar headers y payload size
 *    - Sanitizar todas las entradas del usuario
 * 
 * 4. LOGGING SEGURO:
 *    - No registrar información sensible en logs
 *    - Usar sistemas de logging estructurado
 * 
 * 5. OPTIMIZACIÓN DB:
 *    - Implementar connection pooling
 *    - Cache de conexiones para reducir latencia
 */
```

## 🚨 **Resumen de Vulnerabilidades Identificadas:**

### **CRÍTICAS:**
1. **Línea 21**: Exposición de información sensible en errores
2. **Línea 6**: Falta de rate limiting y validaciones
3. **Línea 8**: Reconexión DB ineficiente en cada request

### **MODERADAS:**
4. **Línea 12**: Logging inseguro de errores completos
5. **Línea 30-32**: Exposición de información del sistema en logs

### **RECOMENDACIÓN URGENTE:**
Implementar las mejoras de seguridad mencionadas en los comentarios antes del despliegue en producción.