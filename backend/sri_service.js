const fs = require('fs');
const path = require('path');
const axios = require('axios');
const forge = require('node-forge');
const { DOMParser } = require('@xmldom/xmldom');
const { SignedXml } = require('xml-crypto');

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

function pemBody(pem) {
  return String(pem)
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
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
    privateKeyPem: forge.pki.privateKeyToPem(keyBags[0].key),
    certificatePem: forge.pki.certificateToPem(certBags[0].cert),
  };
}

function signXmlWithCertificate(xml, company) {
  const { privateKeyPem, certificatePem } = readPkcs12Certificate(company);
  const signer = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certificatePem,
  });

  signer.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
  signer.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
  signer.addReference({
    xpath: "/*[@id='comprobante']",
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    ],
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
  });
  signer.keyInfoProvider = {
    getKeyInfo: () => `<X509Data><X509Certificate>${pemBody(certificatePem)}</X509Certificate></X509Data>`,
  };

  signer.computeSignature(xml, {
    location: { reference: "/*[@id='comprobante']", action: 'append' },
  });

  return signer.getSignedXml();
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
      SOAPAction: soapAction,
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

  const responseXml = await postSoap(receptionUrl, 'validarComprobante', soapBody);
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

  const responseXml = await postSoap(authorizationUrl, 'autorizacionComprobante', soapBody);
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
  signXmlWithCertificate,
  sendReceipt,
  authorizeReceipt,
};
