// index.js
const app = require('./server');
const connectDB = require('./db');

// Conectar a Mongo una vez antes de exportar
connectDB();

module.exports = app;
