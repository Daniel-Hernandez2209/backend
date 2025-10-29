// scripts/seedCategories.js
import mongoose from 'mongoose';
import Category from '../models/category.js';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

// Datos originales de las categorías
const athenaCategories = [
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

// Función principal de migración
async function seedCategories() {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Conectado a MongoDB');

    // Opción 1: Limpiar colección existente (cuidado en producción)
    await Category.deleteMany({});
    console.log('🗑️  Categorías existentes eliminadas');

    // Opción 2: Solo insertar si no existen (para producción)
    // const existingCategories = await Category.countDocuments();
    // if (existingCategories > 0) {
    //   console.log('⚠️  Ya existen categorías en la base de datos');
    //   process.exit(0);
    // }

    // Insertar categorías
    const insertedCategories = await Category.insertMany(athenaCategories);
    console.log(`✅ ${insertedCategories.length} categorías insertadas exitosamente`);

    // Mostrar resumen
    insertedCategories.forEach(cat => {
      console.log(`  - ${cat.name} (${cat.slug}) - ${cat.subcategories.length} subcategorías`);
    });

    console.log('\n🎉 Migración completada exitosamente');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  }
}

// Ejecutar migración
seedCategories();