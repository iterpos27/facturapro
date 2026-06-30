const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. Obtener lista de cajas (GET /api/cash-registers/list)
router.get('/list', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT c.*, s.nombre as sucursal_nombre 
      FROM cajas c
      JOIN sucursales s ON c.id_sucursal = s.id_sucursal
      WHERE c.activo = true
      ORDER BY c.nombre ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener lista de cajas:', error);
    res.status(500).json({ error: 'Error al consultar las cajas registradas.' });
  }
});

// 2. Obtener estado de sesión de caja actual de un usuario (GET /api/cash-registers/status)
router.get('/status', async (req, res) => {
  const { id_usuario } = req.query;
  try {
    let queryStr = `
      SELECT sc.*, c.nombre as caja_nombre
      FROM sesiones_caja sc
      JOIN cajas c ON sc.id_caja = c.id_caja
      WHERE sc.estado = 'ABIERTA'
    `;
    const params = [];
    if (id_usuario) {
      queryStr += ` AND sc.id_usuario = $1`;
      params.push(parseInt(id_usuario, 10));
    }
    queryStr += ` ORDER BY sc.fecha_apertura DESC LIMIT 1`;

    const result = await db.query(queryStr, params);
    if (result.rows.length === 0) {
      return res.json({ sessionActive: false });
    }
    res.json({ sessionActive: true, session: result.rows[0] });
  } catch (error) {
    console.error('Error al verificar estado de caja:', error);
    res.status(500).json({ error: 'Error al verificar estado de caja.' });
  }
});

// 3. Abrir caja (POST /api/cash-registers/open)
router.post('/open', async (req, res) => {
  const { id_caja, id_usuario, monto_apertura } = req.body;

  if (!id_caja || !id_usuario || monto_apertura === undefined) {
    return res.status(400).json({ error: 'Caja, usuario y monto de apertura son requeridos.' });
  }

  const montoNum = parseFloat(monto_apertura);
  if (isNaN(montoNum) || montoNum < 0) {
    return res.status(400).json({ error: 'El monto de apertura debe ser un número válido mayor o igual a 0.' });
  }

  try {
    // Validar si la caja ya está abierta
    const checkActive = await db.query(`
      SELECT id_sesion FROM sesiones_caja 
      WHERE id_caja = $1 AND estado = 'ABIERTA'
    `, [id_caja]);

    if (checkActive.rows.length > 0) {
      return res.status(400).json({ error: 'Esta caja ya tiene una sesión abierta activa.' });
    }

    const result = await db.query(
      `INSERT INTO sesiones_caja (id_caja, id_usuario, monto_apertura, estado)
       VALUES ($1, $2, $3, 'ABIERTA')
       RETURNING *`,
      [parseInt(id_caja, 10), parseInt(id_usuario, 10), montoNum]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al abrir caja:', error);
    res.status(500).json({ error: 'Error al abrir la sesión de caja.' });
  }
});

// 4. Cerrar caja (POST /api/cash-registers/close)
router.post('/close', async (req, res) => {
  const { id_sesion, monto_cierre } = req.body;

  if (!id_sesion || monto_cierre === undefined) {
    return res.status(400).json({ error: 'Sesión de caja y monto de cierre son obligatorios.' });
  }

  const montoNum = parseFloat(monto_cierre);
  if (isNaN(montoNum) || montoNum < 0) {
    return res.status(400).json({ error: 'El monto de cierre debe ser un número válido mayor o igual a 0.' });
  }

  try {
    const result = await db.query(
      `UPDATE sesiones_caja
       SET monto_cierre = $1, estado = 'CERRADA', fecha_cierre = CURRENT_TIMESTAMP
       WHERE id_sesion = $2 AND estado = 'ABIERTA'
       RETURNING *`,
      [montoNum, parseInt(id_sesion, 10)]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Sesión de caja no encontrada o ya cerrada.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al cerrar caja:', error);
    res.status(500).json({ error: 'Error al cerrar la sesión de caja.' });
  }
});

// 5. Obtener métodos de pago oficiales del SRI (GET /api/cash-registers/payment-methods)
router.get('/payment-methods', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM metodos_pago WHERE activo = true ORDER BY codigo_sri ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener métodos de pago:', error);
    res.status(500).json({ error: 'Error al obtener métodos de pago.' });
  }
});

module.exports = router;
