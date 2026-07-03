const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('./auth');
const { writeAudit } = require('../audit');
const { generarClaveAccesoSRI } = require('../sri_utils');

router.use(authenticateToken);

const formatSequential = (num) => String(num).padStart(9, '0');

router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT f.*, c.name as cliente_nombre, c.identification_number as cliente_identificacion, u.username
      FROM facturas f
      JOIN clients c ON f.id_cliente = c.id
      LEFT JOIN usuarios u ON f.id_usuario = u.id_usuario
      ORDER BY f.fecha_emision DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener facturas:', error);
    res.status(500).json({ error: 'Error al consultar facturas emitidas.' });
  }
});

// Obtener facturas con saldo pendiente (Cuentas por Cobrar)
router.get('/receivables', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT f.*, c.name as cliente_nombre, c.identification_number as cliente_identificacion, c.phone as cliente_telefono, u.username
      FROM facturas f
      JOIN clients c ON f.id_cliente = c.id
      LEFT JOIN usuarios u ON f.id_usuario = u.id_usuario
      WHERE f.estado = 'EMITIDA' AND f.saldo > 0
      ORDER BY f.fecha_emision DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener cuentas por cobrar:', error);
    res.status(500).json({ error: 'Error al consultar las cuentas por cobrar.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const invoiceRes = await db.query(`
      SELECT f.*, c.name as cliente_nombre, c.identification_number as cliente_identificacion,
             c.email as cliente_email, c.phone as cliente_telefono, c.address as cliente_direccion,
             s.codigo_establecimiento, s.punto_emision, s.nombre as sucursal_nombre,
             mp.nombre as metodo_pago_nombre
      FROM facturas f
      JOIN clients c ON f.id_cliente = c.id
      JOIN sucursales s ON f.id_sucursal = s.id_sucursal
      LEFT JOIN metodos_pago mp ON f.id_metodo_pago = mp.id_metodo
      WHERE f.id_factura = $1
    `, [req.params.id]);

    if (invoiceRes.rows.length === 0) {
      return res.status(404).json({ error: 'Factura no encontrada.' });
    }

    const detailsRes = await db.query(`
      SELECT fd.*, p.nombre as producto_nombre, p.codigo as producto_codigo
      FROM factura_detalles fd
      JOIN productos p ON fd.id_producto = p.id_producto
      WHERE fd.id_factura = $1
      ORDER BY fd.id_detalle ASC
    `, [req.params.id]);

    const paymentsRes = await db.query(`
      SELECT fp.*, mp.nombre AS metodo_pago_nombre, mp.codigo_sri
      FROM factura_pagos fp
      LEFT JOIN metodos_pago mp ON fp.id_metodo_pago = mp.id_metodo
      WHERE fp.id_factura = $1
      ORDER BY fp.id_pago ASC
    `, [req.params.id]).catch((error) => {
      if (error.code === '42P01') return { rows: [] };
      throw error;
    });

    const cobrosRes = await db.query(`
      SELECT fc.*, mp.nombre AS metodo_pago_nombre, u.username
      FROM factura_cobros fc
      LEFT JOIN metodos_pago mp ON fc.id_metodo_pago = mp.id_metodo
      LEFT JOIN usuarios u ON fc.id_usuario = u.id_usuario
      WHERE fc.id_factura = $1
      ORDER BY fc.fecha_cobro ASC
    `, [req.params.id]).catch((error) => {
      if (error.code === '42P01') return { rows: [] };
      throw error;
    });

    res.json({
      invoice: invoiceRes.rows[0],
      details: detailsRes.rows,
      payments: paymentsRes.rows,
      cobros: cobrosRes.rows,
    });
  } catch (error) {
    console.error('Error al obtener detalle de factura:', error);
    res.status(500).json({ error: 'Error al consultar el detalle de la factura.' });
  }
});

router.post('/', async (req, res) => {
  const { id_cliente, id_usuario, id_metodo_pago, id_proforma, items, monto_pago, anticipo, observacion, payments } = req.body;

  const normalizedPayments = Array.isArray(payments)
    ? payments
        .map((payment) => ({
          id_metodo_pago: Number(payment.id_metodo_pago || payment.methodId || 0),
          monto: Math.max(parseFloat(payment.monto ?? payment.amount ?? 0) || 0, 0),
          referencia: String(payment.referencia || payment.reference || '').trim(),
        }))
        .filter((payment) => payment.id_metodo_pago && payment.monto > 0)
    : [];
  const primaryPaymentId = Number(id_metodo_pago || normalizedPayments[0]?.id_metodo_pago || 0);

  if (!id_cliente || !id_usuario || !primaryPaymentId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Faltan datos requeridos para emitir la factura.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    if (id_proforma) {
      const proformaRes = await client.query(
        'SELECT estado FROM proformas WHERE id_proforma = $1 FOR UPDATE',
        [id_proforma]
      );
      if (proformaRes.rows.length === 0) {
        throw new Error('La proforma seleccionada no existe.');
      }
      if (proformaRes.rows[0].estado === 'FACTURADA') {
        throw new Error('La proforma seleccionada ya fue facturada.');
      }
      if (proformaRes.rows[0].estado === 'ANULADA') {
        throw new Error('No se puede facturar una proforma anulada.');
      }
    }

    const branchRes = await client.query(`
      SELECT s.id_sucursal, s.codigo_establecimiento, s.punto_emision
      FROM sucursales s
      WHERE s.activo = true
      LIMIT 1
    `);
    if (branchRes.rows.length === 0) {
      throw new Error('No hay sucursales activas configuradas.');
    }
    const { id_sucursal, codigo_establecimiento, punto_emision } = branchRes.rows[0];

    const boxSessionRes = await client.query(`
      SELECT id_sesion FROM sesiones_caja
      WHERE id_usuario = $1 AND estado = 'ABIERTA'
      ORDER BY fecha_apertura DESC LIMIT 1
    `, [id_usuario]);
    if (boxSessionRes.rows.length === 0) {
      throw new Error('Debe tener un turno de caja abierta para poder facturar.');
    }
    const id_sesion_caja = boxSessionRes.rows[0].id_sesion;

    const seqRes = await client.query(`
      SELECT secuencial_actual FROM secuenciales
      WHERE id_sucursal = $1 AND tipo_comprobante = 'FACTURA' AND activo = true
      FOR UPDATE
    `, [id_sucursal]);

    let seqActual = 1;
    if (seqRes.rows.length > 0) {
      seqActual = seqRes.rows[0].secuencial_actual;
      await client.query(`
        UPDATE secuenciales
        SET secuencial_actual = secuencial_actual + 1
        WHERE id_sucursal = $1 AND tipo_comprobante = 'FACTURA'
      `, [id_sucursal]);
    } else {
      await client.query(`
        INSERT INTO secuenciales (id_sucursal, tipo_comprobante, secuencial_actual)
        VALUES ($1, 'FACTURA', 2)
      `, [id_sucursal]);
    }

    const secuencialStr = formatSequential(seqActual);
    const numeroFactura = `${codigo_establecimiento}-${punto_emision}-${secuencialStr}`;

    let subtotalSinImpuestos = 0;
    let subtotalConIva = 0;
    let subtotalIvaCero = 0;
    let descuentoTotal = 0;
    let valorIvaTotal = 0;
    const detailLines = [];

    for (const item of items) {
      const idProducto = item.id_producto;
      const cantVal = parseFloat(item.cantidad) || 0;
      const priceVal = parseFloat(item.precio_unitario) || 0;
      const descVal = parseFloat(item.descuento) || 0;
      const descPercentVal = parseFloat(item.descuento_porcentaje) || 0;

      if (!idProducto || cantVal <= 0 || priceVal < 0 || descVal < 0 || descPercentVal < 0 || descPercentVal > 100) {
        throw new Error('Cada detalle debe tener producto, cantidad, precio y descuento validos.');
      }

      const prodRes = await client.query(`
        SELECT p.nombre, p.stock_actual, p.id_impuesto, i.porcentaje, i.nombre as impuesto_nombre
        FROM productos p
        JOIN impuestos i ON p.id_impuesto = i.id_impuesto
        WHERE p.id_producto = $1
      `, [idProducto]);
      if (prodRes.rows.length === 0) {
        throw new Error(`Producto con ID ${idProducto} no encontrado.`);
      }

      const product = prodRes.rows[0];
      const stockActual = parseFloat(product.stock_actual);
      if (stockActual < cantVal) {
        throw new Error(`Stock insuficiente para "${product.nombre}". Disponible: ${stockActual}, Requerido: ${cantVal}`);
      }

      const baseLine = cantVal * priceVal;
      const taxPercent = parseFloat(product.porcentaje) || 0;
      const lineIva = baseLine * (taxPercent / 100);
      const finalBeforeDiscount = baseLine + lineIva;
      const percentDiscountValue = finalBeforeDiscount * (descPercentVal / 100);
      const lineDiscountTotal = Math.min(finalBeforeDiscount, descVal + percentDiscountValue);

      subtotalSinImpuestos += baseLine;
      descuentoTotal += lineDiscountTotal;
      valorIvaTotal += lineIva;
      if (taxPercent > 0) {
        subtotalConIva += baseLine;
      } else {
        subtotalIvaCero += baseLine;
      }

      detailLines.push({
        id_producto: idProducto,
        cantidad: cantVal,
        precio_unitario: priceVal,
        descuento: descVal,
        descuento_porcentaje: descPercentVal,
        descuento_total: lineDiscountTotal,
        id_impuesto: product.id_impuesto,
        porcentaje_iva: taxPercent,
        valor_iva: lineIva,
        precio_total: baseLine,
      });
    }

    const totalFactura = Math.max(subtotalSinImpuestos + valorIvaTotal - descuentoTotal, 0);
    const anticipoVal = Math.max(parseFloat(anticipo) || 0, 0);
    const pagoVal = normalizedPayments.length > 0
      ? normalizedPayments.reduce((sum, payment) => sum + payment.monto, 0)
      : Math.max(parseFloat(monto_pago) || 0, 0);
    const totalPagado = anticipoVal + pagoVal;
    const cambio = Math.max(totalPagado - totalFactura, 0);
    const saldo = Math.max(totalFactura - totalPagado, 0);

    const accessKey = generarClaveAccesoSRI({
      fechaEmision: new Date(),
      tipoComprobante: '01',
      ruc: '1792345678001',
      ambiente: '1',
      establecimiento: codigo_establecimiento,
      puntoEmision: punto_emision,
      secuencial: seqActual,
    });

    const invoiceInserted = await client.query(`
      INSERT INTO facturas (
        id_sucursal, secuencial, numero_factura, id_cliente, id_usuario, id_sesion_caja,
        subtotal_sin_impuestos, subtotal_con_iva, subtotal_iva_cero, descuento_total,
        valor_iva, total, id_metodo_pago, id_proforma, monto_pago, anticipo, cambio, saldo, observacion, clave_acceso
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `, [
      id_sucursal,
      secuencialStr,
      numeroFactura,
      id_cliente,
      id_usuario,
      id_sesion_caja,
      subtotalSinImpuestos,
      subtotalConIva,
      subtotalIvaCero,
      descuentoTotal,
      valorIvaTotal,
      totalFactura,
      primaryPaymentId,
      id_proforma || null,
      pagoVal,
      anticipoVal,
      cambio,
      saldo,
      observacion || '',
      accessKey,
    ]);
    const id_factura = invoiceInserted.rows[0].id_factura;

    if (normalizedPayments.length === 0 && pagoVal > 0) {
      normalizedPayments.push({
        id_metodo_pago: primaryPaymentId,
        monto: pagoVal,
        referencia: '',
      });
    }

    for (const payment of normalizedPayments) {
      await client.query(`
        INSERT INTO factura_pagos (id_factura, id_metodo_pago, monto, referencia)
        VALUES ($1, $2, $3, $4)
      `, [id_factura, payment.id_metodo_pago, payment.monto, payment.referencia]);
    }

    for (const line of detailLines) {
      await client.query(`
        INSERT INTO factura_detalles (
          id_factura, id_producto, cantidad, precio_unitario, descuento,
          descuento_porcentaje, descuento_total, id_impuesto, porcentaje_iva, valor_iva, precio_total
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        id_factura,
        line.id_producto,
        line.cantidad,
        line.precio_unitario,
        line.descuento,
        line.descuento_porcentaje,
        line.descuento_total,
        line.id_impuesto,
        line.porcentaje_iva,
        line.valor_iva,
        line.precio_total,
      ]);

      await client.query(`
        INSERT INTO movimientos_inventario (id_producto, tipo, cantidad, motivo, referencia, id_usuario)
        VALUES ($1, 'EGRESO', $2, 'VENTA', $3, $4)
      `, [line.id_producto, line.cantidad, numeroFactura, id_usuario]);

      await client.query(`
        UPDATE productos
        SET stock_actual = stock_actual - $1
        WHERE id_producto = $2
      `, [line.cantidad, line.id_producto]);
    }

    if (id_proforma) {
      await client.query(
        "UPDATE proformas SET estado = 'FACTURADA', updated_at = CURRENT_TIMESTAMP WHERE id_proforma = $1",
        [id_proforma]
      );
    }

    await writeAudit(client, {
      entity: 'facturas',
      entityId: id_factura,
      action: id_proforma ? 'FACTURAR_PROFORMA' : 'EMITIR_FACTURA',
      userId: id_usuario,
      detail: { numero_factura: numeroFactura, id_proforma: id_proforma || null, total: totalFactura, saldo },
    });

    await client.query('COMMIT');
    res.status(201).json(invoiceInserted.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar factura:', error);
    res.status(400).json({ error: error.message || 'Error al emitir la factura.' });
  } finally {
    client.release();
  }
});

