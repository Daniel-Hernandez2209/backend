# ATHENA BRAND Backend - Production Deployment Guide

## Quick Start

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Fill in all environment variables in .env
# See details below for each required config

# Start development server
npm run dev

# Start production server
npm start
```

## Critical Configuration

### 1. Database Setup (MongoDB Atlas)

1. Create a MongoDB Atlas cluster: https://www.mongodb.com/cloud/atlas
2. Create a database user with strong password
3. Add IP whitelist (allow Vercel IPs: 0.0.0.0/0 for production, or specific IPs)
4. Get connection string and extract:
   - `MONGO_USER` - Database username
   - `MONGO_PASS` - Database password
   - `MONGO_CLUSTER` - Cluster name (e.g., cluster0.abc123.mongodb.net)
   - `MONGO_DB` - Database name

**⚠️ CRITICAL**: URL-encode special characters in password using: https://www.urlencoder.org/

### 2. Redis Setup (Upstash)

Used for JWT refresh tokens and caching.

1. Sign up at: https://upstash.com/
2. Create Redis database
3. Copy `REDIS_URL` from console

### 3. JWT Secret

Generate a strong random key (minimum 32 characters):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set as `JWT_SECRET` in .env

### 4. Email Configuration (Nodemailer)

#### Gmail Setup (Recommended for testing)

1. Enable 2-factor authentication: https://myaccount.google.com/security
2. Create App Password: https://myaccount.google.com/apppasswords
3. Set:
   - `EMAIL_HOST=smtp.gmail.com`
   - `EMAIL_PORT=587`
   - `EMAIL_SECURE=false`
   - `EMAIL_USER=your.email@gmail.com`
   - `EMAIL_PASS=your_16_char_app_password`

#### SendGrid Setup (Production)

```
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=apikey
EMAIL_PASS=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### AWS SES Setup

```
EMAIL_HOST=email-smtp.{region}.amazonaws.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_smtp_username
EMAIL_PASS=your_smtp_password
```

### 5. Cloudinary Setup (Image Uploads)

1. Create account: https://cloudinary.com/
2. Go to Dashboard
3. Set:
   - `CLOUDINARY_CLOUD_NAME` - Cloud name
   - `CLOUDINARY_API_KEY` - API Key
   - `CLOUDINARY_API_SECRET` - API Secret (never expose on frontend)

### 6. CORS Configuration

For production, set allowed origins:

```env
# .env
CORS_ORIGIN=https://athenabrand.co,https://www.athenabrand.co
```

## HTTPS & Security

### Production Deployment (Vercel)

The server automatically redirects HTTP → HTTPS in production:

```javascript
// server.js - Automatic for Vercel
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    if (req.header("x-forwarded-proto") !== "https") {
      res.redirect(`https://${req.header("host")}${req.url}`);
    } else {
      next();
    }
  });
}
```

### HSTS Header

HSTS policy is configured (max-age: 31536000 = 1 year):

```javascript
hsts: {
  maxAge: 31536000,
  includeSubDomains: true,
  preload: true
}
```

## API Health Checks

### Health Status

```bash
# Check if server is running
curl https://api.athenabrand.co/health
# Returns: { status: 'OK', db: 'connected', timestamp: '...' }

# Check if ready for traffic
curl https://api.athenabrand.co/readiness
# Returns: { ready: true } or 503 if DB disconnected
```

## Authentication

### JWT Token Flow

1. **Register/Login** → Get access token (15 min) + refresh token (7 days)
2. **Access Protected Route** → Send `Authorization: Bearer <token>`
3. **Token Expires** → Use refresh token to get new access token
4. **Logout** → Refresh tokens are invalidated in Redis

### Token Headers

```bash
# Request with JWT
curl -H "Authorization: Bearer eyJhbGc..." https://api.athenabrand.co/api/auth/me

