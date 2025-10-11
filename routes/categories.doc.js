```javascript
/**
 * ARCHIVO DE RUTAS DE CATEGORÍAS
 * ================================
 * 
 * Este archivo define todas las rutas HTTP para el sistema de gestión de categorías
 * utilizando Express.js. Implementa una arquitectura MVC donde las rutas actúan
 * como el punto de entrada, delegando la lógica de negocio a los controladores.
 * 
 * Funcionalidades:
 * - Rutas públicas: listado, menú, sitemap, SEO, consultas específicas
 * - Rutas administrativas: gestión completa con autenticación requerida
 * 
 * NOTA DE SEGURIDAD: Este código requiere mejoras de validación y rate limiting
 */

// Importación del framework Express para crear el router
const express = require('express');

// Importación del controlador que contiene toda la lógica de negocio de categorías
const CategoryController = require('../controllers/categoryController');

// Importación del middleware de autenticación para proteger rutas administrativas
const { adminAuth } = require('../middleware/auth');

// Creación de una instancia de router de Express para definir las rutas
const router = express.Router();

// =============================================================================
// RUTAS PÚBLICAS - No requieren autenticación
// =============================================================================

// GET / - Obtiene todas las categorías públicas
// Endpoint para mostrar el listado completo de categorías activas
router.get('/', CategoryController.getAllCategories);

// GET /menu - Obtiene categorías para el menú de navegación
// Endpoint optimizado que retorna solo las categorías necesarias para el menú principal
router.get('/menu', CategoryController.getMenuCategories);

// GET /sitemap - Obtiene datos de categorías para el sitemap XML
// Endpoint utilizado por generadores de sitemap para SEO
router.get('/sitemap', CategoryController.getSitemapData);

// GET /stats - Obtiene estadísticas de categorías
// Endpoint que retorna métricas y estadísticas generales de las categorías
router.get('/stats', CategoryController.getCategoryStats);

// GET /seo/:slug - Obtiene información SEO de una categoría específica
// :slug - Parámetro de ruta que identifica la categoría por su slug único
// VULNERABILIDAD: Falta validación del parámetro slug
router.get('/seo/:slug', CategoryController.getCategorySEO);

// GET /:slug - Obtiene una categoría específica por su slug
// :slug - Parámetro de ruta para identificar la categoría
// PROBLEMA: Esta ruta genérica puede interceptar rutas específicas si no se ordena correctamente
router.get('/:slug', CategoryController.getCategoryBySlug);

// GET /:slug/subcategories - Obtiene las subcategorías de una categoría padre
// :slug - Parámetro que identifica la categoría padre
// Retorna todas las subcategorías activas de la categoría especificada
router.get('/:slug/subcategories', CategoryController.getSubcategories);

// =============================================================================
// RUTAS ADMINISTRATIVAS - Requieren autenticación
// =============================================================================

// GET /admin/all - Obtiene todas las categorías para administración
// adminAuth - Middleware que verifica que el usuario sea administrador
// Retorna todas las categorías (activas e inactivas) para gestión administrativa
router.get('/admin/all', adminAuth, CategoryController.getAllCategoriesAdmin);

// PUT /:slug/toggle - Activa/desactiva una categoría
// adminAuth - Middleware de autenticación administrativa requerido
// :slug - Parámetro que identifica la categoría a modificar
// NOTA: Esta ruta debería estar bajo el prefijo /admin/ para mayor claridad
router.put('/:slug/toggle', adminAuth, CategoryController.toggleCategory);

// Exportación del router para ser utilizado en la aplicación principal
module.exports = router;
```

**Observaciones importantes sobre seguridad y mejoras:**

1. **Orden de rutas crítico**: Las rutas específicas (`/seo/:slug`) deben ir ANTES que las genéricas (`/:slug`)
2. **Falta validación**: Los parámetros `:slug` necesitan validación con express-validator
3. **Sin rate limiting**: Vulnerable a ataques de denegación de servicio
4. **Estructura inconsistente**: La ruta `/:slug/toggle` debería ser `/admin/:slug/toggle`