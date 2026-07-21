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
  if (Number.isNaN(dateObj.getTime())) {
    throw new Error('La fecha de emision no es valida para generar la clave de acceso SRI.');
  }
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const yyyy = String(dateObj.getFullYear());
  const fechaStr = `${dd}${mm}${yyyy}`;

  const rucStr = String(ruc || '').trim();
  if (!/^\d{13}$/.test(rucStr)) {
    throw new Error('Configure un RUC de empresa valido para generar la clave de acceso SRI.');
  }
  const ambienteStr = String(ambiente).replace(/\D/g, '') || '1';
  const tipoComprobanteStr = String(tipoComprobante).replace(/\D/g, '').padStart(2, '0').slice(-2);
  const establecimientoStr = String(establecimiento).replace(/\D/g, '').padStart(3, '0').slice(-3);
  const puntoEmisionStr = String(puntoEmision).replace(/\D/g, '').padStart(3, '0').slice(-3);
  const serie = `${establecimientoStr}${puntoEmisionStr}`;
  const secuencialStr = String(secuencial).replace(/\D/g, '').padStart(9, '0').slice(-9);
  const codigoStr = String(codigoNumerico).replace(/\D/g, '').padStart(8, '0').slice(-8);
  const emisionStr = String(tipoEmision).replace(/\D/g, '') || '1';

  const claveSinDigito = `${fechaStr}${tipoComprobanteStr}${rucStr}${ambienteStr.slice(-1)}${serie}${secuencialStr}${codigoStr}${emisionStr.slice(-1)}`;
  if (!/^\d{48}$/.test(claveSinDigito)) {
    throw new Error('No se pudo generar una clave de acceso SRI valida. Revise fecha, serie y secuencial del documento.');
  }
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
const WITHHOLDING_PERCENT_BY_CODE = {
  312: 2.00,
};

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
  const numericParts = String(numeroFactura)
    .split('-')
    .map((part) => part.replace(/\D/g, ''))
    .filter(Boolean);
  const [estab = '001', ptoEmi = '001', secuencial = '000000001'] = numericParts.slice(-3);
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
    <dirMatriz>${escapeXml(company.direccion_matriz)}</dirMatriz>${company.agente_retencion ? `\n    <agenteRetencion>${escapeXml(company.agente_retencion)}</agenteRetencion>` : ''}${company.regimen && company.regimen.toUpperCase().includes('RIMPE') ? `\n    <contribuyenteRimpe>CONTRIBUYENTE RÉGIMEN RIMPE</contribuyenteRimpe>` : ''}
  </infoTributaria>
  <infoFactura>
    <fechaEmision>${formatSriDate(invoice.fecha_emision)}</fechaEmision>
    <dirEstablecimiento>${escapeXml(invoice.sucursal_direccion || company.direccion_matriz)}</dirEstablecimiento>${company.contribuyente_especial ? `\n    <contribuyenteEspecial>${escapeXml(company.contribuyente_especial)}</contribuyenteEspecial>` : ''}
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

