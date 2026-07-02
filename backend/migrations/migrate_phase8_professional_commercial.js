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
  console.log('Iniciando migracion profesional comercial...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE facturas
      ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT,
      ADD COLUMN IF NOT EXISTS anulada_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS anulada_por INT REFERENCES usuarios(id_usuario);
    `);

    await client.query(`
      ALTER TABLE proformas
      ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT,
      ADD COLUMN IF NOT EXISTS aprobada_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS anulada_at TIMESTAMP;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS factura_pagos (
        id_pago SERIAL PRIMARY KEY,
        id_factura INT REFERENCES facturas(id_factura) ON DELETE CASCADE,
        id_metodo_pago INT REFERENCES metodos_pago(id_metodo),
        monto DECIMAL(12, 4) NOT NULL DEFAULT 0,
        referencia VARCHAR(120),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_factura_pagos_factura
      ON factura_pagos (id_factura);
    `);

    await client.query('COMMIT');
    console.log('Migracion profesional comercial finalizada con exito.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error durante la migracion profesional comercial:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
