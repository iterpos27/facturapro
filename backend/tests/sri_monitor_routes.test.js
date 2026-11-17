const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const db = require('../db');
const router = require('../routes/sri_monitor');
const { authenticateToken } = require('../routes/auth');

/** Servidor HTTP efímero con consultas simuladas, sin modificar la base de datos local. */
async function withServer(t, protectedRoute = false) {
  const app = express();
  if (protectedRoute) app.use(authenticateToken);
  app.use('/api/sri', router);
  const server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}/api/sri`;
}

test('panel devuelve indicadores y página sin XML ni datos de certificados', async (t) => {
  const queries = [];
  t.mock.method(db, 'query', async (sql, params) => {
    queries.push({ sql, params });
    return { rows: sql.includes('GROUP BY') ? [{ estado: 'RECIBIDO', cantidad: 26 }] : [{ id_sri: 3, estado: 'RECIBIDO' }] };
  });
  const url = await withServer(t);
  const response = await fetch(`${url}/monitor?estado=RECIBIDO&page=2`);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.total, 26);
  assert.equal(result.page, 2);
  assert.equal(queries[0].params.at(-1), 25);
  assert.doesNotMatch(queries[0].sql, /xml_firmado|certificado|SELECT \*/);
});
test('panel rechaza fechas inexistentes y filtros inválidos antes de consultar BD', async (t) => {
  t.mock.method(db, 'query', async () => { throw new Error('No debería ejecutar SQL'); });
  const url = await withServer(t);
  for (const query of ['desde=2026-02-31', 'page=-1', 'tipo=99', 'desde=2026-09-25&hasta=2026-09-01']) {
    assert.equal((await fetch(`${url}/monitor?${query}`)).status, 400, query);
  }
});
test('clave inválida es rechazada sin contactar al SRI', async (t) => {
  const url = await withServer(t);
  assert.equal((await fetch(`${url}/consult/123`)).status, 400);
});
test('panel requiere autenticación al montarse con el middleware de producción', async (t) => {
  const url = await withServer(t, true);
  assert.equal((await fetch(`${url}/monitor`)).status, 401);
});
