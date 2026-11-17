/**
 * email_service.js
 * Servicio de envío de correos para FacturaPro.
 * Usa nodemailer con SMTP configurable por variables de entorno.
 * Envía el RIDE PDF y XML adjuntos al cliente tras la autorización SRI.
 */

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

/**
 * Crea el transporter de nodemailer desde variables de entorno.
 * Variables requeridas:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 * Opcionales:
 *   SMTP_FROM  → remitente por defecto (ej: "FacturaPro <noreply@tudominio.com>")
 *   SMTP_SECURE → "true" para puerto 465, omitir o "false" para 587/STARTTLS
 */
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null; // email no configurado — se loguea warning al intentar enviar
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
    tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
  });
}

/**
 * Envía la factura autorizada por correo al cliente.
 * @param {object} opts
 * @param {string} opts.to         - Email del destinatario
 * @param {string} opts.clientName - Nombre del cliente
 * @param {string} opts.docNumber  - Número de factura/documento
 * @param {string} opts.docType    - Tipo legible: "Factura", "Nota de Crédito", "Retención"
 * @param {string} opts.authNumber - Número de autorización SRI
 * @param {string} opts.xml        - XML firmado y autorizado
 * @param {string} opts.companyName - Nombre de la empresa emisora
 * @returns {Promise<{sent: boolean, error?: string}>}
 */
function buildDocumentAttachments({ docType, docNumber, authNumber, xml, ridePdf }) {
  const stem = `${docType.replace(/\s/g, '_')}_${docNumber.replace(/\//g, '-')}`;
  const attachments = [];
  if (xml) attachments.push({
    filename: `${stem}_${authNumber.slice(-8)}.xml`,
    content: xml,
    contentType: 'application/xml',
  });
  if (ridePdf) attachments.push({
    filename: `${stem}_RIDE.pdf`,
    content: ridePdf,
    contentType: 'application/pdf',
  });
  return attachments;
}

async function sendAuthorizedDocument({ to, clientName, docNumber, docType, authNumber, xml, ridePdf, companyName }) {
  if (!to || !to.includes('@')) {
    logger.warn({ to }, 'Email de cliente no válido — no se enviará el comprobante.');
    return { sent: false, error: 'Email de cliente no válido.' };
  }

  const transporter = createTransporter();
  if (!transporter) {
    logger.warn('SMTP no configurado (SMTP_HOST/SMTP_USER/SMTP_PASS). No se enviará el comprobante por correo.');
    return { sent: false, error: 'Servicio de email no configurado en el servidor.' };
  }

  const from = process.env.SMTP_FROM || `${companyName || 'FacturaPro'} <${process.env.SMTP_USER}>`;
  const subject = `${docType} No. ${docNumber} — ${companyName || 'FacturaPro'}`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; background:#f4f4f4; margin:0; padding:0;">
  <div style="max-width:600px; margin:30px auto; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.1);">
    <div style="background:#1a56db; padding:24px 32px;">
      <h1 style="color:#fff; margin:0; font-size:1.4rem;">${companyName || 'FacturaPro'}</h1>
    </div>
    <div style="padding:32px;">
      <p style="font-size:1rem; color:#333;">Estimado/a <strong>${clientName || 'Cliente'}</strong>,</p>
      <p style="color:#555;">Le informamos que su <strong>${docType}</strong> ha sido <strong style="color:#15803d;">AUTORIZADA</strong> por el SRI.</p>

      <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:6px; padding:16px; margin:20px 0;">
        <p style="margin:4px 0;"><strong>Documento:</strong> ${docType} No. ${docNumber}</p>
        <p style="margin:4px 0;"><strong>Autorización SRI:</strong> <code style="font-size:.85rem;">${authNumber}</code></p>
      </div>

      <p style="color:#555;">Adjunto encontrará el comprobante electrónico en XML y su representación impresa RIDE en PDF.</p>

      <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;">
      <p style="font-size:.82rem; color:#9ca3af; text-align:center;">
        Este es un mensaje automático generado por FacturaPro.<br>
        Por favor no responda a este correo.
      </p>
    </div>
  </div>
</body>
</html>`;

  const attachments = buildDocumentAttachments({ docType, docNumber, authNumber, xml, ridePdf });

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      attachments,
    });
    logger.info({ messageId: info.messageId, to, docNumber }, 'Comprobante enviado por email.');
    return { sent: true, messageId: info.messageId, subject };
  } catch (error) {
    logger.error({ error, to, docNumber }, 'Error al enviar comprobante por email.');
    return { sent: false, error: error.message };
  }
}

module.exports = { sendAuthorizedDocument, buildDocumentAttachments };
