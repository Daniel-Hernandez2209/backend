// controllers/categoryController.js - VERSIÓN CON MONGODB
const Category = import('../models/category');
const logger = import('../utils/logger');
const NodeCache = import('node-cache');

// Cache con TTL de 1 hora
const categoryCache = new NodeCache({ 
  stdTTL: 3600,
  checkperiod: 600 // Verificar cada 10 minutos
});

class CategoryController {
  
  // Helper para manejo de errores
  static handleError(res, error, context) {
    logger.error(`Error en ${context}`, { 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }

  // Helper para limpiar caché
  static clearCache(pattern = null) {
    if (pattern) {
      const keys = categoryCache.keys();
      keys.forEach(key => {
        if (key.includes(pattern)) {
          categoryCache.del(key);
        }
      });
    } else {
      categoryCache.flushAll();
    }
  }

  // Validación de slug
  static validateSlug(slug) {
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    return slugRegex.test(slug) && slug.length >= 2 && slug.length <= 50;
  }

  // Middleware de validación
  static validateSlugParam(req, res, next) {
    const { slug } = req.params;
    
    if (!slug || !CategoryController.validateSlug(slug)) {
      return res.status(400).json({
        success: false,
        message: 'Slug inválido'
      });
    }
    next();
  }

  // GET /api/categories - Obtener todas las categorías activas
  static async getAllCategories(req, res) {
    try {
      const cacheKey = 'active_categories';
      let categories = categoryCache.get(cacheKey);
      
      if (!categories) {
        categories = await Category.findActiveOrdered()
          .select('-__v') // Excluir campo de versión
          .lean(); // Convertir a objetos JS planos para mejor performance
        
        categoryCache.set(cacheKey, categories);
        logger.info('Categorías cargadas desde DB y cacheadas');
      }
      
      res.json({ 
        success: true, 
        data: categories,
        message: 'Categorías obtenidas exitosamente'
      });

    } catch (error) {
      return CategoryController.handleError(res, error, 'getAllCategories');
    }
  }

  // GET /api/categories/menu - Menú simplificado
  static async getMenuCategories(req, res) {
    try {
      const cacheKey = 'menu_categories';
      let menuCategories = categoryCache.get(cacheKey);
      
      if (!menuCategories) {
        const categories = await Category.findActiveOrdered()
          .select('slug name subcategories')
          .lean();
        
        menuCategories = categories.map(cat => ({
          slug: cat.slug,
          name: cat.name,
          subcategories: cat.subcategories.slice(0, 5)
        }));
        
        categoryCache.set(cacheKey, menuCategories);
      }

      res.json({
        success: true,
        data: menuCategories
      });

    } catch (error) {
      return CategoryController.handleError(res, error, 'getMenuCategories');
    }
  }

  // GET /api/categories/:slug - Obtener categoría específica
  static async getCategoryBySlug(req, res) {
    try {
      const { slug } = req.params;
      const cacheKey = `category_${slug}`;
      
      let category = categoryCache.get(cacheKey);
      
      if (!category) {
        category = await Category.findBySlug(slug)
          .select('-__v')
          .lean();
        
        if (!category) {
          return res.status(404).json({
            success: false,
            message: 'Categoría no encontrada'
          });
        }
        
        categoryCache.set(cacheKey, category);
      }

      res.json({
        success: true,
        data: category
      });

    } catch (error) {
      return CategoryController.handleError(res, error, 'getCategoryBySlug');
    }
  }

  // GET /api/categories/:slug/subcategories - Obtener subcategorías
  static async getSubcategories(req, res) {
    try {
      const { slug } = req.params;
      
      const category = await Category.findBySlug(slug)
        .select('slug name subcategories')
        .lean();

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Categoría no encontrada'
        });
      }

      res.json({
        success: true,
        data: {
          category: {
            slug: category.slug,
            name: category.name
          },
          subcategories: category.subcategories
        }
      });

    } catch (error) {
      return CategoryController.handleError(res, error, 'getSubcategories');
    }
  }

  // GET /api/categories/sitemap - Datos para sitemap
  static async getSitemapData(req, res) {
    try {
      const cacheKey = 'sitemap_categories';
      let sitemapData = categoryCache.get(cacheKey);
      
      if (!sitemapData) {
        const categories = await Category.findActiveOrdered()
          .select('slug name subcategories updatedAt')
          .lean();
        
        sitemapData = categories.map(cat => ({
          slug: cat.slug,
          name: cat.name,
          lastModified: cat.updatedAt || new Date().toISOString(),
          priority: 0.8,
          changeFreq: 'weekly',
          subcategories: cat.subcategories.map(sub => ({
            slug: `${cat.slug}/${sub.slug}`,
            name: `${cat.name} - ${sub.name}`,
            lastModified: cat.updatedAt || new Date().toISOString(),
            priority: 0.6,
            changeFreq: 'weekly'
          }))
        }));
        
        categoryCache.set(cacheKey, sitemapData, 86400); // Cache 24 horas
      }

      res.json({
        success: true,
        data: sitemapData
      });

    } catch (error) {
      return CategoryController.handleError(res, error, 'getSitemapData');
    }
  }

  // GET /api/categories/seo/:slug - Información SEO
  static async getCategorySEO(req, res) {
    try {
      const { slug } = req.params;
      
      const category = await Category.findBySlug(slug)
        .select('slug name description image seoTitle seoDescription keywords')
        .lean();
      
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Categoría no encontrada'
        });
      }

      const baseUrl = process.env.NODE_ENV === 'production' 
        ? 'https://athenabrand.com' 
        : process.env.FRONTEND_URL || 'http://localhost:3000';
      
      const seoData = {
        title: category.seoTitle || `${category.name} - ATHENA BRAND`,
        description: category.seoDescription || category.description,
        keywords: category.keywords || [],
        ogTitle: category.seoTitle || `${category.name} - ATHENA BRAND`,
        ogDescription: category.seoDescription || category.description,
        ogImage: category.image,
        structuredData: {
          "@context": "https://schema.org",
          "@type": "ProductCategory",
          "name": category.name,
          "description": category.description,
          "image": category.image,
          "url": `${baseUrl}/categoria/${category.slug}`,
          "parentOrganization": {
            "@type": "Organization",
            "name": "ATHENA BRAND",
            "url": baseUrl
          }
        }
      };

      res.json({
        success: true,
        data: seoData
      });

    } catch (error) {
      return CategoryController.handleError(res, error, 'getCategorySEO');
    }
  }

  // GET /api/categories/stats - Estadísticas
  static async getCategoryStats(req, res) {
    try {
      const cacheKey = 'category_stats';
      let stats = categoryCache.get(cacheKey);
      
      if (!stats) {
        const categories = await Category.find({ isActive: true })
          .select('slug name')
          .lean();
        
        // TODO: Implementar conteo real de productos cuando exista el modelo
        stats = {
          totalCategories: categories.length,
          categories: categories.map(cat => ({
            category: cat.name,
            slug: cat.slug,
            productCount: 0, // Placeholder
            priceStats: { 
              avgPrice: 0, 
              minPrice: 0, 
              maxPrice: 0 
            }
          }))
        };
        
        categoryCache.set(cacheKey, stats, 1800); // Cache 30 minutos
      }

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      return CategoryController.handleError(res, error, 'getCategoryStats');
    }
  }

  // ============================================
  // RUTAS ADMINISTRATIVAS
  // ============================================

  // GET /api/admin/categories - Todas las categorías (incluyendo inactivas)
  static async getAllCategoriesAdmin(req, res) {
    try {
      const categories = await Category.find()
        .sort({ order: 1 })
        .select('-__v')
        .lean();

      res.json({
        success: true,
        data: categories,
        message: 'Todas las categorías obtenidas (admin)'
      });

    } catch (error) {
      return CategoryController.handleError(res, error, 'getAllCategoriesAdmin');
    }
  }

  // PUT /api/admin/categories/:slug/toggle - Activar/desactivar
  static async toggleCategory(req, res) {
    try {
      const { slug } = req.params;
      
      const category = await Category.findOne({ slug });

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Categoría no encontrada'
        });
      }

      // Usar método del modelo
      await category.toggleActive();
      
      // Limpiar caché
      CategoryController.clearCache();

      res.json({
        success: true,
        message: `Categoría ${category.isActive ? 'activada' : 'desactivada'} exitosamente`,
        data: {
          slug: category.slug,
          isActive: category.isActive
        }
      });

    } catch (error) {
      return CategoryController.handleError(res, error, 'toggleCategory');
    }
  }

  // POST /api/admin/categories - Crear categoría
  static async createCategory(req, res) {
    try {
      const category = new Category(req.body);
      await category.save();
      
      // Limpiar caché
      CategoryController.clearCache();

      res.status(201).json({
        success: true,
        message: 'Categoría creada exitosamente',
        data: category
      });

    } catch (error) {
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Datos de categoría inválidos',
          errors: Object.values(error.errors).map(e => e.message)
        });
      }
      
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Ya existe una categoría con ese slug'
        });
      }

      return CategoryController.handleError(res, error, 'createCategory');
    }
  }

  // PUT /api/admin/categories/:slug - Actualizar categoría
  static async updateCategory(req, res) {
    try {
      const { slug } = req.params;
      
      const category = await Category.findOneAndUpdate(
        { slug },
        req.body,
        { 
          new: true, // Retornar documento actualizado
          runValidators: true // Ejecutar validaciones
        }
      );

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Categoría no encontrada'
        });
      }

      // Limpiar caché
      CategoryController.clearCache();

      res.json({
        success: true,
        message: 'Categoría actualizada exitosamente',
        data: category
      });

    } catch (error) {
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Datos de categoría inválidos',
          errors: Object.values(error.errors).map(e => e.message)
        });
      }

      return CategoryController.handleError(res, error, 'updateCategory');
    }
  }

  // DELETE /api/admin/categories/:slug - Eliminar categoría
  static async deleteCategory(req, res) {
    try {
      const { slug } = req.params;
      
      const category = await Category.findOne({ slug });

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Categoría no encontrada'
        });
      }

      // TODO: Verificar si hay productos asociados
      // const Product = require('../models/Product');
      // const hasProducts = await Product.exists({ category: category._id });
      // if (hasProducts) {
      //   return res.status(400).json({
      //     success: false,
      //     message: 'No se puede eliminar una categoría con productos asociados'
      //   });
      // }

      await category.remove();
      
      // Limpiar caché
      CategoryController.clearCache();

      res.json({
        success: true,
        message: 'Categoría eliminada exitosamente'
      });

    } catch (error) {
      return CategoryController.handleError(res, error, 'deleteCategory');
    }
  }
}

export default  CategoryController;