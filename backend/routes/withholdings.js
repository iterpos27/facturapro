const express = require('express');
const router = express.Router();
const db = require('../db');
const { writeAudit } = require('../audit');
const { generarClaveAccesoSRI } = require('../sri_utils');

// 1. Obtener todas las Retenciones (GET /api/withholdings)
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT r.*, c.numero_factura_compra, p.nombre AS proveedor_nombre, p.identificacion AS proveedor_identificacion, u.username
      FROM retenciones r
      LEFT JOIN compras c ON r.id_compra = c.id_compra
      LEFT JOIN proveedores p ON c.id_proveedor = p.id_proveedor
      JOIN usuarios u ON r.id_usuario = u.id_usuario
      ORDER BY r.fecha_emision DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener retenciones:', error);
    res.status(500).json({ error: 'Error al consultar las retenciones.' });
  }
});

// 2. Obtener detalle de una Retención (GET /api/withholdings/:id)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const retRes = await db.query(`
      SELECT r.*, c.numero_factura_compra, c.fecha_compra,
             p.nombre AS proveedor_nombre, p.identificacion AS proveedor_identificacion,
             p.email AS proveedor_email, p.telefono AS proveedor_telefono, p.direccion AS proveedor_direccion,
             u.username
      FROM retenciones r
      LEFT JOIN compras c ON r.id_compra = c.id_compra
      LEFT JOIN proveedores p ON c.id_proveedor = p.id_proveedor
      JOIN usuarios u ON r.id_usuario = u.id_usuario
      WHERE r.id_retencion = $1
    `, [id]);

    if (retRes.rows.length === 0) {
      return res.status(404).json({ error: 'Retención no encontrada.' });
    }

    const detallesRes = await db.query(`
      SELECT rd.*
      FROM retencion_detalles rd
      WHERE rd.id_retencion = $1
      ORDER BY rd.id_detalle ASC
    `, [id]);

    res.json({
      withholding: retRes.rows[0],
      details: detallesRes.rows,
    });
  } catch (error) {
    console.error('Error al obtener detalle de retención:', error);
    res.status(500).json({ error: 'Error al consultar el detalle de la retención.' });
  }
});

// 3. Emitir Comprobante de Retención (POST /api/withholdings)
router.post('/', async (req, res) => {
  const { id_compra, id_usuario, details } = req.body || {};

  if (!id_compra || !id_usuario || !details || details.length === 0) {
    return res.status(400).json({ error: 'Faltan datos obligatorios para emitir la retención.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Obtener compra y bloquear fila
    const compRes = await client.query(
      'SELECT id_compra, numero_factura_compra, total FROM compras WHERE id_compra = $1 FOR UPDATE',
      [id_compra]
    );

    if (compRes.rows.length === 0) {
      throw new Error('Compra asociada no encontrada.');
    }

    const compra = compRes.rows[0];

    // 2. Generar secuencial de retención
    const countRes = await client.query('SELECT COUNT(*) FROM retenciones');
    const nextSeq = parseInt(countRes.rows[0].count || 0, 10) + 1;
    const numero_retencion = `RET-001-001-${String(nextSeq).padStart(9, '0')}`;

    // Clave de acceso SRI ficticia
    const accessKey = generarClaveAccesoSRI({
      fechaEmision: new Date(),
      tipoComprobante: '07',
      ruc: '1792345678001',
      ambiente: '1',
      establecimiento: '001',
      puntoEmision: '001',
      secuencial: nextSeq,
    });

    // 3. Insertar Retención
    const retInsertRes = await client.query(`
      INSERT INTO retenciones (numero_retencion, id_compra, id_usuario, clave_acceso)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [numero_retencion, id_compra, id_usuario, accessKey]);

    const withholding = retInsertRes.rows[0];

    // 4. Insertar detalles de retención
    for (const d of details) {
      const { impuesto, codigo_sri, porcentaje, base_imponible, valor_retenido } = d;

      await client.query(`
        INSERT INTO retencion_detalles (id_retencion, impuesto, codigo_sri, porcentaje, base_imponible, valor_retenido)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        withholding.id_retencion,
        impuesto,
        codigo_sri,
        parseFloat(porcentaje),
        parseFloat(base_imponible),
        parseFloat(valor_retenido),
      ]);
    }

    // 5. Registrar en Auditoría
    await writeAudit(client, {
      entity: 'retenciones',
      entityId: withholding.id_retencion,
      action: 'EMITIR_RETENCION',
      userId: id_usuario,
      detail: {
        numero_retencion,
        numero_factura_compra: compra.numero_factura_compra,
      },
    });

    await client.query('COMMIT');
    res.status(201).json(withholding);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al emitir retención:', error);
    res.status(400).json({ error: error.message || 'Error al procesar la retención.' });
  } finally {
    client.release();
  }
});

module.exports = router;
