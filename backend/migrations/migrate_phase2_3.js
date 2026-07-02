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
  console.log('Iniciando migración de Proveedores (Fase 2) y Módulos de Operación (Fase 3)...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Crear tabla de proveedores
    console.log('Creando tabla de proveedores...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS proveedores (
        id_proveedor SERIAL PRIMARY KEY,
        tipo_identificacion VARCHAR(20) NOT NULL,
        identificacion VARCHAR(20) UNIQUE NOT NULL,
        nombre VARCHAR(150) NOT NULL,
        email VARCHAR(100) NOT NULL,
        telefono VARCHAR(20),
        direccion VARCHAR(255),
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Crear tabla de movimientos de inventario
    console.log('Creando tabla de movimientos_inventario...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS movimientos_inventario (
        id_movimiento SERIAL PRIMARY KEY,
        id_producto INT REFERENCES productos(id_producto) ON DELETE CASCADE,
        tipo VARCHAR(20) NOT NULL, -- INGRESO, EGRESO
        cantidad DECIMAL(12, 2) NOT NULL,
        motivo VARCHAR(255) NOT NULL, -- COMPRA, VENTA, AJUSTE, INVENTARIO_INICIAL
        referencia VARCHAR(50), -- No. Factura o Guía
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        id_usuario INT REFERENCES usuarios(id_usuario)
      );
    `);

    // 3. Crear tabla de cajas
    console.log('Creando tabla de cajas...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS cajas (
        id_caja SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        id_sucursal INT REFERENCES sucursales(id_sucursal) ON DELETE CASCADE,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Crear tabla de sesiones de caja
    console.log('Creando tabla de sesiones_caja (Apertura y Cierre)...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS sesiones_caja (
        id_sesion SERIAL PRIMARY KEY,
        id_caja INT REFERENCES cajas(id_caja) ON DELETE CASCADE,
        id_usuario INT REFERENCES usuarios(id_usuario),
        fecha_apertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_cierre TIMESTAMP,
        monto_apertura DECIMAL(12, 2) NOT NULL,
        monto_cierre DECIMAL(12, 2),
        estado VARCHAR(20) DEFAULT 'ABIERTA', -- ABIERTA, CERRADA
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Crear tabla de métodos de pago (SRI Oficial)
    console.log('Creando tabla de metodos_pago...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS metodos_pago (
        id_metodo SERIAL PRIMARY KEY,
        codigo_sri VARCHAR(2) UNIQUE NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        activo BOOLEAN DEFAULT TRUE
      );
    `);

    // 6. Sembrar datos de Métodos de Pago oficiales del SRI
    console.log('Sembrando métodos de pago SRI...');
    const paymentMethods = [
      ['01', 'SIN UTILIZACION DEL SISTEMA FINANCIERO (EFECTIVO)'],
      ['16', 'TARJETA DE DEBITO'],
      ['17', 'DINERO ELECTRONICO'],
      ['18', 'TARJETA PREPAGO'],
      ['19', 'TARJETA DE CREDITO'],
      ['20', 'OTROS CON UTILIZACION DEL SISTEMA FINANCIERO'],
      ['21', 'ENDOSO DE TITULOS']
    ];

    for (const [code, name] of paymentMethods) {
      await client.query(`
        INSERT INTO metodos_pago (codigo_sri, nombre) 
        VALUES ($1, $2)
        ON CONFLICT (codigo_sri) DO NOTHING;
      `, [code, name]);
    }

    // Sembrar una caja por defecto para la sucursal existente
    console.log('Sembrando caja principal de demostración...');
    const branchRes = await client.query("SELECT id_sucursal FROM sucursales LIMIT 1");
    if (branchRes.rows.length > 0) {
      const branchId = branchRes.rows[0].id_sucursal;
      await client.query(`
        INSERT INTO cajas (nombre, id_sucursal) 
        VALUES ('Caja Principal Matriz', $1)
        ON CONFLICT DO NOTHING;
      `, [branchId]);
    }

    await client.query('COMMIT');
    console.log('¡Migración y siembra de las fases 2 y 3 finalizada exitosamente!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error durante la migración:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
