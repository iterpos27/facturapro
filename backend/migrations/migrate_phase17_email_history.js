const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const db = require('../db');

async function migratePhase17EmailHistory() {
  console.log('Iniciando migracion Phase 17: historial de emails SRI...');

  try {
    await db.query('BEGIN');

    await db.query(`
      CREATE TABLE IF NOT EXISTS sri_email_envios (
        id_email SERIAL PRIMARY KEY,
        tipo_comprobante VARCHAR(2) NOT NULL,
        id_documento INT NOT NULL,
        numero_comprobante VARCHAR(60),
        destinatario VARCHAR(200) NOT NULL,
        asunto VARCHAR(250),
        estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
        mensaje_error TEXT,
        message_id VARCHAR(250),
        adjunto_xml BOOLEAN DEFAULT false,
        adjunto_ride BOOLEAN DEFAULT false,
        id_usuario INT REFERENCES usuarios(id_usuario),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_sri_email_documento
      ON sri_email_envios(tipo_comprobante, id_documento, created_at DESC);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_sri_email_estado
      ON sri_email_envios(estado, created_at DESC);
    `);

    await db.query('COMMIT');
    console.log('Phase 17 completada: historial de emails SRI listo.');
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error en migracion Phase 17:', error);
    throw error;
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) {
  migratePhase17EmailHistory().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = migratePhase17EmailHistory;
