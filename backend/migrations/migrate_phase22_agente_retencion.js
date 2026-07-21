const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const db = require('../db');

async function migratePhase22AgenteRetencion() {
  console.log('Iniciando migracion Phase 22: Columna agente_retencion en empresas...');

  try {
    await db.query('BEGIN');

    await db.query(`
      ALTER TABLE empresas
      ADD COLUMN IF NOT EXISTS agente_retencion VARCHAR(50);
    `);

    await db.query('COMMIT');
    console.log('Phase 22 completada: columna agente_retencion agregada.');
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error en migracion Phase 22:', error);
    throw error;
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) {
  migratePhase22AgenteRetencion().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = migratePhase22AgenteRetencion;
