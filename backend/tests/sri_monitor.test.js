const test = require('node:test');
const assert = require('node:assert/strict');
const { refreshSriRecord } = require('../services/sri_monitor');
const { generarClaveAccesoSRI } = require('../utils/sri_utils');
const { getSriEndpoints } = require('../services/sri_service');

/** Base de datos aislada: registra escrituras para comprobar atomicidad sin usar datos reales. */
function fixture({ type = '01', state = 'RECIBIDO', lockedState, response, failDocument = false, wrongCompany = false } = {}) {
  const key = generarClaveAccesoSRI({ fechaEmision: new Date(2026, 8, 1), tipoComprobante: type, ruc: '1790012345001', secuencial: 1 });
  const record = { id_sri: 1, id_documento: 2, tipo_comprobante: type, estado: state, ambiente: 'PRUEBAS', clave_acceso: key };
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('FOR UPDATE')) return { rows: [{ ...record, estado: lockedState || state }] };
      if (sql.startsWith('UPDATE sri_comprobantes')) return { rows: [{ ...record, estado: params[1] }] };
      if (sql.startsWith('UPDATE ')) return { rowCount: failDocument ? 0 : 1 };
      return { rows: [] };
    },
    release() { calls.push({ sql: 'RELEASE' }); },
  };
  const dependencies = {
    db: {
      async query(sql) { return { rows: sql.includes('empresas') ? [{ ruc: wrongCompany ? '0990012345001' : '1790012345001' }] : [record] }; },
      pool: { async connect() { calls.push({ sql: 'CONNECT' }); return client; } },
    },
    async authorizeReceipt(sentKey, _company, environment) {
      calls.push({ sql: 'SOAP', params: [sentKey, environment] });
      if (response instanceof Error) throw response;
      return response || { estado: 'AUTORIZADO', numeroAutorizacion: key, fechaAutorizacion: '2026-09-24T12:00:00-05:00', mensajes: [] };
    },
    async writeAudit(_client, payload) { calls.push({ sql: 'AUDIT', payload }); },
  };
  return { calls, dependencies };
}

for (const [type, table] of [['01', 'facturas'], ['04', 'notas_credito'], ['07', 'retenciones']]) {
  test(`reconsulta histórica sincroniza ${table} y auditoría`, async () => {
    const { calls, dependencies } = fixture({ type });
    const result = await refreshSriRecord(1, 10, dependencies);
    assert.equal(result.estado, 'AUTORIZADO');
    assert.ok(calls.some((call) => call.sql.startsWith(`UPDATE ${table} `)));
    assert.ok(calls.findIndex((call) => call.sql === 'SOAP') < calls.findIndex((call) => call.sql === 'BEGIN'));
    assert.equal(calls.find((call) => call.sql === 'AUDIT').payload.userId, 10);
    assert.ok(calls.some((call) => call.sql === 'COMMIT'));
    assert.equal(calls.at(-1).sql, 'RELEASE');
  });
}
test('timeout no modifica documentos ni abre transacciones', async () => {
  const { calls, dependencies } = fixture({ response: new Error('timeout') });
  await assert.rejects(refreshSriRecord(1, 10, dependencies), /timeout/);
  assert.deepEqual(calls.map((item) => item.sql), ['SOAP']);
});
test('sin autorización mantiene RECIBIDO, no inventa rechazo', async () => {
  const { dependencies } = fixture({ response: { estado: 'SIN_AUTORIZACION', mensajes: [] } });
  assert.equal((await refreshSriRecord(1, 10, dependencies)).estado, 'RECIBIDO');
});
test('sin autorización no inventa recepción de un XML solo generado', async () => {
  const { calls, dependencies } = fixture({ state: 'GENERADO', response: { estado: 'SIN_AUTORIZACION' } });
  assert.equal((await refreshSriRecord(1, 10, dependencies)).estado, 'GENERADO');
  assert.ok(!calls.some((call) => call.sql.startsWith('UPDATE')));
});
test('una transmisión incierta no se marca recibida sin confirmación del SRI', async () => {
  const { calls, dependencies } = fixture({ state: 'ENVIANDO', response: { estado: 'SIN_AUTORIZACION' } });
  assert.equal((await refreshSriRecord(1, 10, dependencies)).estado, 'ENVIANDO');
  assert.ok(!calls.some((call) => call.sql.startsWith('UPDATE')));
});
test('autorización concurrente nunca retrocede', async () => {
  const { calls, dependencies } = fixture({ lockedState: 'AUTORIZADO', response: { estado: 'NO AUTORIZADO' } });
  assert.equal((await refreshSriRecord(1, 10, dependencies)).estado, 'AUTORIZADO');
  assert.ok(!calls.some((call) => call.sql.startsWith('UPDATE')));
});
test('documento no coincidente revierte la actualización SRI', async () => {
  const { calls, dependencies } = fixture({ failDocument: true });
  await assert.rejects(refreshSriRecord(1, 10, dependencies), /original/);
  assert.ok(calls.some((call) => call.sql === 'ROLLBACK'));
  assert.ok(!calls.some((call) => call.sql === 'COMMIT'));
});
test('otra empresa no puede sincronizar el comprobante', async () => {
  const { calls, dependencies } = fixture({ wrongCompany: true });
  await assert.rejects(refreshSriRecord(1, 10, dependencies), /empresa/);
  assert.equal(calls.length, 0);
});
test('una respuesta autorizada incompleta no modifica datos', async () => {
  const { calls, dependencies } = fixture({ response: { estado: 'AUTORIZADO' } });
  await assert.rejects(refreshSriRecord(1, 10, dependencies), /incompleta/);
  assert.ok(!calls.some((call) => call.sql === 'CONNECT'));
});
test('producción está bloqueada hasta completar la validación en pruebas', () => {
  assert.throws(() => getSriEndpoints({ ambiente_sri: 'PRODUCCION' }, 'PRODUCCION'), /validación.*pruebas/i);
});
test('pruebas no acepta endpoints SRI de producción configurados a mano', () => {
  assert.throws(() => getSriEndpoints({ ambiente_sri: 'PRUEBAS', sri_endpoint_recepcion: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline' }, 'PRUEBAS'), /producción/i);
});
