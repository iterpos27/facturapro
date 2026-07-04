const fs = require('fs');
const path = require('path');
const axios = require('axios');
const forge = require('node-forge');
const { DOMParser } = require('@xmldom/xmldom');
const { signInvoiceXml } = require('ec-sri-invoice-signer');

const SRI_TEST_RECEPTION_URL = 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline';
const SRI_TEST_AUTHORIZATION_URL = 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline';
const SRI_PROD_RECEPTION_URL = 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline';
const SRI_PROD_AUTHORIZATION_URL = 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline';

const normalize = (value) => String(value || '').trim();

function getSriEndpoints(company, ambiente = 'PRUEBAS') {
  const isProduction = normalize(ambiente).toUpperCase() === 'PRODUCCION';
  return {
    receptionUrl: normalize(company.sri_endpoint_recepcion) || (isProduction ? SRI_PROD_RECEPTION_URL : SRI_TEST_RECEPTION_URL),
    authorizationUrl: normalize(company.sri_endpoint_autorizacion) || (isProduction ? SRI_PROD_AUTHORIZATION_URL : SRI_TEST_AUTHORIZATION_URL),
  };
}

function resolveCertificatePath(certificatePath) {
  const value = normalize(certificatePath);
  if (!value) {
    throw new Error('Configure la ruta del certificado .p12/.pfx en parametros de empresa.');
  }

  const resolvedPath = path.isAbsolute(value)
    ? value
    : path.resolve(__dirname, value);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`No se encontro el certificado configurado: ${resolvedPath}`);
  }

  return resolvedPath;
}

function readPkcs12Certificate(company) {
  const certificatePath = resolveCertificatePath(company.certificado_path);
  const password = normalize(company.certificado_clave);
  if (!password) {
    throw new Error('Configure la clave del certificado de firma electronica.');
  }

  const p12Buffer = fs.readFileSync(certificatePath);
  const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [];
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];

  if (!keyBags.length || !keyBags[0].key) {
    throw new Error('El certificado no contiene una clave privada valida.');
  }
  if (!certBags.length || !certBags[0].cert) {
    throw new Error('El certificado no contiene un certificado publico valido.');
  }

  return {
    privateKey: keyBags[0].key,
    certificatePem: forge.pki.certificateToPem(certBags[0].cert),
    p12Buffer,
    password,
  };
}

function validateCertificateConfig(company) {
  const { certificatePem } = readPkcs12Certificate(company);
  const cert = forge.pki.certificateFromPem(certificatePem);
  return {
    subject: cert.subject.attributes.map((attr) => `${attr.shortName || attr.name}=${attr.value}`).join(', '),
    issuer: cert.issuer.attributes.map((attr) => `${attr.shortName || attr.name}=${attr.value}`).join(', '),
    validFrom: cert.validity.notBefore,
    validTo: cert.validity.notAfter,
  };
}

async function signXmlWithCertificate(xml, company) {
  const { p12Buffer, password } = readPkcs12Certificate(company);
  return signInvoiceXml(xml, p12Buffer, { pkcs12Password: password });
}

function getFirstText(xml, tags) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  for (const tag of tags) {
    const nodes = doc.getElementsByTagName(tag);
    if (nodes.length > 0) return normalize(nodes[0].textContent);
  }
  return '';
}

function getMessages(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const mensajes = [];
  const messageNodes = doc.getElementsByTagName('mensaje');
  for (let i = 0; i < messageNodes.length; i += 1) {
    const node = messageNodes[i];
    const getChild = (name) => {
      const child = node.getElementsByTagName(name);
      return child.length ? normalize(child[0].textContent) : '';
    };
    mensajes.push({
      identificador: getChild('identificador'),
      mensaje: getChild('mensaje'),
      informacionAdicional: getChild('informacionAdicional'),
      tipo: getChild('tipo'),
    });
  }
  return mensajes;
}

async function postSoap(url, soapAction, body) {
  const response = await axios.post(url, body, {
    timeout: 30000,
    headers: {
      'Content-Type': 'text/xml;charset=UTF-8',
      SOAPAction: soapAction || '',
    },
  });
  return response.data;
}

async function sendReceipt(xmlFirmado, company, ambiente = 'PRUEBAS') {
  const { receptionUrl } = getSriEndpoints(company, ambiente);
  const xmlBase64 = Buffer.from(xmlFirmado, 'utf8').toString('base64');
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.recepcion">
  <soapenv:Header/>
  <soapenv:Body>
    <ec:validarComprobante>
      <xml>${xmlBase64}</xml>
    </ec:validarComprobante>
  </soapenv:Body>
</soapenv:Envelope>`;

  const responseXml = await postSoap(receptionUrl, '', soapBody);
  return {
    estado: getFirstText(responseXml, ['estado']) || 'SIN_RESPUESTA',
    mensajes: getMessages(responseXml),
    responseXml,
  };
}

async function authorizeReceipt(claveAcceso, company, ambiente = 'PRUEBAS') {
  const { authorizationUrl } = getSriEndpoints(company, ambiente);
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">
  <soapenv:Header/>
  <soapenv:Body>
    <ec:autorizacionComprobante>
      <claveAccesoComprobante>${claveAcceso}</claveAccesoComprobante>
    </ec:autorizacionComprobante>
  </soapenv:Body>
</soapenv:Envelope>`;

  const responseXml = await postSoap(authorizationUrl, '', soapBody);
  return {
    estado: getFirstText(responseXml, ['estado']) || 'SIN_AUTORIZACION',
    numeroAutorizacion: getFirstText(responseXml, ['numeroAutorizacion']),
    fechaAutorizacion: getFirstText(responseXml, ['fechaAutorizacion']),
    mensajes: getMessages(responseXml),
    responseXml,
  };
}

module.exports = {
  getSriEndpoints,
  validateCertificateConfig,
  signXmlWithCertificate,
  sendReceipt,
  authorizeReceipt,
};