# Response includes CSRF token
curl -H "GET" https://api.athenabrand.co/api/orders/list
# Response header: X-CSRF-Token: <token>
```

## Database

### Migrations

Migrations are NOT currently versioned. For schema changes:

1. Update Mongoose schemas in `models/`
2. Redeploy server
3. Schemas auto-validate on startup

**TODO**: Implement db-migrate for reversible migrations

### Indexes

Indexes are automatically created from Mongoose schemas:

```javascript
// User model
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, isActive: 1 });
```

Monitor with:

```bash
# MongoDB Atlas console → Databases → Indexes tab
```

## Performance Optimization

### Caching

- **Categories**: Cached 1 hour in-memory (Node.js)
- **Products**: Use Redis for distributed caching
- **Responses**: HTTP Cache-Control headers set

### Database Optimization

- Always use pagination (max 100 items/page)
- Create indexes for frequently filtered fields
- Use `.lean()` for read-only queries
- Use `.select()` to exclude unnecessary fields

## Monitoring & Logging

### Structured Logging

All logs include correlation IDs for tracing:

```bash
# View logs with correlation ID
# AWS CloudWatch → Filter by correlationId
```

Fields logged:

- `correlationId` - Request trace ID
- `userId` - Authenticated user
- `level` - Debug, Info, Warn, Error
- `timestamp` - ISO 8601 format

### Health Alerts

Monitor these endpoints:

```bash
# Production monitoring
* GET /health - Every 60 seconds (via Vercel or load balancer)
* GET /readiness - On deployment
```

## Deployment Checklist

- [ ] All env vars configured in production
- [ ] HTTPS enforced (automatic on Vercel, verify with curl)
- [ ] Database backups enabled in MongoDB Atlas
- [ ] Email service configured and tested
- [ ] Cloudinary quota verified
- [ ] Redis connection working
- [ ] Rate limiting configured
- [ ] CORS whitelist contains production domain
- [ ] JWT_SECRET is strong and unique
- [ ] No console.log statements in critical code
- [ ] Error logs don't expose sensitive data
- [ ] Database indexes created
- [ ] Health checks responding
- [ ] SSL certificate valid

## Troubleshooting

### Database Connection Issues

```bash
# Test MongoDB connection
curl https://api.athenabrand.co/api/test-db
# Should return: { success: true, message: "✅ Conexión exitosa a MongoDB" }

# If fails:
# 1. Check MONGO_* env vars
# 2. Verify IP whitelist in MongoDB Atlas
# 3. Verify database user exists
# 4. Test connection from local: mongo "mongodb+srv://user:pass@cluster/db"
```

### Email Delivery Issues

```bash
# Test email sending
POST /api/auth/forgot-password
{ "email": "test@example.com" }

# If no email received:
# 1. Check EMAIL_* variables
# 2. Verify app password for Gmail
# 3. Check spam folder
# 4. Monitor logs: console.log() or logger.error()
```

### High Response Times

```bash
# Check database performance
# MongoDB Atlas → Performance → Query Profiler

# Look for:
# - N+1 queries (load individual products in loop)
# - Missing indexes
# - Large payloads not paginated

# Monitor in production:
# Logs include response duration in milliseconds
```

## API Documentation

See [API_DOCS.md](./API_DOCS.md) for full endpoint documentation.

## Architecture Decisions

- **Express.js** - Lightweight web framework
- **MongoDB** - Document database for flexible schema
- **Mongoose** - ODM with proper validation
- **Redis** - In-memory store for sessions/caching
- **JWT** - Stateless authentication
- **Cloudinary** - External image hosting (no server storage)
- **Nodemailer** - Transactional email sending

## Future Improvements

- [ ] API versioning (/api/v2/...)
- [ ] OpenTelemetry distributed tracing
- [ ] Database migrations with versioning
- [ ] Circuit breakers for external services
- [ ] Request correlation IDs in all logs
- [ ] Soft deletes for data preservation
- [ ] Encrypted sensitive fields
- [ ] Advanced rate limiting by user tier
- [ ] GraphQL API option
- [ ] WebSocket support for real-time updates
