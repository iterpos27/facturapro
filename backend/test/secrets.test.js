const test = require('node:test');
const assert = require('node:assert/strict');
const { encryptSecret, decryptSecret, redactCompany, ENCRYPTED_PREFIX } = require('../utils/secrets');

test('cifra y descifra secretos sin guardar texto plano', () => {
  const encrypted = encryptSecret('clave-super-secreta');
  assert.ok(encrypted.startsWith(ENCRYPTED_PREFIX));
  assert.equal(encrypted.includes('clave-super-secreta'), false);
  assert.equal(decryptSecret(encrypted), 'clave-super-secreta');
});

test('mantiene compatibilidad temporal con secretos antiguos en texto plano', () => {
  assert.equal(decryptSecret('clave-antigua'), 'clave-antigua');
});

test('redacta la clave del certificado en respuestas de empresa', () => {
  const company = redactCompany({ id_empresa: 1, ruc: '0999999999001', certificado_clave: 'secreto' });
  assert.equal(company.certificado_clave, undefined);
  assert.equal(company.certificado_configurado, true);
  assert.equal(company.ruc, '0999999999001');
});
