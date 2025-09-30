// controllers/productController.js - Controlador de productos para ATHENA BRAND
const Product = require('../models/Product');
const { validationResult } = require('express-validator');
const connectDB = require('../db');

class ProductController {
  // GET /api/products - Obtener todos los productos con paginación y filtros
  static async getAllProducts(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 12;
      const skip = (page - 1) * limit;
      
      // Filtros
      const filters = { isActive: true };
      
      if (req.query.category) {
        filters.category = req.query.category;
      }
      
      if (req.query.featured === 'true') {
        filters.isFeatured = true;
      }
      
      // Rango de precios
      if (req.query.minPrice || req.query.maxPrice) {
        filters.$or = [
          // Precio normal
          {
            $and: [
              { discountPrice: { $exists: false } },
              req.query.minPrice && { price: { $gte: parseFloat(req.query.minPrice) } },
              req.query.maxPrice && { price: { $lte: parseFloat(req.query.maxPrice) } }
            ].filter(Boolean)
          },
          // Precio con descuento
          {
            $and: [
              { discountPrice: { $exists: true, $gt: 0 } },
              req.query.minPrice && { discountPrice: { $gte: parseFloat(req.query.minPrice) } },
              req.query.maxPrice && { discountPrice: { $lte: parseFloat(req.query.maxPrice) } }
            ].filter(Boolean)
          }
        ];
      }

      // Filtro por tallas
      if (req.query.sizes) {
        const sizes = Array.isArray(req.query.sizes) ? req.query.sizes : [req.query.sizes];
        filters['sizes.size'] = { $in: sizes };
      }

      // Filtro por disponibilidad
      if (req.query.inStock === 'true') {
        filters['sizes.stock'] = { $gt: 0 };
      }
      
      // Ordenamiento
      let sortBy = {};
      switch (req.query.sort) {
        case 'price_asc':
          sortBy = { price: 1 };
          break;
        case 'price_desc':
          sortBy = { price: -1 };
          break;
        case 'newest':
          sortBy = { createdAt: -1 };
          break;
        case 'popular':
          sortBy = { sales: -1, views: -1 };
          break;
        case 'name_asc':
          sortBy = { name: 1 };
          break;
        case 'name_desc':
          sortBy = { name: -1 };
          break;
        default:
          sortBy = { createdAt: -1 };
      }
      
      const products = await Product.find(filters)
        .sort(sortBy)
        .skip(skip)
        .limit(limit)
        .select('-__v');
      
      const total = await Product.countDocuments(filters);
      
      res.json({
        success: true,
        data: products,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1
        }
      });
      
    } catch (error) {
      console.error('Error obteniendo productos:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener productos',
        error: process.env.NODE_ENV === 'development' ? error.message : {}
      });
    }
  }

  // GET /api/products/search - Búsqueda de productos
  static async searchProducts(req, res) {
    try {
      const { q: query, category, limit = 20 } = req.query;
      
      if (!query || query.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'La consulta de búsqueda debe tener al menos 2 caracteres'
        });
      }
      
      // Crear criterio de búsqueda más flexible
      const searchCriteria = {
        isActive: true,
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } },
          { sku: { $regex: query, $options: 'i' } }
        ]
      };
      
      if (category) {
        searchCriteria.category = category;
      }
      
      const products = await Product.find(searchCriteria)
        .limit(parseInt(limit))
        .sort({ sales: -1, views: -1 })
        .select('-__v');
      
      res.json({
        success: true,
        data: products,
        total: products.length,
        query: query
      });
      
    } catch (error) {
      console.error('Error en búsqueda:', error);
      res.status(500).json({
        success: false,
        message: 'Error en la búsqueda',
        error: process.env.NODE_ENV === 'development' ? error.message : {}
      });
    }
  }

  // GET /api/products/category/:category - Productos por categoría
  static async getProductsByCategory(req, res) {
    try {
      const { category } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 12;
      const skip = (page - 1) * limit;
      
      // Validar categoría ATHENA BRAND
      const validCategories = ['hombre', 'mujer', 'deportivos', 'hoodies-sacos', 'chaquetas'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          message: 'Categoría no válida para ATHENA BRAND'
        });
      }
      
      // Aplicar filtros adicionales
      const filters = { 
        category, 
        isActive: true 
      };

      // Filtros de la query
      if (req.query.subcategory) {
        filters.subcategory = req.query.subcategory;
      }

      if (req.query.minPrice || req.query.maxPrice) {
        filters.price = {};
        if (req.query.minPrice) filters.price.$gte = parseFloat(req.query.minPrice);
        if (req.query.maxPrice) filters.price.$lte = parseFloat(req.query.maxPrice);
      }

      // Ordenamiento
      let sortBy = { createdAt: -1 };
      if (req.query.sort) {
        switch (req.query.sort) {
          case 'price_asc':
            sortBy = { price: 1 };
            break;
          case 'price_desc':
            sortBy = { price: -1 };
            break;
          case 'popular':
            sortBy = { sales: -1, views: -1 };
            break;
          case 'name_asc':
            sortBy = { name: 1 };
            break;
        }
      }
      
      const products = await Product.find(filters)
        .sort(sortBy)
        .skip(skip)
        .limit(limit)
        .select('-__v');
      
      const total = await Product.countDocuments(filters);
      
      res.json({
        success: true,
        data: products,
        category: category.toUpperCase(),
        total,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      });
      
    } catch (error) {
      console.error('Error obteniendo productos por categoría:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener productos por categoría',
        error: process.env.NODE_ENV === 'development' ? error.message : {}
      });
    }
  }

  // GET /api/products/featured - Productos destacados
  static async getFeaturedProducts(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 8;
      
      const products = await Product.find({
        isFeatured: true,
        isActive: true
      })
        .sort({ sales: -1, createdAt: -1 })
        .limit(limit)
        .select('-__v');
      
      res.json({
        success: true,
        data: products,
        message: 'Productos destacados ATHENA BRAND'
      });
      
    } catch (error) {
      console.error('Error obteniendo productos destacados:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener productos destacados',
        error: process.env.NODE_ENV === 'development' ? error.message : {}
      });
    }
  }

  // GET /api/products/:slug - Detalle de producto por slug
  static async getProductBySlug(req, res) {
    try {
      const { slug } = req.params;
      
      const product = await Product.findOne({ 
        slug, 
        isActive: true 
      }).select('-__v');
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }
      
      // Incrementar vistas
      await product.incrementViews();
      
      // Productos relacionados (misma categoría)
      const relatedProducts = await Product.find({
        category: product.category,
        _id: { $ne: product._id },
        isActive: true
      })
        .limit(4)
        .select('name slug images price discountPrice category');
      
      res.json({
        success: true,
        data: product,
        relatedProducts
      });
      
    } catch (error) {
      console.error('Error obteniendo detalle del producto:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener detalle del producto',
        error: process.env.NODE_ENV === 'development' ? error.message : {}
      });
    }
  }

  // POST /api/products - Crear nuevo producto (solo admin)
  static async createProduct(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos de producto inválidos',
          errors: errors.array()
        });
      }

      const productData = req.body;
      
      // Generar slug si no se proporciona
      if (!productData.slug) {
        productData.slug = productData.name
          .toLowerCase()
          .replace(/[^a-zA-Z0-9\s]/g, '')
          .replace(/\s+/g, '-');
      }
      
      const product = new Product(productData);
      await product.save();
      
      res.status(201).json({
        success: true,
        data: product,
        message: 'Producto creado exitosamente'
      });
      
    } catch (error) {
      console.error('Error creando producto:', error);
      
      // Manejar errores de duplicación
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return res.status(400).json({
          success: false,
          message: `Ya existe un producto con este ${field === 'slug' ? 'nombre' : field}`
        });
      }
      
      res.status(400).json({
        success: false,
        message: 'Error al crear producto',
        error: process.env.NODE_ENV === 'development' ? error.message : {}
      });
    }
  }

  // PUT /api/products/:id - Actualizar producto (solo admin)
  static async updateProduct(req, res) {
    try {
      const { id } = req.params;
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos de actualización inválidos',
          errors: errors.array()
        });
      }

      const updateData = req.body;
      
      // Si se actualiza el nombre, regenerar slug
      if (updateData.name && !updateData.slug) {
        updateData.slug = updateData.name
          .toLowerCase()
          .replace(/[^a-zA-Z0-9\s]/g, '')
          .replace(/\s+/g, '-');
      }
      
      const product = await Product.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      ).select('-__v');
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }
      
      res.json({
        success: true,
        data: product,
        message: 'Producto actualizado exitosamente'
      });
      
    } catch (error) {
      console.error('Error actualizando producto:', error);
      res.status(400).json({
        success: false,
        message: 'Error al actualizar producto',
        error: process.env.NODE_ENV === 'development' ? error.message : {}
      });
    }
  }

  // DELETE /api/products/:id - Eliminar producto (soft delete)
  static async deleteProduct(req, res) {
    try {
      const { id } = req.params;
      
      const product = await Product.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true }
      );
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }
      
      res.json({
        success: true,
        message: 'Producto eliminado exitosamente'
      });
      
    } catch (error) {
      console.error('Error eliminando producto:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar producto',
        error: process.env.NODE_ENV === 'development' ? error.message : {}
      });
    }
  }

  // GET /api/products/admin/all - Obtener todos los productos para admin
  static async getAllProductsAdmin(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      
      // Incluir productos inactivos para admin
      const filters = {};
      
      if (req.query.category) {
        filters.category = req.query.category;
      }
      
      if (req.query.isActive !== undefined) {
        filters.isActive = req.query.isActive === 'true';
      }

      if (req.query.search) {
        filters.$or = [
          { name: { $regex: req.query.search, $options: 'i' } },
          { sku: { $regex: req.query.search, $options: 'i' } },
          { description: { $regex: req.query.search, $options: 'i' } }
        ];
      }
      
      const products = await Product.find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-__v');
      
      const total = await Product.countDocuments(filters);
      
      res.json({
        success: true,
        data: products,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      });
      
    } catch (error) {
      console.error('Error obteniendo productos (admin):', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener productos'
      });
    }
  }

  // PUT /api/products/:id/stock - Actualizar stock de producto
  static async updateStock(req, res) {
    try {
      const { id } = req.params;
      const { size, quantity, operation = 'set' } = req.body;

      const product = await Product.findById(id);
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }

      const sizeIndex = product.sizes.findIndex(s => s.size === size);
      
      if (sizeIndex === -1) {
        return res.status(400).json({
          success: false,
          message: `Talla ${size} no encontrada para este producto`
        });
      }

      // Actualizar stock según la operación
      switch (operation) {
        case 'add':
          product.sizes[sizeIndex].stock += quantity;
          break;
        case 'subtract':
          product.sizes[sizeIndex].stock = Math.max(0, product.sizes[sizeIndex].stock - quantity);
          break;
        case 'set':
        default:
          product.sizes[sizeIndex].stock = Math.max(0, quantity);
          break;
      }

      await product.save();

      res.json({
        success: true,
        message: 'Stock actualizado exitosamente',
        data: {
          productId: product._id,
          size,
          newStock: product.sizes[sizeIndex].stock
        }
      });

    } catch (error) {
      console.error('Error actualizando stock:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar stock'
      });
    }
  }

  // GET /api/products/analytics/stats - Estadísticas de productos
  static async getProductStats(req, res) {
    try {
      const totalProducts = await Product.countDocuments({ isActive: true });
      const totalCategories = await Product.distinct('category', { isActive: true });
      const lowStock = await Product.find({
        isActive: true,
        'sizes.stock': { $lte: 5 }
      }).countDocuments();

      // Productos más vendidos
      const topSelling = await Product.find({ isActive: true })
        .sort({ sales: -1 })
        .limit(5)
        .select('name sales sku');

      // Productos más vistos
      const mostViewed = await Product.find({ isActive: true })
        .sort({ views: -1 })
        .limit(5)
        .select('name views sku');

      // Productos por categoría
      const productsByCategory = await Product.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalValue: { $sum: '$price' }
          }
        },
        { $sort: { count: -1 } }
      ]);

      res.json({
        success: true,
        data: {
          overview: {
            totalProducts,
            totalCategories: totalCategories.length,
            lowStockProducts: lowStock
          },
          topSelling,
          mostViewed,
          productsByCategory
        }
      });

    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas'
      });
    }
  }

  // POST /api/products/batch - Operaciones en lote
  static async batchOperations(req, res) {
    try {
      const { operation, productIds, data } = req.body;

      if (!operation || !productIds || !Array.isArray(productIds)) {
        return res.status(400).json({
          success: false,
          message: 'Operación y IDs de productos son requeridos'
        });
      }

      let result;

      switch (operation) {
        case 'activate':
          result = await Product.updateMany(
            { _id: { $in: productIds } },
            { isActive: true }
          );
          break;

        case 'deactivate':
          result = await Product.updateMany(
            { _id: { $in: productIds } },
            { isActive: false }
          );
          break;

        case 'feature':
          result = await Product.updateMany(
            { _id: { $in: productIds } },
            { isFeatured: true }
          );
          break;

        case 'unfeature':
          result = await Product.updateMany(
            { _id: { $in: productIds } },
            { isFeatured: false }
          );
          break;

        case 'updateCategory':
          if (!data.category) {
            return res.status(400).json({
              success: false,
              message: 'Categoría requerida para esta operación'
            });
          }
          result = await Product.updateMany(
            { _id: { $in: productIds } },
            { category: data.category }
          );
          break;

        default:
          return res.status(400).json({
            success: false,
            message: 'Operación no válida'
          });
      }

      res.json({
        success: true,
        message: `Operación ${operation} ejecutada exitosamente`,
        data: {
          modifiedCount: result.modifiedCount,
          matchedCount: result.matchedCount
        }
      });

    } catch (error) {
      console.error('Error en operación en lote:', error);
      res.status(500).json({
        success: false,
        message: 'Error ejecutando operación en lote'
      });
    }
  }

  // GET /api/products/export - Exportar productos (CSV)
  static async exportProducts(req, res) {
    try {
      const { format = 'json' } = req.query;
      
      const products = await Product.find({ isActive: true })
        .select('-__v -createdAt -updatedAt')
        .lean();

      if (format === 'csv') {
        // Convertir a CSV (implementación básica)
        const csvHeader = 'Name,SKU,Category,Price,Discount Price,Stock\n';
        const csvRows = products.map(p => {
          const totalStock = p.sizes.reduce((sum, size) => sum + size.stock, 0);
          return `"${p.name}","${p.sku}","${p.category}",${p.price},${p.discountPrice || ''},${totalStock}`;
        }).join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="productos-athena.csv"');
        res.send(csvHeader + csvRows);
      } else {
        res.json({
          success: true,
          data: products,
          count: products.length
        });
      }

    } catch (error) {
      console.error('Error exportando productos:', error);
      res.status(500).json({
        success: false,
        message: 'Error al exportar productos'
      });
    }
  }
}

module.exports = ProductController;