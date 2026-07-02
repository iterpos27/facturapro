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
  console.log('Iniciando migracion de proformas...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS proformas (
        id_proforma SERIAL PRIMARY KEY,
        transaction_number INT UNIQUE NOT NULL,
        numero_proforma VARCHAR(30) UNIQUE NOT NULL,
        fecha_emision TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        valid_until DATE,
        id_cliente INT REFERENCES clients(id),
        id_usuario INT REFERENCES usuarios(id_usuario),
        notes TEXT,
        subtotal_sin_impuestos DECIMAL(12, 4) NOT NULL DEFAULT 0,
        subtotal_con_iva DECIMAL(12, 4) NOT NULL DEFAULT 0,
        subtotal_iva_cero DECIMAL(12, 4) NOT NULL DEFAULT 0,
        descuento_total DECIMAL(12, 4) NOT NULL DEFAULT 0,
        valor_iva DECIMAL(12, 4) NOT NULL DEFAULT 0,
        total DECIMAL(12, 4) NOT NULL DEFAULT 0,
        estado VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS proforma_detalles (
        id_detalle SERIAL PRIMARY KEY,
        id_proforma INT REFERENCES proformas(id_proforma) ON DELETE CASCADE,
        id_producto INT REFERENCES productos(id_producto),
        cantidad DECIMAL(12, 2) NOT NULL,
        precio_unitario DECIMAL(12, 4) NOT NULL,
        descuento_valor DECIMAL(12, 4) NOT NULL DEFAULT 0,
        descuento_porcentaje DECIMAL(5, 2) NOT NULL DEFAULT 0,
        descuento_total DECIMAL(12, 4) NOT NULL DEFAULT 0,
        porcentaje_iva DECIMAL(5, 2) NOT NULL DEFAULT 0,
        valor_iva DECIMAL(12, 4) NOT NULL DEFAULT 0,
        subtotal_sin_iva DECIMAL(12, 4) NOT NULL DEFAULT 0,
        total DECIMAL(12, 4) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_proformas_fecha
      ON proformas(fecha_emision DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_proforma_detalles_proforma
      ON proforma_detalles(id_proforma);
    `);

    await client.query('COMMIT');
    console.log('Migracion de proformas finalizada con exito.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error durante la migracion de proformas:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