function buildNotaCreditoXml({ creditNote, details = [], company, ambiente = 'PRUEBAS' }) {
  const serie = parseSerie(creditNote.numero_nota_credito);
  const ambienteCode = getAmbienteCode(ambiente);
  const tipoEmision = normalizeText(company.tipo_emision).toUpperCase() === 'INDISPONIBILIDAD' ? '2' : '1';
  const ruc = normalizeText(company.ruc);
  if (!/^\d{13}$/.test(ruc)) {
    throw new Error('Configure un RUC de empresa valido para generar XML SRI.');
  }

  const claveActual = normalizeText(creditNote.clave_acceso);
  const claveAcceso = claveAccesoPerteneceAlRuc(claveActual, ruc) ? claveActual : generarClaveAccesoSRI({
    fechaEmision: creditNote.fecha_emision || new Date(),
    tipoComprobante: '04',
    ruc,
    ambiente: ambienteCode,
    establecimiento: serie.estab,
    puntoEmision: serie.ptoEmi,
    secuencial: serie.secuencial,
  });

  const subtotalIvaCero = parseFloat(creditNote.subtotal_iva_cero || 0);
  const subtotalConIva = parseFloat(creditNote.subtotal_con_iva || 0);
  const valorIva = parseFloat(creditNote.valor_iva || 0);
  const totalSinImpuestos = subtotalIvaCero + subtotalConIva;
  const total = parseFloat(creditNote.total || 0);
  const ivaPercent = details.find((detail) => parseFloat(detail.porcentaje_iva || 0) > 0)?.porcentaje_iva || 15;

  const totalImpuestos = [];
  if (subtotalIvaCero > 0) {
    totalImpuestos.push(`
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>0</codigoPorcentaje>
        <baseImponible>${money(subtotalIvaCero)}</baseImponible>
        <valor>0.00</valor>
      </totalImpuesto>`);
  }
  if (subtotalConIva > 0 || valorIva > 0) {
    totalImpuestos.push(`
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>${getCodigoPorcentajeIva(ivaPercent)}</codigoPorcentaje>
        <baseImponible>${money(subtotalConIva)}</baseImponible>
        <valor>${money(valorIva)}</valor>
      </totalImpuesto>`);
  }

  const detallesXml = details.map((detail) => {
    const iva = parseFloat(detail.porcentaje_iva || 0);
    const base = parseFloat(detail.precio_total || 0);
    const valor = parseFloat(detail.valor_iva || 0);
    return `
    <detalle>
      <codigoInterno>${escapeXml(detail.producto_codigo || detail.id_producto)}</codigoInterno>
      <descripcion>${escapeXml(detail.producto_nombre)}</descripcion>
      <cantidad>${quantity(detail.cantidad)}</cantidad>
      <precioUnitario>${money(detail.precio_unitario)}</precioUnitario>
      <descuento>0.00</descuento>
      <precioTotalSinImpuesto>${money(base)}</precioTotalSinImpuesto>
      <impuestos>
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>${getCodigoPorcentajeIva(iva)}</codigoPorcentaje>
          <tarifa>${money(iva)}</tarifa>
          <baseImponible>${money(base)}</baseImponible>
          <valor>${money(valor)}</valor>
        </impuesto>
      </impuestos>
    </detalle>`;
  }).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<notaCredito id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>${ambienteCode}</ambiente>
    <tipoEmision>${tipoEmision}</tipoEmision>
    <razonSocial>${escapeXml(company.razon_social)}</razonSocial>
    <nombreComercial>${escapeXml(company.nombre_comercial || company.razon_social)}</nombreComercial>
    <ruc>${escapeXml(ruc)}</ruc>
    <claveAcceso>${escapeXml(claveAcceso)}</claveAcceso>
    <codDoc>04</codDoc>
    <estab>${escapeXml(serie.estab)}</estab>
    <ptoEmi>${escapeXml(serie.ptoEmi)}</ptoEmi>
    <secuencial>${escapeXml(serie.secuencial)}</secuencial>
    <dirMatriz>${escapeXml(company.direccion_matriz)}</dirMatriz>${company.agente_retencion ? `\n    <agenteRetencion>${escapeXml(company.agente_retencion)}</agenteRetencion>` : ''}${company.regimen && company.regimen.toUpperCase().includes('RIMPE') ? `\n    <contribuyenteRimpe>CONTRIBUYENTE RÉGIMEN RIMPE</contribuyenteRimpe>` : ''}
  </infoTributaria>
  <infoNotaCredito>
    <fechaEmision>${formatSriDate(creditNote.fecha_emision)}</fechaEmision>
    <dirEstablecimiento>${escapeXml(creditNote.sucursal_direccion || company.direccion_matriz)}</dirEstablecimiento>
    <tipoIdentificacionComprador>${getTipoIdentificacion(creditNote.cliente_identificacion)}</tipoIdentificacionComprador>
    <razonSocialComprador>${escapeXml(creditNote.cliente_nombre)}</razonSocialComprador>
    <identificacionComprador>${escapeXml(creditNote.cliente_identificacion)}</identificacionComprador>${company.contribuyente_especial ? `\n    <contribuyenteEspecial>${escapeXml(company.contribuyente_especial)}</contribuyenteEspecial>` : ''}
    <obligadoContabilidad>${company.obligado_contabilidad ? 'SI' : 'NO'}</obligadoContabilidad>
    <codDocModificado>01</codDocModificado>
    <numDocModificado>${escapeXml(creditNote.numero_factura)}</numDocModificado>
    <fechaEmisionDocSustento>${formatSriDate(creditNote.factura_fecha)}</fechaEmisionDocSustento>
    <totalSinImpuestos>${money(totalSinImpuestos)}</totalSinImpuestos>
    <valorModificacion>${money(total)}</valorModificacion>
    <moneda>DOLAR</moneda>
    <totalConImpuestos>${totalImpuestos.join('')}
    </totalConImpuestos>
    <motivo>${escapeXml(creditNote.motivo || 'DEVOLUCION')}</motivo>
  </infoNotaCredito>
  <detalles>${detallesXml}
  </detalles>
  <infoAdicional>
    <campoAdicional nombre="Email">${escapeXml(creditNote.cliente_email || 'SIN EMAIL')}</campoAdicional>
    <campoAdicional nombre="Telefono">${escapeXml(creditNote.cliente_telefono || 'SIN TELEFONO')}</campoAdicional>
  </infoAdicional>
</notaCredito>`;

  return { xml, claveAcceso, ambienteCode };
}

function buildRetencionXml({ withholding, details = [], company, ambiente = 'PRUEBAS' }) {
  const serie = parseSerie(withholding.numero_retencion);
  const ambienteCode = getAmbienteCode(ambiente);
  const tipoEmision = normalizeText(company.tipo_emision).toUpperCase() === 'INDISPONIBILIDAD' ? '2' : '1';
  const ruc = normalizeText(company.ruc);
  if (!/^\d{13}$/.test(ruc)) {
    throw new Error('Configure un RUC de empresa valido para generar XML SRI.');
  }

  const claveActual = normalizeText(withholding.clave_acceso);
  const claveAcceso = claveAccesoPerteneceAlRuc(claveActual, ruc) ? claveActual : generarClaveAccesoSRI({
    fechaEmision: withholding.fecha_emision || new Date(),
    tipoComprobante: '07',
    ruc,
    ambiente: ambienteCode,
    establecimiento: serie.estab,
    puntoEmision: serie.ptoEmi,
    secuencial: serie.secuencial,
  });

  const normalizeSupportNumber = (value) => {
    const raw = normalizeText(value);
    const parts = raw.split('-').map((part) => part.replace(/\D/g, '')).filter(Boolean);
    if (parts.length >= 3) {
      const [estab, ptoEmi, secuencial] = parts.slice(-3);
      return `${estab.padStart(3, '0').slice(-3)}${ptoEmi.padStart(3, '0').slice(-3)}${secuencial.padStart(9, '0').slice(-9)}`;
    }

    const digits = raw.replace(/\D/g, '');
    if (digits.length > 6 && digits.length < 15) {
      return `${digits.slice(0, 3)}${digits.slice(3, 6)}${digits.slice(6).padStart(9, '0').slice(-9)}`;
    }
    return digits.padStart(15, '0').slice(-15);
  };
  const periodDate = withholding.fecha_compra || withholding.fecha_emision || new Date();
  const dateObj = new Date(periodDate);
  const periodoFiscal = `${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;

  const impuestosXml = details.map((detail) => {
    const isIva = normalizeText(detail.impuesto).toUpperCase().includes('IVA');
    const code = normalizeText(detail.codigo_sri);
    const base = parseFloat(detail.base_imponible) || 0;
    const percentage = WITHHOLDING_PERCENT_BY_CODE[code] ?? (parseFloat(detail.porcentaje) || 0);
    const withheldValue = WITHHOLDING_PERCENT_BY_CODE[code] !== undefined
      ? base * (percentage / 100)
      : parseFloat(detail.valor_retenido || 0);
    return `
    <impuesto>
      <codigo>${isIva ? '2' : '1'}</codigo>
      <codigoRetencion>${escapeXml(code)}</codigoRetencion>
      <baseImponible>${money(base)}</baseImponible>
      <porcentajeRetener>${money(percentage)}</porcentajeRetener>
      <valorRetenido>${money(withheldValue)}</valorRetenido>
      <codDocSustento>01</codDocSustento>
      <numDocSustento>${escapeXml(normalizeSupportNumber(withholding.numero_factura_compra))}</numDocSustento>
      <fechaEmisionDocSustento>${formatSriDate(withholding.fecha_compra)}</fechaEmisionDocSustento>
    </impuesto>`;
  }).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<comprobanteRetencion id="comprobante" version="1.0.0">
  <infoTributaria>
    <ambiente>${ambienteCode}</ambiente>
    <tipoEmision>${tipoEmision}</tipoEmision>
    <razonSocial>${escapeXml(company.razon_social)}</razonSocial>
    <nombreComercial>${escapeXml(company.nombre_comercial || company.razon_social)}</nombreComercial>
    <ruc>${escapeXml(ruc)}</ruc>
    <claveAcceso>${escapeXml(claveAcceso)}</claveAcceso>
    <codDoc>07</codDoc>
    <estab>${escapeXml(serie.estab)}</estab>
    <ptoEmi>${escapeXml(serie.ptoEmi)}</ptoEmi>
    <secuencial>${escapeXml(serie.secuencial)}</secuencial>
    <dirMatriz>${escapeXml(company.direccion_matriz)}</dirMatriz>${company.agente_retencion ? `\n    <agenteRetencion>${escapeXml(company.agente_retencion)}</agenteRetencion>` : ''}${company.regimen && company.regimen.toUpperCase().includes('RIMPE') ? `\n    <contribuyenteRimpe>CONTRIBUYENTE RÉGIMEN RIMPE</contribuyenteRimpe>` : ''}
  </infoTributaria>
  <infoCompRetencion>
    <fechaEmision>${formatSriDate(withholding.fecha_emision)}</fechaEmision>
    <dirEstablecimiento>${escapeXml(company.direccion_matriz)}</dirEstablecimiento>${company.contribuyente_especial ? `\n    <contribuyenteEspecial>${escapeXml(company.contribuyente_especial)}</contribuyenteEspecial>` : ''}
    <obligadoContabilidad>${company.obligado_contabilidad ? 'SI' : 'NO'}</obligadoContabilidad>
    <tipoIdentificacionSujetoRetenido>${getTipoIdentificacion(withholding.proveedor_identificacion)}</tipoIdentificacionSujetoRetenido>
    <razonSocialSujetoRetenido>${escapeXml(withholding.proveedor_nombre)}</razonSocialSujetoRetenido>
    <identificacionSujetoRetenido>${escapeXml(withholding.proveedor_identificacion)}</identificacionSujetoRetenido>
    <periodoFiscal>${periodoFiscal}</periodoFiscal>
  </infoCompRetencion>
  <impuestos>${impuestosXml}
  </impuestos>
</comprobanteRetencion>`;

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
  buildNotaCreditoXml,
  buildRetencionXml,
  escapeXml,
  simularAutorizacionSRI,
};
