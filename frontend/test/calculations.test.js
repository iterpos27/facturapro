import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLineAmounts } from '../src/lib/calculations.js';

test('calcula subtotal, IVA y descuento de una linea', () => {
  const result = calculateLineAmounts({
    cantidad: 2, precio_unitario: 10, iva_porcentaje: 15,
    descuento: 1, descuento_porcentaje: 10,
  });
  assert.equal(result.subtotal, 20);
  assert.equal(result.iva, 3);
  assert.equal(result.totalDiscount, 3.3);
  assert.equal(result.total, 19.7);
});

test('nunca produce un total negativo', () => {
  const result = calculateLineAmounts({ cantidad: 1, precio_unitario: 10, descuento: 100 });
  assert.equal(result.total, 0);
});
