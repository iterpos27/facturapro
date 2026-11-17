const test = require('node:test');
const assert = require('node:assert/strict');
const { runSriDispatchCycle, runSriRecoveryCycle } = require('../services/sri_auto_dispatch');

test('el despachador procesa únicamente comprobantes en cola de PRUEBAS', async () => {
  const calls = [];
  const database = {
    async query(sql) {
      calls.push(sql);
      return { rows: [{ id_sri: 3, tipo_comprobante: '01', id_documento: 8 }] };
    },
  };
  const dispatched = [];
  await runSriDispatchCycle({ database, dispatch: async (item) => {
    dispatched.push(item);
    return { statusCode: 200, body: { estado: 'RECIBIDO' } };
  } });
  assert.match(calls[0], /estado\s*=\s*'PENDIENTE_ENVIO'/);
  assert.match(calls[0], /ambiente\s*=\s*'PRUEBAS'/);
  assert.deepEqual(dispatched.map((item) => item.id_sri), [3]);
});
test('un fallo del SRI queda para reintento y se informa al operador', async () => {
  const database = { async query() { return { rows: [{ id_sri: 4, tipo_comprobante: '04', id_documento: 2 }] }; } };
  const failures = await runSriDispatchCycle({ database, dispatch: async () => ({ statusCode: 400, body: { error: 'firma inválida' } }) });
  assert.equal(failures.length, 1);
  assert.match(failures[0].error, /firma inválida/);
});

test('recuperación reconsulta la clave incierta y las autorizaciones pendientes sin retransmitir', async () => {
  let sql;
  const database = { async query(query) {
    sql = query;
    return { rows: [{ id_sri: 9 }] };
  } };
  const ids = [];
  const failures = await runSriRecoveryCycle({ database, refresh: async (id) => { ids.push(id); } });
  assert.match(sql, /ENVIANDO/);
  assert.match(sql, /RECIBIDO/);
  assert.deepEqual(ids, [9]);
  assert.deepEqual(failures, []);
});
