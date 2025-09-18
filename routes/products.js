const express = require('express');
const router = express.Router();
const Product = require('../models/Products');

// GET /api/products - Obtener todos los productos con paginación y filtros
router.get('/', async (req, res) => {
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
      filters.price = {};
      if (req.query.minPrice) filters.price.$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice) filters.price.$lte = parseFloat(req.query.maxPrice);
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
      error: error.message
    });
  }
});

// GET /api/products/search - Búsqueda de productos
router.get('/search', async (req, res) => {
  try {
    const { q: query, category, limit = 20 } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'La consulta de búsqueda debe tener al menos 2 caracteres'
      });
    }
    
    const products = await Product.searchProducts(query, category, parseInt(limit));
    
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
      error: error.message
    });
  }
});

// GET /api/products/category/:category - Productos por categoría
router.get('/category/:category', async (req, res) => {
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
    
    const products = await Product.find({ 
      category, 
      isActive: true 
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v');
    
    const total = await Product.countDocuments({ category, isActive: true });
    
    res.json({
      success: true,
      data: products,
      category: category.toUpperCase(),
      total,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total
      }
    });
    
  } catch (error) {
    console.error('Error obteniendo productos por categoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener productos por categoría',
      error: error.message
    });
  }
});

// GET /api/products/featured - Productos destacados para el home
router.get('/featured', async (req, res) => {
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
      error: error.message
    });
  }
});

// GET /api/products/:slug - Detalle de producto por slug
router.get('/:slug', async (req, res) => {
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
      error: error.message
    });
  }
});

// POST /api/products - Crear nuevo producto (solo admin)
router.post('/', async (req, res) => {
  try {
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
    res.status(400).json({
      success: false,
      message: 'Error al crear producto',
      error: error.message
    });
  }
});

// PUT /api/products/:id - Actualizar producto (solo admin)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
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
      error: error.message
    });
  }
});

// DELETE /api/products/:id - Eliminar producto (soft delete)
router.delete('/:id', async (req, res) => {
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
      error: error.message
    });
  }
});

module.exports = router;