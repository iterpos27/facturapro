const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const logger = require('./utils/logger');

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-only-facturapro-secret')) {
  logger.fatal('FATAL: Se debe configurar JWT_SECRET con un valor seguro en entornos de producción.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;
const corsOrigin = process.env.CORS_ORIGIN;

app.disable('x-powered-by');

// Rate limiting global para todas las rutas API
// El login tiene su propio limitador más estricto (5 req / 15 min en auth.js)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300,                  // 300 requests por ventana por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiadas solicitudes desde esta IP. Por favor, intente de nuevo en 15 minutos.',
  },
  skip: (req) => req.path === '/health', // no limitar el health check
});

// Middleware de seguridad — helmet añade cabeceras HTTP defensivas (CSP, HSTS, X-Frame-Options, etc.)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // permite servir uploads al frontend
}));
app.use(cors(corsOrigin ? { origin: corsOrigin.split(',').map((origin) => origin.trim()) } : undefined));
app.use(express.json());
app.use('/uploads', express.static(path.resolve(__dirname, 'uploads')));
app.use('/api', apiLimiter);

// Rutas de sistema
app.get('/', (_req, res) => {
  res.json({ message: 'API de Facturapro funcionando' });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Registrar rutas
const { router: authRoutes, authenticateToken, authorizePermissions } = require('./routes/auth');
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
const rideRoutes = require('./routes/rides');
const bankRoutes = require('./routes/banks');

app.use('/api/auth', authRoutes);
app.use('/api/clients', authenticateToken, authorizePermissions('CLIENTS_CRUD'), clientRoutes);
app.use('/api/products', authenticateToken, authorizePermissions('PRODUCTS_CRUD'), productRoutes);
app.use('/api/categories', authenticateToken, authorizePermissions('CATEGORIES_CRUD'), categoryRoutes);
app.use('/api/users', authenticateToken, authorizePermissions('USERS_CRUD', 'ROLES_CRUD'), userRoutes);
app.use('/api/company', authenticateToken, authorizePermissions('COMPANY_UPDATE'), companyRoutes);
app.use('/api/branches', authenticateToken, authorizePermissions('BRANCHES_CRUD'), branchRoutes);
app.use('/api/suppliers', authenticateToken, authorizePermissions('SUPPLIERS_CRUD'), supplierRoutes);
app.use('/api/inventory', authenticateToken, authorizePermissions('INVENTORY_READ'), inventoryRoutes);
app.use('/api/cash-registers', authenticateToken, authorizePermissions('CASH_REGISTER_CRUD'), cashRegisterRoutes);
app.use('/api/invoices', authenticateToken, authorizePermissions('INVOICES_CRUD', 'RECEIVABLES_CRUD'), invoiceRoutes);
app.use('/api/proformas', authenticateToken, authorizePermissions('PROFORMAS_CRUD'), proformaRoutes);
app.use('/api/sequentials', authenticateToken, authorizePermissions('SEQUENTIALS_UPDATE'), sequentialRoutes);
app.use('/api/reports', authenticateToken, authorizePermissions('REPORTS_READ'), reportRoutes);
app.use('/api/banks', authenticateToken, authorizePermissions('BANKS_CRUD'), bankRoutes);
app.use('/api/audit', authenticateToken, authorizePermissions('AUDIT_READ'), auditRoutes);
app.use('/api/sri', authenticateToken, authorizePermissions('SRI_ELECTRONIC_BILLING'), sriRoutes);
app.use('/api/rides', authenticateToken, authorizePermissions('PROFORMAS_CRUD', 'INVOICES_CRUD', 'CREDIT_NOTES_CRUD', 'WITHHOLDINGS_CRUD'), rideRoutes);
app.use('/api/purchases', authenticateToken, authorizePermissions('PURCHASES_CRUD'), purchaseRoutes);
app.use('/api/credit-notes', authenticateToken, authorizePermissions('CREDIT_NOTES_CRUD'), creditNotesRoutes);
app.use('/api/withholdings', authenticateToken, authorizePermissions('WITHHOLDINGS_CRUD'), withholdingsRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: `Ruta API no encontrada: ${req.method} ${req.originalUrl}` });
});

// Manejo de errores global
app.use((err, req, res, _next) => {
  logger.error({ err, method: req.method, url: req.originalUrl }, 'Unhandled error');
  res.status(500).json({ error: 'Ocurrió un error en el servidor.' });
});

app.listen(PORT, () => {
  logger.info(`Servidor corriendo en http://localhost:${PORT}`);
  require('./services/sri_auto_dispatch').startSriDispatchWorker();
});
