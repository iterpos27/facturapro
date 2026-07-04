const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('./auth');

// Proteger todas las rutas de auditoría con autenticación y autorización
router.use(authenticateToken);

router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '80', 10), 200);
  const entity = String(req.query.entity || '').trim();

  try {
    const params = [];
    let where = '';
    if (entity) {
      params.push(entity);
      where = 'WHERE ae.entidad = $1';
    }
    params.push(limit);

    const result = await db.query(`
      SELECT ae.id_auditoria, ae.entidad, ae.entidad_id, ae.accion, ae.detalle, ae.created_at,
             u.username
      FROM auditoria_eventos ae
      LEFT JOIN usuarios u ON ae.id_usuario = u.id_usuario
      ${where}
      ORDER BY ae.created_at DESC
      LIMIT $${params.length}
    `, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Error al consultar auditoria:', error);
    res.status(500).json({ error: 'Error al consultar auditoria.' });
  }
});

module.exports = router;
