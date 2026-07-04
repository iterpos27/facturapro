const express = require('express');
const router = express.Router();
const db = require('../db');
const { writeAudit } = require('../audit');
const { authenticateToken } = require('./auth');
const { validate, schemas } = require('../middleware/validate');

// Proteger todas las rutas de compras con autenticación y autorización
router.use(authenticateToken);

// 1. Obtener listado de compras (GET /api/purchases)
router.get('/', async (req, res) => {
  const page  = Math.max(parseInt(req.query.page  || '1',  10), 1);
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
  const offset = (page - 1) * limit;
  try {
    const [dataRes, countRes] = await Promise.all([
      db.query(`
        SELECT c.*, p.nombre AS proveedor_nombre, p.identificacion AS proveedor_identificacion, u.username
        FROM compras c
        JOIN proveedores p ON c.id_proveedor = p.id_proveedor
        JOIN usuarios u ON c.id_usuario = u.id_usuario
        ORDER BY c.fecha_compra DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]),
      db.query('SELECT COUNT(*) FROM compras'),
    ]);
    const total = parseInt(countRes.rows[0].count, 10);
    res.json({ data: dataRes.rows, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Error al obtener compras:', error);
    res.status(500).json({ error: 'Error al consultar las compras.' });
  }
});

// 2. Obtener detalle de una compra (GET /api/purchases/:id)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const compraRes = await db.query(`
      SELECT c.*, p.nombre AS proveedor_nombre, p.identificacion AS proveedor_identificacion,
             p.email AS proveedor_email, p.telefono AS proveedor_telefono, p.direccion AS proveedor_direccion,
             u.username
      FROM compras c
      JOIN proveedores p ON c.id_proveedor = p.id_proveedor
      JOIN usuarios u ON c.id_usuario = u.id_usuario
      WHERE c.id_compra = $1
    `, [id]);

    if (compraRes.rows.length === 0) {
      return res.status(404).json({ error: 'Compra no encontrada.' });
    }

    const detallesRes = await db.query(`
      SELECT cd.*, p.nombre AS producto_nombre, p.codigo AS producto_codigo
      FROM compra_detalles cd
      JOIN productos p ON cd.id_producto = p.id_producto
      WHERE cd.id_compra = $1
      ORDER BY cd.id_detalle ASC
    `, [id]);
    const companyRes = await db.query('SELECT * FROM empresas LIMIT 1');

    res.json({
      purchase: compraRes.rows[0],
      details: detallesRes.rows,
      company: companyRes.rows[0] || null,
    });
  } catch (error) {
    console.error('Error al obtener detalle de compra:', error);
    res.status(500).json({ error: 'Error al consultar el detalle de la compra.' });
  }
});

// 3. Registrar una nueva compra (POST /api/purchases)
router.post('/', async (req, res) => {
  const {
    numero_factura_compra,
    id_proveedor,
    subtotal_iva_cero,
    subtotal_con_iva,
    descuento_total,
    valor_iva,
    total,
    observacion,
    items,
  } = req.body || {};
  const id_usuario = req.user.id_usuario;

  if (!numero_factura_compra || !id_proveedor || !items || items.length === 0) {
    return res.status(400).json({ error: 'Faltan datos obligatorios para registrar la compra.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insertar en compras
    const compraRes = await client.query(`
      INSERT INTO compras (
        numero_factura_compra, id_proveedor, id_usuario,
        subtotal_iva_cero, subtotal_con_iva, descuento_total,
        valor_iva, total, observacion
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      numero_factura_compra,
      id_proveedor,
      id_usuario,
      parseFloat(subtotal_iva_cero || 0),
      parseFloat(subtotal_con_iva || 0),
      parseFloat(descuento_total || 0),
      parseFloat(valor_iva || 0),
      parseFloat(total || 0),
      observacion || '',
    ]);

    const purchase = compraRes.rows[0];

    // 2. Procesar ítems y actualizar stock
    for (const item of items) {
      const { id_producto, cantidad, costo_unitario, precio_total, valor_iva: itemIva } = item;

      // Insertar detalle
      await client.query(`
        INSERT INTO compra_detalles (id_compra, id_producto, cantidad, costo_unitario, precio_total, valor_iva)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        purchase.id_compra,
        id_producto,
        parseFloat(cantidad),
        parseFloat(costo_unitario),
        parseFloat(precio_total),
        parseFloat(itemIva || 0),
      ]);

      // Incrementar stock y actualizar el ultimo costo de compra del producto.
      await client.query(`
        UPDATE productos
        SET stock_actual = stock_actual + $1,
            precio_compra = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id_producto = $2
      `, [parseFloat(cantidad), id_producto, parseFloat(costo_unitario)]);

      // Registrar movimiento de inventario
      await client.query(`
        INSERT INTO movimientos_inventario (id_producto, tipo, cantidad, motivo, referencia, id_usuario)
        VALUES ($1, 'INGRESO', $2, 'COMPRA', $3, $4)
      `, [id_producto, parseFloat(cantidad), numero_factura_compra, id_usuario]);
    }

    // 3. Registrar en Auditoría
    await writeAudit(client, {
      entity: 'compras',
      entityId: purchase.id_compra,
      action: 'REGISTRAR_COMPRA',
      userId: id_usuario,
      detail: {
        numero_factura_compra,
        id_proveedor,
        total: purchase.total,
      },
    });

    await client.query('COMMIT');
    res.status(201).json(purchase);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar compra:', error);
    res.status(400).json({ error: error.message || 'Error al procesar el registro de compra.' });
  } finally {
    client.release();
  }
});

router.put('/:id/cancel', async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body || {};
  const id_usuario = req.user.id_usuario;

  if (!String(reason || '').trim()) {
    return res.status(400).json({ error: 'Usuario y motivo de anulacion son obligatorios.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const purchaseRes = await client.query('SELECT * FROM compras WHERE id_compra = $1 FOR UPDATE', [id]);
    if (purchaseRes.rows.length === 0) {
      throw new Error('Compra no encontrada.');
    }
    const purchase = purchaseRes.rows[0];
    if (purchase.estado === 'ANULADA') {
      throw new Error('La compra ya se encuentra anulada.');
    }

    const activeWithholding = await client.query(
      "SELECT id_retencion FROM retenciones WHERE id_compra = $1 AND estado = 'EMITIDA' LIMIT 1",
      [id]
    ).catch((error) => (error.code === '42P01' ? { rows: [] } : Promise.reject(error)));
    if (activeWithholding.rows.length > 0) {
      throw new Error('Primero anula la retencion asociada a esta compra.');
    }

    const detailsRes = await client.query('SELECT * FROM compra_detalles WHERE id_compra = $1', [id]);
    for (const detail of detailsRes.rows) {
      await client.query(`
        UPDATE productos
        SET stock_actual = stock_actual - $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id_producto = $2
      `, [detail.cantidad, detail.id_producto]);

      await client.query(`
        INSERT INTO movimientos_inventario (id_producto, tipo, cantidad, motivo, referencia, id_usuario)
        VALUES ($1, 'EGRESO', $2, 'COMPRA_ANULADA', $3, $4)
      `, [detail.id_producto, detail.cantidad, purchase.numero_factura_compra, id_usuario]);
    }

    const updateRes = await client.query(`
      UPDATE compras
      SET estado = 'ANULADA',
          motivo_anulacion = $1,
          anulada_at = CURRENT_TIMESTAMP,
          anulada_por = $2
      WHERE id_compra = $3
      RETURNING *
    `, [String(reason).trim(), id_usuario, id]);

    await writeAudit(client, {
      entity: 'compras',
      entityId: id,
      action: 'ANULAR_COMPRA',
      userId: id_usuario,
      detail: { numero_factura_compra: purchase.numero_factura_compra, reason: String(reason).trim() },
    });

    await client.query('COMMIT');
    res.json(updateRes.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al anular compra:', error);
    res.status(400).json({ error: error.message || 'Error al anular la compra.' });
  } finally {
    client.release();
  }
});

module.exports = router;
