// server.js - Backend principal optimizado para Vercel (SEGURA Y ESTABLE)
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { csrfProtection, csrfErrorHandler } from "./middleware/csrf.js";
import logger from "./utils/logger.js";
import connectDB from "./db.js";
import { globalLimiter, authLimiter } from "./middleware/rateLimiter.js";

// ✅ Importar modelos para registrarlos en Mongoose
import User from "./models/User.js";
import Product from "./models/Product.js";
import Order from "./models/Order.js";
// import Category from "./models/category.js"; // Agregar si es necesario

dotenv.config();

const app = express();
app.set("trust proxy", 1); // Necesario para Vercel

// ✅ HTTPS Enforcement - Redirect HTTP to HTTPS in production
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    if (req.header("x-forwarded-proto") !== "https") {
      res.redirect(`https://${req.header("host")}${req.url}`);
    } else {
      next();
    }
  });
}

// ===========================================
// 🌐 CORS — debe ir PRIMERO para que todas las respuestas incluyan los headers
// ===========================================

// Orígenes permitidos desde variable de entorno (comma-separated)
const getAllowedOrigins = () =>
  (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

// Regex para preview deployments de Vercel (los wildcards de string no funcionan en cors)
const VERCEL_PREVIEW_RE = /^https:\/\/athena-brand-frontend-[a-z0-9-]+\.vercel\.app$/;

const corsOptions = {
  origin: (origin, callback) => {
    // Permitir requests sin origin: apps móviles, Postman, server-to-server
    if (!origin) return callback(null, true);

    const allowed = getAllowedOrigins();

    if (allowed.includes(origin) || VERCEL_PREVIEW_RE.test(origin)) {
      return callback(null, true);
    }

    logger.warn("CORS: origen rechazado", { origin });
    callback(new Error("No permitido por CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ===========================================
// ⚙️ MIDDLEWARE DE SEGURIDAD Y OPTIMIZACIÓN
// ===========================================

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  }),
);

app.use(compression());

// Sanitización de datos
app.use(mongoSanitize()); // Prevenir inyección NoSQL
app.use(xss()); // Prevenir ataques XSS

// Logging según entorno
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// ===========================================
// 🚦 RATE LIMITING GLOBAL Y ESPECÍFICO
// ===========================================

app.use("/api", globalLimiter);

app.use("/api/auth/login", authLimiter);

// Limiter adicional para área administrativa
app.use(
  "/api/admin",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: {
      success: false,
      message: "Demasiadas solicitudes al área administrativa.",
    },
  }),
);

// ===========================================
// 🧩 PARSEO DE JSON SEGURO
// ===========================================

