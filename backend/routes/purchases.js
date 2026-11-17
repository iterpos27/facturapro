const express = require('express');
const router = express.Router();
const db = require('../db');
const { writeAudit } = require('../utils/audit');
const { publicCompany } = require('../utils/company_secrets');
const { authenticateToken } = require('./auth');
const { validate, schemas } = require('../middleware/validate');
const { recordInventoryCostMovement } = require('../services/inventory_costing');

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

router.get('/payables', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT c.*, p.nombre AS proveedor_nombre, p.identificacion AS proveedor_identificacion,
             p.email AS proveedor_email, p.telefono AS proveedor_telefono,
             CASE
               WHEN COALESCE(c.saldo, 0) <= 0 THEN 'PAGADA'
               WHEN c.fecha_vencimiento IS NOT NULL AND c.fecha_vencimiento < CURRENT_DATE THEN 'VENCIDA'
               WHEN COALESCE(c.monto_pagado, 0) > 0 THEN 'ABONADA'
               ELSE COALESCE(c.estado_pago, 'PENDIENTE')
             END AS estado_pago_actual,
             CASE
               WHEN c.fecha_vencimiento IS NULL THEN 0
               ELSE GREATEST((CURRENT_DATE - c.fecha_vencimiento), 0)
             END AS dias_vencidos
      FROM compras c
      JOIN proveedores p ON c.id_proveedor = p.id_proveedor
      WHERE c.estado = 'REGISTRADA' AND COALESCE(c.saldo, 0) > 0
      ORDER BY c.fecha_vencimiento ASC NULLS LAST, c.fecha_compra DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener cuentas por pagar:', error);
    res.status(500).json({ error: 'Error al consultar cuentas por pagar.' });
  }
});

