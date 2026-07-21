const test = require('node:test');
const assert = require('node:assert/strict');
const { schemas } = require('../middleware/validate');

test('acepta un cliente completo y normaliza su correo', () => {
  const result = schemas.createClient.validate({
    name: 'Cliente Prueba', identification_number: '0912345678',
    email: 'CLIENTE@EJEMPLO.COM', person_type: 'NATURAL',
  });
  assert.equal(result.error, undefined);
  assert.equal(result.value.email, 'cliente@ejemplo.com');
});

test('rechaza pagos con monto cero o negativo', () => {
  assert.ok(schemas.registerPayment.validate({ monto: 0 }).error);
  assert.ok(schemas.registerPayment.validate({ monto: -1 }).error);
});

test('rechaza una empresa con RUC o endpoints inseguros', () => {
  const result = schemas.updateCompany.validate({
    ruc: '123', razon_social: 'Empresa', direccion_matriz: 'Direccion',
    sri_endpoint_recepcion: 'http://ejemplo.test',
  });
  assert.ok(result.error);
});

test('exige contrasenas de usuario de al menos diez caracteres', () => {
  const result = schemas.createUser.validate({
    username: 'operador', email: 'operador@ejemplo.com', password: 'corta', id_rol: 1,
  });
  assert.ok(result.error);
});
