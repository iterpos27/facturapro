const test = require('node:test');
const assert = require('node:assert/strict');
const { confirmReceptionAndAuthorize } = require('../services/sri_reception');
const { refreshSriRecord } = require('../services/sri_monitor');
const { generarClaveAccesoSRI } = require('../utils/sri_utils');

for (const type of ['01', '04', '07']) {
  test(`${type}: error de autorización ocurre después de confirmar recepción`, async () => {
    const calls = [];
    const client = { async query(sql) { calls.push(sql); return { rowCount: 1 }; } };
    await assert.rejects(confirmReceptionAndAuthorize(client,
      { tipo_comprobante: type, id_sri: 1, id_documento: 2, clave_acceso: 'key' },
      { estado: 'RECIBIDA' }, 10, {
        async writeAudit() { calls.push('AUDIT'); },
        async refreshSriRecord() {
          assert.equal(calls.at(-1), 'COMMIT');
          throw new Error('SOAP timeout');
        },
      }), /timeout/);
    assert.equal(calls.filter((sql) => sql.includes("estado='RECIBIDO'")).length, 2);
    assert.equal(calls.at(-1), 'COMMIT');
  });
}
test('recuperación reutiliza la conexión también para sus lecturas iniciales', async () => {
  const key = generarClaveAccesoSRI({ fechaEmision: '2026-09-24', tipoComprobante: '01', ruc: '1790012345001', secuencial: 1 });
  const client = {
    async query(sql) { return { rows: sql.includes('empresas') ? [{ ruc: '1790012345001' }] : [{ clave_acceso: key, ambiente: 'PRUEBAS', tipo_comprobante: '01', estado: 'AUTORIZADO' }] }; },
  };
  const result = await refreshSriRecord(1, 10, {
    client, db: { async query() { assert.fail('No debe pedir otra conexión al pool'); } },
  });
  assert.equal(result.estado, 'AUTORIZADO');
});
