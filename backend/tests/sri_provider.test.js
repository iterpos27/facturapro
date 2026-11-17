const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFacturaXml, buildNotaCreditoXml, buildRetencionXml } = require('../utils/sri_utils');

// Verifica el dato del proveedor en cada tipo de comprobante sin contactar al SRI.
for (const [name, builder, key] of [
  ['factura', buildFacturaXml, 'invoice'],
  ['nota de crédito', buildNotaCreditoXml, 'creditNote'],
  ['retención', buildRetencionXml, 'withholding'],
]) {
  const build = (provider) => builder({
    [key]: { fecha_emision: '2026-09-24' },
    company: { ruc: '1790012345001', ruc_proveedor_software: provider },
  }).xml;

  test(`${name}: incluye el RUC configurado una sola vez`, () => {
    assert.equal((build('1790012345001').match(/nombre="RucProveedorSoftware"/g) || []).length, 1);
    assert.match(build('1790012345001'), /<campoAdicional nombre="RucProveedorSoftware">1790012345001<\/campoAdicional>/);
  });
  test(`${name}: permite configuraciones anteriores sin proveedor`, () => {
    assert.doesNotMatch(build(null), /RucProveedorSoftware/);
  });
  test(`${name}: rechaza un RUC mal formado antes de generar XML`, () => {
    assert.throws(() => build('123<script>'), /13 dígitos/);
  });
}