router.put('/:id/cancel', authorizeRoles('ADMINISTRADOR', 'CONTADOR'), async (req, res) => {
  const { id } = req.params;
  const { id_usuario, reason } = req.body;

  if (!id_usuario) {
    return res.status(400).json({ error: 'El ID de usuario es requerido para anular.' });
  }
  if (!String(reason || '').trim()) {
    return res.status(400).json({ error: 'El motivo de anulacion es obligatorio.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const factRes = await client.query('SELECT * FROM facturas WHERE id_factura = $1', [id]);
    if (factRes.rows.length === 0) {
      throw new Error('Factura no encontrada.');
    }
    const factura = factRes.rows[0];

    if (factura.estado === 'ANULADA') {
      throw new Error('La factura ya se encuentra anulada.');
    }

    const detailsRes = await client.query('SELECT * FROM factura_detalles WHERE id_factura = $1', [id]);
    for (const detail of detailsRes.rows) {
      await client.query(`
        INSERT INTO movimientos_inventario (id_producto, tipo, cantidad, motivo, referencia, id_usuario)
        VALUES ($1, 'INGRESO', $2, 'DEVOLUCION', $3, $4)
      `, [detail.id_producto, detail.cantidad, factura.numero_factura, id_usuario]);

      await client.query(`
        UPDATE productos
        SET stock_actual = stock_actual + $1
        WHERE id_producto = $2
      `, [detail.cantidad, detail.id_producto]);
    }

    const updRes = await client.query(`
      UPDATE facturas
      SET estado = 'ANULADA',
          motivo_anulacion = $2,
          anulada_at = CURRENT_TIMESTAMP,
          anulada_por = $3
      WHERE id_factura = $1
      RETURNING *
    `, [id, String(reason).trim(), id_usuario]);

    await writeAudit(client, {
      entity: 'facturas',
      entityId: id,
      action: 'ANULAR_FACTURA',
      userId: id_usuario,
      detail: { numero_factura: factura.numero_factura, reason: String(reason).trim() },
    });

    await client.query('COMMIT');
    res.json(updRes.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al anular factura:', error);
    res.status(400).json({ error: error.message || 'Error al procesar la anulacion.' });
  } finally {
    client.release();
  }
});

// Registrar un abono (cobro) a una factura con saldo pendiente (Cuentas por Cobrar)
router.post('/:id/payments', async (req, res) => {
  const { id } = req.params;
  const { id_metodo_pago, monto, referencia, id_usuario } = req.body || {};

  if (!id_metodo_pago || !monto || parseFloat(monto) <= 0 || !id_usuario) {
    return res.status(400).json({ error: 'Faltan datos obligatorios para registrar el cobro.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Obtener factura y bloquear fila
    const factRes = await client.query(
      'SELECT id_factura, numero_factura, saldo, total, estado FROM facturas WHERE id_factura = $1 FOR UPDATE',
      [id]
    );

    if (factRes.rows.length === 0) {
      throw new Error('Factura no encontrada.');
    }

    const factura = factRes.rows[0];
    if (factura.estado === 'ANULADA') {
      throw new Error('No se pueden registrar cobros en una factura anulada.');
    }

    const currentSaldo = parseFloat(factura.saldo || 0);
    const paymentAmount = parseFloat(monto);

    if (currentSaldo <= 0) {
      throw new Error('La factura ya está totalmente pagada.');
    }

    if (paymentAmount > currentSaldo + 0.0001) {
      throw new Error(`El monto del cobro ($${paymentAmount.toFixed(2)}) supera el saldo pendiente ($${currentSaldo.toFixed(2)}).`);
    }

    // Insertar cobro
    const cobroRes = await client.query(`
      INSERT INTO factura_cobros (id_factura, id_metodo_pago, monto, referencia, id_usuario)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [id, id_metodo_pago, paymentAmount, referencia || '', id_usuario]);

    // Actualizar saldo
    const newSaldo = Math.max(currentSaldo - paymentAmount, 0);
    await client.query(
      'UPDATE facturas SET saldo = $1 WHERE id_factura = $2',
      [newSaldo, id]
    );

    // Auditoría
    await writeAudit(client, {
      entity: 'facturas',
      entityId: id,
      action: 'REGISTRAR_COBRO_CXC',
      userId: id_usuario,
      detail: {
        numero_factura: factura.numero_factura,
        monto_cobro: paymentAmount,
        saldo_anterior: currentSaldo,
        nuevo_saldo: newSaldo,
        referencia: referencia || ''
      }
    });

    await client.query('COMMIT');
    res.status(201).json({
      message: 'Cobro registrado exitosamente.',
      payment: cobroRes.rows[0],
      nuevo_saldo: newSaldo
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar cobro cxc:', error);
    res.status(400).json({ error: error.message || 'Error al procesar el cobro.' });
  } finally {
    client.release();
  }
});

module.exports = router;
