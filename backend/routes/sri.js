const express = require('express');
const router = express.Router();
const db = require('../db');
const { writeAudit } = require('../audit');
const { buildFacturaXml } = require('../sri_utils');

const getCurrentUserId = (req) => req.user?.id_usuario || req.user?.id || null;

async function loadInvoiceForSri(client, idFactura) {
  const invoiceRes = await client.query(`
    SELECT f.*, c.name as cliente_nombre, c.identification_number as cliente_identificacion,
           c.email as cliente_email, c.phone as cliente_telefono, c.address as cliente_direccion,
           s.codigo_establecimiento, s.punto_emision, s.nombre as sucursal_nombre,
           s.direccion as sucursal_direccion
    FROM facturas f
    JOIN clients c ON f.id_cliente = c.id
    JOIN sucursales s ON f.id_sucursal = s.id_sucursal
    WHERE f.id_factura = $1
  `, [idFactura]);

  if (invoiceRes.rows.length === 0) {
    throw new Error('Factura no encontrada.');
  }

  const detailsRes = await client.query(`
    SELECT fd.*, p.nombre as producto_nombre, p.codigo as producto_codigo
    FROM factura_detalles fd
    JOIN productos p ON fd.id_producto = p.id_producto
    WHERE fd.id_factura = $1
    ORDER BY fd.id_detalle ASC
  `, [idFactura]);

  const paymentsRes = await client.query(`
    SELECT fp.*, mp.nombre AS metodo_pago_nombre, mp.codigo_sri
    FROM factura_pagos fp
    LEFT JOIN metodos_pago mp ON fp.id_metodo_pago = mp.id_metodo
    WHERE fp.id_factura = $1
    ORDER BY fp.id_pago ASC
  `, [idFactura]).catch((error) => {
    if (error.code === '42P01') return { rows: [] };
    throw error;
  });

  return {
    invoice: invoiceRes.rows[0],
    details: detailsRes.rows,
    payments: paymentsRes.rows,
  };
}

router.get('/invoices/:id/status', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT *
      FROM sri_comprobantes
      WHERE tipo_comprobante = '01' AND id_documento = $1
    `, [req.params.id]);

    res.json(result.rows[0] || null);
  } catch (error) {
    console.error('Error al consultar estado SRI:', error);
    res.status(500).json({ error: 'Error al consultar el estado SRI.' });
  }
});

router.post('/invoices/:id/generate-test-xml', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const companyRes = await client.query('SELECT * FROM empresas LIMIT 1');
    if (companyRes.rows.length === 0) {
      throw new Error('Configure los datos de la empresa antes de generar XML SRI.');
    }

    const { invoice, details, payments } = await loadInvoiceForSri(client, req.params.id);
    if (invoice.estado === 'ANULADA') {
      throw new Error('No se puede generar XML SRI para una factura anulada.');
    }
    if (details.length === 0) {
      throw new Error('La factura no tiene detalles para generar XML SRI.');
    }

    const ambiente = 'PRUEBAS';
    const { xml, claveAcceso } = buildFacturaXml({
      invoice,
      details,
      payments,
      company: companyRes.rows[0],
      ambiente,
    });

    const sriRes = await client.query(`
      INSERT INTO sri_comprobantes (
        tipo_comprobante, id_documento, numero_comprobante, clave_acceso,
        ambiente, estado, xml_generado, mensajes
      )
      VALUES ('01', $1, $2, $3, $4, 'GENERADO', $5, '[]'::jsonb)
      ON CONFLICT (tipo_comprobante, id_documento)
      DO UPDATE SET
        numero_comprobante = EXCLUDED.numero_comprobante,
        clave_acceso = EXCLUDED.clave_acceso,
        ambiente = EXCLUDED.ambiente,
        estado = 'GENERADO',
        xml_generado = EXCLUDED.xml_generado,
        mensajes = '[]'::jsonb,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [invoice.id_factura, invoice.numero_factura, claveAcceso, ambiente, xml]);

    await client.query(`
      UPDATE facturas
      SET clave_acceso = $2,
          xml_generado = $3,
          sri_estado = 'GENERADO',
          sri_ambiente = $4,
          sri_mensajes = '[]'::jsonb
      WHERE id_factura = $1
    `, [invoice.id_factura, claveAcceso, xml, ambiente]);

    await writeAudit(client, {
      entity: 'facturas',
      entityId: invoice.id_factura,
      action: 'GENERAR_XML_SRI_PRUEBAS',
      userId: getCurrentUserId(req),
      detail: {
        numero_factura: invoice.numero_factura,
        clave_acceso: claveAcceso,
        ambiente,
      },
    });

    await client.query('COMMIT');
    res.json({
      estado: sriRes.rows[0].estado,
      ambiente,
      clave_acceso: claveAcceso,
      xml,
      sri: sriRes.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al generar XML SRI pruebas:', error);
    res.status(400).json({ error: error.message || 'Error al generar XML SRI en pruebas.' });
  } finally {
    client.release();
  }
});

module.exports = router;
