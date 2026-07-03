const express = require('express');
const cors = require('cors');
require('dotenv').config();

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-only-facturapro-secret')) {
  console.error('FATAL: Se debe configurar JWT_SECRET con un valor seguro en entornos de producción.');
  process.exit(1);
}

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
const { router: authRoutes, authenticateToken, authorizeRoles } = require('./routes/auth');
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
const proformaRoutes = require('./routes/proformas');
const sequentialRoutes = require('./routes/sequentials');
const reportRoutes = require('./routes/reports');
const purchaseRoutes = require('./routes/purchases');
const creditNotesRoutes = require('./routes/credit_notes');
const withholdingsRoutes = require('./routes/withholdings');
const auditRoutes = require('./routes/audit');
const sriRoutes = require('./routes/sri');

app.use('/api/auth', authRoutes);
app.use('/api/clients', authenticateToken, clientRoutes);
app.use('/api/products', authenticateToken, productRoutes);
app.use('/api/categories', authenticateToken, categoryRoutes);
app.use('/api/users', authenticateToken, authorizeRoles('ADMINISTRADOR'), userRoutes);
app.use('/api/company', authenticateToken, companyRoutes);
app.use('/api/branches', authenticateToken, branchRoutes);
app.use('/api/suppliers', authenticateToken, supplierRoutes);
app.use('/api/inventory', authenticateToken, inventoryRoutes);
app.use('/api/cash-registers', authenticateToken, cashRegisterRoutes);
app.use('/api/invoices', authenticateToken, invoiceRoutes);
app.use('/api/proformas', authenticateToken, proformaRoutes);
app.use('/api/sequentials', authenticateToken, authorizeRoles('ADMINISTRADOR'), sequentialRoutes);
app.use('/api/reports', authenticateToken, authorizeRoles('ADMINISTRADOR', 'CONTADOR'), reportRoutes);
app.use('/api/audit', authenticateToken, authorizeRoles('ADMINISTRADOR', 'CONTADOR'), auditRoutes);
app.use('/api/sri', authenticateToken, authorizeRoles('ADMINISTRADOR', 'CONTADOR'), sriRoutes);
app.use('/api/purchases', authenticateToken, authorizeRoles('ADMINISTRADOR', 'CONTADOR'), purchaseRoutes);
app.use('/api/credit-notes', authenticateToken, authorizeRoles('ADMINISTRADOR', 'CONTADOR'), creditNotesRoutes);
app.use('/api/withholdings', authenticateToken, authorizeRoles('ADMINISTRADOR', 'CONTADOR'), withholdingsRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: `Ruta API no encontrada: ${req.method} ${req.originalUrl}` });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Ocurrió un error en el servidor.' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
