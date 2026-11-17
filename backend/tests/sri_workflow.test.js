const test = require('node:test');
const assert = require('node:assert/strict');
const { assertTransmissionDate, authorizationState, validateAccessKey, assertLocalCancellationAllowed } = require('../utils/sri_workflow');
const { generarClaveAccesoSRI } = require('../utils/sri_utils');
const { buildFacturaXml } = require('../utils/sri_utils');

// La fecha de Ecuador todavía es 24 cuando UTC ya pasó al día 25.
const now = new Date('2026-09-25T02:00:00Z');
test('transmisión compara el calendario de Ecuador', () => {
  assert.doesNotThrow(() => assertTransmissionDate('<fechaEmision>24/09/2026</fechaEmision>', now));
  assert.throws(() => assertTransmissionDate('<fechaEmision>25/09/2026</fechaEmision>', now), /2026-09-24/);
  assert.throws(() => assertTransmissionDate('<fechaEmision>23/09/2026</fechaEmision>', now), /fecha/);
});
test('rechaza XML sin fecha y fechas inexistentes', () => {
  for (const xml of ['', '<fechaEmision>31/02/2026</fechaEmision>', '<fechaEmision>no</fechaEmision>']) {
    assert.throws(() => assertTransmissionDate(xml, now), /fecha/i);
  }
});
test('una autorización pendiente no equivale a rechazo', () => {
  assert.equal(authorizationState('SIN_AUTORIZACION'), 'RECIBIDO');
  assert.equal(authorizationState('EN PROCESO'), 'RECIBIDO');
  assert.equal(authorizationState('NO AUTORIZADO'), 'NO_AUTORIZADO');
  assert.equal(authorizationState('AUTORIZADO'), 'AUTORIZADO');
  assert.equal(authorizationState('SIN_AUTORIZACION', 'AUTORIZADO'), 'AUTORIZADO');
  assert.throws(() => authorizationState('RESPUESTA_DESCONOCIDA'), /respuesta/i);
});
test('clave conserva sus 49 dígitos y valida módulo 11 y ambiente', () => {
  const key = generarClaveAccesoSRI({ fechaEmision: new Date(2026, 8, 24), tipoComprobante: '01', ruc: '1790012345001', secuencial: 1 });
  assert.equal(validateAccessKey(key).ambiente, 'PRUEBAS');
  assert.throws(() => validateAccessKey(key.slice(0, -1) + ((Number(key.at(-1)) + 1) % 10)), /verificador/);
  assert.throws(() => validateAccessKey('123'), /49/);
});
test('una fecha civil ISO no retrocede un día al generar la clave y el XML', () => {
  const result = buildFacturaXml({ invoice: { fecha_emision: '2026-09-24' }, company: { ruc: '1790012345001' } });
  assert.equal(result.claveAcceso.slice(0, 8), '24092026');
  assert.match(result.xml, /<fechaEmision>24\/09\/2026<\/fechaEmision>/);
});

test('la anulación interna no altera documentos que el SRI ya recibió', () => {
  for (const sri_estado of ['PENDIENTE_ENVIO', 'ENVIANDO', 'RECIBIDO', 'EN_PROCESO', 'AUTORIZADO']) {
    assert.throws(() => assertLocalCancellationAllowed({ sri_estado }), /SRI/);
  }
  for (const sri_estado of [null, 'GENERADO', 'FIRMADO', 'DEVUELTO', 'NO_AUTORIZADO']) {
    assert.doesNotThrow(() => assertLocalCancellationAllowed({ sri_estado }));
  }
  assert.throws(() => assertLocalCancellationAllowed({ sri_estado: null }, { estado: 'AUTORIZADO' }), /SRI/);
});
