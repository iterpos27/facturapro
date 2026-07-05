const express = require('express');
const router = express.Router();
const db = require('../db');
const { writeAudit } = require('../audit');
const {
  buildFacturaXml,
  buildNotaCreditoXml,
  buildRetencionXml,
  claveAccesoPerteneceAlRuc,
} = require('../sri_utils');
const {
  getSriEndpoints,
  validateCertificateConfig,
  signXmlWithCertificate,
  sendReceipt,
  authorizeReceipt,
} = require('../sri_service');
const { authenticateToken } = require('./auth');
const { sendAuthorizedDocument } = require('../email_service');

// Proteger todas las rutas de SRI con autenticación y autorización
router.use(authenticateToken);

const getCurrentUserId = (req) => req.user?.id_usuario || req.user?.id || null;
const normalize = (value) => String(value || '').trim();
const money = (value) => (Math.round((parseFloat(value) || 0) * 100) / 100).toFixed(2);

function sriRecordMatchesCompany(sri, company) {
  const ruc = normalize(company.ruc);
  if (!sri?.xml_generado || !claveAccesoPerteneceAlRuc(sri.clave_acceso, ruc)) {
    return false;
  }
  return sri.xml_generado.includes(`<ruc>${ruc}</ruc>`) && sri.xml_generado.includes(sri.clave_acceso);
}

function sriEmailConfig(tipoComprobante) {
  const configs = {
    '01': {
      label: 'Factura',
      table: 'facturas',
      pk: 'id_factura',
      numberField: 'numero_factura',
      totalField: 'total',
      recipientName: 'cliente_nombre',
      recipientEmail: 'cliente_email',
      query: `
        SELECT f.*, c.name AS cliente_nombre, c.email AS cliente_email,
               c.identification_number AS cliente_identificacion
        FROM facturas f
        JOIN clients c ON f.id_cliente = c.id
        WHERE f.id_factura = $1
      `,
    },
    '04': {
      label: 'Nota de Credito',
      table: 'notas_credito',
      pk: 'id_nota_credito',
      numberField: 'numero_nota_credito',
      totalField: 'total',
      recipientName: 'cliente_nombre',
      recipientEmail: 'cliente_email',
      query: `
        SELECT nc.*, f.numero_factura, c.name AS cliente_nombre, c.email AS cliente_email,
               c.identification_number AS cliente_identificacion
        FROM notas_credito nc
        JOIN facturas f ON nc.id_factura = f.id_factura
        JOIN clients c ON f.id_cliente = c.id
        WHERE nc.id_nota_credito = $1
      `,
    },
    '07': {
      label: 'Comprobante de Retencion',
      table: 'retenciones',
      pk: 'id_retencion',
      numberField: 'numero_retencion',
      totalField: null,
      recipientName: 'proveedor_nombre',
      recipientEmail: 'proveedor_email',
      query: `
        SELECT r.*, c.numero_factura_compra, p.nombre AS proveedor_nombre, p.email AS proveedor_email,
               p.identificacion AS proveedor_identificacion
        FROM retenciones r
        JOIN compras c ON r.id_compra = c.id_compra
        JOIN proveedores p ON c.id_proveedor = p.id_proveedor
        WHERE r.id_retencion = $1
      `,
    },
  };
  const config = configs[tipoComprobante];
  if (!config) throw new Error('Tipo de comprobante no soportado para email.');
  return config;
}

function normalizeEmailDocumentType(value) {
  const type = String(value || '').toLowerCase();
  if (['invoice', 'invoices', 'factura', 'facturas', '01'].includes(type)) return '01';
  if (['credit-note', 'credit-notes', 'nota-credito', 'notas-credito', '04'].includes(type)) return '04';
  if (['withholding', 'withholdings', 'retencion', 'retenciones', '07'].includes(type)) return '07';
  throw new Error('Tipo de comprobante no soportado.');
}

