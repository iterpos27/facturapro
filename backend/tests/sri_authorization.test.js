const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const { authorizeReceipt } = require('../services/sri_service');
const { generarClaveAccesoSRI } = require('../utils/sri_utils');
const key = generarClaveAccesoSRI({ fechaEmision: '2026-09-24', tipoComprobante: '01', ruc: '1790012345001', secuencial: 1 });

test('respuesta vacía de autorizaciones conserva estado pendiente', async (t) => {
  t.mock.method(axios, 'post', async () => ({ data: '<RespuestaAutorizacionComprobante><numeroComprobantes>0</numeroComprobantes><autorizaciones/></RespuestaAutorizacionComprobante>' }));
  assert.equal((await authorizeReceipt(key, {}, 'PRUEBAS')).estado, 'SIN_AUTORIZACION');
});
test('error SOAP no se interpreta como autorización pendiente', async (t) => {
  t.mock.method(axios, 'post', async () => ({ data: '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><soap:Fault><faultstring>Error del servicio</faultstring></soap:Fault></soap:Body></soap:Envelope>' }));
  await assert.rejects(authorizeReceipt(key, {}, 'PRUEBAS'), /respuesta|servicio/i);
});
test('respuesta autorizada con prefijos XML se interpreta correctamente', async (t) => {
  t.mock.method(axios, 'post', async () => ({ data: `<ns:RespuestaAutorizacionComprobante xmlns:ns="urn:sri"><ns:numeroComprobantes>1</ns:numeroComprobantes><ns:autorizaciones><ns:autorizacion><ns:estado>AUTORIZADO</ns:estado><ns:numeroAutorizacion>${key}</ns:numeroAutorizacion><ns:fechaAutorizacion>2026-09-24T12:00:00-05:00</ns:fechaAutorizacion></ns:autorizacion></ns:autorizaciones></ns:RespuestaAutorizacionComprobante>` }));
  const result = await authorizeReceipt(key, {}, 'PRUEBAS');
  assert.equal(result.estado, 'AUTORIZADO');
  assert.equal(result.numeroAutorizacion, key);
});
