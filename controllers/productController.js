// controllers/productController.js - Controlador de productos para ATHENA BRAND (refactorizado, seguro)
import Product from "../models/Product.js";
import { validationResult } from "express-validator";
import logger from "../utils/logger.js";
import mongoose from "mongoose";

// -----------------------------
// Config / Constantes
// -----------------------------
const VALID_CATEGORIES = ['hombre', 'mujer', 'deportivos', 'hoodies-sacos', 'chaquetas'];
const ALLOWED_SORT_FIELDS = {
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  newest: { createdAt: -1 },
  popular: { sales: -1, views: -1 },
  name_asc: { name: 1 },
  name_desc: { name: -1 }
};

// -----------------------------
// Helpers
// -----------------------------
/**
 * Escapa caracteres especiales para usar en $regex.
 */
const escapeRegex = (string) => {
  if (typeof string !== 'string') return '';
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Generador seguro de slugs.
 */
const generateSlug = (name) => {
  if (!name || typeof name !== 'string') {
    throw new Error('Nombre inválido para generar slug');
  }
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/gi, '') // mantener alfanuméricos, espacios y guiones
    .replace(/\s+/g, '-')
    .substring(0, 100)
    .replace(/^-+|-+$/g, '');
};

/**
 * Asegura que un slug sea único (excluye optional excludeId).
 * Retorna el slug final (si existe conflicto, le añade un sufijo incremental).
 */
const ensureUniqueSlug = async (baseSlug, excludeId = null) => {
  let slug = baseSlug;
  let suffix = 0;
  while (true) {
    const query = { slug };
    if (excludeId && mongoose.Types.ObjectId.isValid(excludeId)) {
      query._id = { $ne: excludeId };
    }
    const existing = await Product.findOne(query).select('_id slug').lean();
    if (!existing) return slug;
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
    if (suffix > 1000) throw new Error('No se pudo generar slug único');
  }
};

/**
 * Normaliza y limita paginación segura.
 */
const parsePagination = (query) => {
  const page = Math.max(1, Math.min(1000, parseInt(query.page, 10) || 1));
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 12));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