function buildRideHtml({ company, document, config, sri, totalRetenido = 0 }) {
  const docNumber = document[config.numberField];
  const total = config.totalField ? document[config.totalField] : totalRetenido;
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>${config.label} ${docNumber}</title></head>
<body style="font-family:Arial,sans-serif;color:#111827;padding:24px;">
  <div style="border:1px solid #d1d5db;border-radius:8px;padding:18px;max-width:760px;margin:auto;">
    <h2 style="margin:0 0 8px;">${company.razon_social || company.nombre_comercial || 'Empresa'}</h2>
    <p style="margin:0 0 14px;"><strong>RUC:</strong> ${company.ruc || ''}</p>
    <h3 style="margin:0 0 12px;">${config.label} No. ${docNumber}</h3>
    <p><strong>Cliente/Sujeto:</strong> ${document[config.recipientName] || ''}</p>
    <p><strong>Identificacion:</strong> ${document.cliente_identificacion || document.proveedor_identificacion || ''}</p>
    <p><strong>Fecha:</strong> ${new Date(document.fecha_emision || document.created_at || Date.now()).toLocaleString('es-EC')}</p>
    <p><strong>Ambiente:</strong> ${sri.ambiente || document.sri_ambiente || 'PRUEBAS'}</p>
    <p><strong>Autorizacion:</strong> ${sri.numero_autorizacion || document.sri_numero_autorizacion || sri.clave_acceso || document.clave_acceso || ''}</p>
    <p style="word-break:break-all;"><strong>Clave de acceso:</strong><br>${sri.clave_acceso || document.clave_acceso || ''}</p>
    <hr>
    <p style="font-size:22px;font-weight:700;text-align:right;">TOTAL: $${money(total)}</p>
  </div>
</body>
</html>`;
}

async function loadEmailDocument(tipoComprobante, idDocumento) {
  const config = sriEmailConfig(tipoComprobante);
  const [documentRes, sriRes, companyRes] = await Promise.all([
    db.query(config.query, [idDocumento]),
    db.query('SELECT * FROM sri_comprobantes WHERE tipo_comprobante = $1 AND id_documento = $2', [tipoComprobante, idDocumento]),
    db.query('SELECT * FROM empresas LIMIT 1'),
  ]);
  if (documentRes.rows.length === 0) throw new Error('Documento no encontrado.');
  const sri = sriRes.rows[0];
  if (!sri || sri.estado !== 'AUTORIZADO') {
    throw new Error('El comprobante debe estar AUTORIZADO por SRI antes de enviarlo por email.');
  }
  const document = documentRes.rows[0];
  let totalRetenido = 0;
  if (tipoComprobante === '07') {
    const retRes = await db.query('SELECT COALESCE(SUM(valor_retenido), 0) AS total FROM retencion_detalles WHERE id_retencion = $1', [idDocumento]);
    totalRetenido = retRes.rows[0]?.total || 0;
  }
  return {
    config,
    document,
    sri,
    company: companyRes.rows[0] || {},
    totalRetenido,
  };
}

async function registerEmailAttempt({ tipoComprobante, idDocumento, numeroComprobante, destinatario, asunto, result, hasXml, hasRide, userId }) {
  const estado = result.sent ? 'ENVIADO' : 'ERROR';
  const insertRes = await db.query(`
    INSERT INTO sri_email_envios (
      tipo_comprobante, id_documento, numero_comprobante, destinatario, asunto,
      estado, mensaje_error, message_id, adjunto_xml, adjunto_ride, id_usuario
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `, [
    tipoComprobante,
    idDocumento,
    numeroComprobante,
    destinatario,
    asunto || '',
    estado,
    result.error || null,
    result.messageId || null,
    hasXml,
    hasRide,
    userId || null,
  ]);
  return insertRes.rows[0];
}

async function sendSriDocumentEmail({ tipoComprobante, idDocumento, userId }) {
  const { config, document, sri, company, totalRetenido } = await loadEmailDocument(tipoComprobante, idDocumento);
  const to = document[config.recipientEmail];
  const docNumber = document[config.numberField];
  const xml = sri.xml_firmado || sri.xml_generado || document.xml_generado || '';
  const rideHtml = buildRideHtml({ company, document, config, sri, totalRetenido });
  const result = await sendAuthorizedDocument({
    to,
    clientName: document[config.recipientName],
    docNumber,
    docType: config.label,
    authNumber: sri.numero_autorizacion || document.sri_numero_autorizacion || sri.clave_acceso,
    xml,
    rideHtml,
    companyName: company.razon_social,
  });
  const history = await registerEmailAttempt({
    tipoComprobante,
    idDocumento,
    numeroComprobante: docNumber,
    destinatario: to || '',
    asunto: result.subject || `${config.label} No. ${docNumber}`,
    result,
    hasXml: Boolean(xml),
    hasRide: Boolean(rideHtml),
    userId,
  });
  return { result, history };
}

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

async function loadCreditNoteForSri(client, idNotaCredito) {
  const creditNoteRes = await client.query(`
    SELECT nc.*, f.numero_factura, f.fecha_emision AS factura_fecha,
           c.name AS cliente_nombre, c.identification_number AS cliente_identificacion,
           c.email AS cliente_email, c.phone AS cliente_telefono, c.address AS cliente_direccion,
           s.direccion AS sucursal_direccion
    FROM notas_credito nc
    JOIN facturas f ON nc.id_factura = f.id_factura
    JOIN clients c ON f.id_cliente = c.id
    LEFT JOIN sucursales s ON f.id_sucursal = s.id_sucursal
    WHERE nc.id_nota_credito = $1
  `, [idNotaCredito]);

  if (creditNoteRes.rows.length === 0) {
    throw new Error('Nota de credito no encontrada.');
  }

  const creditNote = creditNoteRes.rows[0];
  const detailsRes = await client.query(`
    SELECT ncd.*, p.nombre AS producto_nombre, p.codigo AS producto_codigo,
           COALESCE(fd.porcentaje_iva, 0) AS porcentaje_iva
    FROM nota_credito_detalles ncd
    JOIN productos p ON ncd.id_producto = p.id_producto
    JOIN notas_credito nc ON ncd.id_nota_credito = nc.id_nota_credito
    LEFT JOIN factura_detalles fd ON fd.id_factura = nc.id_factura AND fd.id_producto = ncd.id_producto
    WHERE ncd.id_nota_credito = $1
    ORDER BY ncd.id_detalle ASC
  `, [idNotaCredito]);

  return {
    document: creditNote,
    details: detailsRes.rows,
  };
}

async function loadWithholdingForSri(client, idRetencion) {
  const withholdingRes = await client.query(`
    SELECT r.*, c.numero_factura_compra, c.fecha_compra,
           p.nombre AS proveedor_nombre, p.identificacion AS proveedor_identificacion,
           p.email AS proveedor_email, p.telefono AS proveedor_telefono, p.direccion AS proveedor_direccion
    FROM retenciones r
    JOIN compras c ON r.id_compra = c.id_compra
    JOIN proveedores p ON c.id_proveedor = p.id_proveedor
    WHERE r.id_retencion = $1
  `, [idRetencion]);

  if (withholdingRes.rows.length === 0) {
    throw new Error('Retencion no encontrada.');
  }

  const detailsRes = await client.query(`
    SELECT *
    FROM retencion_detalles
    WHERE id_retencion = $1
    ORDER BY id_detalle ASC
  `, [idRetencion]);

  return {
    document: withholdingRes.rows[0],
    details: detailsRes.rows,
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

  const { invoice, details, payments } = await loadInvoiceForSri(client, idFactura);
  if (invoice.estado === 'ANULADA') {
    throw new Error('No se puede procesar SRI para una factura anulada.');
  }
  if (details.length === 0) {
    throw new Error('La factura no tiene detalles para generar XML SRI.');
  }

  const existingSri = sriRes.rows[0];
  if (existingSri?.estado === 'AUTORIZADO') {
    return existingSri;
  }
  if (sriRecordMatchesCompany(existingSri, company)) {
    return existingSri;
  }

  const ambiente = normalize(company.ambiente_sri).toUpperCase() === 'PRODUCCION' ? 'PRODUCCION' : 'PRUEBAS';
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
      xml_firmado = NULL,
      numero_autorizacion = NULL,
      fecha_autorizacion = NULL,
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
        sri_numero_autorizacion = NULL,
        sri_fecha_autorizacion = NULL,
        sri_mensajes = '[]'::jsonb
    WHERE id_factura = $1
  `, [invoice.id_factura, claveAcceso, xml, ambiente]);

  return upsertRes.rows[0];
}