router.post('/:id/payments', async (req, res) => {
  const { id } = req.params;
  const { monto, metodo_pago, referencia } = req.body || {};
  const id_usuario = req.user.id_usuario;
  const paymentAmount = parseFloat(monto);

  if (!paymentAmount || paymentAmount <= 0) {
    return res.status(400).json({ error: 'El monto del pago debe ser mayor a cero.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const compraRes = await client.query(
      'SELECT id_compra, numero_factura_compra, total, saldo, estado FROM compras WHERE id_compra = $1 FOR UPDATE',
      [id]
    );
    if (compraRes.rows.length === 0) {
      throw new Error('Compra no encontrada.');
    }
    const compra = compraRes.rows[0];
    if (compra.estado === 'ANULADA') {
      throw new Error('No se pueden registrar pagos sobre una compra anulada.');
    }

    const currentSaldo = parseFloat(compra.saldo || 0);
    if (currentSaldo <= 0) {
      throw new Error('La compra ya esta totalmente pagada.');
    }
    if (paymentAmount > currentSaldo + 0.0001) {
      throw new Error(`El pago supera el saldo pendiente ($${currentSaldo.toFixed(2)}).`);
    }

    const paymentRes = await client.query(`
      INSERT INTO compra_pagos (id_compra, monto, metodo_pago, referencia, id_usuario)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [id, paymentAmount, metodo_pago || 'EFECTIVO', referencia || '', id_usuario]);

    const newSaldo = Math.max(currentSaldo - paymentAmount, 0);
    const newPaid = Math.max(parseFloat(compra.total || 0) - newSaldo, 0);
    await client.query(`
      UPDATE compras
      SET saldo = $1,
          monto_pagado = $2,
          estado_pago = CASE
            WHEN $1::numeric <= 0 THEN 'PAGADA'
            WHEN fecha_vencimiento IS NOT NULL AND fecha_vencimiento < CURRENT_DATE THEN 'VENCIDA'
            ELSE 'ABONADA'
          END
      WHERE id_compra = $3
    `, [newSaldo, newPaid, id]);

    await writeAudit(client, {
      entity: 'compras',
      entityId: id,
      action: 'REGISTRAR_PAGO_PROVEEDOR',
      userId: id_usuario,
      detail: {
        numero_factura_compra: compra.numero_factura_compra,
        monto: paymentAmount,
        saldo_anterior: currentSaldo,
        nuevo_saldo: newSaldo,
      },
    });

    await client.query('COMMIT');
    res.status(201).json({ payment: paymentRes.rows[0], nuevo_saldo: newSaldo });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar pago proveedor:', error);
    res.status(400).json({ error: error.message || 'Error al registrar pago proveedor.' });
  } finally {
    client.release();
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
      company: companyRes.rows[0] ? publicCompany(companyRes.rows[0]) : null,
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
    tipo_pago,
    dias_credito,
    monto_pagado,
    items,
  } = req.body || {};
  const id_usuario = req.user.id_usuario;

  if (!numero_factura_compra || !id_proveedor || !items || items.length === 0) {
    return res.status(400).json({ error: 'Faltan datos obligatorios para registrar la compra.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const totalValue = parseFloat(total || 0);
    const paidValue = Math.max(parseFloat(monto_pagado || 0) || 0, 0);
    const tipoCompra = paidValue < totalValue || String(tipo_pago || '').toUpperCase() === 'CREDITO' ? 'CREDITO' : 'CONTADO';
    const creditDays = tipoCompra === 'CREDITO'
      ? Math.max(parseInt(dias_credito || 15, 10) || 15, 1)
      : 0;
    const dueDate = tipoCompra === 'CREDITO'
      ? new Date(Date.now() + creditDays * 24 * 60 * 60 * 1000)
      : null;
    const saldo = Math.max(totalValue - paidValue, 0);
    const estadoPago = saldo <= 0 ? 'PAGADA' : 'PENDIENTE';

    // 1. Insertar en compras
    const compraRes = await client.query(`
      INSERT INTO compras (
        numero_factura_compra, id_proveedor, id_usuario,
        subtotal_iva_cero, subtotal_con_iva, descuento_total,
        valor_iva, total, observacion, tipo_compra, dias_credito,
        fecha_vencimiento, monto_pagado, saldo, estado_pago
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      numero_factura_compra,
      id_proveedor,
      id_usuario,
      parseFloat(subtotal_iva_cero || 0),
      parseFloat(subtotal_con_iva || 0),
      parseFloat(descuento_total || 0),
      parseFloat(valor_iva || 0),
      totalValue,
      observacion || '',
      tipoCompra,
      creditDays,
      dueDate,
      paidValue,
      saldo,
      estadoPago,
    ]);

    const purchase = compraRes.rows[0];

    if (paidValue > 0) {
      await client.query(`
        INSERT INTO compra_pagos (id_compra, monto, metodo_pago, referencia, id_usuario)
        VALUES ($1, $2, 'INICIAL', 'Pago inicial al registrar compra', $3)
      `, [purchase.id_compra, paidValue, id_usuario]).catch((error) => {
        if (error.code === '42P01') return null;
        throw error;
      });
    }

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

      await recordInventoryCostMovement(client, {
        id_producto,
        tipo: 'INGRESO',
        cantidad,
        motivo: 'COMPRA',
        referencia: numero_factura_compra,
        id_usuario,
        costo_unitario,
        documento_tipo: 'COMPRA',
        documento_id: purchase.id_compra,
      });
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
        saldo: purchase.saldo,
        tipo_compra: purchase.tipo_compra,
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
      await recordInventoryCostMovement(client, {
        id_producto: detail.id_producto,
        tipo: 'EGRESO',
        cantidad: detail.cantidad,
        motivo: 'COMPRA_ANULADA',
        referencia: purchase.numero_factura_compra,
        id_usuario,
        costo_unitario: detail.costo_unitario,
        documento_tipo: 'COMPRA_ANULADA',
        documento_id: purchase.id_compra,
      });
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
