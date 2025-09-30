// controllers/categoryController.js - Controlador de categorías para ATHENA BRAND

class CategoryController {
  // Categorías fijas de ATHENA BRAND con información adicional
  static athenaCategories = [
    {
      slug: 'hombre',
      name: 'HOMBRE',
      description: 'Moda urbana masculina. Streetwear auténtico con estilo colombiano.',
      image: '/uploads/categories/hombre-banner.jpg',
      subcategories: [
        { name: 'Camisetas', slug: 'camisetas', description: 'Camisetas básicas y estampadas' },
        { name: 'Hoodies', slug: 'hoodies', description: 'Sudaderas con capucha' },
        { name: 'Pantalones', slug: 'pantalones', description: 'Jeans y pantalones urbanos' },
        { name: 'Chaquetas', slug: 'chaquetas', description: 'Chaquetas y abrigos' },
        { name: 'Accesorios', slug: 'accesorios', description: 'Gorras, pulseras y más' }
      ],
      isActive: true,
      order: 1,
      seoTitle: 'Ropa de Hombre - ATHENA BRAND | Streetwear Masculino Colombia',
      seoDescription: 'Descubre nuestra colección de ropa urbana para hombre. Camisetas, hoodies, jeans y accesorios. Streetwear auténtico desde San Pedro, Antioquia.',
      keywords: ['ropa hombre', 'streetwear masculino', 'moda urbana', 'camisetas hombre', 'hoodies colombia']
    },
    
    {
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
      seoDescription: 'Hoodies y sacos de máxima calidad. Diseños únicos, cortes perfectos y materiales premium. La esencia del streetwear colombiano.',
      keywords: ['hoodies', 'sudaderas', 'sacos', 'streetwear', 'sudaderas colombia', 'hoodies bogota']
    },
    
    {
      slug: 'chaquetas',
      name: 'CHAQUETAS',
      description: 'Chaquetas urbanas para toda ocasión. Desde cortavientos hasta blazers.',
      image: '/uploads/categories/chaquetas-banner.jpg',
      subcategories: [
        { name: 'Cortavientos', slug: 'cortavientos', description: 'Chaquetas ligeras' },
        { name: 'Denim', slug: 'denim', description: 'Chaquetas de jean' },
        { name: 'Bomber', slug: 'bomber', description: 'Chaquetas bomber' },
        { name: 'Urbanas', slug: 'urbanas', description: 'Chaquetas streetwear' },
        { name: 'Abrigos', slug: 'abrigos', description: 'Para clima frío' }
      ],
      isActive: true,
      order: 5,
      seoTitle: 'Chaquetas Urbanas - ATHENA BRAND | Outerwear Colombia',
      seoDescription: 'Chaquetas urbanas de alta calidad. Cortavientos, bombers, denim y más. Perfectas para el clima colombiano.',
      keywords: ['chaquetas urbanas', 'cortavientos', 'chaquetas colombia', 'bomber', 'outerwear']
    }
  ];

