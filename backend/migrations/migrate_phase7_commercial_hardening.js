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
  console.log('Iniciando migracion comercial: estados, pagos, auditoria y reportes...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE facturas
      ADD COLUMN IF NOT EXISTS descuento_total DECIMAL(12, 4) DEFAULT 0.0000,
      ADD COLUMN IF NOT EXISTS monto_pago DECIMAL(12, 4) DEFAULT 0.0000,
      ADD COLUMN IF NOT EXISTS anticipo DECIMAL(12, 4) DEFAULT 0.0000,
      ADD COLUMN IF NOT EXISTS cambio DECIMAL(12, 4) DEFAULT 0.0000,
      ADD COLUMN IF NOT EXISTS saldo DECIMAL(12, 4) DEFAULT 0.0000,
      ADD COLUMN IF NOT EXISTS observacion TEXT;
    `);

    await client.query(`
      ALTER TABLE factura_detalles
      ADD COLUMN IF NOT EXISTS descuento_porcentaje DECIMAL(5, 2) DEFAULT 0.0000,
      ADD COLUMN IF NOT EXISTS descuento_total DECIMAL(12, 4) DEFAULT 0.0000;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS auditoria_eventos (
        id_auditoria SERIAL PRIMARY KEY,
        entidad VARCHAR(60) NOT NULL,
        entidad_id VARCHAR(80),
        accion VARCHAR(80) NOT NULL,
        id_usuario INT REFERENCES usuarios(id_usuario),
        detalle JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_auditoria_entidad
      ON auditoria_eventos (entidad, entidad_id, created_at DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_auditoria_fecha
      ON auditoria_eventos (created_at DESC);
    `);

    await client.query(`
      UPDATE facturas
      SET descuento_total = COALESCE(descuento_total, 0),
          monto_pago = COALESCE(monto_pago, total),
          anticipo = COALESCE(anticipo, 0),
          cambio = COALESCE(cambio, 0),
          saldo = COALESCE(saldo, 0)
      WHERE descuento_total IS NULL
         OR monto_pago IS NULL
         OR anticipo IS NULL
         OR cambio IS NULL
         OR saldo IS NULL;
    `);

    await client.query('COMMIT');
    console.log('Migracion comercial finalizada con exito.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error durante la migracion comercial:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
