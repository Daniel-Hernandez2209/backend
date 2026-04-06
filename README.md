# 🎯 ATHENA BRAND - Backend API

[![Node.js](https://img.shields.io/badge/Node.js-≥16.0.0-green)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.18.2-lightgrey)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green)](https://www.mongodb.com/cloud/atlas)
[![License](https://img.shields.io/badge/License-ISC-blue)](LICENSE)

API REST profesional y segura para **ATHENA BRAND** - Tienda de ropa ecommerce en San Pedro, Antioquia, Colombia.

---

## 📋 Tabla de Contenidos

- [Características](#características)
- [Tecnologías](#tecnologías)
- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Scripts Disponibles](#scripts-disponibles)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Autenticación](#autenticación)
- [Endpoints Principales](#endpoints-principales)
- [Seguridad](#seguridad)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Contribución](#contribución)

---

## ✨ Características

### 🛍️ Ecommerce
- ✅ Catálogo dinámico de productos con categorías y subcategorías
- ✅ Carrito de compras seguro con validación de stock atómico
- ✅ Gestión de órdenes con múltiples estados
- ✅ Sistema de pagos integrado (Stripe, PSE, transferencia bancaria)

### 🔐 Seguridad
- ✅ Autenticación JWT con refresh tokens
- ✅ CSRF protection con validación de tokens
- ✅ Rate limiting por endpoint (protección DoS)
- ✅ Sanitización de inputs (XSS, NoSQL injection)
- ✅ HTTPS enforcement en producción
- ✅ Encriptación de contraseñas (bcrypt 12 salt rounds)
- ✅ Logging seguro sin exposición de datos sensibles

### 🚀 Performance
- ✅ Compresión gzip de respuestas
- ✅ Caché Redis para refresh tokens
- ✅ Paginación con límites DoS-protected
- ✅ Índices de base de datos optimizados
- ✅ Connection pooling en MongoDB

### 📊 Confiabilidad
- ✅ Retry logic con exponential backoff
- ✅ Circuit breaker para servicios externos
- ✅ Health checks de base de datos
- ✅ Correlation IDs para debugging distribuido
- ✅ Audit logging para operaciones sensibles
- ✅ Soft deletes para preservación de datos

### 👨‍💼 Administración
- ✅ Panel de control para gestionar productos
- ✅ Gestión de usuarios y roles
- ✅ Control de categorías
- ✅ Reportes de ventas y inventario

---

## 🛠️ Tecnologías

### Core
- **Node.js** ≥16.0.0 - Runtime JavaScript
- **Express.js** 4.18.2 - Framework web
- **ES6 Modules** - Sintaxis moderna

### Base de Datos
- **MongoDB Atlas** 8.0.3 - Base de datos NoSQL
- **Mongoose** 8.0.3 - ODM para MongoDB
- **Upstash Redis** - Cache serverless

### Autenticación & Seguridad
- **JWT (jsonwebtoken)** 9.0.2 - Tokens JWT
- **bcryptjs** 2.4.3 - Hash de contraseñas
- **Helmet** 7.1.0 - Headers HTTP de seguridad
- **csrf/csurf** 1.11.0 - CSRF protection
- **xss-clean** 0.1.4 - Sanitización XSS
- **express-mongo-sanitize** 2.2.0 - Sanitización NoSQL

### Performance & Monitoreo
- **express-rate-limit** 7.1.5 - Rate limiting
- **compression** 1.7.4 - Compresión gzip
- **morgan** 1.10.0 - HTTP logging
- **winston** 3.18.3 - Logger estructurado
- **node-cache** 5.1.2 - Caché en memoria

### Servicios Externos
- **Cloudinary** 1.41.3 - CDN de imágenes
- **Nodemailer** 8.0.4 - Email transaccional
- **Stripe** 14.9.0 - Procesamiento de pagos

### Validación
- **express-validator** 7.2.1 - Validación de inputs
- **Joi** 17.11.0 - Validación de schema
- **Validator** 13.15.15 - Validación de formatos

---

## 📦 Requisitos

- **Node.js**: ≥16.0.0
- **npm**: ≥8.0.0
- **Cuenta MongoDB Atlas**: Para base de datos
- **Cuenta Upstash**: Para Redis serverless
- **Cuenta Cloudinary**: Para almacenamiento de imágenes
- **Cuenta Stripe**: Para pagos (opcional)

---

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/athena-brand-backend.git
cd athena-brand-backend
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con tus credenciales
nano .env
```

### 4. Limpiar índices duplicados (primera vez)

```bash
node scripts/cleanIndexes.js
```

### 5. Iniciar en desarrollo

```bash
npm run dev
```

Debería ver:
```
✅ Conectado a MongoDB al iniciar el servidor
✅ Sincronización de índices completada exitosamente
Server running on port 3000
```

---

## ⚙️ Configuración

### Variables de Entorno

Copia `.env.example` a `.env` y configura:

#### Base de Datos
```env
MONGO_USER=tu_usuario
MONGO_PASS=tu_contraseña_segura
MONGO_CLUSTER=cluster0.xxxxx.mongodb.net
MONGO_DB=athena_brand
```

#### Autenticación JWT
```env
JWT_SECRET=tu_secret_super_largo_y_seguro_minimo_32_caracteres
JWT_EXPIRE=15m
REFRESH_TOKEN_TTL=7
```

#### Redis (Cache)
```env
REDIS_URL=https://tu-redis-url:xxxxx@xxxxx.upstash.io
```

#### Email (Nodemailer)
```env
# Gmail
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=tu-email@gmail.com
EMAIL_PASS=tu-app-password

# O usar SendGrid, AWS SES, etc.
```

#### Almacenamiento de Imágenes
```env
CLOUDINARY_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

#### Pagos
```env
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLIC_KEY=pk_test_xxxxx
```

#### Deployment
```env
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
PORT=3000
```

---

## 📜 Scripts Disponibles

### Desarrollo
```bash
npm run dev          # Inicia en modo desarrollo con nodemon
npm run start        # Inicia en producción
```

### Testing
```bash
npm test             # Ejecutar tests unitarios
npm run test:watch   # Modo watch
```

### Linting & Formato
```bash
npm run lint         # Verificar estándares de código
npm run lint:fix     # Arreglar automáticamente
```

### Base de Datos
```bash
npm run seed         # Poblar datos iniciales
npm run seed:categories   # Solo categorías
npm run seed:all     # Seed completo
```

### Limpieza
```bash
node scripts/cleanIndexes.js  # Limpiar índices duplicados
```

---

## 📁 Estructura del Proyecto

```
athena-brand-backend/
├── config/               # Configuración
│   └── database.js       # Conexión DB
├── controllers/          # Lógica de negocio
│   ├── authController.js
│   ├── productController.js
│   ├── orderController.js
│   ├── categoryController.js
│   └── adminController.js
├── middleware/           # Middleware Express
│   ├── auth.js          # Autenticación JWT
│   ├── csrf.js          # CSRF protection
│   ├── rateLimiter.js   # Rate limiting
│   ├── auditLog.js      # Audit trail
│   └── correlationId.js # Request tracing
├── models/              # Mongoose schemas
│   ├── User.js
│   ├── Product.js
│   ├── Order.js
│   └── category.js
├── routes/              # Rutas API
│   ├── auth.js
│   ├── products.js
│   ├── orders.js
│   ├── categories.js
│   ├── upload.js
│   └── admin/           # Rutas administrativas
├── utils/               # Utilidades
│   ├── logger.js        # Winston logger
│   ├── redis.js         # Redis token management
│   ├── retry.js         # Retry logic
│   ├── pagination.js    # Pagination safety
│   ├── circuitBreaker.js# Circuit breaker
│   ├── softDelete.js    # Soft delete support
│   └── sendEmail.js     # Email sending
├── scripts/             # Scripts auxiliares
│   ├── seedCategories.js
│   ├── setData.js
│   └── cleanIndexes.js
├── test/                # Tests
│   └── rateLimiter.test.js
├── .env.example         # Template de env
├── .env                 # Variables (gitignored)
├── db.js                # DB connection
├── server.js            # Express app
├── index.js             # Entry point
├── package.json
├── DEPLOYMENT.md        # Guía de deployment
├── CRITICAL_FIXES_SUMMARY.md
└── README.md            # Este archivo
```

---

## 🔐 Autenticación

### Flujo de Autenticación

```
1. LOGIN
   POST /api/auth/login
   → Valida credenciales
   → Genera access token (JWT, 15 min)
   → Genera refresh token (Redis, 7 días)
   ← Retorna tokens

2. USAR API
   GET /api/products
   Header: Authorization: Bearer <access_token>
   ← Datos

3. REFRESH TOKEN
   POST /api/auth/refresh
   Body: { refreshToken: "..." }
   → Valida en Redis
   → Genera nuevo access token
   ← Nuevo token

4. LOGOUT
   POST /api/auth/logout
   → Invalida refresh token en Redis
   ← Success
```

### Protección de Rutas

```javascript
// Rutas públicas
GET /api/products
GET /api/categories

// Rutas autenticadas
POST /api/orders          (requiere auth)
GET /api/user/profile     (requiere auth)
PUT /api/user/password    (requiere auth)

// Rutas administrativas
DELETE /api/admin/users/:id       (requiere auth + admin)
PUT /api/admin/products/:id       (requiere auth + admin)
GET /api/admin/orders             (requiere auth + admin)
```

---

## 📡 Endpoints Principales

### Autenticación
```
POST   /api/auth/register              # Registrar usuario
POST   /api/auth/login                 # Login
POST   /api/auth/refresh               # Refresh token
POST   /api/auth/logout                # Logout
POST   /api/auth/forgot-password       # Enviar reset email
POST   /api/auth/reset-password        # Reset password
POST   /api/auth/change-password       # Cambiar contraseña (autenticado)
POST   /api/auth/verify-email          # Verificar email
```

### Productos
```
GET    /api/products                   # Listar productos (paginado)
GET    /api/products/:id               # Obtener producto
GET    /api/products/search?q=...      # Buscar productos
POST   /api/admin/products             # Crear producto (admin)
PUT    /api/admin/products/:id         # Actualizar producto (admin)
DELETE /api/admin/products/:id         # Eliminar producto (admin)
```

### Órdenes
```
POST   /api/orders                     # Crear orden
GET    /api/orders                     # Listar mis órdenes
GET    /api/orders/:id                 # Obtener orden
PUT    /api/orders/:id/cancel          # Cancelar orden
GET    /api/admin/orders               # Listar todas (admin)
PUT    /api/admin/orders/:id/status    # Cambiar estado (admin)
```

### Categorías
```
GET    /api/categories                 # Listar categorías
GET    /api/categories/:slug           # Obtener categoría
POST   /api/admin/categories           # Crear (admin)
PUT    /api/admin/categories/:id       # Actualizar (admin)
DELETE /api/admin/categories/:id       # Eliminar (admin)
```

### Salud del Sistema
```
GET    /health                         # Health check (200/503)
GET    /readiness                      # Readiness probe
```

---

## 🛡️ Seguridad

### Medidas Implementadas

| Medida | Descripción |
|--------|-------------|
| **JWT Algorithm Lock** | Solo HS256 permitido (previene algoritmo substitution) |
| **HTTPS Enforcement** | Redirige HTTP a HTTPS en producción |
| **Rate Limiting** | Global: 100/15min, Auth: 5/15min, Admin: 20/15min |
| **CSRF Protection** | Tokens con validación en cookies |
| **Password Hashing** | bcrypt con 12 salt rounds |
| **SQL/NoSQL Injection** | Sanitización con express-mongo-sanitize |
| **XSS Prevention** | xss-clean + escape en inputs |
| **Token Invalidation** | Refresh tokens invalidados en password reset |
| **Helmet Headers** | CSP, HSTS, X-Frame-Options, etc. |
| **Audit Logging** | Trail inmutable de operaciones sensibles |

### Buenas Prácticas

```bash
# Variables sensibles en .env (nunca en código)
# .env no se versiona (está en .gitignore)

# Contraseñas hasheadas en BD
# Tokens nunca en localStorage (usar httpOnly cookies)

# Validación server-side siempre
# Mensajes de error no revelan detalles internos
```

---

## 🚀 Deployment

### Vercel (Recomendado)

```bash
# 1. Instalar Vercel CLI
npm install -g vercel

# 2. Configurar variables de entorno en Vercel dashboard

# 3. Deploy
vercel

# O auto-deploy en cada push
git push origin main
```

### Docker

```bash
docker build -t athena-brand-backend .
docker run -p 3000:3000 --env-file .env athena-brand-backend
```

### Checklist Pre-Deployment

- [ ] Variables de entorno configuradas
- [ ] JWT_SECRET es fuerte (32+ caracteres)
- [ ] MongoDB Atlas whitelist configurado
- [ ] Redis connection probada
- [ ] Cloudinary API keys válidas
- [ ] CORS origins correctos
- [ ] Email transporter funcional
- [ ] Stripe keys en sandbox mode o production
- [ ] npm audit sin vulnerabilidades críticas
- [ ] Tests pasando

Ver [DEPLOYMENT.md](./DEPLOYMENT.md) para más detalles.

---

## 🐛 Troubleshooting

### Error: "Connection refused"
```
❌ ECONNREFUSED - MongoDB no disponible

Solución:
1. Verificar MongoDB Atlas cluster está activo
2. Whitelist tu IP en Atlas security
3. Variables MONGO_* correctas en .env
```

### Error: "Duplicate schema index"
```
❌ MONGOOSE Warning: Duplicate schema index

Solución:
1. Ejecutar: node scripts/cleanIndexes.js
2. Reiniciar server
```

### Error: "CSRF token validation failed"
```
❌ 403 - Invalid CSRF token

Solución:
1. POST sin CSRF token
2. GET /api/endpoint primero para obtener token
3. Incluir X-CSRF-Token header en POST
```

### Error: "Rate limit exceeded"
```
❌ 429 - Too Many Requests

Solución:
1. Esperar 15 minutos
2. Usar IP diferente (dev)
3. Aumentar límites en .env (dev)
```

### Error: "Email sending failed"
```
❌ SMTP Error

Solución:
1. Verificar credenciales EMAIL_* en .env
2. Probar SMTP manual: telnet smtp.gmail.com 587
3. Gmail: habilitar "Less secure apps"
4. SendGrid: verificar sender domain
```

### Error: "Redis connection failed"
```
❌ Redis unavailable

Solución:
1. Verificar REDIS_URL en .env
2. Comprobar conectividad Upstash
3. Verificar firewall
```

---

## 📚 Documentación Adicional

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Guía completa de deployment
- [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) - Guía específica para Vercel serverless ⭐
- [CRITICAL_FIXES_SUMMARY.md](./CRITICAL_FIXES_SUMMARY.md) - Security fixes aplicados
- [.env.example](./.env.example) - Template de variables
- [API Documentation](./API_DOCS.md) - Documentación de endpoints (próximamente)

---

## 🤝 Contribución

Las contribuciones son bienvenidas. Por favor:

1. Fork el repositorio
2. Crea una rama (`git checkout -b feature/amazing-feature`)
3. Commit cambios (`git commit -m 'Add amazing feature'`)
4. Push a la rama (`git push origin feature/amazing-feature`)
5. Abre un Pull Request

### Estándares de Código

```bash
# Verificar linting
npm run lint

# Arreglar automáticamente
npm run lint:fix

# Prettier format
npm run prettier
```

---

## 📄 Licencia

Este proyecto está bajo la licencia ISC. Ver [LICENSE](LICENSE) para más detalles.

---

## 👨‍💼 Autor

**Daniel Hernandez**  
ATHENA BRAND - Backend Development  
San Pedro, Antioquia, Colombia

📧 danielh@athenabrand.co  
🌐 https://athenabrand.co

---

## 🙏 Agradecimientos

- Equipo de ATHENA BRAND
- Comunidad Node.js
- Stack Overflow Community

---

## 📞 Soporte

Para soporte técnico:
- 📧 Email: support@athenabrand.co
- 💬 Issues: [GitHub Issues](https://github.com/tu-usuario/athena-brand-backend/issues)
- 📆 Discord: [Link a servidor Discord]

---

**Última actualización**: Abril 6, 2026  
**Versión**: 1.0.0  
**Status**: ✅ Production Ready (después del primer deploy)

---

> 🚀 Made with ❤️ for ATHENA BRAND - Colombian Fashion Store
