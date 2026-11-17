const test = require('node:test');
const assert = require('node:assert/strict');
const {
  generarClaveAccesoSRI,
  generarClaveAccesoParaEmpresa,
  buildFacturaXml,
  buildNotaCreditoXml,
  buildRetencionXml,
} = require('../utils/sri_utils');

const ruc = '1790012345001';
const testKey = generarClaveAccesoSRI({
  fechaEmision: '2026-11-13',
  tipoComprobante: '01',
  ruc,
  ambiente: '1',
  secuencial: '000000001',
});

test('la clave nueva usa el ambiente configurado de la empresa', () => {
  const key = generarClaveAccesoParaEmpresa({
    fechaEmision: '2026-11-13',
    tipoComprobante: '01',
    ruc,
    ambiente_sri: 'PRODUCCION',
    establecimiento: '001',
    puntoEmision: '001',
    secuencial: '000000001',
  });
  assert.equal(key[23], '2');
});

for (const [label, builder, field] of [
  ['factura', buildFacturaXml, 'invoice'],
  ['nota de crédito', buildNotaCreditoXml, 'creditNote'],
  ['retención', buildRetencionXml, 'withholding'],
]) {
  test(`${label}: no reutiliza una clave de pruebas al generar XML de producción`, () => {
    const { xml, claveAcceso } = builder({
      [field]: {
        fecha_emision: '2026-11-13',
        clave_acceso: testKey,
        numero_factura: '001-001-000000001',
        numero_nota_credito: '001-001-000000001',
        numero_retencion: '001-001-000000001',
      },
      company: { ruc },
      ambiente: 'PRODUCCION',
    });
    assert.equal(claveAcceso[23], '2');
    assert.match(xml, /<ambiente>2<\/ambiente>/);
    assert.match(xml, new RegExp(`<claveAcceso>${claveAcceso}</claveAcceso>`));
  });
}

test('la factura no reutiliza una clave válida de otro tipo de documento', () => {
  const wrongTypeKey = generarClaveAccesoSRI({
    fechaEmision: '2026-11-13', tipoComprobante: '04', ruc,
    ambiente: '1', secuencial: '000000001',
  });
  const result = buildFacturaXml({
    invoice: { fecha_emision: '2026-11-13', numero_factura: '001-001-000000001', clave_acceso: wrongTypeKey },
    company: { ruc }, ambiente: 'PRUEBAS',
  });
  assert.equal(result.claveAcceso.slice(8, 10), '01');
  assert.match(result.xml, new RegExp(`<claveAcceso>${result.claveAcceso}</claveAcceso>`));
});

for (const [label, wrong, document] of [
  ['fecha', { fechaEmision: '2026-11-12' }, { fecha_emision: '2026-11-13' }],
  ['secuencial', { secuencial: '000000002' }, { numero_factura: '001-001-000000001' }],
]) {
  test(`la factura no reutiliza una clave con distinta ${label}`, () => {
    const wrongKey = generarClaveAccesoSRI({
      fechaEmision: '2026-11-13', tipoComprobante: '01', ruc,
      ambiente: '1', secuencial: '000000001', ...wrong,
    });
    const result = buildFacturaXml({
      invoice: { fecha_emision: '2026-11-13', numero_factura: '001-001-000000001', ...document, clave_acceso: wrongKey },
      company: { ruc }, ambiente: 'PRUEBAS',
    });
    assert.notEqual(result.claveAcceso, wrongKey);
  });
}
