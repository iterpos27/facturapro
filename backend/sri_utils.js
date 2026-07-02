/**
 * Utilidades para Simulación de Facturación Electrónica - SRI Ecuador
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
  tipoComprobante, // '01' Factura, '04' Nota Credito, '07' Retencion
  ruc = '1792345678001',
  ambiente = '1', // '1' Pruebas, '2' Produccion
  establecimiento = '001',
  puntoEmision = '001',
  secuencial,
  codigoNumerico = '12345678',
  tipoEmision = '1', // '1' Normal
}) {
  const dateObj = new Date(fechaEmision);
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const yyyy = String(dateObj.getFullYear());
  const fechaStr = `${dd}${mm}${yyyy}`;

  const rucStr = String(ruc).padEnd(13, '0').slice(0, 13);
  const ambienteStr = String(ambiente);
  const serie = `${String(establecimiento).padStart(3, '0')}${String(puntoEmision).padStart(3, '0')}`;
  const secuencialStr = String(secuencial).padStart(9, '0');
  const codigoStr = String(codigoNumerico).padStart(8, '0');
  const emisionStr = String(tipoEmision);

  const claveSinDigito = `${fechaStr}${tipoComprobante}${rucStr}${ambienteStr}${serie}${secuencialStr}${codigoStr}${emisionStr}`;
  const digitoVerificador = calcularModulo11(claveSinDigito);
  return `${claveSinDigito}${digitoVerificador}`;
}

/**
 * Simulación de respuesta SOAP del SRI
 * Retorna estado RECIBIDA y AUTORIZADA tras firma digital y procesamiento
 */
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
  <comprobante><![CDATA[
    <factura id="comprobante" version="1.1.0">
      <infoTributaria>
        <ambiente>1</ambiente>
        <tipoEmision>1</tipoEmision>
        <razonSocial>FACTURAPRO S.A.</razonSocial>
        <nombreComercial>FACTURAPRO</nombreComercial>
        <ruc>1792345678001</ruc>
        <claveAcceso>${claveAcceso}</claveAcceso>
        <codDoc>01</codDoc>
      </infoTributaria>
    </factura>
  ]]></comprobante>
</autorizacion>`
  };
}

module.exports = {
  generarClaveAccesoSRI,
  simularAutorizacionSRI,
};
