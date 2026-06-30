const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-facturapro-secret';

// 1. Iniciar Sesión (POST /api/auth/login)
router.post('/login', async (req, res) => {
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
        rol_nombre: user.rol_nombre
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
        rol_nombre: user.rol_nombre
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

// 2. Obtener datos del usuario actual (GET /api/auth/me)
router.get('/me', authenticateToken, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = {
  router,
  authenticateToken
};
