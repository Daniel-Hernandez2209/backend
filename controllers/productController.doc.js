```js
/**
 * CONTROLADOR DE PRODUCTOS PARA ATHENA BRAND
 * 
 * Este archivo implementa un controlador completo para la gestión de productos en una API REST
 * para la marca ATHENA BRAND. Incluye funcionalidades para:
 * 
 * - CRUD completo de productos (crear, leer, actualizar, eliminar)
 * - Búsqueda y filtrado avanzado por categoría, precio, tallas, etc.
 * - Paginación para manejo eficiente de grandes datasets
 * - Funciones administrativas (estadísticas, operaciones en lote, exportación)
 * - Características específicas de e-commerce (productos destacados, relacionados, control de stock)
 * 
 * ADVERTENCIA: Este código contiene múltiples vulnerabilidades de seguridad críticas
 * incluyendo inyección NoSQL, exposición de datos sensibles y falta de validación de entrada.
 */

// Importación del modelo de producto desde la capa de datos
const Product = require('../models/Product');
// Middleware de validación de Express para sanitizar entrada del usuario
const { validationResult } = require('express-validator');
// Función de conexión a la base de datos MongoDB
const connectDB = require('../db');

// Clase principal del controlador que encapsula todos los métodos relacionados con productos
class ProductController {
  
  /**
   * GET /api/products - Obtener todos los productos con paginación y filtros
   * Endpoint público para listar productos con múltiples opciones de filtrado
   */
  static async getAllProducts(req, res) {
    try {
      // Extraer parámetros de paginación de la query string con valores por defecto
      const page = parseInt(req.query.page) || 1; // ⚠️ VULNERABLE: Sin validación de límites
      const limit = parseInt(req.query.limit) || 12; // ⚠️ VULNERABLE: Sin límite máximo
      // Calcular cuántos elementos saltar para la paginación
      const skip = (page - 1) * limit;
      
      // Inicializar objeto de filtros con productos activos únicamente
      const filters = { isActive: true };
      
      // ⚠️ CRÍTICO: INYECCIÓN NoSQL - Entrada sin sanitizar
      if (req.query.category) {
        filters.category = req.query.category; // Permite inyección de objetos maliciosos
      }
      
      // Filtro para productos destacados basado en parámetro booleano
      if (req.query.featured === 'true') {
        filters.isFeatured = true;
      }
      
      // Construcción de filtro complejo para rangos de precios
      if (req.query.minPrice || req.query.maxPrice) {
        // Usar $or para manejar productos con y sin descuento
        filters.$or = [
          // Filtro para productos sin precio de descuento
          {
            $and: [
              { discountPrice: { $exists: false } }, // Productos sin descuento
              // ⚠️ VULNERABLE: parseFloat sin validación puede causar NaN
              req.query.minPrice && { price: { $gte: parseFloat(req.query.minPrice) } },
              req.query.maxPrice && { price: { $lte: parseFloat(req.query.maxPrice) } }
            ].filter(Boolean) // Remover elementos falsy del array
          },
          // Filtro para productos con precio de descuento
          {
            $and: [
              { discountPrice: { $exists: true, $gt: 0 } }, // Productos con descuento válido
              req.query.minPrice && { discountPrice: { $gte: parseFloat(req.query.minPrice) } },
              req.query.maxPrice && { discountPrice: { $lte: parseFloat(req.query.maxPrice) } }
            ].filter(Boolean)
          }
        ];
      }

      // Filtro por tallas disponibles usando operador $in de MongoDB
      if (req.query.sizes) {
        // Normalizar entrada a array para manejar múltiples tallas
        const sizes = Array.isArray(req.query.sizes) ? req.query.sizes : [req.query.sizes];
        // Buscar en el subdocumento de tallas
        filters['sizes.size'] = { $in: sizes };
      }

      // Filtro por disponibilidad de stock
      if (req.query.inStock === 'true') {
        // Buscar productos con al menos una talla en stock
        filters['sizes.stock'] = { $gt: 0 };
      }
      
      // Configuración de ordenamiento basado en parámetros de query
      let sortBy = {};
      // ⚠️ VULNERABLE: Switch sin validación permite inyección de campos de ordenamiento
      switch (req.query.sort) {
        case 'price_asc':
          sortBy = { price: 1 }; // Orden ascendente por precio
          break;
        case 'price_desc':
          sortBy = { price: -1 }; // Orden descendente por precio
          break;
        case 'newest':
          sortBy = { createdAt: -1 }; // Más nuevos primero
          break;
        case 'popular':
          sortBy = { sales: -1, views: -1 }; // Ordenar por ventas y vistas
          break;
        case 'name_asc':
          sortBy = { name: 1 }; // Orden alfabético A-Z
          break;
        case 'name_desc':
          sortBy = { name: -1 }; // Orden alfabético Z-A
          break;
        default:
          sortBy = { createdAt: -1 }; // Por defecto: más recientes primero
      }
      
      // Ejecutar consulta principal con filtros, ordenamiento y paginación
      const products = await Product.find(filters)
        .sort(sortBy)
        .skip(skip) // Saltar elementos para paginación
        .limit(limit) // Limitar número de resultados
        .select('-__v'); // Excluir campo interno de versioning de MongoDB
      
      // Consulta separada para contar total de documentos que cumplen los filtros
      const total = await Product.countDocuments(filters);
      
      // Respuesta exitosa con datos y metadatos de paginación
      res.json({
        success: true,
        data: products,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit), // Calcular páginas totales
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage: page < Math.ceil(total / limit), // Boolean para navegación
          hasPrevPage: page > 1 // Boolean para navegación
        }
      });
      
    } catch (error) {
      // ⚠️ CRÍTICO: Exposición de información sensible en logs y respuesta
      console.error('Error obteniendo productos:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener productos',
        // ⚠️ VULNERABLE: Exposición de stack traces en desarrollo
        error: process.env.NODE_ENV === 'development' ? error.message : {}
      });
    }
  }

  /**
   * GET /api/products/search - Búsqueda de productos por texto
   * Implementa búsqueda de texto completo en múltiples campos
   */
  static async searchProducts(req, res) {
    try {
      // Destructuring de parámetros de búsqueda con valores por defecto
      const { q: query, category, limit = 20 } = req.query;
      
      // Validación básica de longitud mínima para evitar consultas muy ampl