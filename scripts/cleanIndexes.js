// scripts/cleanIndexes.js - Limpia índices duplicados de MongoDB
// Uso: node scripts/cleanIndexes.js

import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Importar modelos para registrarlos
import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';

const connectDB = async () => {
  try {
    // Validar variables
    const requiredVars = ['MONGO_USER', 'MONGO_PASS', 'MONGO_CLUSTER', 'MONGO_DB'];
    const missing = requiredVars.filter((v) => !process.env[v]);
    if (missing.length > 0) {
      throw new Error(`❌ Faltan variables: ${missing.join(', ')}`);
    }

    const user = encodeURIComponent(process.env.MONGO_USER);
    const pass = encodeURIComponent(process.env.MONGO_PASS);
    const cluster = process.env.MONGO_CLUSTER;
    const db = process.env.MONGO_DB;

    const uri = `mongodb+srv://${user}:${pass}@${cluster}/${db}?retryWrites=true&w=majority&appName=Cluster0`;

    await mongoose.connect(uri, {
      maxPoolSize: 5,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 10000,
    });

    console.log('✅ Conectado a MongoDB');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    process.exit(1);
  }
};

const cleanIndexes = async () => {
  try {
    console.log('🔄 Limpiando índices duplicados...\n');

    const models = Object.values(mongoose.modelNames()).map(name => mongoose.model(name));

    for (const model of models) {
      try {
        const collectionName = model.collection.name;
        console.log(`📋 Procesando colección: ${collectionName}`);

        // Obtener índices actuales
        const indexInfo = await model.collection.getIndexes();
        console.log(`   Índices encontrados:`, Object.keys(indexInfo));

        // Eliminar todos excepto _id_
        for (const indexKey in indexInfo) {
          if (indexKey !== '_id_') {
            try {
              await model.collection.dropIndex(indexKey);
              console.log(`   ✅ Índice eliminado: ${indexKey}`);
            } catch (err) {
              console.log(`   ⚠️  No se pudo eliminar ${indexKey}:`, err.message);
            }
          }
        }

        // Recrear índices desde el esquema
        await model.collection.createIndexes();
        console.log(`   ✅ Índices recreados desde esquema\n`);
      } catch (err) {
        console.error(`   ❌ Error en ${model.modelName}:`, err.message);
      }
    }

    console.log('✅ Limpieza de índices completada');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
    process.exit(0);
  }
};

// Ejecutar
(async () => {
  await connectDB();
  await cleanIndexes();
})();