app.use(
  express.json({
    limit: "1mb",
    verify: (req, res, buf) => {
      try {
        JSON.parse(buf);
        req.rawBody = buf;
      } catch {
        const err = new Error("JSON inválido");
        err.status = 400;
        throw err;
      }
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ✅ CSRF Protection Setup
app.use(cookieParser());
if (process.env.NODE_ENV === "production") {
  app.use(csrfProtection);
}

// ===========================================
// 🗂️ ARCHIVOS ESTÁTICOS
// ===========================================

app.use(
  "/uploads",
  express.static("uploads", {
    maxAge: "1y",
    etag: true,
    lastModified: true,
  }),
);

// ===========================================
// 🧠 CONEXIÓN A MONGODB (PERSISTENTE EN VERCEL)
// ===========================================

// ✅ Sincronizar índices: elimina duplicados y mantiene consistencia (NO BLOQUEA startup)
const syncIndexes = async () => {
  try {
    logger.info("🔄 Sincronización de índices iniciada (background)");

    // Obtener todos los modelos registrados
    const models = Object.values(mongoose.modelNames()).map((name) =>
      mongoose.model(name),
    );

    for (const model of models) {
      try {
        const collectionName = model.collection.name;

        // Eliminar índices existentes excepto _id (con timeout)
        try {
          const indexInfo = await Promise.race([
            model.collection.getIndexes(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Index timeout")), 5000),
            ),
          ]);

          for (const indexKey in indexInfo) {
            if (indexKey !== "_id_") {
              try {
                await model.collection.dropIndex(indexKey);
              } catch (dropErr) {
                logger.warn(
                  `No se pudo eliminar index ${indexKey}:`,
                  dropErr.message,
                );
              }
            }
          }
        } catch (err) {
          if (
            !err.message.includes("ns not found") &&
            !err.message.includes("timeout")
          ) {
            logger.warn(
              `Aviso obteniendo índices de ${collectionName}:`,
              err.message,
            );
          }
        }

        // Recrear índices desde la definición del esquema
        try {
          await Promise.race([
            model.collection.createIndexes(),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Create indexes timeout")),
                5000,
              ),
            ),
          ]);
          logger.info(`✅ Índices sincronizados: ${collectionName}`);
        } catch (createErr) {
          logger.warn(
            `No se pudieron crear índices para ${collectionName}:`,
            createErr.message,
          );
        }
      } catch (err) {
        logger.error(
          `Error sincronizando índices de ${model.modelName}:`,
          err.message,
        );
      }
    }

    logger.info("✅ Sincronización de índices completada");
  } catch (error) {
    logger.error("Error durante sincronización de índices:", error.message);
  }
};

// 🚀 Iniciar servidor sin bloquear por índices
(async () => {
  try {
    await connectDB();
    logger.info("Conectado a MongoDB al iniciar el servidor");

    // ⚡ IMPORTANTE: NO esperar syncIndexes (evita timeout en Vercel)
    // La sincronización ocurre en background sin bloquear
    if (process.env.NODE_ENV !== "production") {
      // En desarrollo, sincronizar con timeout para feedback
      syncIndexes().catch((err) =>
        logger.error("Sync fallido en dev:", err.message),
      );
    } else {
      // En producción, sincronizar en background sin bloquear
      setImmediate(() => {
        syncIndexes().catch((err) =>
          logger.error("Sync fallido en production:", err.message),
        );
      });
    }
  } catch (error) {
    logger.error("Error al conectar la base de datos", { error: error.message });
  }
})();

// ===========================================
// 🚀 RUTAS DE LA API
// ===========================================

app.get("/health", (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  const status = isConnected ? 200 : 503;
  res.status(status).json({
    status: isConnected ? "OK" : "unhealthy",
    db: isConnected ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

app.get("/readiness", (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ ready: false });
  }
  res.json({ ready: true });
});

// Importar rutas
import adminRoutes from "./routes/admin/user.js";
import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import orderRoutes from "./routes/order.js";
import uploadRoutes from "./routes/upload.js";
import categoryRoutes from "./routes/categories.js";
import adminCategoryRoutes from "./routes/admin/categories.js";
// Usar rutas
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/admin/categories", adminCategoryRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/user", adminRoutes);

// ===========================================
// 📘 INFORMACIÓN Y DOCUMENTACIÓN DE LA API
// ===========================================

app.get("/api", (req, res) => {
  res.json({
    message: "🏛️ ATHENA BRAND API",
    tagline: "MENOS RUIDO MAS ESENCIA",
    version: "1.0.0",
    documentation: "/api/docs",
    features: [
      "Autenticación JWT",
      "Gestión de productos",
      "Sistema de pedidos",
      "Uploads de imágenes",
      "Emails transaccionales",
      "Panel administrativo",
    ],
  });
});

app.get("/api/docs", (req, res) => {
  res.json({
    title: "ATHENA BRAND API Documentation",
    version: "1.0.0",
    description: "API REST para la tienda ATHENA BRAND",
    baseURL: req.protocol + "://" + req.get("host") + "/api",
    authentication: "Bearer Token (JWT)",
  });
});

// ===========================================
// 🧪 TEST DE CONEXIÓN A MONGO ATLAS
// ===========================================

const TestSchema = new mongoose.Schema({
  name: String,
  timestamp: { type: Date, default: Date.now },
});
const TestModel = mongoose.models.Test || mongoose.model("Test", TestSchema);

app.get("/api/test-db", async (req, res) => {
  try {
    const doc = await TestModel.create({ name: "Test Connection" });
    res.json({
      success: true,
      message: "✅ Conexión exitosa a MongoDB",
      timestamp: doc.timestamp,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

// ===========================================
// ⚠️ MANEJO GLOBAL DE ERRORES
// ===========================================

// ✅ CSRF Error Handler (must be before other error handlers)
app.use(csrfErrorHandler);

app.use((err, req, res, next) => {
  if (err.message === "No permitido por CORS") {
    return res.status(403).json({ success: false, message: err.message });
  }

  logger.error("Error no manejado", { message: err.message, stack: err.stack, url: req.originalUrl });

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Error interno del servidor",
  });
});

// 404 handler
app.use("*", (req, res) => {
  const response = {
    success: false,
    message: `Ruta ${req.originalUrl} no encontrada`,
  };
  if (process.env.NODE_ENV === "development") {
    response.availableEndpoints = [
      "GET /api",
      "GET /api/docs",
      "GET /health",
      "GET /api/test-db",
    ];
  }
  res.status(404).json(response);
});
// ===========================================
// 🚀 INICIAR SERVIDOR
// ===========================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`Servidor corriendo en puerto ${PORT}`);
});

export default app;
