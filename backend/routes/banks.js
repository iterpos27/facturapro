const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('./auth');
const { writeAudit } = require('../audit');

router.use(authenticateToken);

const amount = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

router.get('/accounts', async (_req, res) => {
  try {
    const result = await db.query(`
      SELECT cb.*,
             COALESCE(SUM(dbp.monto) FILTER (WHERE dbp.estado = 'CONCILIADO'), 0) AS conciliado,
             COALESCE(SUM(dbp.monto) FILTER (WHERE dbp.estado <> 'ANULADO'), 0) AS depositado
      FROM cuentas_bancarias cb
      LEFT JOIN depositos_bancarios dbp ON cb.id_cuenta = dbp.id_cuenta
      WHERE cb.activo = true
      GROUP BY cb.id_cuenta
      ORDER BY cb.banco ASC, cb.numero_cuenta ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al consultar cuentas bancarias:', error);
    res.status(500).json({ error: 'Error al consultar cuentas bancarias.' });
  }
});

router.post('/accounts', async (req, res) => {
  const { banco, numero_cuenta, tipo_cuenta, titular, saldo_inicial } = req.body || {};
  if (!String(banco || '').trim() || !String(numero_cuenta || '').trim()) {
    return res.status(400).json({ error: 'Banco y numero de cuenta son obligatorios.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`
      INSERT INTO cuentas_bancarias (banco, numero_cuenta, tipo_cuenta, titular, saldo_inicial)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      String(banco).trim(),
      String(numero_cuenta).trim(),
      String(tipo_cuenta || 'CORRIENTE').trim().toUpperCase(),
      String(titular || '').trim(),
      amount(saldo_inicial),
    ]);
    await writeAudit(client, {
      entity: 'cuentas_bancarias',
      entityId: result.rows[0].id_cuenta,
      action: 'CREAR_CUENTA_BANCARIA',
      userId: req.user.id_usuario,
      detail: { banco, numero_cuenta },
    });
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear cuenta bancaria:', error);
    res.status(400).json({ error: error.message || 'Error al crear cuenta bancaria.' });
  } finally {
    client.release();
  }
});

router.get('/deposits', async (req, res) => {
  const params = [];
  const where = [];
  if (req.query.id_cuenta) {
    params.push(Number(req.query.id_cuenta));
    where.push(`d.id_cuenta = $${params.length}`);
  }
  if (req.query.estado) {
    params.push(String(req.query.estado).toUpperCase());
    where.push(`d.estado = $${params.length}`);
  }
  try {
    const result = await db.query(`
      SELECT d.*, cb.banco, cb.numero_cuenta, sc.fecha_apertura, u.username
      FROM depositos_bancarios d
      JOIN cuentas_bancarias cb ON d.id_cuenta = cb.id_cuenta
      LEFT JOIN sesiones_caja sc ON d.id_sesion = sc.id_sesion
      LEFT JOIN usuarios u ON d.id_usuario = u.id_usuario
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY d.fecha_deposito DESC, d.id_deposito DESC
      LIMIT 200
    `, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al consultar depositos:', error);
    res.status(500).json({ error: 'Error al consultar depositos bancarios.' });
  }
});

router.post('/deposits', async (req, res) => {
  const { id_cuenta, id_sesion, fecha_deposito, monto, referencia, observacion } = req.body || {};
  const depositAmount = amount(monto);
  if (!id_cuenta || depositAmount <= 0) {
    return res.status(400).json({ error: 'Cuenta y monto mayor a cero son obligatorios.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const accountRes = await client.query('SELECT id_cuenta FROM cuentas_bancarias WHERE id_cuenta = $1 AND activo = true', [id_cuenta]);
    if (accountRes.rows.length === 0) throw new Error('Cuenta bancaria no encontrada o inactiva.');

    const result = await client.query(`
      INSERT INTO depositos_bancarios (
        id_cuenta, id_sesion, fecha_deposito, monto, referencia, observacion, id_usuario
      )
      VALUES ($1, $2, COALESCE(NULLIF($3, '')::date, CURRENT_DATE), $4, $5, $6, $7)
      RETURNING *
    `, [
      id_cuenta,
      id_sesion || null,
      fecha_deposito || '',
      depositAmount,
      String(referencia || '').trim(),
      String(observacion || '').trim(),
      req.user.id_usuario,
    ]);
    await writeAudit(client, {
      entity: 'depositos_bancarios',
      entityId: result.rows[0].id_deposito,
      action: 'REGISTRAR_DEPOSITO_BANCARIO',
      userId: req.user.id_usuario,
      detail: { id_cuenta, id_sesion: id_sesion || null, monto: depositAmount },
    });
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar deposito:', error);
    res.status(400).json({ error: error.message || 'Error al registrar deposito.' });
  } finally {
    client.release();
  }
});

router.put('/deposits/:id/reconcile', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`
      UPDATE depositos_bancarios
      SET estado = 'CONCILIADO',
          conciliado_at = CURRENT_TIMESTAMP,
          conciliado_por = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id_deposito = $2 AND estado <> 'ANULADO'
      RETURNING *
    `, [req.user.id_usuario, req.params.id]);
    if (result.rows.length === 0) throw new Error('Deposito no encontrado o anulado.');
    await writeAudit(client, {
      entity: 'depositos_bancarios',
      entityId: req.params.id,
      action: 'CONCILIAR_DEPOSITO_BANCARIO',
      userId: req.user.id_usuario,
      detail: { id_deposito: req.params.id },
    });
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al conciliar deposito:', error);
    res.status(400).json({ error: error.message || 'Error al conciliar deposito.' });
  } finally {
    client.release();
  }
});

