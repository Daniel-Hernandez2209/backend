```js
/**
 * controllers/categoryController.js - Controlador de categorías para ATHENA BRAND
 * 
 * DESCRIPCIÓN GENERAL:
 * Este controlador maneja un sistema de categorías estático para la tienda de ropa urbana ATHENA BRAND.
 * Proporciona 9 endpoints RESTful para gestionar categorías predefinidas, incluyendo:
 * - 5 categorías fijas (Hombre, Mujer, Deportivos, Hoodies y Sacos, Chaquetas)
 * - Cada categoría tiene subcategorías, datos SEO y metadatos estructurados
 * - Funcionalidades para frontend público, administración y SEO
 * 
 * ENDPOINTS DISPONIBLES:
 * - GET /api/categories - Categorías públicas activas
 * - GET /api/categories/menu - Versión simplificada para menús
 * - GET /api/categories/:slug - Categoría específica por slug
 * - GET /api/categories/:slug/subcategories - Subcategorías de una categoría
 * - GET /api/categories/admin/all - Todas las categorías (admin)
 * - GET /api/categories/sitemap - Datos para sitemap XML
 * - GET /api/categories/seo/:slug - Metadatos SEO completos
 * - GET /api/categories/stats - Estadísticas con productos
 * - PUT /api/categories/:slug/toggle - Activar/desactivar categorías
 */

// Definición de la clase controladora principal
class CategoryController {
  // Array estático que contiene todas las categorías predefinidas de ATHENA BRAND
  static athenaCategories = [
    {
      // Identificador único para URLs amigables
      slug: 'hombre',
      // Nombre visible de la categoría
      name: 'HOMBRE',
      // Descripción breve para la categoría
      description: 'Moda urbana masculina. Streetwear auténtico con estilo colombiano.',
      // Ruta de la imagen banner de la categoría
      image: '/uploads/categories/hombre-banner.jpg',
      // Array de subcategorías relacionadas
      subcategories: [
        { name: 'Camisetas', slug: 'camisetas', description: 'Camisetas básicas y estampadas' },
        { name: 'Hoodies', slug: 'hoodies', description: 'Sudaderas con capucha' },
        { name: 'Pantalones', slug: 'pantalones', description: 'Jeans y pantalones urbanos' },
        { name: 'Chaquetas', slug: 'chaquetas', description: 'Chaquetas y abrigos' },
        { name: 'Accesorios', slug: 'accesorios', description: 'Gorras, pulseras y más' }
      ],
      // Estado de activación de la categoría
      isActive: true,
      // Orden de visualización en el frontend
      order: 1,
      // Título optimizado para SEO y meta tags
      seoTitle: 'Ropa de Hombre - ATHENA BRAND | Streetwear Masculino Colombia',
      // Meta descripción para buscadores
      seoDescription: 'Descubre nuestra colección de ropa urbana para hombre. Camisetas, hoodies, jeans y accesorios. Streetwear auténtico desde San Pedro, Antioquia.',
      // Palabras clave para SEO
      keywords: ['ropa hombre', 'streetwear masculino', 'moda urbana', 'camisetas hombre', 'hoodies colombia']
    },
    
    {
      // Categoría femenina con estructura idéntica
      slug: 'mujer',
      name: 'MUJER',
      description: 'Moda femenina urbana. Piezas únicas para mujeres que marcan la diferencia.',
      image: '/uploads/categories/mujer-banner.jpg',
      subcategories: [
        { name: 'Tops', slug: 'tops', description: 'Tops, crop tops y blusas' },
        { name: 'Hoodies', slug: 'hoodies', description: 'Sudaderas femeninas' },
        { name: 'Pantalones', slug: 'pantalones', description: 'Jeans y leggins' },
        { name: 'Chaquetas', slug: 'chaquetas', description: 'Chaquetas y blazers' },
        { name: 'Accesorios', slug: 'accesorios', description: 'Accesorios femeninos' }
      ],
      isActive: true,
      order: 2,
      seoTitle: 'Ropa de Mujer - ATHENA BRAND | Streetwear Femenino Colombia',
      seoDescription: 'Colección femenina de streetwear. Tops, hoodies, jeans y accesorios para mujeres urbanas. Moda colombiana auténtica.',
      keywords: ['ropa mujer', 'streetwear femenino', 'moda urbana mujer', 'tops mujer', 'hoodies mujer']
    },
    
    {
      // Categoría deportiva
      slug: 'deportivos',
      name: 'DEPORTIVOS',
      description: 'Ropa deportiva y athleisure. Comodidad y estilo para tu vida activa.',
      image: '/uploads/categories/deportivos-banner.jpg',
      subcategories: [
        { name: 'Conjuntos', slug: 'conjuntos', description: 'Sets deportivos completos' },
        { name: 'Camisetas', slug: 'camisetas', description: 'Camisetas técnicas' },
        { name: 'Pantalones', slug: 'pantalones', description: 'Leggins y shorts deportivos' },
        { name: 'Sudaderas', slug: 'sudaderas', description: 'Hoodies deportivos' },
        { name: 'Accesorios', slug: 'accesorios', description: 'Accesorios fitness' }
      ],
      isActive: true,
      order: 3,
      seoTitle: 'Ropa Deportiva - ATHENA BRAND | Athleisure Colombia',
      seoDescription: 'Ropa deportiva de alta calidad. Conjuntos, leggins, camisetas técnicas y más. Perfecta para gym, yoga y vida cotidiana.',
      keywords: ['ropa deportiva', 'athleisure', 'conjuntos deportivos', 'leggins', 'ropa gym']
    },
    
    {
      // Categoría especializada en sudaderas
      slug: 'hoodies-sacos',
      name: 'HOODIES Y SACOS',
      description: 'Sudaderas y sacos de alta calidad. La esencia del streetwear en cada prenda.',
      image: '/uploads/categories/hoodies-banner.jpg',
      subcategories: [
        { name: 'Hoodies', slug: 'hoodies', description: 'Sudaderas con capucha' },
        { name: 'Sacos', slug: 'sacos', description: 'Sacos sin capucha' },
        { name: 'Oversized', slug: 'oversized', description: 'Cortes holgados' },
        { name: 'Zip Hoodies', slug: 'zip-hoodies', description: 'Con cierre frontal' },
        { name: 'Vintage', slug: 'vintage', description: 'Estilo retro' }
      ],
      isActive: true,
      order: 4,
      seoTitle: 'Hoodies y Sacos - ATHENA BRAND | Sudaderas Colombia',
      seo