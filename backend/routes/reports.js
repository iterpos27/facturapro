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
      audit: recentAudit.rows,
    });
  } catch (error) {
    console.error('Error al consultar reportes:', error);
    res.status(500).json({ error: 'Error al consultar reportes.' });
  }
});

module.exports = router;
