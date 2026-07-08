const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const db = require('../db');

async function migratePhase21SriFieldLengths() {
  console.log('Iniciando migracion Phase 21: longitudes SRI flexibles...');

  try {
    await db.query('BEGIN');

    await db.query(`
      ALTER TABLE sri_comprobantes
        ALTER COLUMN clave_acceso TYPE VARCHAR(60),
        ALTER COLUMN numero_autorizacion TYPE VARCHAR(120);
    `);

    await db.query(`
      ALTER TABLE facturas
        ALTER COLUMN clave_acceso TYPE VARCHAR(60),
        ALTER COLUMN sri_numero_autorizacion TYPE VARCHAR(120);
    `);

    await db.query(`
      ALTER TABLE notas_credito
        ALTER COLUMN clave_acceso TYPE VARCHAR(60),
        ALTER COLUMN sri_numero_autorizacion TYPE VARCHAR(120);
    `);

    await db.query(`
      ALTER TABLE retenciones
        ALTER COLUMN clave_acceso TYPE VARCHAR(60),
        ALTER COLUMN sri_numero_autorizacion TYPE VARCHAR(120);
    `);

    await db.query('COMMIT');
    console.log('Phase 21 completada: campos SRI ajustados.');
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error en migracion Phase 21:', error);
    throw error;
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) {
  migratePhase21SriFieldLengths().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = migratePhase21SriFieldLengths;
