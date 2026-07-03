const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function migrate() {
  console.log('Iniciando migracion de SRI ambiente de pruebas...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS sri_comprobantes (
        id_sri SERIAL PRIMARY KEY,
        tipo_comprobante VARCHAR(2) NOT NULL,
        id_documento INT NOT NULL,
        numero_comprobante VARCHAR(30) NOT NULL,
        clave_acceso VARCHAR(49) NOT NULL,
        ambiente VARCHAR(20) NOT NULL DEFAULT 'PRUEBAS',
        estado VARCHAR(30) NOT NULL DEFAULT 'GENERADO',
        xml_generado TEXT,
        xml_firmado TEXT,
        numero_autorizacion VARCHAR(49),
        fecha_autorizacion TIMESTAMP,
        mensajes JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tipo_comprobante, id_documento)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sri_comprobantes_clave_acceso
      ON sri_comprobantes (clave_acceso);
    `);

    await client.query(`
      ALTER TABLE facturas
      ADD COLUMN IF NOT EXISTS sri_estado VARCHAR(30),
      ADD COLUMN IF NOT EXISTS sri_ambiente VARCHAR(20),
      ADD COLUMN IF NOT EXISTS sri_numero_autorizacion VARCHAR(49),
      ADD COLUMN IF NOT EXISTS sri_fecha_autorizacion TIMESTAMP,
      ADD COLUMN IF NOT EXISTS sri_mensajes JSONB DEFAULT '[]'::jsonb;
    `);

    await client.query('COMMIT');
    console.log('Migracion de SRI ambiente de pruebas completada con exito.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error durante migracion de SRI pruebas:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
