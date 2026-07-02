const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db');
const { writeAudit } = require('../audit');

const formatTransactionNumber = (value) => String(Number(value) || 0).padStart(6, '0');
const formatProformaNumber = (transactionNumber) => formatTransactionNumber(transactionNumber);

const mapRowToProforma = (row, items = []) => ({
  id: row.id_proforma,
  id_proforma: row.id_proforma,
  number: row.numero_proforma,
  transactionNumber: formatTransactionNumber(row.transaction_number),
  clientId: row.id_cliente,
  clientName: row.cliente_nombre,
  clientIdentification: row.cliente_identificacion,
  clientPhone: row.cliente_telefono || '',
  clientEmail: row.cliente_email || '',
  clientAddress: row.cliente_direccion || '',
  createdAt: row.fecha_emision,
  validUntil: row.valid_until,
  notes: row.notes || '',
  subtotal: Number(row.subtotal_sin_impuestos || 0),
  subtotalConIva: Number(row.subtotal_con_iva || 0),
  subtotalIvaCero: Number(row.subtotal_iva_cero || 0),
  discount: Number(row.descuento_total || 0),
  iva: Number(row.valor_iva || 0),
  total: Number(row.total || 0),
  status: row.estado,
  username: row.username || '',
  items,
});

const mapDetailRow = (row) => ({
  id: row.id_detalle,
  productId: row.id_producto,
  code: row.producto_codigo || '-',
  name: row.producto_nombre || 'Producto',
  quantity: Number(row.cantidad || 0),
  price: Number(row.precio_unitario || 0),
  taxPercent: Number(row.porcentaje_iva || 0),
  discount: Number(row.descuento_total || 0),
  discountAmount: Number(row.descuento_valor || 0),
  discountPercent: Number(row.descuento_porcentaje || 0),
  subtotal: Number(row.subtotal_sin_iva || 0),
  iva: Number(row.valor_iva || 0),
  total: Number(row.total || 0),
  measure: row.producto_referencia || '-',
  brand: row.producto_marca || '-',
  stock: Number(row.stock_actual || 0),
});

const verifyUserPassword = async (userId, password) => {
  if (!password) {
    throw new Error('La clave del usuario es requerida para esta accion.');
  }

  const userResult = await db.query(
    'SELECT password_hash FROM usuarios WHERE id_usuario = $1 AND activo = true',
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new Error('Usuario no encontrado o inactivo.');
  }

  const passwordMatch = await bcrypt.compare(password, userResult.rows[0].password_hash);
  if (!passwordMatch) {
    throw new Error('Clave de usuario incorrecta.');
  }
};

const buildCalculatedDetails = async (client, items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Agrega al menos un producto a la proforma.');
  }

  let subtotalSinImpuestos = 0;
  let subtotalConIva = 0;
  let subtotalIvaCero = 0;
  let descuentoTotal = 0;
  let valorIvaTotal = 0;
  const details = [];

  for (const item of items) {
    const idProducto = item.id_producto || item.productId;
    const cantidad = Number(item.cantidad ?? item.quantity ?? 0);
    const precioUnitario = Number(item.precio_unitario ?? item.price ?? 0);
    const descuentoValor = Number(item.descuento ?? item.discountAmount ?? 0);
    const descuentoPorcentaje = Number(item.descuento_porcentaje ?? item.discountPercent ?? 0);

    if (!idProducto || cantidad <= 0 || precioUnitario < 0) {
      throw new Error('Cada detalle debe tener producto, cantidad y precio validos.');
    }

    const productResult = await client.query(`
      SELECT p.id_producto, p.nombre, p.codigo, p.referencia, p.marca, p.stock_actual,
             COALESCE(i.porcentaje, $2) AS porcentaje_iva
      FROM productos p
      LEFT JOIN impuestos i ON p.id_impuesto = i.id_impuesto
      WHERE p.id_producto = $1
    `, [idProducto, Number(item.iva_porcentaje ?? item.taxPercent ?? 0)]);

    if (productResult.rows.length === 0) {
      throw new Error(`Producto ${idProducto} no encontrado.`);
    }

    const product = productResult.rows[0];
    const porcentajeIva = Number(product.porcentaje_iva || 0);
    const subtotalSinIva = cantidad * precioUnitario;
    const valorIva = subtotalSinIva * (porcentajeIva / 100);
    const precioFinal = subtotalSinIva + valorIva;
    const descuentoPorcentajeValor = precioFinal * (descuentoPorcentaje / 100);
    const descuentoLineaTotal = Math.min(precioFinal, descuentoValor + descuentoPorcentajeValor);
    const totalLinea = Math.max(precioFinal - descuentoLineaTotal, 0);

    subtotalSinImpuestos += subtotalSinIva;
    descuentoTotal += descuentoLineaTotal;
    valorIvaTotal += valorIva;

    if (porcentajeIva > 0) {
      subtotalConIva += subtotalSinIva;
    } else {
      subtotalIvaCero += subtotalSinIva;
    }

    details.push({
      idProducto,
      cantidad,
      precioUnitario,
      descuentoValor,
      descuentoPorcentaje,
      descuentoLineaTotal,
      porcentajeIva,
      valorIva,
      subtotalSinIva,
      totalLinea,
    });
  }

  return {
    details,
    subtotalSinImpuestos,
    subtotalConIva,
    subtotalIvaCero,
    descuentoTotal,
    valorIvaTotal,
    total: Math.max(subtotalSinImpuestos + valorIvaTotal - descuentoTotal, 0),
  };
};

