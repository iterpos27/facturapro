const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db');
const { loadRide, renderRideHtml } = require('../services/ride_service');

test('RIDE sin respuesta SRI muestra autorización pendiente sin inventar fecha', async (t) => {
  const issueDate = '2026-10-23T10:00:00';
  t.mock.method(db, 'query', async (sql) => {
    const statement = String(sql);
    if (statement.includes('FROM empresas')) return { rows: [{ razon_social: 'Empresa de prueba' }] };
    if (statement.includes('FROM facturas f')) return { rows: [{ numero_factura: '001-001-000000001', fecha_emision: issueDate, sri_fecha_autorizacion: issueDate, clave_acceso: 'CLAVE_FACTURA', estado: 'EMITIDA' }] };
    if (statement.includes('FROM notas_credito nc')) return { rows: [{ numero_nota_credito: '001-001-000000002', fecha_emision: issueDate, sri_fecha_autorizacion: issueDate, clave_acceso: 'CLAVE_NOTA', estado: 'EMITIDA' }] };
    if (statement.includes('FROM retenciones r')) return { rows: [{ numero_retencion: '001-001-000000003', fecha_emision: issueDate, sri_fecha_autorizacion: issueDate, clave_acceso: 'CLAVE_RETENCION', estado: 'EMITIDA' }] };
    return { rows: [] };
  });

  for (const type of ['invoice', 'credit-note', 'withholding']) {
    const payload = await loadRide(type, 1);
    const html = renderRideHtml(payload);
    assert.equal(payload.ride.authorization, 'PENDIENTE SRI', type);
    assert.equal(payload.ride.authorizationDate, null, type);
    assert.match(html, /NUMERO DE AUTORIZACION:<\/strong><br>\s*<div class="break small">PENDIENTE SRI<\/div>/);
    assert.match(html, /FECHA Y HORA DE AUTORIZACION:<\/strong> N\/D<br>/);
    assert.match(html, /CLAVE DE ACCESO:<\/strong>\s*<div class="break small">CLAVE_/);
  }
});
