const crypto = require('crypto');

const ENCRYPTED_PREFIX = 'enc:v1:';
const DEV_ENCRYPTION_KEY = 'facturapro-development-encryption-key';

function getEncryptionKey() {
  const source = process.env.DATA_ENCRYPTION_KEY || DEV_ENCRYPTION_KEY;
  return crypto.createHash('sha256').update(source, 'utf8').digest();
}

function encryptSecret(value) {
  const plainText = String(value || '');
  if (!plainText) return '';
  if (plainText.startsWith(ENCRYPTED_PREFIX)) return plainText;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptSecret(value) {
  const storedValue = String(value || '');
  if (!storedValue || !storedValue.startsWith(ENCRYPTED_PREFIX)) return storedValue;

  const parts = storedValue.slice(ENCRYPTED_PREFIX.length).split(':');
  if (parts.length !== 3) throw new Error('El secreto cifrado tiene un formato invalido.');

  const [ivBase64, authTagBase64, encryptedBase64] = parts;
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivBase64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(authTagBase64, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function redactCompany(company) {
  if (!company) return null;
  const { certificado_clave, ...safeCompany } = company;
  return { ...safeCompany, certificado_configurado: Boolean(certificado_clave) };
}

module.exports = { ENCRYPTED_PREFIX, encryptSecret, decryptSecret, redactCompany };
