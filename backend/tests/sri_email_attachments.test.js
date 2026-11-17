const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDocumentAttachments } = require('../services/email_service');
const { sendAuthorizedDocument } = require('../services/email_service');
const nodemailer = require('nodemailer');

test('el correo autorizado adjunta XML y RIDE PDF, no una página HTML', () => {
  const pdf = Buffer.from('%PDF-1.7\n');
  const attachments = buildDocumentAttachments({
    docType: 'Factura', docNumber: '001-001-000000123',
    authNumber: '12345678901234567890', xml: '<factura/>', ridePdf: pdf,
  });
  assert.equal(attachments.length, 2);
  assert.match(attachments[0].filename, /\.xml$/);
  assert.equal(attachments[0].contentType, 'application/xml');
  assert.match(attachments[1].filename, /_RIDE\.pdf$/);
  assert.equal(attachments[1].contentType, 'application/pdf');
  assert.equal(attachments[1].content, pdf);
});

test('el transporte SMTP recibe destinatario, XML y RIDE PDF sin enviar correo real', async (t) => {
  const before = { SMTP_HOST: process.env.SMTP_HOST, SMTP_USER: process.env.SMTP_USER, SMTP_PASS: process.env.SMTP_PASS };
  Object.assign(process.env, { SMTP_HOST: 'smtp.test.local', SMTP_USER: 'test', SMTP_PASS: 'test' });
  t.after(() => {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  let sent;
  t.mock.method(nodemailer, 'createTransport', () => ({
    async sendMail(message) { sent = message; return { messageId: 'local-test' }; },
  }));
  const result = await sendAuthorizedDocument({
    to: 'prueba@example.com', clientName: 'Prueba', docNumber: '001-001-000000123',
    docType: 'Factura', authNumber: '12345678901234567890',
    xml: '<factura/>', ridePdf: Buffer.from('%PDF-1.7\n'), companyName: 'IPS Tech',
  });
  assert.equal(result.sent, true);
  assert.equal(sent.to, 'prueba@example.com');
  assert.deepEqual(sent.attachments.map((item) => item.contentType), ['application/xml', 'application/pdf']);
});
