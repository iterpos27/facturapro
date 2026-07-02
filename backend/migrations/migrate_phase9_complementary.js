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
  console.log('Iniciando migración de documentos complementarios (Notas de Crédito y Retenciones)...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Crear tabla de notas de crédito
    await client.query(`
      CREATE TABLE IF NOT EXISTS notas_credito (
        id_nota_credito SERIAL PRIMARY KEY,
        numero_nota_credito VARCHAR(50) NOT NULL UNIQUE,
        id_factura INT NOT NULL REFERENCES facturas(id_factura) ON DELETE RESTRICT,
        id_usuario INT NOT NULL REFERENCES usuarios(id_usuario),
        fecha_emision TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        subtotal_iva_cero DECIMAL(12, 4) NOT NULL DEFAULT 0,
        subtotal_con_iva DECIMAL(12, 4) NOT NULL DEFAULT 0,
        valor_iva DECIMAL(12, 4) NOT NULL DEFAULT 0,
        total DECIMAL(12, 4) NOT NULL DEFAULT 0,
        motivo VARCHAR(255) NOT NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'EMITIDA', -- EMITIDA, ANULADA
        clave_acceso VARCHAR(49),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Crear detalles de nota de crédito
    await client.query(`
      CREATE TABLE IF NOT EXISTS nota_credito_detalles (
        id_detalle SERIAL PRIMARY KEY,
        id_nota_credito INT NOT NULL REFERENCES notas_credito(id_nota_credito) ON DELETE CASCADE,
        id_producto INT NOT NULL REFERENCES productos(id_producto) ON DELETE RESTRICT,
        cantidad DECIMAL(12, 2) NOT NULL CHECK (cantidad > 0),
        precio_unitario DECIMAL(12, 4) NOT NULL CHECK (precio_unitario >= 0),
        precio_total DECIMAL(12, 4) NOT NULL,
        valor_iva DECIMAL(12, 4) NOT NULL DEFAULT 0
      );
    `);

    // 3. Crear tabla de retenciones
    await client.query(`
      CREATE TABLE IF NOT EXISTS retenciones (
        id_retencion SERIAL PRIMARY KEY,
        numero_retencion VARCHAR(50) NOT NULL UNIQUE,
        id_compra INT REFERENCES compras(id_compra) ON DELETE CASCADE,
        id_usuario INT NOT NULL REFERENCES usuarios(id_usuario),
        fecha_emision TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        estado VARCHAR(20) NOT NULL DEFAULT 'EMITIDA',
        clave_acceso VARCHAR(49),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Crear detalles de retención
    await client.query(`
      CREATE TABLE IF NOT EXISTS retencion_detalles (
        id_detalle SERIAL PRIMARY KEY,
        id_retencion INT NOT NULL REFERENCES retenciones(id_retencion) ON DELETE CASCADE,
        impuesto VARCHAR(10) NOT NULL, -- RENTA, IVA
        codigo_sri VARCHAR(10) NOT NULL,
        porcentaje DECIMAL(5, 2) NOT NULL,
        base_imponible DECIMAL(12, 4) NOT NULL,
        valor_retenido DECIMAL(12, 4) NOT NULL
      );
    `);

    // 5. Índices de búsqueda
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notas_credito_factura ON notas_credito(id_factura);
      CREATE INDEX IF NOT EXISTS idx_retenciones_compra ON retenciones(id_compra);
    `);

    await client.query('COMMIT');
    console.log('Migración de documentos complementarios completada con éxito.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error durante la migración de documentos complementarios:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
