const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-facturapro-secret';

// Limitador de intentos de login en memoria para evitar ataques de fuerza bruta
const rateLimitWindow = 15 * 60 * 1000; // 15 minutos
const maxLoginAttempts = 5;
const loginAttempts = new Map();

const ROLE_PERMISSION_FALLBACK = {
  ADMINISTRADOR: [
    'DASHBOARD_READ',
    'USERS_CRUD',
    'ROLES_CRUD',
    'COMPANY_UPDATE',
    'BRANCHES_CRUD',
    'SEQUENTIALS_UPDATE',
    'CLIENTS_CRUD',
    'SUPPLIERS_CRUD',
    'PRODUCTS_CRUD',
    'CATEGORIES_CRUD',
    'INVENTORY_READ',
    'PURCHASES_CRUD',
    'PROFORMAS_CRUD',
    'INVOICES_CRUD',
    'RECEIVABLES_CRUD',
    'CREDIT_NOTES_CRUD',
    'WITHHOLDINGS_CRUD',
    'REPORTS_READ',
    'CASH_REGISTER_CRUD',
    'AUDIT_READ',
    'SRI_ELECTRONIC_BILLING',
  ],
  VENDEDOR: [
    'DASHBOARD_READ',
    'CLIENTS_CRUD',
    'PRODUCTS_CRUD',
    'PROFORMAS_CRUD',
    'INVOICES_CRUD',
    'RECEIVABLES_CRUD',
    'CASH_REGISTER_CRUD',
  ],
  CONTADOR: [
    'DASHBOARD_READ',
    'CLIENTS_CRUD',
    'SUPPLIERS_CRUD',
    'PRODUCTS_CRUD',
    'CATEGORIES_CRUD',
    'INVENTORY_READ',
    'PURCHASES_CRUD',
    'PROFORMAS_CRUD',
    'INVOICES_CRUD',
    'RECEIVABLES_CRUD',
    'CREDIT_NOTES_CRUD',
    'WITHHOLDINGS_CRUD',
    'REPORTS_READ',
    'AUDIT_READ',
    'SRI_ELECTRONIC_BILLING',
  ],
};

async function getUserPermissions(idRol) {
  const result = await db.query(`
    SELECT r.nombre AS rol_nombre, p.nombre AS permiso_nombre
    FROM roles r
    LEFT JOIN roles_permisos rp ON r.id_rol = rp.id_rol
    LEFT JOIN permisos p ON rp.id_permiso = p.id_permiso
    WHERE r.id_rol = $1
    ORDER BY p.nombre ASC
  `, [idRol]);

  const roleName = result.rows[0]?.rol_nombre;
  const permissions = result.rows.map((row) => row.permiso_nombre).filter(Boolean);
  return permissions.length > 0 ? permissions : (ROLE_PERMISSION_FALLBACK[roleName] || []);
}

const loginLimiter = (req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
  const now = Date.now();

  if (!loginAttempts.has(ip)) {
    loginAttempts.set(ip, { count: 1, resetTime: now + rateLimitWindow });
    return next();
  }

  const attempt = loginAttempts.get(ip);
  if (now > attempt.resetTime) {
    loginAttempts.set(ip, { count: 1, resetTime: now + rateLimitWindow });
    return next();
  }

  attempt.count += 1;
  if (attempt.count > maxLoginAttempts) {
    const minutesLeft = Math.ceil((attempt.resetTime - now) / 60000);
    return res.status(429).json({
      error: `Demasiados intentos fallidos de inicio de sesión. Por favor, intente de nuevo en ${minutesLeft} minutos.`
    });
  }

  next();
};

// 1. Iniciar Sesión (POST /api/auth/login)
router.post('/login', loginLimiter, async (req, res) => {
  const { usernameOrEmail, password } = req.body || {};

  if (!usernameOrEmail || !password) {
    return res.status(400).json({ error: 'Usuario o correo y contraseña son requeridos.' });
  }

  try {
    // Buscar usuario por username o email, incluyendo el nombre del rol
    const queryStr = `
      SELECT u.*, r.nombre as rol_nombre 
      FROM usuarios u
      JOIN roles r ON u.id_rol = r.id_rol
      WHERE (u.username = $1 OR u.email = $1) AND u.activo = true
    `;
    const result = await db.query(queryStr, [usernameOrEmail]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas o usuario inactivo.' });
    }

    const user = result.rows[0];
    const permissions = await getUserPermissions(user.id_rol);

    // Verificar contraseña
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // Firmar token JWT
    const token = jwt.sign(
      { 
        id_usuario: user.id_usuario, 
        username: user.username, 
        email: user.email, 
        id_rol: user.id_rol,
        rol_nombre: user.rol_nombre,
        permissions
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id_usuario: user.id_usuario,
        username: user.username,
        email: user.email,
        id_rol: user.id_rol,
        rol_nombre: user.rol_nombre,
        permissions
      }
    });

  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    res.status(500).json({ error: 'Error del servidor al procesar la solicitud.' });
  }
});

// Middleware de verificación de JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Acceso denegado. Token no provisto.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido o expirado.' });
    req.user = user;
    next();
  });
};

// Middleware para restringir accesos según el rol
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autorizado. Falta autenticación.' });
    }
    if (!allowedRoles.includes(req.user.rol_nombre)) {
      return res.status(403).json({ error: 'Acceso denegado. No tienes permisos para esta acción.' });
    }
    next();
  };
};

const authorizePermissions = (...allowedPermissions) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autorizado. Falta autenticacion.' });
    }

    if (req.user.rol_nombre === 'ADMINISTRADOR') {
      return next();
    }

    try {
      const permissions = await getUserPermissions(req.user.id_rol);
      const allowed = allowedPermissions.some((permission) => permissions.includes(permission));
      if (!allowed) {
        return res.status(403).json({ error: 'Acceso denegado. No tienes permisos para esta accion.' });
      }
      next();
    } catch (error) {
      console.error('Error al validar permisos:', error);
      res.status(500).json({ error: 'Error al validar permisos del usuario.' });
    }
  };
};

// 2. Obtener datos del usuario actual (GET /api/auth/me)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const permissions = await getUserPermissions(req.user.id_rol);
    res.json({ user: { ...req.user, permissions } });
  } catch (error) {
    console.error('Error al consultar permisos del usuario:', error);
    res.json({ user: req.user });
  }
});

module.exports = {
  router,
  authenticateToken,
  authorizeRoles,
  authorizePermissions,
};
