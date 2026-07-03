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
  console.log('Iniciando migracion de cierre profesional operativo...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE compras
      ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT,
      ADD COLUMN IF NOT EXISTS anulada_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS anulada_por INT REFERENCES usuarios(id_usuario);
    `);

    await client.query(`
      ALTER TABLE retenciones
      ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT,
      ADD COLUMN IF NOT EXISTS anulada_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS anulada_por INT REFERENCES usuarios(id_usuario);
    `);

    await client.query(`
      ALTER TABLE notas_credito
      ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT,
      ADD COLUMN IF NOT EXISTS anulada_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS anulada_por INT REFERENCES usuarios(id_usuario);
    `);

    await client.query(`
      ALTER TABLE empresas
      ADD COLUMN IF NOT EXISTS logo_url TEXT,
      ADD COLUMN IF NOT EXISTS ambiente_sri VARCHAR(20) DEFAULT 'PRUEBAS',
      ADD COLUMN IF NOT EXISTS tipo_emision VARCHAR(20) DEFAULT 'NORMAL',
      ADD COLUMN IF NOT EXISTS certificado_path TEXT,
      ADD COLUMN IF NOT EXISTS certificado_alias VARCHAR(120),
      ADD COLUMN IF NOT EXISTS certificado_clave TEXT,
      ADD COLUMN IF NOT EXISTS sri_endpoint_recepcion TEXT,
      ADD COLUMN IF NOT EXISTS sri_endpoint_autorizacion TEXT;
    `);

    await client.query('COMMIT');
    console.log('Migracion de cierre profesional operativo completada con exito.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error durante migracion de cierre profesional:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