const insertDetails = async (client, idProforma, details) => {
  for (const detail of details) {
    await client.query(`
      INSERT INTO proforma_detalles (
        id_proforma, id_producto, cantidad, precio_unitario, descuento_valor,
        descuento_porcentaje, descuento_total, porcentaje_iva, valor_iva,
        subtotal_sin_iva, total
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      idProforma,
      detail.idProducto,
      detail.cantidad,
      detail.precioUnitario,
      detail.descuentoValor,
      detail.descuentoPorcentaje,
      detail.descuentoLineaTotal,
      detail.porcentajeIva,
      detail.valorIva,
      detail.subtotalSinIva,
      detail.totalLinea,
    ]);
  }
};

const fetchProformaById = async (id) => {
  const headerResult = await db.query(`
    SELECT p.*, c.name AS cliente_nombre, c.identification_number AS cliente_identificacion,
           c.phone AS cliente_telefono, c.email AS cliente_email, c.address AS cliente_direccion,
           u.username
    FROM proformas p
    JOIN clients c ON p.id_cliente = c.id
    LEFT JOIN usuarios u ON p.id_usuario = u.id_usuario
    WHERE p.id_proforma = $1
  `, [id]);

  if (headerResult.rows.length === 0) return null;

  const detailResult = await db.query(`
    SELECT pd.*, p.nombre AS producto_nombre, p.codigo AS producto_codigo,
           p.referencia AS producto_referencia, p.marca AS producto_marca,
           p.stock_actual
    FROM proforma_detalles pd
    JOIN productos p ON pd.id_producto = p.id_producto
    WHERE pd.id_proforma = $1
    ORDER BY pd.id_detalle ASC
  `, [id]);

  return mapRowToProforma(headerResult.rows[0], detailResult.rows.map(mapDetailRow));
};

router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.*, c.name AS cliente_nombre, c.identification_number AS cliente_identificacion,
             c.phone AS cliente_telefono, c.email AS cliente_email, c.address AS cliente_direccion,
             u.username
      FROM proformas p
      JOIN clients c ON p.id_cliente = c.id
      LEFT JOIN usuarios u ON p.id_usuario = u.id_usuario
      ORDER BY p.transaction_number DESC
    `);

    const proformas = [];
    for (const row of result.rows) {
      const detailResult = await db.query(`
        SELECT pd.*, p.nombre AS producto_nombre, p.codigo AS producto_codigo,
               p.referencia AS producto_referencia, p.marca AS producto_marca,
               p.stock_actual
        FROM proforma_detalles pd
        JOIN productos p ON pd.id_producto = p.id_producto
        WHERE pd.id_proforma = $1
        ORDER BY pd.id_detalle ASC
      `, [row.id_proforma]);
      proformas.push(mapRowToProforma(row, detailResult.rows.map(mapDetailRow)));
    }

    res.json(proformas);
  } catch (error) {
    console.error('Error al obtener proformas:', error);
    res.status(500).json({ error: 'Error al consultar proformas.' });
  }
});

