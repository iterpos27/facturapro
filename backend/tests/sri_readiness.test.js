const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateSriReadiness, requireSingleCompany } = require('../utils/sri_readiness');

const readyCompany = {
  ambiente_sri: 'PRUEBAS', ruc: '1790012345001',
  certificado_path: 'certificates/test.p12', certificado_clave: 'configured',
};

test('dos empresas impiden declarar lista la configuración SRI', () => {
  const result = evaluateSriReadiness([readyCompany, readyCompany]);
  assert.equal(result.ok, false);
  assert.match(result.problems.join(' '), /exactamente una empresa/i);
});

test('producción o certificado incompleto impiden declarar lista la configuración', () => {
  const result = evaluateSriReadiness([{ ...readyCompany, ambiente_sri: 'PRODUCCION', certificado_clave: '' }]);
  assert.equal(result.ok, false);
  assert.match(result.problems.join(' '), /pruebas/i);
  assert.match(result.problems.join(' '), /certificado/i);
});

test('una empresa de pruebas con certificado configurado pasa el chequeo local', () => {
  assert.deepEqual(evaluateSriReadiness([readyCompany]), { ok: true, problems: [] });
});

test('la emisión impide elegir una empresa arbitraria si hay dos', () => {
  assert.throws(() => requireSingleCompany([readyCompany, readyCompany]), /exactamente una empresa/i);
  assert.equal(requireSingleCompany([readyCompany]), readyCompany);
});
