// scripts/seedData.js - Datos de prueba para ATHENA BRAND
import mongoose from 'mongoose';
import dotenv from 'dotenv';  
import bcrypt from 'bcryptjs'; 
import Product from '../models/Product.js';
import User from '../models/User.js';
import slugify from 'slugify';
dotenv.config({ path: '../.env' });


// Configuración de slugify
const slugConfig = {
  lower: true,
  strict: true,
  locale: 'es'
};

// Conectar a MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/athena_brand')
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch(err => console.error('❌ Error conectando:', err));

// Datos de productos para ATHENA BRAND
const athenaProducts = [
  // HOMBRE
  {
    name: 'Hoodie Athena Classic Negro',
    description: 'Sudadera con capucha de algodón premium. Diseño minimalista con logo bordado. Perfecto para el streetwear urbano.',
    price: 89000,
    discountPrice: 71200,
    category: 'hoodies-sacos',
    subcategory: 'sudaderas',
    images: [
      { url: '/uploads/products/hoodie-black-1.jpg', isPrimary: true, alt: 'Hoodie Athena Negro' },
      { url: '/uploads/products/hoodie-black-2.jpg', alt: 'Hoodie Athena Negro - Detalle' }
    ],
    sizes: [
      { size: 'S', stock: 15 },
      { size: 'M', stock: 20 },
      { size: 'L', stock: 18 },
      { size: 'XL', stock: 12 }
    ],
    colors: [{ name: 'Negro', hex: '#000000' }],
    tags: ['hoodie', 'streetwear', 'casual', 'algodón'],
    material: '80% Algodón, 20% Poliéster',
    isFeatured: true,
    isActive: true
  },
  
  {
    name: 'Camiseta Athena Logo Blanca',
    description: 'Camiseta básica de algodón 100% con logo de Athena Brand. Corte regular, perfecta para el día a día.',
    price: 45000,
    discountPrice: 36000,
    category: 'hombre',
    subcategory: 'camisetas',
    images: [
      { url: '/uploads/products/tshirt-white-1.jpg', isPrimary: true, alt: 'Camiseta Athena Blanca' },
      { url: '/uploads/products/tshirt-white-2.jpg', alt: 'Camiseta Athena Blanca - Logo' }
    ],
    sizes: [
      { size: 'XS', stock: 8 },
      { size: 'S', stock: 25 },
      { size: 'M', stock: 30 },
      { size: 'L', stock: 25 },
      { size: 'XL', stock: 15 }
    ],
    colors: [{ name: 'Blanco', hex: '#FFFFFF' }],
    tags: ['camiseta', 'básico', 'algodón', 'logo'],
    material: '100% Algodón Peinado',
    isFeatured: true,
    isActive: true
  },

  {
    name: 'Jean Athena Slim Fit',
    description: 'Jean de corte slim con lavado moderno. Confección premium con detalles únicos de la marca.',
    price: 120000,
    category: 'hombre',
    subcategory: 'pantalones',
    images: [
      { url: '/uploads/products/jean-slim-1.jpg', isPrimary: true, alt: 'Jean Athena Slim' },
      { url: '/uploads/products/jean-slim-2.jpg', alt: 'Jean Athena Slim - Detalle' }
    ],
    sizes: [
      { size: 'S', stock: 10 },
      { size: 'M', stock: 15 },
      { size: 'L', stock: 12 },
      { size: 'XL', stock: 8 }
    ],
    colors: [{ name: 'Azul Oscuro', hex: '#1e3a8a' }],
    tags: ['jean', 'denim', 'slim', 'casual'],
    material: '98% Algodón, 2% Elastano',
    isFeatured: false,
    isActive: true
  },

  // MUJER
  {
    name: 'Crop Top Athena Essential',
    description: 'Top corto de algodón suave con logo bordado. Ideal para combinar con jeans o shorts.',
    price: 38000,
    discountPrice: 30400,
    category: 'mujer',
    subcategory: 'camisetas',
    images: [
      { url: '/uploads/products/crop-top-1.jpg', isPrimary: true, alt: 'Crop Top Athena' },
      { url: '/uploads/products/crop-top-2.jpg', alt: 'Crop Top Athena - Fit' }
    ],
    sizes: [
      { size: 'XS', stock: 12 },
      { size: 'S', stock: 18 },
      { size: 'M', stock: 20 },
      { size: 'L', stock: 15 }
    ],
    colors: [
      { name: 'Rosa', hex: '#ec4899' },
      { name: 'Blanco', hex: '#ffffff' }
    ],
    tags: ['crop', 'femenino', 'básico', 'algodón'],
    material: '95% Algodón, 5% Elastano',
    isFeatured: true,
    isActive: true
  },

  {
    name: 'Hoodie Oversized Mujer Beige',
    description: 'Sudadera oversize de máxima comodidad. Diseño contemporáneo con acabados premium.',
    price: 95000,
    category: 'hoodies-sacos',
    subcategory: 'sudaderas',
    images: [
      { url: '/uploads/products/hoodie-oversized-beige-1.jpg', isPrimary: true, alt: 'Hoodie Oversized Beige' },
      { url: '/uploads/products/hoodie-oversized-beige-2.jpg', alt: 'Hoodie Oversized - Modelo' }
    ],
    sizes: [
      { size: 'S', stock: 8 },
      { size: 'M', stock: 12 },
      { size: 'L', stock: 10 },
      { size: 'XL', stock: 6 }
    ],
    colors: [{ name: 'Beige', hex: '#f5f5dc' }],
    tags: ['hoodie', 'oversized', 'comodidad', 'mujer'],
    material: '85% Algodón, 15% Poliéster',
    isFeatured: false,
    isActive: true
  },

  // DEPORTIVOS
  {
    name: 'Set Deportivo Athena Performance',
    description: 'Conjunto deportivo de alto rendimiento. Tela que absorbe la humedad y permite libertad de movimiento.',
    price: 110000,
    discountPrice: 88000,
    category: 'deportivos',
    subcategory: 'conjuntos',
    images: [
      { url: '/uploads/products/set-deportivo-1.jpg', isPrimary: true, alt: 'Set Deportivo Athena' },
      { url: '/uploads/products/set-deportivo-2.jpg', alt: 'Set Deportivo - Acción' }
    ],
    sizes: [
      { size: 'XS', stock: 5 },
      { size: 'S', stock: 10 },
      { size: 'M', stock: 15 },
      { size: 'L', stock: 12 },
      { size: 'XL', stock: 8 }
    ],
    colors: [
      { name: 'Negro/Gris', hex: '#404040' },
      { name: 'Azul/Navy', hex: '#1e40af' }
    ],
    tags: ['deportivo', 'performance', 'conjunto', 'fitness'],
    material: '88% Poliéster Reciclado, 12% Elastano',
    isFeatured: true,
    isActive: true
  },

  {
    name: 'Leggings Athena Fit',
    description: 'Mallas deportivas de compresión media con cintura alta. Perfectas para yoga, gym y running.',
    price: 65000,
    category: 'deportivos',
    subcategory: 'pantalones',
    images: [
      { url: '/uploads/products/leggings-1.jpg', isPrimary: true, alt: 'Leggings Athena' },
      { url: '/uploads/products/leggings-2.jpg', alt: 'Leggings - Flexibilidad' }
    ],
    sizes: [
      { size: 'XS', stock: 8 },
      { size: 'S', stock: 15 },
      { size: 'M', stock: 18 },
      { size: 'L', stock: 12 },
      { size: 'XL', stock: 7 }
    ],
    colors: [
      { name: 'Negro', hex: '#000000' },
      { name: 'Gris', hex: '#6b7280' }
    ],
    tags: ['leggings', 'yoga', 'fitness', 'compresión'],
    material: '84% Nylon, 16% Elastano',
    isFeatured: false,
    isActive: true
  },

  // CHAQUETAS
  {
    name: 'Chaqueta Athena Urban',
    description: 'Chaqueta cortavientos urbana con capucha removible. Resistente al agua y perfecta para el clima bogotano.',
    price: 150000,
    discountPrice: 120000,
    category: 'chaquetas',
    subcategory: 'cortavientos',
    images: [
      { url: '/uploads/products/chaqueta-urban-1.jpg', isPrimary: true, alt: 'Chaqueta Urban' },
      { url: '/uploads/products/chaqueta-urban-2.jpg', alt: 'Chaqueta Urban - Detalle' }
    ],
    sizes: [
      { size: 'S', stock: 6 },
      { size: 'M', stock: 8 },
      { size: 'L', stock: 7 },
      { size: 'XL', stock: 5 }
    ],
    colors: [
      { name: 'Negro', hex: '#000000' },
      { name: 'Verde Militar', hex: '#4a5d23' }
    ],
    tags: ['chaqueta', 'urbana', 'cortavientos', 'capucha'],
    material: '100% Nylon con recubrimiento PU',
    isFeatured: true,
    isActive: true
  }
];