const sriDocumentTypes = {
  creditNote: {
    tipo: '04',
    table: 'notas_credito',
    pk: 'id_nota_credito',
    numberField: 'numero_nota_credito',
    auditEntity: 'notas_credito',
    label: 'nota de credito',
    load: loadCreditNoteForSri,
    build: ({ document, details, company, ambiente }) => buildNotaCreditoXml({
      creditNote: document,
      details,
      company,
      ambiente,
    }),
  },
  withholding: {
    tipo: '07',
    table: 'retenciones',
    pk: 'id_retencion',
    numberField: 'numero_retencion',
    auditEntity: 'retenciones',
    label: 'retencion',
    load: loadWithholdingForSri,
    build: ({ document, details, company, ambiente }) => buildRetencionXml({
      withholding: document,
      details,
      company,
      ambiente,
    }),
  },
};

function documentConfigOrFail(kind) {
  const config = sriDocumentTypes[kind];
  if (!config) {
    throw new Error('Tipo de documento SRI no soportado.');
  }
  return config;
}

async function updateComplementaryDocumentSri(client, config, idDocumento, patch) {
  await client.query(`
    UPDATE ${config.table}
    SET clave_acceso = COALESCE($2, clave_acceso),
        xml_generado = COALESCE($3, xml_generado),
        sri_estado = COALESCE($4, sri_estado),
        sri_ambiente = COALESCE($5, sri_ambiente),
        sri_numero_autorizacion = $6,
        sri_fecha_autorizacion = NULLIF($7, '')::timestamp,
        sri_mensajes = COALESCE($8::jsonb, sri_mensajes)
    WHERE ${config.pk} = $1
  `, [
    idDocumento,
    patch.clave_acceso || null,
    patch.xml_generado || null,
    patch.sri_estado || null,
    patch.sri_ambiente || null,
    patch.sri_numero_autorizacion || null,
    patch.sri_fecha_autorizacion || '',
    patch.sri_mensajes ? JSON.stringify(patch.sri_mensajes) : null,
  ]);
}