class ProductController {
  // -----------------------------
  // GET /api/products
  // -----------------------------
  static async getAllProducts(req, res) {
    try {
      const { page, limit, skip } = parsePagination(req.query);

      const filters = { isActive: true };

      // Categoría (whitelist)
      if (req.query.category) {
        const category = String(req.query.category).trim();
        if (!VALID_CATEGORIES.includes(category)) {
          return res.status(400).json({ success: false, message: 'Categoría no válida' });
        }
        filters.category = category;
      }

      // Tallas
      if (req.query.sizes) {
        const sizes = Array.isArray(req.query.sizes) ? req.query.sizes : [req.query.sizes];
        const validSizes = sizes.filter(s => typeof s === 'string' && s.length <= 10);
        if (validSizes.length) {
          filters['sizes.size'] = { $in: validSizes };
        }
      }

      // Disponibilidad
      if (req.query.inStock === 'true') {
        filters['sizes.stock'] = { $gt: 0 };
      }

      // Rango de precios (manejo simple y seguro)
      if (req.query.minPrice || req.query.maxPrice) {
        const minPrice = parseFloat(req.query.minPrice);
        const maxPrice = parseFloat(req.query.maxPrice);

        // Evitamos construir $expr complejo si no es necesario
        // Filtramos por price OR discountPrice en el pipeline si se requiere precisión.
        if (!isNaN(minPrice) || !isNaN(maxPrice)) {
          // Usamos $expr para comparar con discountPrice cuando exista
          const priceConditions = [];
          if (!isNaN(minPrice) && minPrice >= 0) {
            priceConditions.push({ $gte: [{ $ifNull: ['$discountPrice', '$price'] }, minPrice] });
          }
          if (!isNaN(maxPrice) && maxPrice >= 0) {
            priceConditions.push({ $lte: [{ $ifNull: ['$discountPrice', '$price'] }, maxPrice] });
          }
          if (priceConditions.length) {
            filters.$expr = { $and: priceConditions };
          }
        }
      }

      // Ordenamiento seguro
      const sortBy = ALLOWED_SORT_FIELDS[req.query.sort] || { createdAt: -1 };

      const [products, total] = await Promise.all([
        Product.find(filters).sort(sortBy).skip(skip).limit(limit).select('-__v').lean(),
        Product.countDocuments(filters)
      ]);

      res.json({
        success: true,
        products,
        pagination: {
          currentPage: page,
          totalPages: Math.max(1, Math.ceil(total / limit)),
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1
        }
      });
    } catch (error) {
      logger.error('Error en getAllProducts', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        ip: req.ip,
        query: req.query
      });
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        errorCode: 'PRODUCTS_FETCH_ERROR'
      });
    }
  }

  // -----------------------------
  // GET /api/products/search
  // -----------------------------
  static async searchProducts(req, res) {
    try {
      const q = String(req.query.q || '').trim();
      const category = req.query.category;
      const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);

      if (!q || q.length < 2 || q.length > 100) {
        return res.status(400).json({ success: false, message: 'La consulta debe tener entre 2 y 100 caracteres' });
      }

      const sanitized = escapeRegex(q);
      const searchCriteria = { isActive: true, $or: [
        { name: { $regex: sanitized, $options: 'i' } },
        { description: { $regex: sanitized, $options: 'i' } },
        { sku: { $regex: sanitized, $options: 'i' } }
      ]};

      // Tags segment safe (solo entradas alfanuméricas cortas)
      const tagSafe = q.toLowerCase();
      if (/^[a-z0-9\s\-_]{1,30}$/i.test(tagSafe)) {
        searchCriteria.$or.push({ tags: { $in: [tagSafe] } });
      }

      if (category) {
        if (!VALID_CATEGORIES.includes(category)) {
          return res.status(400).json({ success: false, message: 'Categoría no válida' });
        }
        searchCriteria.category = category;
      }

      const products = await Product.find(searchCriteria)
        .limit(limit)
        .sort({ sales: -1, views: -1 })
        .select('-__v')
        .lean();

      res.json({
        success: true,
        products,
        total: products.length,
        query: q
      });
    } catch (error) {
      logger.error('Error en searchProducts', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        ip: req.ip,
        query: req.query
      });
      res.status(500).json({
        success: false,
        message: 'Error en la búsqueda',
        errorCode: 'SEARCH_ERROR'
      });
    }
  }

  // -----------------------------
  // GET /api/products/category/:category
  // -----------------------------
  static async getProductsByCategory(req, res) {
    try {
      const { category } = req.params;
      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({ success: false, message: 'Categoría no válida para ATHENA BRAND' });
      }

      const { page, limit, skip } = parsePagination(req.query);
      const filters = { category, isActive: true };

      if (req.query.subcategory) {
        const subcat = String(req.query.subcategory).trim();
        if (subcat.length > 0 && subcat.length <= 50 && /^[a-zA-Z0-9\s\-_]+$/.test(subcat)) {
          filters.subcategory = subcat;
        }
      }

      // Precios (simple, solo price)
      if (req.query.minPrice || req.query.maxPrice) {
        const minPrice = parseFloat(req.query.minPrice);
        const maxPrice = parseFloat(req.query.maxPrice);
        const priceConditions = [];
        if (!isNaN(minPrice) && minPrice >= 0) priceConditions.push({ $gte: ['$price', minPrice] });
        if (!isNaN(maxPrice) && maxPrice >= 0) priceConditions.push({ $lte: ['$price', maxPrice] });
        if (priceConditions.length) filters.$expr = { $and: priceConditions };
      }

      const sortBy = ALLOWED_SORT_FIELDS[req.query.sort] || { createdAt: -1 };

      const [products, total] = await Promise.all([
        Product.find(filters).sort(sortBy).skip(skip).limit(limit).select('-__v').lean(),
        Product.countDocuments(filters)
      ]);

      res.json({
        success: true,
        products,
        category: category.toUpperCase(),
        total,
        pagination: {
          currentPage: page,
          totalPages: Math.max(1, Math.ceil(total / limit)),
          totalItems: total,
          itemsPerPage: limit
        }
      });
    } catch (error) {
      logger.error('Error en getProductsByCategory', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        ip: req.ip,
        category: req.params.category
      });
      res.status(500).json({
        success: false,
        message: 'Error al obtener productos por categoría',
        errorCode: 'CATEGORY_FETCH_ERROR'
      });
    }
  }

  // -----------------------------
  // GET /api/products/featured
  // -----------------------------
  static async getFeaturedProducts(req, res) {
    try {
      const limit = Math.min(50, parseInt(req.query.limit, 10) || 8);
      const products = await Product.find({ isFeatured: true, isActive: true })
        .sort({ sales: -1, createdAt: -1 })
        .limit(limit)
        .select('-__v')
        .lean();

      res.json({
        success: true,
        products,
        message: 'Productos destacados ATHENA BRAND'
      });
    } catch (error) {
      logger.error('Error en getFeaturedProducts', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        message: 'Error al obtener productos destacados',
        errorCode: 'FEATURED_FETCH_ERROR'
      });
    }
  }

  // -----------------------------
  // GET /api/products/:slug
  // -----------------------------
  static async getProductBySlug(req, res) {
    try {
      const { slug } = req.params;
      if (!slug || typeof slug !== 'string' || slug.length > 100) {
        return res.status(400).json({ success: false, message: 'Slug inválido' });
      }

      const product = await Product.findOne({ slug, isActive: true }).select('-__v');
      if (!product) return res.status(404).json({ success: false, message: 'Producto no encontrado' });

      // Incrementar views (método del modelo)
      try {
        await product.incrementViews();
      } catch (incErr) {
        // No interrumpimos la respuesta si falla el incremento de views
        logger.warn('No se pudo incrementar views', { productId: product._id, err: incErr.message });
      }

      const relatedProducts = await Product.find({
        category: product.category,
        _id: { $ne: product._id },
        isActive: true
      })
        .limit(4)
        .select('name slug images price discountPrice category')
        .lean();

      res.json({ success: true, product, relatedProducts });
    } catch (error) {
      logger.error('Error en getProductBySlug', {
        error: error.message,
        stack: error.stack,
        slug: req.params.slug
      });
      res.status(500).json({
        success: false,
        message: 'Error al obtener detalle del producto',
        errorCode: 'PRODUCT_DETAIL_ERROR'
      });
    }
  }

  // -----------------------------
  // POST /api/products - Solo admin
  // -----------------------------
  static async createProduct(req, res) {
    try {
      // Validaciones de express-validator deberían ejecutarse en middleware de rutas.
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Datos de producto inválidos', errors: errors.array() });
      }

      const productData = { ...req.body };

      if (productData.name) {
        const baseSlug = generateSlug(productData.name);
        productData.slug = await ensureUniqueSlug(baseSlug);
      }

      const product = new Product(productData);
      await product.save();

      logger.info('Producto creado', { userId: req.user?.id, productId: product._id });

      res.status(201).json({ success: true, product, message: 'Producto creado exitosamente' });
    } catch (error) {
      logger.error('Error en createProduct', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        body: req.body
      });

      if (error.code === 11000) {
        return res.status(400).json({ success: false, message: 'Ya existe un producto con este SKU o slug' });
      }

      res.status(500).json({
        success: false,
        message: 'Error al crear producto',
        errorCode: 'PRODUCT_CREATE_ERROR'
      });
    }
  }

  // -----------------------------
  // PUT /api/products/:id - Solo admin
  // -----------------------------
  static async updateProduct(req, res) {
    try {
      const { id } = req.params;

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Datos de actualización inválidos', errors: errors.array() });
      }

      const updateData = { ...req.body };

      if (updateData.name) {
        const baseSlug = generateSlug(updateData.name);
        updateData.slug = await ensureUniqueSlug(baseSlug, id);
      }

      const product = await Product.findByIdAndUpdate(id, updateData, { new: true, runValidators: true, select: '-__v' });
      if (!product) return res.status(404).json({ success: false, message: 'Producto no encontrado' });

      logger.info('Producto actualizado', { userId: req.user?.id, productId: product._id, changes: updateData });

      res.json({ success: true, product, message: 'Producto actualizado exitosamente' });
    } catch (error) {
      logger.error('Error en updateProduct', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        productId: req.params.id
      });
      res.status(500).json({
        success: false,
        message: 'Error al actualizar producto',
        errorCode: 'PRODUCT_UPDATE_ERROR'
      });
    }
  }

  // -----------------------------
  // DELETE /api/products/:id - Soft delete (solo admin)
  // -----------------------------
  static async deleteProduct(req, res) {
    try {
      const { id } = req.params;
      const product = await Product.findByIdAndUpdate(id, { isActive: false }, { new: true });
      if (!product) return res.status(404).json({ success: false, message: 'Producto no encontrado' });

      logger.info('Producto desactivado (soft delete)', { userId: req.user?.id, productId: product._id });

      res.json({ success: true, message: 'Producto eliminado exitosamente' });
    } catch (error) {
      logger.error('Error en deleteProduct', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        productId: req.params.id
      });
      res.status(500).json({
        success: false,
        message: 'Error al eliminar producto',
        errorCode: 'PRODUCT_DELETE_ERROR'
      });
    }
  }

  // -----------------------------
  // GET /api/products/admin/all - Solo admin
  // -----------------------------
  static async getAllProductsAdmin(req, res) {
    try {
      const { page, limit, skip } = parsePagination(req.query);
      const filters = {};

      if (req.query.isActive !== undefined) {
        filters.isActive = String(req.query.isActive) === 'true';
      }

      if (req.query.category) {
        if (!VALID_CATEGORIES.includes(req.query.category)) {
          return res.status(400).json({ success: false, message: 'Categoría no válida' });
        }
        filters.category = req.query.category;
      }

      if (req.query.search) {
        const safeSearch = escapeRegex(String(req.query.search).trim());
        if (safeSearch.length >= 2) {
          filters.$or = [
            { name: { $regex: safeSearch, $options: 'i' } },
            { sku: { $regex: safeSearch, $options: 'i' } },
            { description: { $regex: safeSearch, $options: 'i' } }
          ];
        }
      }

      const [products, total] = await Promise.all([
        Product.find(filters).sort({ createdAt: -1 }).skip(skip).limit(limit).select('-__v').lean(),
        Product.countDocuments(filters)
      ]);

      res.json({
        success: true,
        products,
        pagination: {
          currentPage: page,
          totalPages: Math.max(1, Math.ceil(total / limit)),
          totalItems: total,
          itemsPerPage: limit
        }
      });
    } catch (error) {
      logger.error('Error en getAllProductsAdmin', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      res.status(500).json({
        success: false,
        message: 'Error al obtener productos',
        errorCode: 'ADMIN_PRODUCTS_FETCH_ERROR'
      });
    }
  }

  // -----------------------------
  // PUT /api/products/:id/stock - Solo admin
  // -----------------------------
  static async updateStock(req, res) {
    try {
      const { id } = req.params;
      const { size, quantity, operation = 'set' } = req.body;

      if (!size || typeof size !== 'string' || size.length > 10) {
        return res.status(400).json({ success: false, message: 'Talla inválida' });
      }

      const qty = parseInt(quantity, 10);
      if (isNaN(qty) || qty < 0) {
        return res.status(400).json({ success: false, message: 'Cantidad inválida' });
      }

      const product = await Product.findById(id);
      if (!product) return res.status(404).json({ success: false, message: 'Producto no encontrado' });

      const sizeIndex = product.sizes.findIndex(s => s.size === size);
      if (sizeIndex === -1) {
        return res.status(400).json({ success: false, message: `Talla ${size} no encontrada` });
      }

      switch (operation) {
        case 'add':
          product.sizes[sizeIndex].stock += qty;
          break;
        case 'subtract':
          product.sizes[sizeIndex].stock = Math.max(0, product.sizes[sizeIndex].stock - qty);
          break;
        case 'set':
          product.sizes[sizeIndex].stock = qty;
          break;
        default:
          return res.status(400).json({ success: false, message: 'Operación no válida' });
      }

      await product.save();

      logger.info('Stock actualizado', {
        userId: req.user?.id,
        productId: product._id,
        size,
        operation,
        quantity: qty,
        newStock: product.sizes[sizeIndex].stock
      });

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
      logger.error('Error en updateStock', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        productId: req.params.id
      });
      res.status(500).json({
        success: false,
        message: 'Error al actualizar stock',
        errorCode: 'STOCK_UPDATE_ERROR'
      });
    }
  }
}

export default  ProductController;
