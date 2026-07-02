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
  console.log('Iniciando migración de módulo de compras...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS compras (
        id_compra SERIAL PRIMARY KEY,
        numero_factura_compra VARCHAR(50) NOT NULL,
        id_proveedor INT NOT NULL REFERENCES proveedores(id_proveedor) ON DELETE RESTRICT,
        id_usuario INT NOT NULL REFERENCES usuarios(id_usuario),
        fecha_compra TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        subtotal_iva_cero DECIMAL(12, 4) NOT NULL DEFAULT 0,
        subtotal_con_iva DECIMAL(12, 4) NOT NULL DEFAULT 0,
        descuento_total DECIMAL(12, 4) NOT NULL DEFAULT 0,
        valor_iva DECIMAL(12, 4) NOT NULL DEFAULT 0,
        total DECIMAL(12, 4) NOT NULL DEFAULT 0,
        estado VARCHAR(20) NOT NULL DEFAULT 'REGISTRADA', -- REGISTRADA, ANULADA
        observacion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS compra_detalles (
        id_detalle SERIAL PRIMARY KEY,
        id_compra INT NOT NULL REFERENCES compras(id_compra) ON DELETE CASCADE,
        id_producto INT NOT NULL REFERENCES productos(id_producto) ON DELETE RESTRICT,
        cantidad DECIMAL(12, 2) NOT NULL CHECK (cantidad > 0),
        costo_unitario DECIMAL(12, 4) NOT NULL CHECK (costo_unitario >= 0),
        precio_total DECIMAL(12, 4) NOT NULL,
        valor_iva DECIMAL(12, 4) NOT NULL DEFAULT 0
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_compras_proveedor ON compras(id_proveedor);
      CREATE INDEX IF NOT EXISTS idx_compra_detalles_compra ON compra_detalles(id_compra);
      CREATE INDEX IF NOT EXISTS idx_compra_detalles_producto ON compra_detalles(id_producto);
    `);

    await client.query('COMMIT');
    console.log('Migración de compras completada con éxito.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error durante la migración de compras:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
