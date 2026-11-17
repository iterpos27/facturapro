const test = require('node:test');
const assert = require('node:assert/strict');
const { publicCompany, certificateSecretForUpdate, environmentForCompanySave } = require('../utils/company_secrets');

test('la respuesta pública de empresa oculta la contraseña del certificado', () => {
  const response = publicCompany({ id_empresa: 1, ruc: '1790012345001', certificado_clave: 'secreto' });
  assert.equal(response.ruc, '1790012345001');
  assert.equal(response.certificado_configurado, true);
  assert.equal(Object.hasOwn(response, 'certificado_clave'), false);
});

test('guardar otros datos conserva la contraseña del certificado', () => {
  assert.equal(certificateSecretForUpdate('secreto', ''), 'secreto');
  assert.equal(certificateSecretForUpdate('secreto', undefined), 'secreto');
  assert.equal(certificateSecretForUpdate('secreto', 'nueva'), 'nueva');
});

test('guardar empresa no cambia el ambiente SRI por la ruta genérica', () => {
  assert.equal(environmentForCompanySave('PRUEBAS', 'PRODUCCION'), 'PRUEBAS');
  assert.equal(environmentForCompanySave('PRODUCCION', 'PRUEBAS'), 'PRODUCCION');
  assert.equal(environmentForCompanySave(null, 'PRODUCCION'), 'PRUEBAS');
});
