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
  console.log('Iniciando migracion de enlace factura-proforma...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      ALTER TABLE facturas
      ADD COLUMN IF NOT EXISTS id_proforma INT REFERENCES proformas(id_proforma);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_facturas_proforma
      ON facturas(id_proforma);
    `);
    await client.query('COMMIT');
    console.log('Migracion de enlace factura-proforma finalizada con exito.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error durante migracion de enlace factura-proforma:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
