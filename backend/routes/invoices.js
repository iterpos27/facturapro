const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizePermissions } = require('./auth');
const { writeAudit } = require('../utils/audit');
const { generarClaveAccesoSRI } = require('../utils/sri_utils');
const { validate, schemas } = require('../middleware/validate');
const { redactCompany } = require('../utils/secrets');
const { formatDocumentNumber, getDefaultBranch, nextDocumentSequential } = require('../services/sequential_service');
const { recordInventoryCostMovement } = require('../services/inventory_costing');
const logger = require('../utils/logger');

router.use(authenticateToken);

router.get('/', authorizePermissions('INVOICES_CRUD'), async (req, res) => {
  const page  = Math.max(parseInt(req.query.page  || '1',  10), 1);
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
  const offset = (page - 1) * limit;
  try {
    const [dataRes, countRes] = await Promise.all([
      db.query(`
        SELECT f.*, c.name as cliente_nombre, c.identification_number as cliente_identificacion, u.username
        FROM facturas f
        JOIN clients c ON f.id_cliente = c.id
        LEFT JOIN usuarios u ON f.id_usuario = u.id_usuario
        ORDER BY f.fecha_emision DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]),
      db.query('SELECT COUNT(*) FROM facturas'),
    ]);
    const total = parseInt(countRes.rows[0].count, 10);
    res.json({ data: dataRes.rows, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error) {
    logger.error({ err: error }, 'Error al obtener facturas');
    res.status(500).json({ error: 'Error al consultar facturas emitidas.' });
  }
});

// Obtener facturas con saldo pendiente (Cuentas por Cobrar)
// Optimizado: CTEs + LEFT JOINs en lugar de subconsultas correlacionadas por fila
router.get('/receivables', authorizePermissions('RECEIVABLES_CRUD'), async (req, res) => {
  try {
    const result = await db.query(`
      WITH proximas_gestiones AS (
        SELECT DISTINCT ON (fg.id_factura)
          fg.id_factura,
          fg.fecha_compromiso
        FROM factura_gestiones_cobranza fg
        WHERE fg.estado = 'ABIERTA'
        ORDER BY fg.id_factura, fg.fecha_compromiso ASC NULLS LAST, fg.created_at DESC
      ),
      conteo_gestiones AS (
        SELECT id_factura, COUNT(*)::int AS gestiones_count
        FROM factura_gestiones_cobranza
        GROUP BY id_factura
      )
      SELECT
        f.*,
        c.name                 AS cliente_nombre,
        c.identification_number AS cliente_identificacion,
        c.phone                AS cliente_telefono,
        u.username,
        CASE
          WHEN COALESCE(f.saldo, 0) <= 0 THEN 'PAGADA'
          WHEN f.fecha_vencimiento IS NOT NULL AND f.fecha_vencimiento < CURRENT_DATE THEN 'VENCIDA'
          WHEN EXISTS (
            SELECT 1 FROM factura_cobros fc WHERE fc.id_factura = f.id_factura
          ) THEN 'ABONADA'
          ELSE COALESCE(f.estado_cobranza, 'PENDIENTE')
        END AS estado_cobranza_actual,
        CASE
          WHEN f.fecha_vencimiento IS NULL THEN 0
          ELSE GREATEST((CURRENT_DATE - f.fecha_vencimiento), 0)
        END AS dias_vencidos,
        pg.fecha_compromiso   AS proxima_gestion,
        COALESCE(cg.gestiones_count, 0) AS gestiones_count
      FROM facturas f
      JOIN clients c ON f.id_cliente = c.id
      LEFT JOIN usuarios u ON f.id_usuario = u.id_usuario
      LEFT JOIN proximas_gestiones pg ON pg.id_factura = f.id_factura
      LEFT JOIN conteo_gestiones  cg ON cg.id_factura = f.id_factura
      WHERE f.estado = 'EMITIDA'
        AND (
          COALESCE(f.saldo, 0) > 0
          OR f.tipo_venta = 'CREDITO'
          OR EXISTS (SELECT 1 FROM factura_cobros fc WHERE fc.id_factura = f.id_factura)
        )
      ORDER BY
        CASE WHEN COALESCE(f.saldo, 0) > 0 THEN 0 ELSE 1 END,
        f.fecha_vencimiento ASC NULLS LAST,
        f.fecha_emision DESC
    `);
    res.json(result.rows);
  } catch (error) {
    logger.error({ err: error }, 'Error al obtener cuentas por cobrar');
    res.status(500).json({ error: 'Error al consultar las cuentas por cobrar.' });
  }
});

router.get('/:id', authorizePermissions('INVOICES_CRUD'), async (req, res) => {
  try {
    const invoiceRes = await db.query(`
      SELECT f.*, c.name as cliente_nombre, c.identification_number as cliente_identificacion,
             c.email as cliente_email, c.phone as cliente_telefono, c.address as cliente_direccion,
             s.codigo_establecimiento, s.punto_emision, s.nombre as sucursal_nombre,
             s.direccion as sucursal_direccion,
             mp.nombre as metodo_pago_nombre,
             u.username
      FROM facturas f
      JOIN clients c ON f.id_cliente = c.id
      JOIN sucursales s ON f.id_sucursal = s.id_sucursal
      LEFT JOIN metodos_pago mp ON f.id_metodo_pago = mp.id_metodo
      LEFT JOIN usuarios u ON f.id_usuario = u.id_usuario
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

    const gestionesRes = await db.query(`
      SELECT fg.*, u.username
      FROM factura_gestiones_cobranza fg
      LEFT JOIN usuarios u ON fg.id_usuario = u.id_usuario
      WHERE fg.id_factura = $1
      ORDER BY fg.created_at DESC
    `, [req.params.id]).catch((error) => {
      if (error.code === '42P01') return { rows: [] };
      throw error;
    });

    const companyRes = await db.query('SELECT * FROM empresas LIMIT 1');

    res.json({
      invoice: invoiceRes.rows[0],
      details: detailsRes.rows,
      payments: paymentsRes.rows,
      cobros: cobrosRes.rows,
      gestiones: gestionesRes.rows,
      company: redactCompany(companyRes.rows[0]),
    });
  } catch (error) {
    console.error('Error al obtener detalle de factura:', error);
    res.status(500).json({ error: 'Error al consultar el detalle de la factura.' });
  }
});

router.post('/', authorizePermissions('INVOICES_CRUD'), validate(schemas.createInvoice), async (req, res) => {
  const {
    id_cliente,
    id_metodo_pago,
    id_proforma,
    items,
    monto_pago,
    anticipo,
    observacion,
    payments,
    tipo_pago,
    dias_credito,
  } = req.body;
  const id_usuario = req.user.id_usuario;

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

    const branch = await getDefaultBranch(client);
    const { id_sucursal, codigo_establecimiento, punto_emision } = branch;

    const boxSessionRes = await client.query(`
      SELECT id_sesion FROM sesiones_caja
      WHERE id_usuario = $1 AND estado = 'ABIERTA'
      ORDER BY fecha_apertura DESC LIMIT 1
    `, [id_usuario]);
    if (boxSessionRes.rows.length === 0) {
      throw new Error('Debe tener un turno de caja abierta para poder facturar.');
    }
    const id_sesion_caja = boxSessionRes.rows[0].id_sesion;

    const seqActual = await nextDocumentSequential(client, id_sucursal, 'FACTURA');
    const secuencialStr = String(seqActual).padStart(9, '0');
    const numeroFactura = formatDocumentNumber(branch, seqActual);

    let subtotalSinImpuestos = 0;
    let subtotalConIva = 0;
    let subtotalIvaCero = 0;
    let descuentoTotal = 0;
    let valorIvaTotal = 0;
    const detailLines = [];

    // ── Prefetch de productos: 1 sola query para todos los ítems ──────────────
    // Evita el cuello de botella N+1 (antes: 1 query por ítem dentro de la TX)
    const productIds = [...new Set(items.map((item) => Number(item.id_producto)))];
    const productRes = await client.query(`
      SELECT p.id_producto, p.nombre, p.stock_actual, p.id_impuesto, i.porcentaje, i.nombre as impuesto_nombre
      FROM productos p
      JOIN impuestos i ON p.id_impuesto = i.id_impuesto
      WHERE p.id_producto = ANY($1::int[])
    `, [productIds]);

    const productMap = new Map(productRes.rows.map((p) => [p.id_producto, p]));

    for (const item of items) {
      const idProducto = item.id_producto;
      const cantVal = parseFloat(item.cantidad) || 0;
      const priceVal = parseFloat(item.precio_unitario) || 0;
      const descVal = parseFloat(item.descuento) || 0;
      const descPercentVal = parseFloat(item.descuento_porcentaje) || 0;

      if (!idProducto || cantVal <= 0 || priceVal < 0 || descVal < 0 || descPercentVal < 0 || descPercentVal > 100) {
        throw new Error('Cada detalle debe tener producto, cantidad, precio y descuento validos.');
      }

      const product = productMap.get(Number(idProducto));
      if (!product) {
        throw new Error(`Producto con ID ${idProducto} no encontrado.`);
      }

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

    const clientDataRes = await client.query('SELECT identification_number FROM clients WHERE id = $1', [id_cliente]);
    if (clientDataRes.rows.length === 0) {
      throw new Error('El cliente seleccionado no existe.');
    }
    const clientIdent = clientDataRes.rows[0].identification_number;
    if (clientIdent === '9999999999999' && totalFactura > 50.00) {
      throw new Error('Las facturas a Consumidor Final no pueden superar los $50.00. Ingrese los datos de identificación del comprador.');
    }

    const anticipoVal = Math.max(parseFloat(anticipo) || 0, 0);
    const pagoVal = normalizedPayments.length > 0
      ? normalizedPayments.reduce((sum, payment) => sum + payment.monto, 0)
      : Math.max(parseFloat(monto_pago) || 0, 0);
    const totalPagado = anticipoVal + pagoVal;
    const cambio = Math.max(totalPagado - totalFactura, 0);
    const saldo = Math.max(totalFactura - totalPagado, 0);
    const tipoVenta = saldo > 0 || String(tipo_pago || '').toUpperCase() === 'CREDITO' ? 'CREDITO' : 'CONTADO';
    const diasCredito = tipoVenta === 'CREDITO'
      ? Math.max(parseInt(dias_credito || 15, 10) || 15, 1)
      : 0;
    const fechaVencimiento = tipoVenta === 'CREDITO'
      ? new Date(Date.now() + diasCredito * 24 * 60 * 60 * 1000)
      : null;
    const estadoCobranza = saldo <= 0
      ? 'PAGADA'
      : 'PENDIENTE';

    const companyRes = await client.query('SELECT ruc FROM empresas LIMIT 1');
    if (companyRes.rows.length === 0 || !companyRes.rows[0].ruc) {
      throw new Error('Configure el RUC de la empresa antes de emitir facturas.');
    }

    const accessKey = generarClaveAccesoSRI({
      fechaEmision: new Date(),
      tipoComprobante: '01',
      ruc: companyRes.rows[0].ruc,
      ambiente: '1',
      establecimiento: codigo_establecimiento,
      puntoEmision: punto_emision,
      secuencial: seqActual,
    });

    const invoiceInserted = await client.query(`
      INSERT INTO facturas (
        id_sucursal, secuencial, numero_factura, id_cliente, id_usuario, id_sesion_caja,
        subtotal_sin_impuestos, subtotal_con_iva, subtotal_iva_cero, descuento_total,
        valor_iva, total, id_metodo_pago, id_proforma, monto_pago, anticipo, cambio, saldo, observacion, clave_acceso,
        tipo_venta, dias_credito, fecha_vencimiento, estado_cobranza
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
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
      tipoVenta,
      diasCredito,
      fechaVencimiento,
      estadoCobranza,
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

      await recordInventoryCostMovement(client, {
        id_producto: line.id_producto,
        tipo: 'EGRESO',
        cantidad: line.cantidad,
        motivo: 'VENTA',
        referencia: numeroFactura,
        id_usuario,
        documento_tipo: 'FACTURA',
        documento_id: id_factura,
      });
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
      detail: { numero_factura: numeroFactura, id_proforma: id_proforma || null, total: totalFactura, saldo, tipo_venta: tipoVenta, dias_credito: diasCredito },
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

router.put('/:id/cancel', authorizePermissions('INVOICES_CRUD'), authorizePermissions('DOCUMENT_CANCEL'), validate(schemas.cancelDoc), async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const id_usuario = req.user.id_usuario;
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
      await recordInventoryCostMovement(client, {
        id_producto: detail.id_producto,
        tipo: 'INGRESO',
        cantidad: detail.cantidad,
        motivo: 'FACTURA_ANULADA',
        referencia: factura.numero_factura,
        id_usuario,
        documento_tipo: 'FACTURA_ANULADA',
        documento_id: factura.id_factura,
      });
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
router.post('/:id/payments', authorizePermissions('RECEIVABLES_CRUD'), validate(schemas.registerPayment), async (req, res) => {
  const { id } = req.params;
  const { id_metodo_pago, monto, referencia } = req.body || {};
  const id_usuario = req.user.id_usuario;

  if (!id_metodo_pago || !monto || parseFloat(monto) <= 0) {
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
    const newCollectionState = newSaldo <= 0 ? 'PAGADA' : 'ABONADA';
    await client.query(`
      UPDATE facturas
      SET saldo = $1,
          estado_cobranza = CASE
            WHEN $1::numeric <= 0 THEN 'PAGADA'
            WHEN fecha_vencimiento IS NOT NULL AND fecha_vencimiento < CURRENT_DATE THEN 'VENCIDA'
            ELSE $3
          END
      WHERE id_factura = $2
    `, [newSaldo, id, newCollectionState]);

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

router.get('/:id/collections', authorizePermissions('RECEIVABLES_CRUD'), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT fg.*, u.username
      FROM factura_gestiones_cobranza fg
      LEFT JOIN usuarios u ON fg.id_usuario = u.id_usuario
      WHERE fg.id_factura = $1
      ORDER BY fg.created_at DESC
    `, [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al consultar gestiones de cobranza:', error);
    res.status(500).json({ error: 'Error al consultar gestiones de cobranza.' });
  }
});

router.post('/:id/collections', authorizePermissions('RECEIVABLES_CRUD'), validate(schemas.createCollectionAction), async (req, res) => {
  const { id } = req.params;
  const { tipo_gestion, nota, fecha_compromiso, monto_compromiso, estado } = req.body || {};
  const id_usuario = req.user.id_usuario;

  if (!String(nota || '').trim()) {
    return res.status(400).json({ error: 'La nota de gestion es obligatoria.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const factRes = await client.query(
      'SELECT id_factura, numero_factura, saldo, estado FROM facturas WHERE id_factura = $1 FOR UPDATE',
      [id]
    );
    if (factRes.rows.length === 0) {
      throw new Error('Factura no encontrada.');
    }
    if (factRes.rows[0].estado === 'ANULADA') {
      throw new Error('No se puede registrar gestion sobre una factura anulada.');
    }

    const gestionRes = await client.query(`
      INSERT INTO factura_gestiones_cobranza (
        id_factura, tipo_gestion, nota, fecha_compromiso, monto_compromiso, estado, id_usuario
      )
      VALUES ($1, $2, $3, NULLIF($4, '')::date, $5, $6, $7)
      RETURNING *
    `, [
      id,
      String(tipo_gestion || 'LLAMADA').trim().toUpperCase(),
      String(nota).trim(),
      fecha_compromiso || '',
      Math.max(parseFloat(monto_compromiso || 0) || 0, 0),
      String(estado || 'ABIERTA').trim().toUpperCase(),
      id_usuario,
    ]);

    await client.query(`
      UPDATE facturas
      SET estado_cobranza = CASE
        WHEN COALESCE(saldo, 0) <= 0 THEN 'PAGADA'
        WHEN fecha_vencimiento IS NOT NULL AND fecha_vencimiento < CURRENT_DATE THEN 'VENCIDA'
        ELSE 'EN_GESTION'
      END
      WHERE id_factura = $1
    `, [id]);

    await writeAudit(client, {
      entity: 'facturas',
      entityId: id,
      action: 'REGISTRAR_GESTION_COBRANZA',
      userId: id_usuario,
      detail: {
        numero_factura: factRes.rows[0].numero_factura,
        tipo_gestion: tipo_gestion || 'LLAMADA',
        fecha_compromiso: fecha_compromiso || null,
        monto_compromiso: monto_compromiso || 0,
      },
    });

    await client.query('COMMIT');
    res.status(201).json(gestionRes.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar gestion de cobranza:', error);
    res.status(400).json({ error: error.message || 'Error al registrar gestion de cobranza.' });
  } finally {
    client.release();
  }
});

module.exports = router;
