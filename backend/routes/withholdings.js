const express = require('express');
const router = express.Router();
const db = require('../db');
const { writeAudit } = require('../utils/audit');
const { generarClaveAccesoSRI } = require('../utils/sri_utils');
const { authenticateToken, authorizePermissions } = require('./auth');
const { validate, schemas } = require('../middleware/validate');
const { formatDocumentNumber, getDefaultBranch, nextDocumentSequential } = require('../services/sequential_service');

// Proteger todas las rutas de retenciones con autenticación y autorización
router.use(authenticateToken);

// 1. Obtener todas las Retenciones (GET /api/withholdings)
router.get('/', async (req, res) => {
  const page  = Math.max(parseInt(req.query.page  || '1',  10), 1);
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
  const offset = (page - 1) * limit;
  try {
    const [dataRes, countRes] = await Promise.all([
      db.query(`
        SELECT r.*, c.numero_factura_compra, p.nombre AS proveedor_nombre, p.identificacion AS proveedor_identificacion, u.username
        FROM retenciones r
        LEFT JOIN compras c ON r.id_compra = c.id_compra
        LEFT JOIN proveedores p ON c.id_proveedor = p.id_proveedor
        JOIN usuarios u ON r.id_usuario = u.id_usuario
        ORDER BY r.fecha_emision DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]),
      db.query('SELECT COUNT(*) FROM retenciones'),
    ]);
    const total = parseInt(countRes.rows[0].count, 10);
    res.json({ data: dataRes.rows, total, page, limit, pages: Math.ceil(total / limit) });
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
    const companyRes = await db.query('SELECT * FROM empresas LIMIT 1');

    res.json({
      withholding: retRes.rows[0],
      details: detallesRes.rows,
      company: companyRes.rows[0] || null,
    });
  } catch (error) {
    console.error('Error al obtener detalle de retención:', error);
    res.status(500).json({ error: 'Error al consultar el detalle de la retención.' });
  }
});

// 3. Emitir Comprobante de Retención (POST /api/withholdings)
router.post('/', async (req, res) => {
  const { id_compra, details } = req.body || {};
  const id_usuario = req.user.id_usuario;

  if (!id_compra || !details || details.length === 0) {
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
    const branch = await getDefaultBranch(client);
    const nextSeq = await nextDocumentSequential(client, branch.id_sucursal, 'RETENCION');
    const numero_retencion = formatDocumentNumber(branch, nextSeq);
    const companyRes = await client.query('SELECT ruc FROM empresas LIMIT 1');
    if (companyRes.rows.length === 0 || !companyRes.rows[0].ruc) {
      throw new Error('Configure el RUC de la empresa antes de emitir retenciones.');
    }

    const accessKey = generarClaveAccesoSRI({
      fechaEmision: new Date(),
      tipoComprobante: '07',
      ruc: companyRes.rows[0].ruc,
      ambiente: '1',
      establecimiento: branch.codigo_establecimiento,
      puntoEmision: branch.punto_emision,
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

router.put('/:id/cancel', authorizePermissions('DOCUMENT_CANCEL'), async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body || {};
  const id_usuario = req.user.id_usuario;

  if (!String(reason || '').trim()) {
    return res.status(400).json({ error: 'Usuario y motivo de anulacion son obligatorios.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const retRes = await client.query('SELECT * FROM retenciones WHERE id_retencion = $1 FOR UPDATE', [id]);
    if (retRes.rows.length === 0) {
      throw new Error('Retencion no encontrada.');
    }
    if (retRes.rows[0].estado === 'ANULADA') {
      throw new Error('La retencion ya se encuentra anulada.');
    }

    const updateRes = await client.query(`
      UPDATE retenciones
      SET estado = 'ANULADA',
          motivo_anulacion = $1,
          anulada_at = CURRENT_TIMESTAMP,
          anulada_por = $2
      WHERE id_retencion = $3
      RETURNING *
    `, [String(reason).trim(), id_usuario, id]);

    await writeAudit(client, {
      entity: 'retenciones',
      entityId: id,
      action: 'ANULAR_RETENCION',
      userId: id_usuario,
      detail: { numero_retencion: retRes.rows[0].numero_retencion, reason: String(reason).trim() },
    });

    await client.query('COMMIT');
    res.json(updateRes.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al anular retencion:', error);
    res.status(400).json({ error: error.message || 'Error al anular la retencion.' });
  } finally {
    client.release();
  }
});

module.exports = router;
