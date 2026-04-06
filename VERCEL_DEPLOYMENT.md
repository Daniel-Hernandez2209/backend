# 🚀 Vercel Deployment Guide

## Problema: Task timed out after 30 seconds

Las funciones serverless en Vercel tienen un **límite estricto de 30 segundos**. Si tu aplicación excede este tiempo en el startup, obtendrás:

```
❌ Vercel Runtime Timeout Error: Task timed out after 30 seconds
```

---

## ✅ Solución Aplicada

### Cambios Realizados en server.js

La sincronización de índices ahora:
- ✅ **NO bloquea el startup** (usa `setImmediate`)
- ✅ **Corre en background** sin esperar (`await` removido)
- ✅ **Con timeouts** (5s por operación para evitar cuelgues)
- ✅ **Diferente en dev vs production**

**Antes (PROBLEMA):**
```javascript
(async () => {
  await connectDB();
  await syncIndexes();  // ❌ BLOQUEA 20-30 segundos
})();
```

**Después (CORREGIDO):**
```javascript
(async () => {
  await connectDB();  // ✅ Rápido (2-3 segundos)
  
  if (process.env.NODE_ENV === 'production') {
    setImmediate(() => {
      syncIndexes().catch(...);  // ✅ Background, sin bloquear
    });
  }
})();
```

---

## 🚀 Deployment en Vercel

### Paso 1: Configurar vercel.json

Crea un archivo `vercel.json` en la raíz del proyecto:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "index.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "index.js": {
      "maxDuration": 30,
      "memory": 1024
    }
  }
}
```

### Paso 2: Configurar variables de entorno

En Vercel Dashboard:
1. Go to Settings → Environment Variables
2. Agregar todas las variables de `.env.example`:

```
MONGO_USER
MONGO_PASS
MONGO_CLUSTER
MONGO_DB
JWT_SECRET
REDIS_URL
EMAIL_HOST
EMAIL_PORT
EMAIL_USER
EMAIL_PASS
CLOUDINARY_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
STRIPE_SECRET_KEY
FRONTEND_URL
```

### Paso 3: Whitelist IP de Vercel en MongoDB Atlas

1. Go to MongoDB Atlas → Network Access
2. Add IP Address: `0.0.0.0/0` (Vercel no tiene IP fija)
   - ⚠️ Esto es menos seguro, pero necesario para Vercel
   - Alternativa: Usar IP privada con VPN

3. O si tienes un IP VPN fijo:
   - Agregarlo específicamente

### Paso 4: Deploy

```bash
# Instalar Vercel CLI
npm install -g vercel

# Primero deploy (solicita proyecto)
vercel

# Deploy futuro
vercel --prod

# O automático en cada push a main
git push origin main
```

---

## ⚡ Optimizaciones para Vercel

### 1. Reducir cold start

```javascript
// ✅ BIEN: Imports ligeros al inicio
import express from 'express';
import connectDB from './db.js';

// ❌ MAL: Imports pesados dejan esperando
import User from './models/User.js';  // Usar lazy loading
```

### 2. Lazy load de modelos

```javascript
// En routes/auth.js - Load solo cuando se necesita
const User = mongoose.model('User');
```

### 3. Conexión a MongoDB optimizada

Ya está optimizada en `db.js`:
- ✅ Connection pooling (min: 1, max: 5)
- ✅ Timeouts cortos (10s)
- ✅ Reutilización de conexiones

### 4. Health check rápido

```javascript
GET /health    // Retorna en <100ms
GET /readiness // Retorna en <500ms
```

---

## 📊 Tiempos Esperados

| Operación | Tiempo | Status |
|-----------|--------|--------|
| Startup | <2s | ✅ OK |
| DB Connection | 2-3s | ✅ OK |
| Index Sync | 5-10s | ⏳ Background |
| Ready to serve | 3-5s | ✅ OK |
| **Total** | **<30s** | ✅ NO TIMEOUT |

---

## 🐛 Debugging Timeouts

### 1. Ver logs en Vercel

```bash
vercel logs --follow
```

### 2. Local vs Production

**En desarrollo:**
```bash
NODE_ENV=development npm run dev
# Index sync sincrónico (espera)
```

**En producción:**
```bash
NODE_ENV=production npm start
# Index sync asincrónico (background)
```

### 3. Probar localmente como Vercel

```bash
# Instalar vercel locally
npm install -g vercel

