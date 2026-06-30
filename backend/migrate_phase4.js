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
  console.log('Iniciando migración de la Fase 4: Facturación (Normal)...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Crear tabla de secuenciales
    console.log('Creando tabla de secuenciales...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS secuenciales (
        id_secuencial SERIAL PRIMARY KEY,
        id_sucursal INT REFERENCES sucursales(id_sucursal) ON DELETE CASCADE,
        tipo_comprobante VARCHAR(20) NOT NULL DEFAULT 'FACTURA', -- FACTURA, NOTA_CREDITO
        secuencial_actual INT NOT NULL DEFAULT 1,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(id_sucursal, tipo_comprobante)
      );
    `);

    // 2. Crear tabla de facturas
    console.log('Creando tabla de facturas...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS facturas (
        id_factura SERIAL PRIMARY KEY,
        id_sucursal INT REFERENCES sucursales(id_sucursal),
        secuencial VARCHAR(9) NOT NULL,
        numero_factura VARCHAR(17) UNIQUE NOT NULL, -- Formato: 001-001-000000001
        fecha_emision TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        id_cliente INT REFERENCES clients(id),
        id_usuario INT REFERENCES usuarios(id_usuario),
        id_sesion_caja INT REFERENCES sesiones_caja(id_sesion),
        subtotal_sin_impuestos DECIMAL(12, 4) NOT NULL, -- Base imponible total
        subtotal_con_iva DECIMAL(12, 4) NOT NULL, -- Base imponible con IVA > 0%
        subtotal_iva_cero DECIMAL(12, 4) NOT NULL, -- Base imponible con IVA 0%
        valor_iva DECIMAL(12, 4) NOT NULL, -- Valor total del IVA
        total DECIMAL(12, 4) NOT NULL, -- Monto neto total a pagar
        id_metodo_pago INT REFERENCES metodos_pago(id_metodo),
        estado VARCHAR(20) DEFAULT 'EMITIDA', -- EMITIDA, ANULADA
        clave_acceso VARCHAR(49), -- Clave de acceso de 49 dígitos para SRI
        xml_generado TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Crear tabla de detalles de factura
    console.log('Creando tabla de factura_detalles...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS factura_detalles (
        id_detalle SERIAL PRIMARY KEY,
        id_factura INT REFERENCES facturas(id_factura) ON DELETE CASCADE,
        id_producto INT REFERENCES productos(id_producto),
        cantidad DECIMAL(12, 2) NOT NULL,
        precio_unitario DECIMAL(12, 4) NOT NULL, -- Sin impuestos
        descuento DECIMAL(12, 4) DEFAULT 0.0000,
        id_impuesto INT REFERENCES impuestos(id_impuesto),
        porcentaje_iva DECIMAL(5, 2) NOT NULL, -- Respaldo del porcentaje de IVA emitido
        valor_iva DECIMAL(12, 4) NOT NULL,
        precio_total DECIMAL(12, 4) NOT NULL -- Cantidad * Precio Unitario - Descuento
      );
    `);

    // 4. Sembrar secuenciales iniciales para la sucursal por defecto
    console.log('Sembrando secuenciales de prueba para la sucursal principal...');
    const branchRes = await client.query("SELECT id_sucursal FROM sucursales LIMIT 1");
    if (branchRes.rows.length > 0) {
      const branchId = branchRes.rows[0].id_sucursal;
      await client.query(`
        INSERT INTO secuenciales (id_sucursal, tipo_comprobante, secuencial_actual)
        VALUES ($1, 'FACTURA', 1)
        ON CONFLICT (id_sucursal, tipo_comprobante) DO NOTHING;
      `, [branchId]);
    }

    await client.query('COMMIT');
    console.log('¡Migración de la Fase 4 (Facturación) finalizada con éxito!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error durante la migración de la Fase 4:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
