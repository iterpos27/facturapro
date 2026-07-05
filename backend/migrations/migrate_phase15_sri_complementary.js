const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const db = require('../db');

async function migratePhase15SriComplementary() {
  console.log('Iniciando migracion Phase 15: SRI para notas de credito y retenciones...');

  try {
    await db.query('BEGIN');

    await db.query(`
      ALTER TABLE notas_credito
        ADD COLUMN IF NOT EXISTS xml_generado TEXT,
        ADD COLUMN IF NOT EXISTS sri_estado VARCHAR(30),
        ADD COLUMN IF NOT EXISTS sri_ambiente VARCHAR(20),
        ADD COLUMN IF NOT EXISTS sri_numero_autorizacion VARCHAR(49),
        ADD COLUMN IF NOT EXISTS sri_fecha_autorizacion TIMESTAMP,
        ADD COLUMN IF NOT EXISTS sri_mensajes JSONB DEFAULT '[]'::jsonb;
    `);

    await db.query(`
      ALTER TABLE retenciones
        ADD COLUMN IF NOT EXISTS xml_generado TEXT,
        ADD COLUMN IF NOT EXISTS sri_estado VARCHAR(30),
        ADD COLUMN IF NOT EXISTS sri_ambiente VARCHAR(20),
        ADD COLUMN IF NOT EXISTS sri_numero_autorizacion VARCHAR(49),
        ADD COLUMN IF NOT EXISTS sri_fecha_autorizacion TIMESTAMP,
        ADD COLUMN IF NOT EXISTS sri_mensajes JSONB DEFAULT '[]'::jsonb;
    `);

    await db.query(`
      UPDATE notas_credito
      SET sri_estado = COALESCE(sri_estado, 'PENDIENTE'),
          sri_ambiente = COALESCE(sri_ambiente, 'PRUEBAS'),
          sri_mensajes = COALESCE(sri_mensajes, '[]'::jsonb)
      WHERE sri_estado IS NULL OR sri_ambiente IS NULL OR sri_mensajes IS NULL;
    `);

    await db.query(`
      UPDATE retenciones
      SET sri_estado = COALESCE(sri_estado, 'PENDIENTE'),
          sri_ambiente = COALESCE(sri_ambiente, 'PRUEBAS'),
          sri_mensajes = COALESCE(sri_mensajes, '[]'::jsonb)
      WHERE sri_estado IS NULL OR sri_ambiente IS NULL OR sri_mensajes IS NULL;
    `);

    await db.query('COMMIT');
    console.log('Phase 15 completada: documentos complementarios listos para SRI.');
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error en migracion Phase 15:', error);
    throw error;
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) {
  migratePhase15SriComplementary().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = migratePhase15SriComplementary;
