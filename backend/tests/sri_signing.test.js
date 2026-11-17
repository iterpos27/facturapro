const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const forge = require('node-forge');
const { DOMParser } = require('@xmldom/xmldom');
const { signXmlWithCertificate, hasEmbeddedSignature } = require('../services/sri_service');

test('firma factura, nota de crédito y retención dentro del XML correspondiente', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'facturapro-sri-sign-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date('2025-01-01T00:00:00Z');
  cert.validity.notAfter = new Date('2028-01-01T00:00:00Z');
  cert.setSubject([{ name: 'commonName', value: 'Prueba SRI' }]);
  cert.setIssuer(cert.subject.attributes);
  cert.sign(keys.privateKey);
  const password = 'prueba-local';
  const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, { algorithm: '3des' });
  const certPath = path.join(tempDir, 'test.p12');
  fs.writeFileSync(certPath, Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary'));
  const company = { certificado_path: certPath, certificado_clave: password };

  for (const root of ['factura', 'notaCredito', 'comprobanteRetencion']) {
    const xml = `<${root} id="comprobante" version="1.0.0"><infoTributaria><claveAcceso>123</claveAcceso></infoTributaria></${root}>`;
    const signed = await signXmlWithCertificate(xml, company);
    const document = new DOMParser().parseFromString(signed, 'text/xml');
    assert.equal(document.documentElement.tagName, root);
    assert.equal(document.getElementsByTagNameNS('*', 'Signature').length, 1, `${root} debe contener una firma`);
    assert.equal(document.getElementsByTagNameNS('*', 'X509Certificate').length, 1, `${root} debe contener el certificado`);
    assert.equal(hasEmbeddedSignature(xml), false);
    assert.equal(hasEmbeddedSignature(signed), true);
  }
});
