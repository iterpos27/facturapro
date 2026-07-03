const express = require('express');
const router = express.Router();
const db = require('../db');
const { writeAudit } = require('../audit');
const { buildFacturaXml } = require('../sri_utils');
const {
  signXmlWithCertificate,
  sendReceipt,
  authorizeReceipt,
} = require('../sri_service');

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

async function loadCompany(client) {
  const companyRes = await client.query('SELECT * FROM empresas LIMIT 1');
  if (companyRes.rows.length === 0) {
    throw new Error('Configure los datos de la empresa antes de procesar SRI.');
  }
  return companyRes.rows[0];
}

async function ensureGeneratedInvoiceXml(client, idFactura, company) {
  const sriRes = await client.query(`
    SELECT *
    FROM sri_comprobantes
    WHERE tipo_comprobante = '01' AND id_documento = $1
  `, [idFactura]);

  if (sriRes.rows[0]?.xml_generado) {
    return sriRes.rows[0];
  }

  const { invoice, details, payments } = await loadInvoiceForSri(client, idFactura);
  if (invoice.estado === 'ANULADA') {
    throw new Error('No se puede procesar SRI para una factura anulada.');
  }
  if (details.length === 0) {
    throw new Error('La factura no tiene detalles para generar XML SRI.');
  }

  const ambiente = 'PRUEBAS';
  const { xml, claveAcceso } = buildFacturaXml({
    invoice,
    details,
    payments,
    company,
    ambiente,
  });

  const upsertRes = await client.query(`
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

  return upsertRes.rows[0];
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

    const company = await loadCompany(client);

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
      company,
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

router.post('/invoices/:id/sign-test-xml', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const company = await loadCompany(client);
    const sri = await ensureGeneratedInvoiceXml(client, req.params.id, company);
    const signedXml = signXmlWithCertificate(sri.xml_generado, company);

    const updated = await client.query(`
      UPDATE sri_comprobantes
      SET estado = 'FIRMADO',
          xml_firmado = $2,
          mensajes = '[]'::jsonb,
          updated_at = CURRENT_TIMESTAMP
      WHERE id_sri = $1
      RETURNING *
    `, [sri.id_sri, signedXml]);

    await client.query(`
      UPDATE facturas
      SET sri_estado = 'FIRMADO',
          sri_mensajes = '[]'::jsonb
      WHERE id_factura = $1
    `, [sri.id_documento]);

    await writeAudit(client, {
      entity: 'facturas',
      entityId: sri.id_documento,
      action: 'FIRMAR_XML_SRI_PRUEBAS',
      userId: getCurrentUserId(req),
      detail: { clave_acceso: sri.clave_acceso, ambiente: sri.ambiente },
    });

    await client.query('COMMIT');
    res.json({
      estado: 'FIRMADO',
      ambiente: sri.ambiente,
      clave_acceso: sri.clave_acceso,
      sri: updated.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al firmar XML SRI pruebas:', error);
    res.status(400).json({ error: error.message || 'Error al firmar XML SRI en pruebas.' });
  } finally {
    client.release();
  }
});

router.post('/invoices/:id/send-test', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const company = await loadCompany(client);
    let sri = await ensureGeneratedInvoiceXml(client, req.params.id, company);
    let signedXml = sri.xml_firmado;
    if (!signedXml) {
      signedXml = signXmlWithCertificate(sri.xml_generado, company);
      const signedRes = await client.query(`
        UPDATE sri_comprobantes
        SET estado = 'FIRMADO',
            xml_firmado = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id_sri = $1
        RETURNING *
      `, [sri.id_sri, signedXml]);
      sri = signedRes.rows[0];
    }

    const reception = await sendReceipt(signedXml, company, sri.ambiente);
    const estado = reception.estado === 'RECIBIDA' ? 'RECIBIDO' : 'DEVUELTO';
    const messages = reception.mensajes || [];

    const updated = await client.query(`
      UPDATE sri_comprobantes
      SET estado = $2,
          mensajes = $3::jsonb,
          updated_at = CURRENT_TIMESTAMP
      WHERE id_sri = $1
      RETURNING *
    `, [sri.id_sri, estado, JSON.stringify(messages)]);

    await client.query(`
      UPDATE facturas
      SET sri_estado = $2,
          sri_mensajes = $3::jsonb
      WHERE id_factura = $1
    `, [sri.id_documento, estado, JSON.stringify(messages)]);

    await writeAudit(client, {
      entity: 'facturas',
      entityId: sri.id_documento,
      action: 'ENVIAR_XML_SRI_PRUEBAS',
      userId: getCurrentUserId(req),
      detail: { clave_acceso: sri.clave_acceso, estado, mensajes: messages },
    });

    await client.query('COMMIT');
    res.json({
      estado,
      ambiente: sri.ambiente,
      clave_acceso: sri.clave_acceso,
      mensajes: messages,
      sri: updated.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al enviar XML SRI pruebas:', error);
    res.status(400).json({ error: error.message || 'Error al enviar XML SRI en pruebas.' });
  } finally {
    client.release();
  }
});

router.post('/invoices/:id/authorize-test', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const company = await loadCompany(client);
    const sriRes = await client.query(`
      SELECT *
      FROM sri_comprobantes
      WHERE tipo_comprobante = '01' AND id_documento = $1
    `, [req.params.id]);
    const sri = sriRes.rows[0];
    if (!sri) {
      throw new Error('Primero genere y envie el XML al SRI.');
    }
    if (!['RECIBIDO', 'AUTORIZADO'].includes(sri.estado)) {
      throw new Error(`La factura debe estar RECIBIDA para consultar autorizacion. Estado actual: ${sri.estado}.`);
    }

    const authorization = await authorizeReceipt(sri.clave_acceso, company, sri.ambiente);
    const estado = authorization.estado === 'AUTORIZADO' ? 'AUTORIZADO' : 'NO_AUTORIZADO';
    const messages = authorization.mensajes || [];

    const updated = await client.query(`
      UPDATE sri_comprobantes
      SET estado = $2,
          numero_autorizacion = $3,
          fecha_autorizacion = NULLIF($4, '')::timestamp,
          mensajes = $5::jsonb,
          updated_at = CURRENT_TIMESTAMP
      WHERE id_sri = $1
      RETURNING *
    `, [sri.id_sri, estado, authorization.numeroAutorizacion || null, authorization.fechaAutorizacion || '', JSON.stringify(messages)]);

    await client.query(`
      UPDATE facturas
      SET sri_estado = $2,
          sri_numero_autorizacion = $3,
          sri_fecha_autorizacion = NULLIF($4, '')::timestamp,
          sri_mensajes = $5::jsonb
      WHERE id_factura = $1
    `, [sri.id_documento, estado, authorization.numeroAutorizacion || null, authorization.fechaAutorizacion || '', JSON.stringify(messages)]);

    await writeAudit(client, {
      entity: 'facturas',
      entityId: sri.id_documento,
      action: 'CONSULTAR_AUTORIZACION_SRI_PRUEBAS',
      userId: getCurrentUserId(req),
      detail: {
        clave_acceso: sri.clave_acceso,
        estado,
        numero_autorizacion: authorization.numeroAutorizacion || null,
        mensajes: messages,
      },
    });

    await client.query('COMMIT');
    res.json({
      estado,
      ambiente: sri.ambiente,
      clave_acceso: sri.clave_acceso,
      numero_autorizacion: authorization.numeroAutorizacion || null,
      fecha_autorizacion: authorization.fechaAutorizacion || null,
      mensajes: messages,
      sri: updated.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al autorizar XML SRI pruebas:', error);
    res.status(400).json({ error: error.message || 'Error al consultar autorizacion SRI en pruebas.' });
  } finally {
    client.release();
  }
});

router.post('/invoices/:id/process-test', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const company = await loadCompany(client);
    let sri = await ensureGeneratedInvoiceXml(client, req.params.id, company);
    let signedXml = sri.xml_firmado;
    if (!signedXml) {
      signedXml = signXmlWithCertificate(sri.xml_generado, company);
      const signedRes = await client.query(`
        UPDATE sri_comprobantes
        SET estado = 'FIRMADO',
            xml_firmado = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id_sri = $1
        RETURNING *
      `, [sri.id_sri, signedXml]);
      sri = signedRes.rows[0];
    }

    const reception = await sendReceipt(signedXml, company, sri.ambiente);
    const receptionState = reception.estado === 'RECIBIDA' ? 'RECIBIDO' : 'DEVUELTO';
    if (receptionState !== 'RECIBIDO') {
      const messages = reception.mensajes || [];
      const updated = await client.query(`
        UPDATE sri_comprobantes
        SET estado = 'DEVUELTO',
            mensajes = $2::jsonb,
            updated_at = CURRENT_TIMESTAMP
        WHERE id_sri = $1
        RETURNING *
      `, [sri.id_sri, JSON.stringify(messages)]);
      await client.query(`
        UPDATE facturas
        SET sri_estado = 'DEVUELTO',
            sri_mensajes = $2::jsonb
        WHERE id_factura = $1
      `, [sri.id_documento, JSON.stringify(messages)]);
      await client.query('COMMIT');
      return res.json({
        estado: 'DEVUELTO',
        ambiente: sri.ambiente,
        clave_acceso: sri.clave_acceso,
        mensajes: messages,
        sri: updated.rows[0],
      });
    }

    const authorization = await authorizeReceipt(sri.clave_acceso, company, sri.ambiente);
    const finalState = authorization.estado === 'AUTORIZADO' ? 'AUTORIZADO' : 'NO_AUTORIZADO';
    const messages = authorization.mensajes || [];
    const updated = await client.query(`
      UPDATE sri_comprobantes
      SET estado = $2,
          numero_autorizacion = $3,
          fecha_autorizacion = NULLIF($4, '')::timestamp,
          mensajes = $5::jsonb,
          updated_at = CURRENT_TIMESTAMP
      WHERE id_sri = $1
      RETURNING *
    `, [sri.id_sri, finalState, authorization.numeroAutorizacion || null, authorization.fechaAutorizacion || '', JSON.stringify(messages)]);

    await client.query(`
      UPDATE facturas
      SET sri_estado = $2,
          sri_numero_autorizacion = $3,
          sri_fecha_autorizacion = NULLIF($4, '')::timestamp,
          sri_mensajes = $5::jsonb
      WHERE id_factura = $1
    `, [sri.id_documento, finalState, authorization.numeroAutorizacion || null, authorization.fechaAutorizacion || '', JSON.stringify(messages)]);

    await writeAudit(client, {
      entity: 'facturas',
      entityId: sri.id_documento,
      action: 'PROCESAR_SRI_PRUEBAS',
      userId: getCurrentUserId(req),
      detail: {
        clave_acceso: sri.clave_acceso,
        recepcion: reception.estado,
        autorizacion: finalState,
        mensajes: messages,
      },
    });

    await client.query('COMMIT');
    return res.json({
      estado: finalState,
      ambiente: sri.ambiente,
      clave_acceso: sri.clave_acceso,
      numero_autorizacion: authorization.numeroAutorizacion || null,
      fecha_autorizacion: authorization.fechaAutorizacion || null,
      mensajes: messages,
      sri: updated.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al procesar SRI pruebas:', error);
    return res.status(400).json({ error: error.message || 'Error al procesar SRI en pruebas.' });
  } finally {
    client.release();
  }
});

module.exports = router;
