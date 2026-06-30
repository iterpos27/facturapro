const db = require('./db');

const dropSQL = `
ALTER TABLE clients DROP COLUMN IF EXISTS identification_type;
ALTER TABLE clients DROP COLUMN IF EXISTS additional_emails;
`;

async function runDropMigration() {
  try {
    console.log('Ejecutando alteración para eliminar columnas...');
    await db.query(dropSQL);
    console.log('¡Columnas eliminadas exitosamente de la base de datos!');
    process.exit(0);
  } catch (error) {
    console.error('Error al eliminar columnas:', error);
    process.exit(1);
  }
}

runDropMigration();
