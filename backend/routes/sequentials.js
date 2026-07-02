const express = require('express');
const router = express.Router();
const db = require('../db');
const { writeAudit } = require('../audit');

const normalizeThreeDigits = (value, fieldName) => {
  const normalized = String(value || '').replace(/\D/g, '').padStart(3, '0').slice(-3);
  if (!/^\d{3}$/.test(normalized)) {
    throw new Error(`${fieldName} debe tener 3 digitos.`);
  }
  return normalized;
};

router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT seq.id_secuencial, seq.id_sucursal, seq.tipo_comprobante,
             seq.secuencial_actual, seq.activo, seq.created_at,
             s.codigo_establecimiento, s.punto_emision, s.nombre AS sucursal_nombre
      FROM secuenciales seq
      JOIN sucursales s ON seq.id_sucursal = s.id_sucursal
      ORDER BY s.codigo_establecimiento, s.punto_emision, seq.tipo_comprobante
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al consultar secuenciales:', error);
    res.status(500).json({ error: 'Error al consultar secuenciales.' });
  }
});

router.put('/branch/:id', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const codigoEstablecimiento = normalizeThreeDigits(req.body.codigo_establecimiento, 'El establecimiento');
    const puntoEmision = normalizeThreeDigits(req.body.punto_emision, 'El punto de emision');

    await client.query('BEGIN');
    const result = await client.query(`
      UPDATE sucursales
      SET codigo_establecimiento = $1,
          punto_emision = $2
      WHERE id_sucursal = $3
      RETURNING *
    `, [codigoEstablecimiento, puntoEmision, req.params.id]);

    if (result.rows.length === 0) {
      throw new Error('Sucursal no encontrada.');
    }

    await writeAudit(client, {
      entity: 'sucursales',
      entityId: req.params.id,
      action: 'ACTUALIZAR_PUNTO_EMISION',
      userId: req.user?.id_usuario,
      detail: { codigo_establecimiento: codigoEstablecimiento, punto_emision: puntoEmision },
    });

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar punto de emision:', error);
    res.status(400).json({ error: error.message || 'Error al actualizar punto de emision.' });
  } finally {
    client.release();
  }
});

router.put('/:id', async (req, res) => {
  const { secuencial_actual, activo } = req.body;
  const nextSequential = Number(secuencial_actual);

  if (!Number.isInteger(nextSequential) || nextSequential < 1) {
    return res.status(400).json({ error: 'El secuencial debe ser un entero mayor o igual a 1.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`
      UPDATE secuenciales
      SET secuencial_actual = $1,
          activo = $2
      WHERE id_secuencial = $3
      RETURNING *
    `, [nextSequential, activo !== false, req.params.id]);

    if (result.rows.length === 0) {
      throw new Error('Secuencial no encontrado.');
    }

    await writeAudit(client, {
      entity: 'secuenciales',
      entityId: req.params.id,
      action: 'ACTUALIZAR_SECUENCIAL',
      userId: req.user?.id_usuario,
      detail: { secuencial_actual: nextSequential, activo: activo !== false },
    });

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar secuencial:', error);
    res.status(400).json({ error: error.message || 'Error al actualizar secuencial.' });
  } finally {
    client.release();
  }
});

module.exports = router;
