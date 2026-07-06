const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('./auth');

// Proteger todas las rutas de reportes con autenticación y autorización
router.use(authenticateToken);

const addParam = (params, value) => {
  params.push(value);
  return `$${params.length}`;
};

const buildFilters = (query, alias = 'f') => {
  const params = [];
  const where = [];

  if (query.date_from) {
    where.push(`${alias}.fecha_emision >= ${addParam(params, query.date_from)}`);
  }
  if (query.date_to) {
    where.push(`${alias}.fecha_emision < (${addParam(params, query.date_to)}::date + INTERVAL '1 day')`);
  }
  if (query.id_usuario) {
    where.push(`${alias}.id_usuario = ${addParam(params, Number(query.id_usuario))}`);
  }
  if (query.id_caja) {
    where.push(`${alias}.id_sesion_caja IN (SELECT id_sesion FROM sesiones_caja WHERE id_caja = ${addParam(params, Number(query.id_caja))})`);
  }
  if (query.id_cliente) {
    where.push(`${alias}.id_cliente = ${addParam(params, Number(query.id_cliente))}`);
  }

  return { params, clause: where.length ? `WHERE ${where.join(' AND ')}` : '' };
};

router.get('/summary', async (req, res) => {
  try {
    const invoiceFilter = buildFilters(req.query, 'f');
    const purchaseParams = [];
    const purchaseWhere = [];
    if (req.query.date_from) purchaseWhere.push(`c.fecha_compra >= ${addParam(purchaseParams, req.query.date_from)}`);
    if (req.query.date_to) purchaseWhere.push(`c.fecha_compra < (${addParam(purchaseParams, req.query.date_to)}::date + INTERVAL '1 day')`);
    if (req.query.id_usuario) purchaseWhere.push(`c.id_usuario = ${addParam(purchaseParams, Number(req.query.id_usuario))}`);
    if (req.query.id_proveedor) purchaseWhere.push(`c.id_proveedor = ${addParam(purchaseParams, Number(req.query.id_proveedor))}`);
    const purchaseClause = purchaseWhere.length ? `WHERE ${purchaseWhere.join(' AND ')}` : '';

    const [
      invoiceTotals,
      proformaStatuses,
      dailySales,
      topProducts,
      receivables,
      lowStock,
      paymentBreakdown,
      recentAudit,
      purchases,
      creditNotes,
      withholdings,
      approximateProfit,
      inventoryValuation,
      cashSessions,
    ] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE f.estado = 'EMITIDA') AS facturas_emitidas,
          COUNT(*) FILTER (WHERE f.estado = 'ANULADA') AS facturas_anuladas,
          COALESCE(SUM(f.total) FILTER (WHERE f.estado = 'EMITIDA'), 0) AS total_facturado,
          COALESCE(SUM(f.saldo) FILTER (WHERE f.estado = 'EMITIDA'), 0) AS saldo_pendiente
        FROM facturas f
        ${invoiceFilter.clause}
      `, invoiceFilter.params),
      db.query(`
        SELECT estado, COUNT(*) AS cantidad, COALESCE(SUM(total), 0) AS total
        FROM proformas
        GROUP BY estado
        ORDER BY estado
      `),
      db.query(`
        SELECT DATE(f.fecha_emision) AS fecha,
               COUNT(*) AS facturas,
               COALESCE(SUM(f.total) FILTER (WHERE f.estado = 'EMITIDA'), 0) AS total
        FROM facturas f
        ${invoiceFilter.clause || "WHERE f.fecha_emision >= CURRENT_DATE - INTERVAL '7 days'"}
        GROUP BY DATE(f.fecha_emision)
        ORDER BY fecha DESC
      `, invoiceFilter.params),
      db.query(`
        SELECT p.codigo, p.nombre, COALESCE(SUM(fd.cantidad), 0) AS cantidad,
               COALESCE(SUM(fd.precio_total + fd.valor_iva - COALESCE(fd.descuento_total, fd.descuento, 0)), 0) AS total
        FROM factura_detalles fd
        JOIN facturas f ON fd.id_factura = f.id_factura
        JOIN productos p ON fd.id_producto = p.id_producto
        ${invoiceFilter.clause ? `${invoiceFilter.clause} AND f.estado = 'EMITIDA'` : "WHERE f.estado = 'EMITIDA'"}
        GROUP BY p.codigo, p.nombre
        ORDER BY cantidad DESC
        LIMIT 10
      `, invoiceFilter.params),
      db.query(`
        SELECT f.id_factura, f.numero_factura, f.fecha_emision, c.name AS cliente_nombre,
               c.identification_number AS cliente_identificacion, f.total, f.saldo
        FROM facturas f
        JOIN clients c ON f.id_cliente = c.id
        ${invoiceFilter.clause ? `${invoiceFilter.clause} AND f.estado = 'EMITIDA' AND COALESCE(f.saldo, 0) > 0` : "WHERE f.estado = 'EMITIDA' AND COALESCE(f.saldo, 0) > 0"}
        ORDER BY f.fecha_emision DESC
        LIMIT 20
      `, invoiceFilter.params),
      db.query(`
        SELECT codigo, nombre, stock_actual, stock_minimo
        FROM productos
        WHERE activo = true AND COALESCE(stock_actual, 0) <= COALESCE(stock_minimo, 0)
        ORDER BY stock_actual ASC, nombre ASC
        LIMIT 20
      `),
      db.query(`
        SELECT mp.nombre AS metodo_pago, COALESCE(SUM(fp.monto), 0) AS total
        FROM factura_pagos fp
        JOIN facturas f ON fp.id_factura = f.id_factura
        LEFT JOIN metodos_pago mp ON fp.id_metodo_pago = mp.id_metodo
        ${invoiceFilter.clause ? `${invoiceFilter.clause} AND f.estado = 'EMITIDA'` : "WHERE f.estado = 'EMITIDA'"}
        GROUP BY mp.nombre
        ORDER BY total DESC
      `, invoiceFilter.params).catch((error) => (error.code === '42P01' ? { rows: [] } : Promise.reject(error))),
      db.query(`
        SELECT ae.*, u.username
        FROM auditoria_eventos ae
        LEFT JOIN usuarios u ON ae.id_usuario = u.id_usuario
        ORDER BY ae.created_at DESC
        LIMIT 25
      `).catch((error) => (error.code === '42P01' ? { rows: [] } : Promise.reject(error))),
      db.query(`
        SELECT COUNT(*) AS compras, COALESCE(SUM(total), 0) AS total_compras
        FROM compras c
        ${purchaseClause ? `${purchaseClause} AND c.estado = 'REGISTRADA'` : "WHERE c.estado = 'REGISTRADA'"}
      `, purchaseParams).catch((error) => (error.code === '42P01' ? { rows: [{ compras: 0, total_compras: 0 }] } : Promise.reject(error))),
      db.query(`
        SELECT COUNT(*) AS notas_credito, COALESCE(SUM(nc.total), 0) AS total_notas_credito
        FROM notas_credito nc
        JOIN facturas f ON nc.id_factura = f.id_factura
        ${invoiceFilter.clause ? `${invoiceFilter.clause} AND nc.estado = 'EMITIDA'` : "WHERE nc.estado = 'EMITIDA'"}
      `, invoiceFilter.params).catch((error) => (error.code === '42P01' ? { rows: [{ notas_credito: 0, total_notas_credito: 0 }] } : Promise.reject(error))),
      db.query(`
        SELECT COUNT(*) AS retenciones, COALESCE(SUM(rd.valor_retenido), 0) AS total_retenido
        FROM retenciones r
        LEFT JOIN retencion_detalles rd ON r.id_retencion = rd.id_retencion
        LEFT JOIN compras c ON r.id_compra = c.id_compra
        ${purchaseClause ? `${purchaseClause} AND r.estado = 'EMITIDA'` : "WHERE r.estado = 'EMITIDA'"}
      `, purchaseParams).catch((error) => (error.code === '42P01' ? { rows: [{ retenciones: 0, total_retenido: 0 }] } : Promise.reject(error))),
      db.query(`
        SELECT COALESCE(SUM((fd.precio_unitario - COALESCE(p.costo_promedio, p.precio_compra, 0)) * fd.cantidad), 0) AS utilidad_estimada
        FROM factura_detalles fd
        JOIN facturas f ON fd.id_factura = f.id_factura
        JOIN productos p ON fd.id_producto = p.id_producto
        ${invoiceFilter.clause ? `${invoiceFilter.clause} AND f.estado = 'EMITIDA'` : "WHERE f.estado = 'EMITIDA'"}
      `, invoiceFilter.params),
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE activo = true) AS productos_activos,
          COALESCE(SUM(stock_actual), 0) AS unidades_stock,
          COALESCE(SUM(COALESCE(valor_inventario, stock_actual * COALESCE(precio_compra, 0))), 0) AS valor_inventario,
          COALESCE(AVG(NULLIF(COALESCE(costo_promedio, precio_compra, 0), 0)), 0) AS costo_promedio_general
        FROM productos
        WHERE activo = true
      `).catch((error) => (error.code === '42703' ? { rows: [{ productos_activos: 0, unidades_stock: 0, valor_inventario: 0, costo_promedio_general: 0 }] } : Promise.reject(error))),
      (() => {
        const params = [];
        const where = [];
        if (req.query.date_from) where.push(`sc.fecha_apertura >= ${addParam(params, req.query.date_from)}`);
        if (req.query.date_to) where.push(`sc.fecha_apertura < (${addParam(params, req.query.date_to)}::date + INTERVAL '1 day')`);
        if (req.query.id_usuario) where.push(`sc.id_usuario = ${addParam(params, Number(req.query.id_usuario))}`);
        if (req.query.id_caja) where.push(`sc.id_caja = ${addParam(params, Number(req.query.id_caja))}`);
        const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

        return db.query(`
          SELECT
            COUNT(*) AS sesiones,
            COUNT(*) FILTER (WHERE sc.estado = 'ABIERTA') AS abiertas,
            COUNT(*) FILTER (WHERE sc.estado = 'CERRADA') AS cerradas,
            COALESCE(SUM(sc.monto_apertura), 0) AS total_apertura,
            COALESCE(SUM(sc.monto_cierre) FILTER (WHERE sc.estado = 'CERRADA'), 0) AS total_cierre,
            COALESCE(SUM(sc.ventas_contado), 0) AS ventas_contado,
            COALESCE(SUM(sc.ventas_credito), 0) AS ventas_credito,
            COALESCE(SUM(sc.cobros_cxc), 0) AS cobros_cxc,
            COALESCE(SUM(sc.notas_credito_total), 0) AS notas_credito_total,
            COALESCE(SUM(sc.efectivo_esperado), 0) AS efectivo_esperado,
            COALESCE(SUM(sc.total_operativo), 0) AS total_operativo,
            COALESCE(SUM(sc.diferencia_cierre), 0) AS diferencia_cierre
          FROM sesiones_caja sc
          ${clause}
        `, params);
      })(),
    ]);

    res.json({
      invoices: invoiceTotals.rows[0],
      proformas: proformaStatuses.rows,
      dailySales: dailySales.rows,
      topProducts: topProducts.rows,
      receivables: receivables.rows,
      lowStock: lowStock.rows,
      paymentBreakdown: paymentBreakdown.rows,
      audit: recentAudit.rows,
      purchases: purchases.rows[0],
      creditNotes: creditNotes.rows[0],
      withholdings: withholdings.rows[0],
      approximateProfit: approximateProfit.rows[0],
      inventory: inventoryValuation.rows[0],
      cash: cashSessions.rows[0],
    });
  } catch (error) {
    console.error('Error al consultar reportes:', error);
    res.status(500).json({ error: 'Error al consultar reportes.' });
  }
});

module.exports = router;