// Usuarios de prueba
const testUsers = [
  {
    email: 'admin@athenabrand.co',
    password: 'admin123',
    firstName: 'Admin',
    lastName: 'Athena',
    role: 'admin',
    isActive: true,
    isVerified: true,
    phone: '+573001234567',
    address: {
      street: 'Calle Principal 123',
      city: 'San Pedro',
      department: 'Antioquia',
      zipCode: '055020',
      country: 'Colombia'
    }
  },
  {
    email: 'cliente@test.com',
    password: 'cliente123',
    firstName: 'Juan',
    lastName: 'Pérez',
    role: 'customer',
    isActive: true,
    isVerified: true,
    phone: '+573009876543',
    address: {
      street: 'Carrera 45 #67-89',
      city: 'Medellín',
      department: 'Antioquia',
      zipCode: '050010',
      country: 'Colombia'
    },
    preferences: {
      newsletter: true,
      favoriteCategories: ['hombre', 'deportivos'],
      size: 'L'
    }
  },
  {
    email: 'maria@test.com',
    password: 'maria123',
    firstName: 'María',
    lastName: 'González',
    role: 'customer',
    isActive: true,
    isVerified: true,
    phone: '+573011234567',
    address: {
      street: 'Avenida 80 #45-67',
      city: 'Bogotá',
      department: 'Cundinamarca',
      zipCode: '110111',
      country: 'Colombia'
    },
    preferences: {
      newsletter: true,
      favoriteCategories: ['mujer', 'hoodies-sacos'],
      size: 'M'
    }
  }
];

