const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('./auth');
const { writeAudit } = require('../audit');

router.use(authenticateToken);

const toMoney = (value) => {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : 0;
};

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
      queryStr += ' AND sc.id_usuario = $1';
      params.push(parseInt(id_usuario, 10));
    }
    queryStr += ' ORDER BY sc.fecha_apertura DESC LIMIT 1';

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

router.get('/sessions', async (req, res) => {
  const params = [];
  const where = [];

  if (req.query.date_from) {
    params.push(req.query.date_from);
    where.push(`sc.fecha_apertura >= $${params.length}`);
  }
  if (req.query.date_to) {
    params.push(req.query.date_to);
    where.push(`sc.fecha_apertura < ($${params.length}::date + INTERVAL '1 day')`);
  }
  if (req.query.id_usuario) {
    params.push(Number(req.query.id_usuario));
    where.push(`sc.id_usuario = $${params.length}`);
  }
  if (req.query.id_caja) {
    params.push(Number(req.query.id_caja));
    where.push(`sc.id_caja = $${params.length}`);
  }

  const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 100);
  params.push(limit);

  try {
    const result = await db.query(`
      SELECT sc.*, c.nombre AS caja_nombre, s.nombre AS sucursal_nombre, u.username
      FROM sesiones_caja sc
      JOIN cajas c ON sc.id_caja = c.id_caja
      JOIN sucursales s ON c.id_sucursal = s.id_sucursal
      LEFT JOIN usuarios u ON sc.id_usuario = u.id_usuario
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY sc.fecha_apertura DESC
      LIMIT $${params.length}
    `, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Error al consultar sesiones de caja:', error);
    res.status(500).json({ error: 'Error al consultar sesiones de caja.' });
  }
});

router.get('/sessions/:id', async (req, res) => {
  try {
    const sessionRes = await db.query(`
      SELECT sc.*, c.nombre AS caja_nombre, s.nombre AS sucursal_nombre, u.username
      FROM sesiones_caja sc
      JOIN cajas c ON sc.id_caja = c.id_caja
      JOIN sucursales s ON c.id_sucursal = s.id_sucursal
      LEFT JOIN usuarios u ON sc.id_usuario = u.id_usuario
      WHERE sc.id_sesion = $1
    `, [req.params.id]);

    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Sesion de caja no encontrada.' });
    }

    const session = sessionRes.rows[0];
    const summary = await getCashSessionSummary(
      session.id_sesion,
      session.id_usuario,
      session.fecha_apertura,
      db,
      session.fecha_cierre
    );

    res.json({ ...session, summary });
  } catch (error) {
    console.error('Error al consultar detalle de caja:', error);
    res.status(500).json({ error: 'Error al consultar detalle de caja.' });
  }
});

