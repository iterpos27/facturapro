const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('./auth');

// Proteger todas las rutas de caja con autenticación
router.use(authenticateToken);

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
    const session = result.rows[0];
    const summary = await getCashSessionSummary(session.id_sesion, session.id_usuario, session.fecha_apertura);
    res.json({ sessionActive: true, session: { ...session, summary } });
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

async function getCashSessionSummary(idSesion, idUsuario, fechaApertura, client = db) {
  const invoiceRes = await client.query(`
    SELECT COUNT(*)::int AS facturas,
           COALESCE(SUM(total), 0) AS total_facturado,
           COALESCE(SUM(monto_pago), 0) AS pagos_factura,
           COALESCE(SUM(anticipo), 0) AS anticipos,
           COALESCE(SUM(cambio), 0) AS cambios
    FROM facturas
    WHERE id_sesion_caja = $1 AND estado = 'EMITIDA'
  `, [idSesion]);

  const paymentBreakdown = await client.query(`
    SELECT COALESCE(mp.nombre, 'Sin metodo') AS metodo_pago,
           COALESCE(SUM(fp.monto), 0) AS total
    FROM factura_pagos fp
    JOIN facturas f ON fp.id_factura = f.id_factura
    LEFT JOIN metodos_pago mp ON fp.id_metodo_pago = mp.id_metodo
    WHERE f.id_sesion_caja = $1 AND f.estado = 'EMITIDA'
    GROUP BY mp.nombre
    ORDER BY total DESC
  `, [idSesion]).catch((error) => {
    if (error.code === '42P01') return { rows: [] };
    throw error;
  });

  const receivablePayments = await client.query(`
    SELECT COALESCE(SUM(fc.monto), 0) AS total
    FROM factura_cobros fc
    WHERE fc.id_usuario = $1 AND fc.fecha_cobro >= $2
  `, [idUsuario, fechaApertura]).catch((error) => {
    if (error.code === '42P01') return { rows: [{ total: 0 }] };
    throw error;
  });

  const invoices = invoiceRes.rows[0] || {};
  const pagosFactura = Number(invoices.pagos_factura || 0);
  const anticipos = Number(invoices.anticipos || 0);
  const cambios = Number(invoices.cambios || 0);
  const cobrosCxc = Number(receivablePayments.rows[0]?.total || 0);
  const ingresosCaja = Math.max(pagosFactura + anticipos + cobrosCxc - cambios, 0);

  return {
    facturas: Number(invoices.facturas || 0),
    total_facturado: Number(invoices.total_facturado || 0),
    pagos_factura: pagosFactura,
    anticipos,
    cambios,
    cobros_cxc: cobrosCxc,
    ingresos_caja: ingresosCaja,
    esperado_caja: ingresosCaja,
    paymentBreakdown: paymentBreakdown.rows,
  };
}

module.exports = router;
