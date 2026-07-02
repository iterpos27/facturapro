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
  console.log('Iniciando migración de cobros y cuentas por cobrar...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS factura_cobros (
        id_cobro SERIAL PRIMARY KEY,
        id_factura INT NOT NULL REFERENCES facturas(id_factura) ON DELETE CASCADE,
        id_metodo_pago INT NOT NULL REFERENCES metodos_pago(id_metodo),
        monto DECIMAL(12, 4) NOT NULL CHECK (monto > 0),
        referencia VARCHAR(100),
        fecha_cobro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        id_usuario INT REFERENCES usuarios(id_usuario),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_factura_cobros_factura
      ON factura_cobros(id_factura);
    `);

    await client.query('COMMIT');
    console.log('Migración de cobros y cuentas por cobrar completada con éxito.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error durante la migración de cobros:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
