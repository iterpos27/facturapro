const db = require('./db');

const migrationSQL = `
ALTER TABLE clients ADD COLUMN IF NOT EXISTS additional_emails VARCHAR(250);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS observation TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS person_type VARCHAR(20) DEFAULT 'NATURAL';
`;

async function runMigration() {
  try {
    console.log('Ejecutando migración para agregar nuevas columnas...');
    await db.query(migrationSQL);
    console.log('¡Migración completada exitosamente!');
    process.exit(0);
  } catch (error) {
    console.error('Error al ejecutar la migración:', error);
    process.exit(1);
  }
}

runMigration();