  // GET /api/categories - Obtener todas las categorías
  static async getAllCategories(req, res) {
    try {
      // Filtrar solo categorías activas
      const activeCategories = CategoryController.athenaCategories
        .filter(cat => cat.isActive)
        .sort((a, b) => a.order - b.order);

      res.json({
        success: true,
        data: activeCategories,
        message: 'Categorías ATHENA BRAND obtenidas exitosamente'
      });

    } catch (error) {
      console.error('Error obteniendo categorías:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // GET /api/categories/menu - Obtener categorías para el menú (simplificado)
  static async getMenuCategories(req, res) {
    try {
      const menuCategories = CategoryController.athenaCategories
        .filter(cat => cat.isActive)
        .sort((a, b) => a.order - b.order)
        .map(cat => ({
          slug: cat.slug,
          name: cat.name,
          subcategories: cat.subcategories.slice(0, 5) // Solo las primeras 5 subcategorías
        }));

      res.json({
        success: true,
        data: menuCategories
      });

    } catch (error) {
      console.error('Error obteniendo menú de categorías:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // GET /api/categories/:slug - Obtener categoría específica
  static async getCategoryBySlug(req, res) {
    try {
      const { slug } = req.params;
      
      const category = CategoryController.athenaCategories.find(cat => 
        cat.slug === slug && cat.isActive
      );

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Categoría no encontrada'
        });
      }

      res.json({
        success: true,
        data: category
      });

    } catch (error) {
      console.error('Error obteniendo categoría:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // GET /api/categories/:slug/subcategories - Obtener subcategorías
  static async getSubcategories(req, res) {
    try {
      const { slug } = req.params;
      
      const category = CategoryController.athenaCategories.find(cat => 
        cat.slug === slug && cat.isActive
      );

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
      console.error('Error obteniendo subcategorías:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // GET /api/categories/admin/all - Obtener todas las categorías para admin
  static async getAllCategoriesAdmin(req, res) {
    try {
      res.json({
        success: true,
        data: CategoryController.athenaCategories.sort((a, b) => a.order - b.order),
        message: 'Todas las categorías obtenidas (admin)'
      });

    } catch (error) {
      console.error('Error obteniendo categorías (admin):', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // GET /api/categories/sitemap - Para generar sitemap
  static async getSitemapData(req, res) {
    try {
      const sitemapData = CategoryController.athenaCategories
        .filter(cat => cat.isActive)
        .map(cat => ({
          slug: cat.slug,
          name: cat.name,
          lastModified: new Date().toISOString(),
          priority: 0.8,
          changeFreq: 'weekly',
          subcategories: cat.subcategories.map(sub => ({
            slug: `${cat.slug}/${sub.slug}`,
            name: `${cat.name} - ${sub.name}`,
            lastModified: new Date().toISOString(),
            priority: 0.6,
            changeFreq: 'weekly'
          }))
        }));

      res.json({
        success: true,
        data: sitemapData
      });

    } catch (error) {
      console.error('Error generando sitemap de categorías:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // GET /api/categories/seo/:slug - Información SEO de categoría
  static async getCategorySEO(req, res) {
    try {
      const { slug } = req.params;
      
      const category = CategoryController.athenaCategories.find(cat => 
        cat.slug === slug && cat.isActive
      );

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Categoría no encontrada'
        });
      }

      const seoData = {
        title: category.seoTitle || `${category.name} - ATHENA BRAND`,
        description: category.seoDescription || category.description,
        keywords: category.keywords || [],
        canonical: `${process.env.FRONTEND_URL}/categoria/${category.slug}`,
        ogTitle: category.seoTitle || `${category.name} - ATHENA BRAND`,
        ogDescription: category.seoDescription || category.description,
        ogImage: category.image,
        structuredData: {
          "@context": "https://schema.org",
          "@type": "ProductCategory",
          "name": category.name,
          "description": category.description,
          "image": category.image,
          "url": `${process.env.FRONTEND_URL}/categoria/${category.slug}`,
          "parentOrganization": {
            "@type": "Organization",
            "name": "ATHENA BRAND",
            "url": process.env.FRONTEND_URL
          }
        }
      };

      res.json({
        success: true,
        data: seoData
      });

    } catch (error) {
      console.error('Error obteniendo SEO de categoría:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // GET /api/categories/stats - Estadísticas de categorías
  static async getCategoryStats(req, res) {
    try {
      // Esta sería una implementación más completa con datos de productos
      const Product = require('../models/Product');

      const stats = await Promise.all(
        CategoryController.athenaCategories
          .filter(cat => cat.isActive)
          .map(async (category) => {
            const productCount = await Product.countDocuments({
              category: category.slug,
              isActive: true
            });

            const avgPrice = await Product.aggregate([
              { 
                $match: { 
                  category: category.slug, 
                  isActive: true 
                } 
              },
              {
                $group: {
                  _id: null,
                  avgPrice: { $avg: '$price' },
                  minPrice: { $min: '$price' },
                  maxPrice: { $max: '$price' }
                }
              }
            ]);

            return {
              category: category.name,
              slug: category.slug,
              productCount,
              priceStats: avgPrice[0] || { avgPrice: 0, minPrice: 0, maxPrice: 0 }
            };
          })
      );

      res.json({
        success: true,
        data: {
          totalCategories: CategoryController.athenaCategories.filter(c => c.isActive).length,
          categories: stats
        }
      });

    } catch (error) {
      console.error('Error obteniendo estadísticas de categorías:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // PUT /api/categories/:slug/toggle - Activar/desactivar categoría (admin)
  static async toggleCategory(req, res) {
    try {
      const { slug } = req.params;
      
      const categoryIndex = CategoryController.athenaCategories.findIndex(cat => 
        cat.slug === slug
      );

      if (categoryIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Categoría no encontrada'
        });
      }

      CategoryController.athenaCategories[categoryIndex].isActive = 
        !CategoryController.athenaCategories[categoryIndex].isActive;

      res.json({
        success: true,
        message: `Categoría ${CategoryController.athenaCategories[categoryIndex].isActive ? 'activada' : 'desactivada'} exitosamente`,
        data: {
          slug: CategoryController.athenaCategories[categoryIndex].slug,
          isActive: CategoryController.athenaCategories[categoryIndex].isActive
        }
      });

    } catch (error) {
      console.error('Error cambiando estado de categoría:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}

module.exports = CategoryController;