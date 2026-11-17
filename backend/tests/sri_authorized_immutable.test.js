const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const sriRouter = require('../routes/sri');

for (const estado of ['AUTORIZADO', 'RECIBIDO']) {
test(`generar XML de una factura ${estado} conserva el comprobante original`, async (t) => {
  const calls = [];
  const original = {
    id_sri: 8,
    tipo_comprobante: '01',
    id_documento: 2,
    estado,
    ambiente: 'PRUEBAS',
    clave_acceso: '123',
    xml_generado: '<factura>original</factura>',
    xml_firmado: '<factura>firmado</factura>',
    numero_autorizacion: '123',
  };
  const client = {
    async query(sql) {
      calls.push(sql);
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('FROM empresas')) return { rows: [{ ruc: '1790012345001', ambiente_sri: 'PRUEBAS' }] };
      if (sql.includes('FROM sri_comprobantes')) return { rows: [original] };
      return { rows: [] };
    },
    release() {},
  };
  t.mock.method(db.pool, 'connect', async () => client);
  const app = express();
  app.use('/api/sri', sriRouter);
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const token = jwt.sign({ id_usuario: 1 }, process.env.JWT_SECRET || 'dev-only-facturapro-secret');
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/sri/invoices/2/generate-test-xml`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.estado, estado);
  assert.equal(result.xml, original.xml_generado);
  assert.equal(calls.filter((sql) => /^\s*(UPDATE|INSERT|DELETE)/i.test(sql)).length, 0);
});
}
