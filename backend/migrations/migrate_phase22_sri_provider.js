const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const db = require('../db');
const { Pool } = require('pg');

/** Añade el dato del proveedor sin modificar empresas ni comprobantes existentes. */
async function migrateSriProvider() {
  // Usa una conexión propia porque fases anteriores pueden cerrar el pool compartido.
  const migrationPool = new Pool(db.pool.options);
  try {
  // IF NOT EXISTS permite repetir la migración con seguridad.
  await migrationPool.query(`ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS ruc_proveedor_software VARCHAR(13)
    CHECK (ruc_proveedor_software IS NULL OR ruc_proveedor_software ~ '^[0-9]{13}$')`);
  console.log('Phase 22: RUC del proveedor de software disponible.');
  } finally {
    await migrationPool.end();
  }
}

// Solo cierra el pool al ejecutar este archivo directamente.
if (require.main === module) {
  migrateSriProvider().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = migrateSriProvider;