// Función para limpiar y poblar la base de datos
async function seedDatabase() {
  try {
    console.log('🧹 Limpiando base de datos...');
    
    // Limpiar colecciones existentes
    await Product.deleteMany({});
    await User.deleteMany({});
    
    console.log('👤 Creando usuarios de prueba...');
    
    // Crear usuarios
    for (let userData of testUsers) {
      const user = new User(userData);
      await user.save();
      console.log(`✅ Usuario creado: ${user.email}`);
    }
    
    console.log('🛍️ Creando productos ATHENA BRAND...');
    
    // Crear productos
    for (let productData of athenaProducts) {
      // Generar slug
      productData.slug = slugify(productData.name, slugConfig);
      
      // Generar SKU si no existe
      if (!productData.sku) {
        const categoryCode = productData.category.substring(0, 3).toUpperCase();
        const timestamp = Date.now().toString().slice(-4);
        productData.sku = `ATH-${categoryCode}-${timestamp}`;
      }
      
      const product = new Product(productData);
      await product.save();
      console.log(`✅ Producto creado: ${product.name} (${product.sku})`);
    }
    
    console.log('🎉 ¡Base de datos poblada exitosamente!');
    console.log('\n📊 Resumen:');
    console.log(`- ${testUsers.length} usuarios creados`);
    console.log(`- ${athenaProducts.length} productos creados`);
    
    console.log('\n👥 Usuarios de prueba:');
    console.log('📧 Admin: admin@athenabrand.co | 🔑 Contraseña: admin123');
    console.log('📧 Cliente: cliente@test.com | 🔑 Contraseña: cliente123');
    console.log('📧 Cliente: maria@test.com | 🔑 Contraseña: maria123');
    
    console.log('\n🏛️ ATHENA BRAND - MENOS RUIDO MAS ESENCIA');
    console.log('📍 San Pedro, Antioquia - Colombia');
    
  } catch (error) {
    console.error('❌ Error poblando la base de datos:', error);
  } finally {
    // Cerrar conexión
    await mongoose.connection.close();
    console.log('🔌 Conexión cerrada');
    process.exit(0);
  }
}

