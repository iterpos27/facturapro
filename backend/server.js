const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const corsOrigin = process.env.CORS_ORIGIN;

app.disable('x-powered-by');

// Middleware
app.use(cors(corsOrigin ? { origin: corsOrigin.split(',').map((origin) => origin.trim()) } : undefined));
app.use(express.json());

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ message: 'API de Facturapro funcionando' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Registrar rutas
const clientRoutes = require('./routes/clients');
app.use('/api/clients', clientRoutes);

const productRoutes = require('./routes/products');
app.use('/api/products', productRoutes);

const categoryRoutes = require('./routes/categories');
app.use('/api/categories', categoryRoutes);

const authRoutes = require('./routes/auth').router;
app.use('/api/auth', authRoutes);

const userRoutes = require('./routes/users');
app.use('/api/users', userRoutes);

const companyRoutes = require('./routes/company');
app.use('/api/company', companyRoutes);

const branchRoutes = require('./routes/branches');
app.use('/api/branches', branchRoutes);

const supplierRoutes = require('./routes/suppliers');
app.use('/api/suppliers', supplierRoutes);

const inventoryRoutes = require('./routes/inventory');
app.use('/api/inventory', inventoryRoutes);

const cashRegisterRoutes = require('./routes/cash_registers');
app.use('/api/cash-registers', cashRegisterRoutes);

const invoiceRoutes = require('./routes/invoices');
app.use('/api/invoices', invoiceRoutes);


// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Ocurrió un error en el servidor.' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