# Emular Vercel
vercel dev
```

---

## 🚨 Common Issues

### Issue 1: "Task timed out after 30 seconds"

**Causa:** SyncIndexes bloqueando startup

**Solución:**
```bash
# Opción 1: Ya está corregida en server.js
npm run dev && npm start

# Opción 2: Desactivar para Vercel
# En server.js, comentar syncIndexes en production
```

### Issue 2: "MongoDB connection refused"

**Causa:** IP no whitelisted o credenciales incorrectas

**Solución:**
```
1. MongoDB Atlas → Security → Network Access
2. Agregar 0.0.0.0/0 (Vercel ips dinámicas)
3. Verificar MONGO_USER, MONGO_PASS, MONGO_CLUSTER
```

### Issue 3: "Redis connection failed"

**Causa:** REDIS_URL incorrecta o firewall

**Solución:**
```
1. Copiar exacta URL de Upstash
2. Verificar formato: https://user:pass@host:port
3. Probar localmente: redis-cli -u <url>
```

### Issue 4: "Function response was too large"

**Causa:** Respuesta >6MB

**Solución:**
```javascript
// Usar paginación
GET /api/products?page=1&limit=20

// No retornar datos innecesarios
.select('name price category')  // Mongoose projection
```

---

## 📈 Monitoreo en Producción

### Health Checks

```bash
curl https://tu-dominio.vercel.app/health
# {
#   "status": "OK",
#   "db": "connected",
#   "timestamp": "2026-04-06T..."
# }
```

### Logs Estructurados

Todos los logs incluyen:
- ✅ Timestamp
- ✅ Correlation ID
- ✅ User ID
- ✅ Severity level
- ✅ Sin datos sensibles

---

## 🔒 Seguridad en Vercel

### 1. Secrets Management ✅
- Variables críticas en Vercel Dashboard
- `.env` nunca en git (en `.gitignore`)
- Rotación de secretos cada 90 días

### 2. HTTPS Enforcement ✅
```javascript
if (req.header('x-forwarded-proto') !== 'https') {
  res.redirect(`https://${req.header('host')}${req.url}`);
}
```

### 3. Rate Limiting ✅
```javascript
express-rate-limit configurado
Global: 100/15min
Auth: 5/15min
Admin: 20/15min
```

### 4. CORS Configured ✅
```javascript
allowedOrigins: [
  "https://athenabrand.co",
  "https://www.athenabrand.co"
]
```

---

## 📋 Pre-Deployment Checklist

- [ ] `vercel.json` creado
- [ ] Variables de entorno en Vercel Dashboard
- [ ] MongoDB Atlas whitelist 0.0.0.0/0
- [ ] Redis Upstash accesible
- [ ] Cloudinary API keys válidas
- [ ] Email SMTP funcional
- [ ] Stripe keys en modo test
- [ ] FRONTEND_URL correcto
- [ ] CORS origins actualizados
- [ ] `npm audit` sin críticos
- [ ] Tests pasados localmente

---

## 🚀 Deployment Command

```bash
# 1. Verificar todo está en orden
npm run lint
npm audit
npm test (si existen tests)

# 2. Commit y push
git add -A
git commit -m "Deploy: Production ready"
git push origin main

# 3. Esperar auto-deploy o manual
vercel --prod

# 4. Verificar
vercel logs --follow
curl https://tu-dominio.vercel.app/health
```

---

## 📞 Support

Si tienes problemas con Vercel:

1. **Ver logs:**
   ```bash
   vercel logs --follow
   ```

2. **Probar localmente como Vercel:**
   ```bash
   vercel dev
   ```

3. **Revisar:**
   - Variables de entorno correctas
   - MongoDB whitelist
   - Redis accesible
   - Network requests (Cloudinary, Email)

4. **Rollback si es necesario:**
   ```bash
   vercel rollback
   ```

---

**Last Updated:** April 6, 2026  
**Vercel Status:** ✅ Ready for Production

---

> 🚀 ATHENA BRAND Backend - Ready to scale on Vercel serverless
