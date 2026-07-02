const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/summary', async (req, res) => {
  try {
    const [
      invoiceTotals,
      proformaStatuses,
      dailySales,
      topProducts,
      receivables,
      lowStock,
      paymentBreakdown,
      recentAudit,
    ] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE estado = 'EMITIDA') AS facturas_emitidas,
          COUNT(*) FILTER (WHERE estado = 'ANULADA') AS facturas_anuladas,
          COALESCE(SUM(total) FILTER (WHERE estado = 'EMITIDA'), 0) AS total_facturado,
          COALESCE(SUM(saldo) FILTER (WHERE estado = 'EMITIDA'), 0) AS saldo_pendiente
        FROM facturas
      `),
      db.query(`
        SELECT estado, COUNT(*) AS cantidad, COALESCE(SUM(total), 0) AS total
        FROM proformas
        GROUP BY estado
        ORDER BY estado
      `),
      db.query(`
        SELECT DATE(fecha_emision) AS fecha,
               COUNT(*) AS facturas,
               COALESCE(SUM(total) FILTER (WHERE estado = 'EMITIDA'), 0) AS total
        FROM facturas
        WHERE fecha_emision >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY DATE(fecha_emision)
        ORDER BY fecha DESC
      `),
      db.query(`
        SELECT p.codigo, p.nombre, COALESCE(SUM(fd.cantidad), 0) AS cantidad,
               COALESCE(SUM(fd.precio_total + fd.valor_iva - COALESCE(fd.descuento_total, fd.descuento, 0)), 0) AS total
        FROM factura_detalles fd
        JOIN facturas f ON fd.id_factura = f.id_factura
        JOIN productos p ON fd.id_producto = p.id_producto
        WHERE f.estado = 'EMITIDA'
        GROUP BY p.codigo, p.nombre
        ORDER BY cantidad DESC
        LIMIT 10
      `),
      db.query(`
        SELECT f.id_factura, f.numero_factura, f.fecha_emision, c.name AS cliente_nombre,
               c.identification_number AS cliente_identificacion, f.total, f.saldo
        FROM facturas f
        JOIN clients c ON f.id_cliente = c.id
        WHERE f.estado = 'EMITIDA' AND COALESCE(f.saldo, 0) > 0
        ORDER BY f.fecha_emision DESC
        LIMIT 20
      `),
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
        WHERE f.estado = 'EMITIDA'
        GROUP BY mp.nombre
        ORDER BY total DESC
      `).catch((error) => {
        if (error.code === '42P01') {
          return { rows: [] };
        }
        throw error;
      }),
      db.query(`
        SELECT ae.*, u.username
        FROM auditoria_eventos ae
        LEFT JOIN usuarios u ON ae.id_usuario = u.id_usuario
        ORDER BY ae.created_at DESC
        LIMIT 25
      `).catch((error) => {
        if (error.code === '42P01') {
          return { rows: [] };
        }
        throw error;
      }),
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
    });
  } catch (error) {
    console.error('Error al consultar reportes:', error);
    res.status(500).json({ error: 'Error al consultar reportes.' });
  }
});

module.exports = router;