router.post('/reconciliations', async (req, res) => {
  const { id_cuenta, fecha_desde, fecha_hasta, saldo_banco, observacion } = req.body || {};
  if (!id_cuenta || !fecha_desde || !fecha_hasta) {
    return res.status(400).json({ error: 'Cuenta, fecha desde y fecha hasta son obligatorias.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const systemRes = await client.query(`
      SELECT COALESCE(SUM(monto), 0) AS saldo_sistema
      FROM depositos_bancarios
      WHERE id_cuenta = $1
        AND fecha_deposito BETWEEN $2::date AND $3::date
        AND estado <> 'ANULADO'
    `, [id_cuenta, fecha_desde, fecha_hasta]);
    const systemBalance = amount(systemRes.rows[0]?.saldo_sistema);
    const bankBalance = amount(saldo_banco);
    const result = await client.query(`
      INSERT INTO conciliaciones_bancarias (
        id_cuenta, fecha_desde, fecha_hasta, saldo_banco, saldo_sistema,
        diferencia, estado, observacion, id_usuario
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      id_cuenta,
      fecha_desde,
      fecha_hasta,
      bankBalance,
      systemBalance,
      bankBalance - systemBalance,
      Math.abs(bankBalance - systemBalance) <= 0.01 ? 'CUADRADA' : 'DIFERENCIA',
      String(observacion || '').trim(),
      req.user.id_usuario,
    ]);
    await writeAudit(client, {
      entity: 'conciliaciones_bancarias',
      entityId: result.rows[0].id_conciliacion,
      action: 'REGISTRAR_CONCILIACION_BANCARIA',
      userId: req.user.id_usuario,
      detail: { id_cuenta, saldo_banco: bankBalance, saldo_sistema: systemBalance },
    });
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar conciliacion:', error);
    res.status(400).json({ error: error.message || 'Error al registrar conciliacion.' });
  } finally {
    client.release();
  }
});

router.get('/reconciliations', async (_req, res) => {
  try {
    const result = await db.query(`
      SELECT c.*, cb.banco, cb.numero_cuenta, u.username
      FROM conciliaciones_bancarias c
      JOIN cuentas_bancarias cb ON c.id_cuenta = cb.id_cuenta
      LEFT JOIN usuarios u ON c.id_usuario = u.id_usuario
      ORDER BY c.created_at DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al consultar conciliaciones:', error);
    res.status(500).json({ error: 'Error al consultar conciliaciones bancarias.' });
  }
});

module.exports = router;
