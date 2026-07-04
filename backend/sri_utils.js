/**
 * Utilidades para Facturacion Electronica SRI Ecuador.
 * Esta capa genera XML en ambiente de PRUEBAS; la firma y envio SOAP quedan
 * para la fase de certificado digital.
 */

function calcularModulo11(claveSinDigito) {
  let suma = 0;
  let factor = 2;
  for (let i = claveSinDigito.length - 1; i >= 0; i--) {
    suma += parseInt(claveSinDigito.charAt(i), 10) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const residuo = suma % 11;
  const digito = 11 - residuo;
  if (digito === 11) return '0';
  if (digito === 10) return '1';
  return String(digito);
}

function generarClaveAccesoSRI({
  fechaEmision,
  tipoComprobante,
  ruc,
  ambiente = '1',
  establecimiento = '001',
  puntoEmision = '001',
  secuencial,
  codigoNumerico = '12345678',
  tipoEmision = '1',
}) {
  const dateObj = new Date(fechaEmision);
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const yyyy = String(dateObj.getFullYear());
  const fechaStr = `${dd}${mm}${yyyy}`;

  const rucStr = String(ruc || '').trim();
  if (!/^\d{13}$/.test(rucStr)) {
    throw new Error('Configure un RUC de empresa valido para generar la clave de acceso SRI.');
  }
  const ambienteStr = String(ambiente);
  const serie = `${String(establecimiento).padStart(3, '0')}${String(puntoEmision).padStart(3, '0')}`;
  const secuencialStr = String(secuencial).padStart(9, '0');
  const codigoStr = String(codigoNumerico).padStart(8, '0');
  const emisionStr = String(tipoEmision);

  const claveSinDigito = `${fechaStr}${tipoComprobante}${rucStr}${ambienteStr}${serie}${secuencialStr}${codigoStr}${emisionStr}`;
  const digitoVerificador = calcularModulo11(claveSinDigito);
  return `${claveSinDigito}${digitoVerificador}`;
}

function claveAccesoPerteneceAlRuc(claveAcceso, ruc) {
  const clave = String(claveAcceso || '').trim();
  const rucStr = String(ruc || '').trim();
  return /^\d{49}$/.test(clave) && /^\d{13}$/.test(rucStr) && clave.slice(10, 23) === rucStr;
}

const normalizeText = (value, fallback = '') => String(value ?? fallback).trim();
const money = (value) => (Math.round((parseFloat(value) || 0) * 100) / 100).toFixed(2);
const quantity = (value) => (Math.round((parseFloat(value) || 0) * 1000000) / 1000000).toFixed(6);

function escapeXml(value) {
  return normalizeText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatSriDate(value) {
  const date = value ? new Date(value) : new Date();
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function getAmbienteCode(value) {
  return normalizeText(value, 'PRUEBAS').toUpperCase() === 'PRODUCCION' ? '2' : '1';
}

function getTipoIdentificacion(identification) {
  const value = normalizeText(identification);
  if (value === '9999999999999') return '07';
  if (value.length === 13) return '04';
  if (value.length === 10) return '05';
  return '06';
}

function getCodigoPorcentajeIva(percent) {
  const value = Number(percent) || 0;
  if (value === 0) return '0';
  if (value === 12) return '2';
  if (value === 14) return '3';
  if (value === 15) return '4';
  return '4';
}

function parseSerie(numeroFactura = '') {
  const [estab = '001', ptoEmi = '001', secuencial = '000000001'] = String(numeroFactura).split('-');
  return {
    estab: estab.padStart(3, '0').slice(-3),
    ptoEmi: ptoEmi.padStart(3, '0').slice(-3),
    secuencial: secuencial.padStart(9, '0').slice(-9),
  };
}

function buildFacturaXml({ invoice, details = [], payments = [], company, ambiente = 'PRUEBAS' }) {
  const serie = parseSerie(invoice.numero_factura);
  const ambienteCode = getAmbienteCode(ambiente);
  const tipoEmision = normalizeText(company.tipo_emision).toUpperCase() === 'INDISPONIBILIDAD' ? '2' : '1';
  const ruc = normalizeText(company.ruc);
  if (!/^\d{13}$/.test(ruc)) {
    throw new Error('Configure un RUC de empresa valido para generar XML SRI.');
  }
  const claveActual = normalizeText(invoice.clave_acceso);
  const claveAcceso = claveAccesoPerteneceAlRuc(claveActual, ruc) ? claveActual : generarClaveAccesoSRI({
    fechaEmision: invoice.fecha_emision || new Date(),
    tipoComprobante: '01',
    ruc,
    ambiente: ambienteCode,
    establecimiento: serie.estab,
    puntoEmision: serie.ptoEmi,
    secuencial: serie.secuencial,
  });

  const totalConIva = details.reduce((sum, detail) => {
    const percent = parseFloat(detail.porcentaje_iva || 0);
    return percent > 0 ? sum + parseFloat(detail.precio_total || 0) : sum;
  }, 0);
  const totalIvaCero = details.reduce((sum, detail) => {
    const percent = parseFloat(detail.porcentaje_iva || 0);
    return percent <= 0 ? sum + parseFloat(detail.precio_total || 0) : sum;
  }, 0);
  const descuentoTotal = parseFloat(invoice.descuento_total || 0);
  const valorIva = parseFloat(invoice.valor_iva || 0);
  const totalSinImpuestos = parseFloat(invoice.subtotal_sin_impuestos || 0);
  const importeTotal = parseFloat(invoice.total || 0);

  const totals = [];
  if (totalIvaCero > 0) {
    totals.push(`
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>0</codigoPorcentaje>
        <baseImponible>${money(totalIvaCero)}</baseImponible>
        <valor>0.00</valor>
      </totalImpuesto>`);
  }
  if (totalConIva > 0 || valorIva > 0) {
    const percent = details.find((detail) => parseFloat(detail.porcentaje_iva || 0) > 0)?.porcentaje_iva || 15;
    totals.push(`
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>${getCodigoPorcentajeIva(percent)}</codigoPorcentaje>
        <baseImponible>${money(totalConIva)}</baseImponible>
        <valor>${money(valorIva)}</valor>
      </totalImpuesto>`);
  }

  const paymentRows = payments.length > 0 ? payments : [{
    codigo_sri: '20',
    monto: importeTotal,
    metodo_pago_nombre: 'OTROS CON UTILIZACION DEL SISTEMA FINANCIERO',
  }];

  const detallesXml = details.map((detail) => {
    const ivaPercent = parseFloat(detail.porcentaje_iva || 0);
    const base = parseFloat(detail.precio_total || 0);
    const valor = parseFloat(detail.valor_iva || 0);
    return `
    <detalle>
      <codigoPrincipal>${escapeXml(detail.producto_codigo || detail.id_producto)}</codigoPrincipal>
      <descripcion>${escapeXml(detail.producto_nombre)}</descripcion>
      <cantidad>${quantity(detail.cantidad)}</cantidad>
      <precioUnitario>${money(detail.precio_unitario)}</precioUnitario>
      <descuento>${money(detail.descuento_total || detail.descuento || 0)}</descuento>
      <precioTotalSinImpuesto>${money(base)}</precioTotalSinImpuesto>
      <impuestos>
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>${getCodigoPorcentajeIva(ivaPercent)}</codigoPorcentaje>
          <tarifa>${money(ivaPercent)}</tarifa>
          <baseImponible>${money(base)}</baseImponible>
          <valor>${money(valor)}</valor>
        </impuesto>
      </impuestos>
    </detalle>`;
  }).join('');

  const pagosXml = paymentRows.map((payment) => `
      <pago>
        <formaPago>${escapeXml(payment.codigo_sri || '20')}</formaPago>
        <total>${money(payment.monto)}</total>
      </pago>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="2.1.0">
  <infoTributaria>
    <ambiente>${ambienteCode}</ambiente>
    <tipoEmision>${tipoEmision}</tipoEmision>
    <razonSocial>${escapeXml(company.razon_social)}</razonSocial>
    <nombreComercial>${escapeXml(company.nombre_comercial || company.razon_social)}</nombreComercial>
    <ruc>${escapeXml(ruc)}</ruc>
    <claveAcceso>${escapeXml(claveAcceso)}</claveAcceso>
    <codDoc>01</codDoc>
    <estab>${escapeXml(serie.estab)}</estab>
    <ptoEmi>${escapeXml(serie.ptoEmi)}</ptoEmi>
    <secuencial>${escapeXml(serie.secuencial)}</secuencial>
    <dirMatriz>${escapeXml(company.direccion_matriz)}</dirMatriz>
  </infoTributaria>
  <infoFactura>
    <fechaEmision>${formatSriDate(invoice.fecha_emision)}</fechaEmision>
    <dirEstablecimiento>${escapeXml(invoice.sucursal_direccion || company.direccion_matriz)}</dirEstablecimiento>
    <obligadoContabilidad>${company.obligado_contabilidad ? 'SI' : 'NO'}</obligadoContabilidad>
    <tipoIdentificacionComprador>${getTipoIdentificacion(invoice.cliente_identificacion)}</tipoIdentificacionComprador>
    <razonSocialComprador>${escapeXml(invoice.cliente_nombre)}</razonSocialComprador>
    <identificacionComprador>${escapeXml(invoice.cliente_identificacion)}</identificacionComprador>
    <direccionComprador>${escapeXml(invoice.cliente_direccion || 'SIN DIRECCION')}</direccionComprador>
    <totalSinImpuestos>${money(totalSinImpuestos)}</totalSinImpuestos>
    <totalDescuento>${money(descuentoTotal)}</totalDescuento>
    <totalConImpuestos>${totals.join('')}
    </totalConImpuestos>
    <propina>0.00</propina>
    <importeTotal>${money(importeTotal)}</importeTotal>
    <moneda>DOLAR</moneda>
    <pagos>${pagosXml}
    </pagos>
  </infoFactura>
  <detalles>${detallesXml}
  </detalles>
  <infoAdicional>
    <campoAdicional nombre="Email">${escapeXml(invoice.cliente_email || 'SIN EMAIL')}</campoAdicional>
    <campoAdicional nombre="Telefono">${escapeXml(invoice.cliente_telefono || 'SIN TELEFONO')}</campoAdicional>
  </infoAdicional>
</factura>`;

  return { xml, claveAcceso, ambienteCode };
}

function simularAutorizacionSRI(claveAcceso) {
  return {
    estado: 'AUTORIZADO',
    claveAcceso,
    fechaAutorizacion: new Date().toISOString(),
    ambiente: 'PRUEBAS',
    numeroAutorizacion: claveAcceso,
    mensajes: [],
    xmlSimulado: `<?xml version="1.0" encoding="UTF-8"?>
<autorizacion>
  <estado>AUTORIZADO</estado>
  <numeroAutorizacion>${claveAcceso}</numeroAutorizacion>
  <fechaAutorizacion>${new Date().toISOString()}</fechaAutorizacion>
  <ambiente>PRUEBAS</ambiente>
</autorizacion>`,
  };
}

module.exports = {
  generarClaveAccesoSRI,
  claveAccesoPerteneceAlRuc,
  buildFacturaXml,
  escapeXml,
  simularAutorizacionSRI,
};