async function ensureGeneratedComplementaryXml(client, kind, idDocumento, company) {
  const config = documentConfigOrFail(kind);
  const sriRes = await client.query(`
    SELECT *
    FROM sri_comprobantes
    WHERE tipo_comprobante = $1 AND id_documento = $2
  `, [config.tipo, idDocumento]);

  const { document, details } = await config.load(client, idDocumento);
  if (document.estado === 'ANULADA') {
    throw new Error(`No se puede procesar SRI para una ${config.label} anulada.`);
  }
  if (details.length === 0) {
    throw new Error(`La ${config.label} no tiene detalles para generar XML SRI.`);
  }

  const existingSri = sriRes.rows[0];
  if (existingSri?.estado === 'AUTORIZADO') {
    return existingSri;
  }
  if (sriRecordMatchesCompany(existingSri, company)) {
    return existingSri;
  }

  const ambiente = normalize(company.ambiente_sri).toUpperCase() === 'PRODUCCION' ? 'PRODUCCION' : 'PRUEBAS';
  const { xml, claveAcceso } = config.build({
    document,
    details,
    company,
    ambiente,
  });

  const upsertRes = await client.query(`
    INSERT INTO sri_comprobantes (
      tipo_comprobante, id_documento, numero_comprobante, clave_acceso,
      ambiente, estado, xml_generado, mensajes
    )
    VALUES ($1, $2, $3, $4, $5, 'GENERADO', $6, '[]'::jsonb)
    ON CONFLICT (tipo_comprobante, id_documento)
    DO UPDATE SET
      numero_comprobante = EXCLUDED.numero_comprobante,
      clave_acceso = EXCLUDED.clave_acceso,
      ambiente = EXCLUDED.ambiente,
      estado = 'GENERADO',
      xml_generado = EXCLUDED.xml_generado,
      xml_firmado = NULL,
      numero_autorizacion = NULL,
      fecha_autorizacion = NULL,
      mensajes = '[]'::jsonb,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `, [config.tipo, document[config.pk], document[config.numberField], claveAcceso, ambiente, xml]);

  await updateComplementaryDocumentSri(client, config, document[config.pk], {
    clave_acceso: claveAcceso,
    xml_generado: xml,
    sri_estado: 'GENERADO',
    sri_ambiente: ambiente,
    sri_numero_autorizacion: null,
    sri_fecha_autorizacion: '',
    sri_mensajes: [],
  });

  return upsertRes.rows[0];
}