// Función para agregar más productos (opcional)
async function addMoreProducts() {
  const additionalProducts = [
    {
      name: 'Sudadera Athena Vintage',
      description: 'Sudadera de algodón con efecto vintage y logo retro bordado.',
      price: 78000,
      discountPrice: 62400,
      category: 'hoodies-sacos',
      subcategory: 'sudaderas',
      images: [
        { url: '/uploads/products/sudadera-vintage-1.jpg', isPrimary: true },
        { url: '/uploads/products/sudadera-vintage-2.jpg' }
      ],
      sizes: [
        { size: 'S', stock: 12 },
        { size: 'M', stock: 16 },
        { size: 'L', stock: 14 },
        { size: 'XL', stock: 8 }
      ],
      colors: [{ name: 'Gris Vintage', hex: '#9ca3af' }],
      tags: ['sudadera', 'vintage', 'retro', 'streetwear'],
      material: '90% Algodón, 10% Poliéster',
      isFeatured: false,
      isActive: true
    },
    {
      name: 'Short Athena Summer',
      description: 'Short deportivo de secado rápido con bolsillos funcionales.',
      price: 52000,
      category: 'deportivos',
      subcategory: 'shorts',
      images: [
        { url: '/uploads/products/short-summer-1.jpg', isPrimary: true },
        { url: '/uploads/products/short-summer-2.jpg' }
      ],
      sizes: [
        { size: 'XS', stock: 6 },
        { size: 'S', stock: 12 },
        { size: 'M', stock: 15 },
        { size: 'L', stock: 10 },
        { size: 'XL', stock: 5 }
      ],
      colors: [
        { name: 'Negro', hex: '#000000' },
        { name: 'Azul Navy', hex: '#1e3a8a' }
      ],
      tags: ['short', 'deportivo', 'verano', 'secado-rapido'],
      material: '100% Poliéster con tecnología Dri-FIT',
      isFeatured: false,
      isActive: true
    },
    {
      name: 'Gorra Athena Snapback',
      description: 'Gorra snapback con bordado 3D del logo. Visera plana y ajuste perfecto.',
      price: 35000,
      discountPrice: 28000,
      category: 'hombre',
      subcategory: 'accesorios',
      images: [
        { url: '/uploads/products/gorra-snapback-1.jpg', isPrimary: true },
        { url: '/uploads/products/gorra-snapback-2.jpg' }
      ],
      sizes: [
        { size: 'M', stock: 25 },
        { size: 'L', stock: 20 }
      ],
      colors: [
        { name: 'Negro/Blanco', hex: '#000000' },
        { name: 'Azul/Blanco', hex: '#1d4ed8' }
      ],
      tags: ['gorra', 'snapback', 'accesorio', 'streetwear'],
      material: '80% Lana, 20% Acrílico',
      isFeatured: true,
      isActive: true
    }
  ];

  for (let productData of additionalProducts) {
    productData.slug = slugify(productData.name, slugConfig);
    const categoryCode = productData.category.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-4);
    productData.sku = `ATH-${categoryCode}-${timestamp}`;
    
    const product = new Product(productData);
    await product.save();
    console.log(`✅ Producto adicional creado: ${product.name}`);
  }
}

// Función para crear datos de desarrollo específicos
async function seedDevelopment() {
  try {
    await seedDatabase();
    
    console.log('\n🔧 Agregando datos adicionales para desarrollo...');
    await addMoreProducts();
    
    // Actualizar algunos productos como destacados
    await Product.updateMany(
      { name: { $regex: /Hoodie|Camiseta|Set Deportivo|Chaqueta|Gorra/, $options: 'i' } },
      { isFeatured: true }
    );
    
    console.log('✅ Productos destacados actualizados');
    
    // Simular algunas ventas
    await Product.updateMany(
      { isFeatured: true },
      { $inc: { sales: Math.floor(Math.random() * 50) + 10, views: Math.floor(Math.random() * 200) + 50 } }
    );
    
    console.log('✅ Estadísticas simuladas agregadas');
    
  } catch (error) {
    console.error('❌ Error en desarrollo:', error);
  }
}

// Verificar argumentos de línea de comandos
const args = process.argv.slice(2);

if (args.includes('--dev')) {
  seedDevelopment();
} else if (args.includes('--products-only')) {
  // Solo productos
  Product.deleteMany({})
    .then(() => {
      console.log('🧹 Productos eliminados');
      return athenaProducts.forEach(async (productData) => {
        productData.slug = slugify(productData.name, slugConfig);
        const product = new Product(productData);
        await product.save();
        console.log(`✅ ${product.name}`);
      });
    })
    .then(() => {
      console.log('✅ Solo productos creados');
      mongoose.connection.close();
    });
} else {
  // Seed básico
  seedDatabase();
}

export default {
  athenaProducts,
  testUsers,
  seedDatabase,
  addMoreProducts
};