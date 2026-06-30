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
const { router: authRoutes, authenticateToken } = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const userRoutes = require('./routes/users');
const companyRoutes = require('./routes/company');
const branchRoutes = require('./routes/branches');
const supplierRoutes = require('./routes/suppliers');
const inventoryRoutes = require('./routes/inventory');
const cashRegisterRoutes = require('./routes/cash_registers');
const invoiceRoutes = require('./routes/invoices');

app.use('/api/auth', authRoutes);
app.use('/api/clients', authenticateToken, clientRoutes);
app.use('/api/products', authenticateToken, productRoutes);
app.use('/api/categories', authenticateToken, categoryRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/company', authenticateToken, companyRoutes);
app.use('/api/branches', authenticateToken, branchRoutes);
app.use('/api/suppliers', authenticateToken, supplierRoutes);
app.use('/api/inventory', authenticateToken, inventoryRoutes);
app.use('/api/cash-registers', authenticateToken, cashRegisterRoutes);
app.use('/api/invoices', authenticateToken, invoiceRoutes);


// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Ocurrió un error en el servidor.' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
