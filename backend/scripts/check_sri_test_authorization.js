const db = require('../db');
const { authorizeReceipt, hasEmbeddedSignature } = require('../services/sri_service');
const { loadRide, renderRidePdfBuffer } = require('../services/ride_service');
const { buildDocumentAttachments } = require('../services/email_service');

async function main() {
  const companies = await db.query('SELECT * FROM empresas ORDER BY id_empresa LIMIT 2');
  if (companies.rows.length !== 1 || companies.rows[0].ambiente_sri !== 'PRUEBAS') {
    throw new Error('Se requiere una sola empresa en SRI PRUEBAS.');
  }
  const company = companies.rows[0];
  const documents = await db.query(`
    SELECT DISTINCT ON (tipo_comprobante) tipo_comprobante, id_documento, numero_comprobante, clave_acceso,
           xml_generado, xml_firmado, numero_autorizacion, fecha_autorizacion
    FROM sri_comprobantes
    WHERE ambiente = 'PRUEBAS' AND estado = 'AUTORIZADO'
      AND substring(clave_acceso, 11, 13) = $1
      AND tipo_comprobante IN ('01', '04', '07')
    ORDER BY tipo_comprobante, id_sri DESC
  `, [company.ruc]);
  if (documents.rows.length !== 3) throw new Error('Falta un comprobante histórico autorizado de alguno de los tres tipos para el RUC activo.');
  for (const document of documents.rows) {
    const response = await authorizeReceipt(document.clave_acceso, company, 'PRUEBAS');
    console.log(JSON.stringify({
      tipo: document.tipo_comprobante,
      estado_sri: response.estado,
      autorizacion_presente: Boolean(response.numeroAutorizacion),
      coincide_con_registro_local: response.numeroAutorizacion === document.numero_autorizacion,
      firma_incrustada: hasEmbeddedSignature(document.xml_firmado),
      cantidad_mensajes: response.mensajes?.length || 0,
    }));
    if (response.estado !== 'AUTORIZADO' || !response.numeroAutorizacion
      || response.numeroAutorizacion !== document.numero_autorizacion
      || !document.xml_generado || !document.fecha_autorizacion
      || !hasEmbeddedSignature(document.xml_firmado)) {
      throw new Error(`La autorización histórica tipo ${document.tipo_comprobante} no coincide con SRI PRUEBAS.`);
    }
    const rideType = { '01': 'invoice', '04': 'credit-note', '07': 'withholding' }[document.tipo_comprobante];
    const ridePdf = await renderRidePdfBuffer(await loadRide(rideType, document.id_documento));
    const attachments = buildDocumentAttachments({
      docType: rideType, docNumber: document.numero_comprobante,
      authNumber: document.numero_autorizacion, xml: document.xml_firmado, ridePdf,
    });
    if (ridePdf.subarray(0, 5).toString() !== '%PDF-' || attachments.length !== 2
      || attachments[1].contentType !== 'application/pdf') {
      throw new Error(`El RIDE PDF o los adjuntos tipo ${document.tipo_comprobante} no son válidos.`);
    }
    console.log(JSON.stringify({ tipo: document.tipo_comprobante, ride_pdf_valido: true, adjuntos_xml_pdf: true }));
  }
}

main().catch((error) => {
  console.error(`Consulta SRI PRUEBAS fallida: ${error.code || error.message}`);
  process.exitCode = 1;
}).finally(() => db.pool.end());
