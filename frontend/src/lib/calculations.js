/**
 * Helpers y utilidades compartidas para facturación y proformas.
 */

export const todayValue = () => new Date().toISOString().slice(0, 10);

export const getClientId = (client) => client?.id_cliente || client?.id || '';
export const getClientName = (client) => client?.nombre || client?.name || 'CONSUMIDOR FINAL';
export const getClientIdentification = (client) => client?.identificacion || client?.identification_number || '9999999999999';
export const getClientPhone = (client) => client?.telefono || client?.phone || '';
export const getClientEmail = (client) => client?.email || '';
export const getClientAddress = (client) => client?.direccion || client?.address || '';

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/**
 * Calcula los totales para un ítem/renglón de factura o proforma.
 */
export const calculateLineAmounts = (item) => {
  const quantity = parseFloat(item.cantidad) || 0;
  const price = parseFloat(item.precio_unitario) || 0;
  const taxPercent = parseFloat(item.iva_porcentaje) || 0;
  const discountAmount = parseFloat(item.descuento) || 0;
  const discountPercent = parseFloat(item.descuento_porcentaje) || 0;

  const subtotal = roundMoney(quantity * price);
  const iva = roundMoney(subtotal * (taxPercent / 100));
  const finalBeforeDiscount = roundMoney(subtotal + iva);

  const percentValue = roundMoney(finalBeforeDiscount * (discountPercent / 100));
  const totalDiscount = roundMoney(Math.min(finalBeforeDiscount, discountAmount + percentValue));
  const total = roundMoney(Math.max(finalBeforeDiscount - totalDiscount, 0));

  return {
    quantity,
    price,
    taxPercent,
    discountAmount,
    discountPercent,
    percentValue,
    totalDiscount,
    subtotal,
    iva,
    finalBeforeDiscount,
    total
  };
};