router.post('/open', async (req, res) => {
  const { id_caja, monto_apertura, apertura_billetes, apertura_monedas } = req.body;
  const id_usuario = req.user.id_usuario;
  const bills = toMoney(apertura_billetes);
  const coins = toMoney(apertura_monedas);
  const hasDenominations = apertura_billetes !== undefined || apertura_monedas !== undefined;
  const openingAmount = hasDenominations ? bills + coins : toMoney(monto_apertura);

  if (!id_caja) {
    return res.status(400).json({ error: 'Caja y usuario son requeridos.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const checkActive = await client.query(`
      SELECT id_sesion
      FROM sesiones_caja
      WHERE id_caja = $1 AND estado = 'ABIERTA'
    `, [id_caja]);

    if (checkActive.rows.length > 0) {
      throw new Error('Esta caja ya tiene una sesion abierta activa.');
    }

    const result = await client.query(`
      INSERT INTO sesiones_caja (
        id_caja, id_usuario, monto_apertura, apertura_billetes, apertura_monedas, estado
      ) VALUES ($1, $2, $3, $4, $5, 'ABIERTA')
      RETURNING *
    `, [parseInt(id_caja, 10), parseInt(id_usuario, 10), openingAmount, hasDenominations ? bills : openingAmount, coins]);

    await writeAudit(client, {
      entity: 'sesiones_caja',
      entityId: result.rows[0].id_sesion,
      action: 'ABRIR_CAJA',
      userId: id_usuario,
      detail: { apertura_billetes: hasDenominations ? bills : openingAmount, apertura_monedas: coins, monto_apertura: openingAmount },
    });

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al abrir caja:', error);
    res.status(400).json({ error: error.message || 'Error al abrir la sesion de caja.' });
  } finally {
    client.release();
  }
});

router.post('/close', async (req, res) => {
  const { id_sesion, cierre_billetes, cierre_monedas, monto_cierre } = req.body;
  const bills = toMoney(cierre_billetes);
  const coins = toMoney(cierre_monedas);
  const hasDenominations = cierre_billetes !== undefined || cierre_monedas !== undefined;
  const closingAmount = hasDenominations ? bills + coins : toMoney(monto_cierre);

  if (!id_sesion) {
    return res.status(400).json({ error: 'Sesion de caja es obligatoria.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const sessionRes = await client.query(`
      SELECT *
      FROM sesiones_caja
      WHERE id_sesion = $1 AND estado = 'ABIERTA'
      FOR UPDATE
    `, [parseInt(id_sesion, 10)]);

    if (sessionRes.rows.length === 0) {
      throw new Error('Sesion de caja no encontrada o ya cerrada.');
    }

    const session = sessionRes.rows[0];
    const summary = await getCashSessionSummary(session.id_sesion, session.id_usuario, session.fecha_apertura, client);
    const efectivoEsperado = Number(session.monto_apertura || 0) + summary.ventas_contado + summary.cobros_cxc - summary.notas_credito_total;
    const totalOperativo = efectivoEsperado + summary.ventas_credito;
    const diferencia = closingAmount - efectivoEsperado;

    const result = await client.query(`
      UPDATE sesiones_caja
      SET cierre_billetes = $1,
          cierre_monedas = $2,
          monto_cierre = $3,
          ventas_contado = $4,
          ventas_credito = $5,
          cobros_cxc = $6,
          notas_credito_total = $7,
          efectivo_esperado = $8,
          total_operativo = $9,
          diferencia_cierre = $10,
          estado = 'CERRADA',
          fecha_cierre = CURRENT_TIMESTAMP
      WHERE id_sesion = $11
      RETURNING *
    `, [
      hasDenominations ? bills : closingAmount,
      coins,
      closingAmount,
      summary.ventas_contado,
      summary.ventas_credito,
      summary.cobros_cxc,
      summary.notas_credito_total,
      efectivoEsperado,
      totalOperativo,
      diferencia,
      parseInt(id_sesion, 10),
    ]);

    await writeAudit(client, {
      entity: 'sesiones_caja',
      entityId: id_sesion,
      action: 'CERRAR_CAJA',
      userId: session.id_usuario,
      detail: {
        cierre_billetes: hasDenominations ? bills : closingAmount,
        cierre_monedas: coins,
        monto_cierre: closingAmount,
        efectivo_esperado: efectivoEsperado,
        total_operativo: totalOperativo,
        diferencia_cierre: diferencia,
      },
    });

    const sessionMetaRes = await client.query(`
      SELECT c.nombre AS caja_nombre, s.nombre AS sucursal_nombre, u.username
      FROM sesiones_caja sc
      JOIN cajas c ON sc.id_caja = c.id_caja
      JOIN sucursales s ON c.id_sucursal = s.id_sucursal
      LEFT JOIN usuarios u ON sc.id_usuario = u.id_usuario
      WHERE sc.id_sesion = $1
    `, [session.id_sesion]);

    await client.query('COMMIT');
    res.json({
      ...result.rows[0],
      ...(sessionMetaRes.rows[0] || {}),
      summary: { ...summary, efectivo_esperado: efectivoEsperado, total_operativo: totalOperativo, diferencia_cierre: diferencia },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al cerrar caja:', error);
    res.status(400).json({ error: error.message || 'Error al cerrar la sesion de caja.' });
  } finally {
    client.release();
  }
});

router.get('/payment-methods', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM metodos_pago WHERE activo = true ORDER BY codigo_sri ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener metodos de pago:', error);
    res.status(500).json({ error: 'Error al obtener metodos de pago.' });
  }
});

async function getCashSessionSummary(idSesion, idUsuario, fechaApertura, client = db, fechaCierre = null) {
  const invoiceRes = await client.query(`
    SELECT COUNT(*)::int AS facturas,
           COALESCE(SUM(total), 0) AS total_facturado,
           COALESCE(SUM(total - COALESCE(saldo, 0)), 0) AS ventas_contado,
           COALESCE(SUM(COALESCE(saldo, 0)), 0) AS ventas_credito,
           COALESCE(SUM(monto_pago), 0) AS pagos_factura,
           COALESCE(SUM(anticipo), 0) AS anticipos,
           COALESCE(SUM(cambio), 0) AS cambios
    FROM facturas
    WHERE id_sesion_caja = $1 AND estado = 'EMITIDA'
  `, [idSesion]);

  const creditNotesRes = await client.query(`
    SELECT COALESCE(SUM(nc.total), 0) AS total
    FROM notas_credito nc
    JOIN facturas f ON nc.id_factura = f.id_factura
    WHERE f.id_sesion_caja = $1 AND nc.estado = 'EMITIDA'
  `, [idSesion]).catch((error) => {
    if (error.code === '42P01') return { rows: [{ total: 0 }] };
    throw error;
  });

  const receivableParams = [idUsuario, fechaApertura];
  let receivableDateFilter = 'fc.fecha_cobro >= $2';
  if (fechaCierre) {
    receivableParams.push(fechaCierre);
    receivableDateFilter += ' AND fc.fecha_cobro <= $3';
  }

  const receivablePayments = await client.query(`
    SELECT COALESCE(SUM(fc.monto), 0) AS total
    FROM factura_cobros fc
    WHERE fc.id_usuario = $1 AND ${receivableDateFilter}
  `, receivableParams).catch((error) => {
    if (error.code === '42P01') return { rows: [{ total: 0 }] };
    throw error;
  });

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

  const invoices = invoiceRes.rows[0] || {};
  const ventasContado = Number(invoices.ventas_contado || 0);
  const ventasCredito = Number(invoices.ventas_credito || 0);
  const cobrosCxc = Number(receivablePayments.rows[0]?.total || 0);
  const notasCredito = Number(creditNotesRes.rows[0]?.total || 0);
  const efectivoTurno = Math.max(ventasContado + cobrosCxc - notasCredito, 0);

  return {
    facturas: Number(invoices.facturas || 0),
    total_facturado: Number(invoices.total_facturado || 0),
    ventas_contado: ventasContado,
    ventas_credito: ventasCredito,
    pagos_factura: Number(invoices.pagos_factura || 0),
    anticipos: Number(invoices.anticipos || 0),
    cambios: Number(invoices.cambios || 0),
    cobros_cxc: cobrosCxc,
    notas_credito_total: notasCredito,
    ingresos_caja: efectivoTurno,
    esperado_caja: efectivoTurno,
    total_operativo: efectivoTurno + ventasCredito,
    paymentBreakdown: paymentBreakdown.rows,
  };
}

module.exports = router;
