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
  console.log('Iniciando migracion de arqueo detallado de caja...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE sesiones_caja
      ADD COLUMN IF NOT EXISTS apertura_billetes DECIMAL(12, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS apertura_monedas DECIMAL(12, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS cierre_billetes DECIMAL(12, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS cierre_monedas DECIMAL(12, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ventas_contado DECIMAL(12, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ventas_credito DECIMAL(12, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS cobros_cxc DECIMAL(12, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS notas_credito_total DECIMAL(12, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS efectivo_esperado DECIMAL(12, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_operativo DECIMAL(12, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS diferencia_cierre DECIMAL(12, 2) DEFAULT 0;
    `);

    await client.query(`
      UPDATE sesiones_caja
      SET apertura_billetes = COALESCE(NULLIF(apertura_billetes, 0), COALESCE(monto_apertura, 0)),
          apertura_monedas = COALESCE(apertura_monedas, 0),
          cierre_billetes = COALESCE(NULLIF(cierre_billetes, 0), COALESCE(monto_cierre, 0)),
          cierre_monedas = COALESCE(cierre_monedas, 0)
      WHERE apertura_billetes IS NULL
         OR cierre_billetes IS NULL
         OR apertura_billetes = 0
         OR cierre_billetes = 0;
    `);

    await client.query('COMMIT');
    console.log('Migracion de arqueo detallado de caja completada con exito.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error durante la migracion de arqueo de caja:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