async function generateComplementaryXmlHandler(req, res, kind) {
  const client = await db.pool.connect();
  const config = documentConfigOrFail(kind);
  try {
    await client.query('BEGIN');
    const company = await loadCompany(client);
    const sri = await ensureGeneratedComplementaryXml(client, kind, req.params.id, company);

    await writeAudit(client, {
      entity: config.auditEntity,
      entityId: sri.id_documento,
      action: 'GENERAR_XML_SRI_PRUEBAS',
      userId: getCurrentUserId(req),
      detail: {
        numero_comprobante: sri.numero_comprobante,
        clave_acceso: sri.clave_acceso,
        ambiente: sri.ambiente,
      },
    });

    await client.query('COMMIT');
    res.json({
      estado: sri.estado,
      ambiente: sri.ambiente,
      clave_acceso: sri.clave_acceso,
      xml: sri.xml_generado,
      sri,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al generar XML SRI pruebas:', error);
    res.status(400).json({ error: error.message || 'Error al generar XML SRI en pruebas.' });
  } finally {
    client.release();
  }
}

async function processComplementarySriHandler(req, res, kind) {
  const client = await db.pool.connect();
  const config = documentConfigOrFail(kind);
  try {
    await client.query('BEGIN');

    const company = await loadCompany(client);
    let sri = await ensureGeneratedComplementaryXml(client, kind, req.params.id, company);
    let signedXml = sri.xml_firmado;
    if (!signedXml) {
      signedXml = await signXmlWithCertificate(sri.xml_generado, company);
      const signedRes = await client.query(`
        UPDATE sri_comprobantes
        SET estado = 'FIRMADO',
            xml_firmado = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id_sri = $1
        RETURNING *
      `, [sri.id_sri, signedXml]);
      sri = signedRes.rows[0];
      await updateComplementaryDocumentSri(client, config, sri.id_documento, {
        sri_estado: 'FIRMADO',
        sri_mensajes: [],
      });
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
      await updateComplementaryDocumentSri(client, config, sri.id_documento, {
        sri_estado: 'DEVUELTO',
        sri_mensajes: messages,
      });
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

    await updateComplementaryDocumentSri(client, config, sri.id_documento, {
      sri_estado: finalState,
      sri_numero_autorizacion: authorization.numeroAutorizacion || null,
      sri_fecha_autorizacion: authorization.fechaAutorizacion || '',
      sri_mensajes: messages,
    });

    await writeAudit(client, {
      entity: config.auditEntity,
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
    if (finalState === 'AUTORIZADO') {
      await sendSriDocumentEmail({
        tipoComprobante: config.tipo,
        idDocumento: sri.id_documento,
        userId: getCurrentUserId(req),
      }).catch((err) => console.error('Email no enviado:', err));
    }
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

router.get('/readiness-test', async (req, res) => {
  try {
    const company = await loadCompany(db);
    const checks = [];
    const addCheck = (key, ok, label, detail = '') => checks.push({ key, ok, label, detail });

    addCheck('company_ruc', Boolean(company.ruc && String(company.ruc).length === 13), 'RUC de empresa', company.ruc || '');
    addCheck('company_name', Boolean(company.razon_social), 'Razon social', company.razon_social || '');
    addCheck('company_address', Boolean(company.direccion_matriz), 'Direccion matriz', company.direccion_matriz || '');
    addCheck('environment', true, 'Ambiente SRI', 'PRUEBAS');

    const endpoints = getSriEndpoints(company, 'PRUEBAS');
    addCheck('endpoint_reception', Boolean(endpoints.receptionUrl), 'Endpoint recepcion', endpoints.receptionUrl);
    addCheck('endpoint_authorization', Boolean(endpoints.authorizationUrl), 'Endpoint autorizacion', endpoints.authorizationUrl);

    try {
      const certificate = validateCertificateConfig(company);
      addCheck('certificate', true, 'Certificado electronico', `Valido hasta ${new Date(certificate.validTo).toLocaleDateString()}`);
    } catch (error) {
      addCheck('certificate', false, 'Certificado electronico', error.message);
    }

    res.json({
      ready: checks.every((check) => check.ok),
      ambiente: 'PRUEBAS',
      checks,
    });
  } catch (error) {
    res.status(400).json({
      ready: false,
      ambiente: 'PRUEBAS',
      checks: [{ key: 'company', ok: false, label: 'Empresa', detail: error.message }],
    });
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

    const ambiente = normalize(company.ambiente_sri).toUpperCase() === 'PRODUCCION' ? 'PRODUCCION' : 'PRUEBAS';
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
        xml_firmado = NULL,
        numero_autorizacion = NULL,
        fecha_autorizacion = NULL,
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
          sri_numero_autorizacion = NULL,
          sri_fecha_autorizacion = NULL,
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
    const signedXml = await signXmlWithCertificate(sri.xml_generado, company);

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
      signedXml = await signXmlWithCertificate(sri.xml_generado, company);
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
    if (estado === 'AUTORIZADO') {
      await sendSriDocumentEmail({
        tipoComprobante: '01',
        idDocumento: sri.id_documento,
        userId: getCurrentUserId(req),
      }).catch((err) => console.error('Email no enviado:', err));
    }

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
    console.error('Error al autorizar XML SRI:', error);
    res.status(400).json({ error: error.message || 'Error al consultar autorizacion SRI.' });
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
      signedXml = await signXmlWithCertificate(sri.xml_generado, company);
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
    if (finalState === 'AUTORIZADO') {
      await sendSriDocumentEmail({
        tipoComprobante: '01',
        idDocumento: sri.id_documento,
        userId: getCurrentUserId(req),
      }).catch((err) => console.error('Email no enviado:', err));
    }

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
    console.error('Error al procesar SRI:', error);
    return res.status(400).json({ error: error.message || 'Error al procesar SRI.' });
  } finally {
    client.release();
  }
});

router.get('/credit-notes/:id/status', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT *
      FROM sri_comprobantes
      WHERE tipo_comprobante = '04' AND id_documento = $1
    `, [req.params.id]);

    res.json(result.rows[0] || null);
  } catch (error) {
    console.error('Error al consultar estado SRI de nota de credito:', error);
    res.status(500).json({ error: 'Error al consultar el estado SRI.' });
  }
});

router.post('/credit-notes/:id/generate-test-xml', (req, res) => (
  generateComplementaryXmlHandler(req, res, 'creditNote')
));

router.post('/credit-notes/:id/process-test', (req, res) => (
  processComplementarySriHandler(req, res, 'creditNote')
));

router.get('/withholdings/:id/status', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT *
      FROM sri_comprobantes
      WHERE tipo_comprobante = '07' AND id_documento = $1
    `, [req.params.id]);

    res.json(result.rows[0] || null);
  } catch (error) {
    console.error('Error al consultar estado SRI de retencion:', error);
    res.status(500).json({ error: 'Error al consultar el estado SRI.' });
  }
});

router.post('/withholdings/:id/generate-test-xml', (req, res) => (
  generateComplementaryXmlHandler(req, res, 'withholding')
));

router.post('/withholdings/:id/process-test', (req, res) => (
  processComplementarySriHandler(req, res, 'withholding')
));

router.get('/emails/:type/:id', async (req, res) => {
  try {
    const tipoComprobante = normalizeEmailDocumentType(req.params.type);
    const result = await db.query(`
      SELECT e.*, u.username
      FROM sri_email_envios e
      LEFT JOIN usuarios u ON e.id_usuario = u.id_usuario
      WHERE e.tipo_comprobante = $1 AND e.id_documento = $2
      ORDER BY e.created_at DESC
    `, [tipoComprobante, req.params.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al consultar historial de email SRI:', error);
    res.status(400).json({ error: error.message || 'Error al consultar historial de email.' });
  }
});

router.post('/emails/:type/:id/send', async (req, res) => {
  try {
    const tipoComprobante = normalizeEmailDocumentType(req.params.type);
    const { result, history } = await sendSriDocumentEmail({
      tipoComprobante,
      idDocumento: req.params.id,
      userId: getCurrentUserId(req),
    });
    res.status(result.sent ? 201 : 400).json({
      sent: result.sent,
      error: result.error || null,
      history,
    });
  } catch (error) {
    console.error('Error al enviar email SRI:', error);
    res.status(400).json({ error: error.message || 'Error al enviar comprobante por email.' });
  }
});

module.exports = router;
