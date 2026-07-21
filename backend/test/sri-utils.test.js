const test = require('node:test');
const assert = require('node:assert/strict');
const { generarClaveAccesoSRI, claveAccesoPerteneceAlRuc, escapeXml } = require('../utils/sri_utils');

test('genera una clave de acceso de 49 digitos asociada al RUC', () => {
  const ruc = '1790016919001';
  const clave = generarClaveAccesoSRI({
    fechaEmision: '2026-07-20T12:00:00-05:00', tipoComprobante: '01', ruc, secuencial: 15,
  });
  assert.match(clave, /^\d{49}$/);
  assert.equal(claveAccesoPerteneceAlRuc(clave, ruc), true);
});

test('escapa caracteres peligrosos en XML', () => {
  assert.equal(escapeXml('A&B <C> "D"'), 'A&amp;B &lt;C&gt; &quot;D&quot;');
});