router.get('/next-transaction', async (req, res) => {
  try {
    const result = await db.query('SELECT COALESCE(MAX(transaction_number), 0) + 1 AS next_value FROM proformas');
    const nextValue = Number(result.rows[0].next_value || 1);
    res.json({ transactionNumber: formatTransactionNumber(nextValue), value: nextValue });
  } catch (error) {
    console.error('Error al obtener siguiente transaccion:', error);
    res.status(500).json({ error: 'Error al consultar el siguiente numero de transaccion.' });
  }
});

router.get('/number/:number', async (req, res) => {
  try {
    const normalizedNumber = String(req.params.number || '').trim().toUpperCase();
    const headerResult = await db.query(
      "SELECT id_proforma FROM proformas WHERE UPPER(numero_proforma) = $1 OR LPAD(transaction_number::text, 6, '0') = $1",
      [normalizedNumber]
    );

    if (headerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Proforma no encontrada.' });
    }

    const proforma = await fetchProformaById(headerResult.rows[0].id_proforma);
    res.json(proforma);
  } catch (error) {
    console.error('Error al buscar proforma por numero:', error);
    res.status(500).json({ error: 'Error al buscar la proforma.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const proforma = await fetchProformaById(req.params.id);
    if (!proforma) return res.status(404).json({ error: 'Proforma no encontrada.' });
    res.json(proforma);
  } catch (error) {
    console.error('Error al obtener proforma:', error);
    res.status(500).json({ error: 'Error al consultar la proforma.' });
  }
});

router.post('/', async (req, res) => {
  const { id_cliente, validUntil, notes, items } = req.body;

  if (!id_cliente) {
    return res.status(400).json({ error: 'Selecciona un cliente para la proforma.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const totals = await buildCalculatedDetails(client, items);
    await client.query('LOCK TABLE proformas IN EXCLUSIVE MODE');
    const seqResult = await client.query('SELECT COALESCE(MAX(transaction_number), 0) + 1 AS next_value FROM proformas');
    const transactionNumber = Number(seqResult.rows[0].next_value || 1);
    const numeroProforma = formatProformaNumber(transactionNumber);

    const insertResult = await client.query(`
      INSERT INTO proformas (
        transaction_number, numero_proforma, valid_until, id_cliente, id_usuario, notes,
        subtotal_sin_impuestos, subtotal_con_iva, subtotal_iva_cero,
        descuento_total, valor_iva, total
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id_proforma
    `, [
      transactionNumber,
      numeroProforma,
      validUntil || null,
      id_cliente,
      req.user.id_usuario,
      notes || '',
      totals.subtotalSinImpuestos,
      totals.subtotalConIva,
      totals.subtotalIvaCero,
      totals.descuentoTotal,
      totals.valorIvaTotal,
      totals.total,
    ]);

    await insertDetails(client, insertResult.rows[0].id_proforma, totals.details);
    await writeAudit(client, {
      entity: 'proformas',
      entityId: insertResult.rows[0].id_proforma,
      action: 'CREAR_PROFORMA',
      userId: req.user.id_usuario,
      detail: { numero_proforma: numeroProforma, total: totals.total },
    });
    await client.query('COMMIT');

    const proforma = await fetchProformaById(insertResult.rows[0].id_proforma);
    res.status(201).json(proforma);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear proforma:', error);
    res.status(400).json({ error: error.message || 'Error al guardar la proforma.' });
  } finally {
    client.release();
  }
});

router.put('/:id', async (req, res) => {
  const { id_cliente, validUntil, notes, items, editPassword } = req.body;

  const client = await db.pool.connect();
  try {
    await verifyUserPassword(req.user.id_usuario, editPassword);
    await client.query('BEGIN');

    const existsResult = await client.query('SELECT id_proforma, estado FROM proformas WHERE id_proforma = $1', [req.params.id]);
    if (existsResult.rows.length === 0) {
      throw new Error('Proforma no encontrada.');
    }
    if (existsResult.rows[0].estado !== 'BORRADOR') {
      throw new Error('Solo se pueden editar proformas en estado BORRADOR.');
    }

    const totals = await buildCalculatedDetails(client, items);
    await client.query(`
      UPDATE proformas
      SET id_cliente = $1,
          valid_until = $2,
          notes = $3,
          subtotal_sin_impuestos = $4,
          subtotal_con_iva = $5,
          subtotal_iva_cero = $6,
          descuento_total = $7,
          valor_iva = $8,
          total = $9,
          updated_at = CURRENT_TIMESTAMP
      WHERE id_proforma = $10
    `, [
      id_cliente,
      validUntil || null,
      notes || '',
      totals.subtotalSinImpuestos,
      totals.subtotalConIva,
      totals.subtotalIvaCero,
      totals.descuentoTotal,
      totals.valorIvaTotal,
      totals.total,
      req.params.id,
    ]);

    await client.query('DELETE FROM proforma_detalles WHERE id_proforma = $1', [req.params.id]);
    await insertDetails(client, req.params.id, totals.details);
    await writeAudit(client, {
      entity: 'proformas',
      entityId: req.params.id,
      action: 'EDITAR_PROFORMA',
      userId: req.user.id_usuario,
      detail: { total: totals.total },
    });
    await client.query('COMMIT');

    const proforma = await fetchProformaById(req.params.id);
    res.json(proforma);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al editar proforma:', error);
    res.status(400).json({ error: error.message || 'Error al editar la proforma.' });
  } finally {
    client.release();
  }
});

router.patch('/:id/approve', async (req, res) => {
  const { editPassword } = req.body || {};
  const client = await db.pool.connect();

  try {
    await verifyUserPassword(req.user.id_usuario, editPassword);
    await client.query('BEGIN');

    const current = await client.query(
      'SELECT id_proforma, estado, numero_proforma FROM proformas WHERE id_proforma = $1 FOR UPDATE',
      [req.params.id]
    );
    if (current.rows.length === 0) {
      throw new Error('Proforma no encontrada.');
    }
    if (current.rows[0].estado !== 'BORRADOR') {
      throw new Error('Solo se pueden aprobar proformas en estado BORRADOR.');
    }

    await client.query(
      "UPDATE proformas SET estado = 'APROBADA', aprobada_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id_proforma = $1",
      [req.params.id]
    );
    await writeAudit(client, {
      entity: 'proformas',
      entityId: req.params.id,
      action: 'APROBAR_PROFORMA',
      userId: req.user.id_usuario,
      detail: { numero_proforma: current.rows[0].numero_proforma },
    });

    await client.query('COMMIT');
    const proforma = await fetchProformaById(req.params.id);
    res.json(proforma);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al aprobar proforma:', error);
    res.status(400).json({ error: error.message || 'Error al aprobar la proforma.' });
  } finally {
    client.release();
  }
});

router.patch('/:id/cancel', async (req, res) => {
  const { editPassword, reason } = req.body || {};
  const client = await db.pool.connect();

  try {
    await verifyUserPassword(req.user.id_usuario, editPassword);
    if (!String(reason || '').trim()) {
      throw new Error('El motivo de anulacion es obligatorio.');
    }
    await client.query('BEGIN');

    const current = await client.query(
      'SELECT id_proforma, estado, numero_proforma FROM proformas WHERE id_proforma = $1 FOR UPDATE',
      [req.params.id]
    );
    if (current.rows.length === 0) {
      throw new Error('Proforma no encontrada.');
    }
    if (['FACTURADA', 'ANULADA'].includes(current.rows[0].estado)) {
      throw new Error('No se puede anular una proforma facturada o ya anulada.');
    }

    await client.query(
      "UPDATE proformas SET estado = 'ANULADA', motivo_anulacion = $1, anulada_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id_proforma = $2",
      [String(reason).trim(), req.params.id]
    );
    await writeAudit(client, {
      entity: 'proformas',
      entityId: req.params.id,
      action: 'ANULAR_PROFORMA',
      userId: req.user.id_usuario,
      detail: { numero_proforma: current.rows[0].numero_proforma, reason: String(reason).trim() },
    });

    await client.query('COMMIT');
    const proforma = await fetchProformaById(req.params.id);
    res.json(proforma);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al anular proforma:', error);
    res.status(400).json({ error: error.message || 'Error al anular la proforma.' });
  } finally {
    client.release();
  }
});

router.delete('/:id', async (req, res) => {
  res.status(405).json({ error: 'Las proformas no se eliminan. Usa la opcion Anular para mantener trazabilidad.' });
});

module.exports = router;
