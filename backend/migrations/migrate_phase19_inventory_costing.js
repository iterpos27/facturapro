const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const db = require('../db');

async function migratePhase19InventoryCosting() {
  console.log('Iniciando migracion Phase 19: kardex valorizado y costo promedio...');

  try {
    await db.query('BEGIN');

    await db.query(`
      ALTER TABLE productos
        ADD COLUMN IF NOT EXISTS costo_promedio DECIMAL(12, 4) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS valor_inventario DECIMAL(12, 4) DEFAULT 0;
    `);

    await db.query(`
      UPDATE productos
      SET costo_promedio = CASE
            WHEN COALESCE(costo_promedio, 0) > 0 THEN costo_promedio
            ELSE COALESCE(precio_compra, 0)
          END,
          valor_inventario = ROUND((COALESCE(stock_actual, 0) * COALESCE(NULLIF(costo_promedio, 0), precio_compra, 0))::numeric, 4)
      WHERE costo_promedio IS NULL
         OR valor_inventario IS NULL
         OR COALESCE(valor_inventario, 0) = 0;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS kardex_valorizado (
        id_kardex SERIAL PRIMARY KEY,
        id_producto INT NOT NULL REFERENCES productos(id_producto) ON DELETE CASCADE,
        id_movimiento INT REFERENCES movimientos_inventario(id_movimiento) ON DELETE SET NULL,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        tipo VARCHAR(20) NOT NULL,
        motivo VARCHAR(80) NOT NULL,
        referencia VARCHAR(80),
        documento_tipo VARCHAR(40),
        documento_id INT,
        cantidad_entrada DECIMAL(12, 4) DEFAULT 0,
        costo_entrada DECIMAL(12, 4) DEFAULT 0,
        total_entrada DECIMAL(12, 4) DEFAULT 0,
        cantidad_salida DECIMAL(12, 4) DEFAULT 0,
        costo_salida DECIMAL(12, 4) DEFAULT 0,
        total_salida DECIMAL(12, 4) DEFAULT 0,
        saldo_cantidad DECIMAL(12, 4) DEFAULT 0,
        costo_promedio DECIMAL(12, 4) DEFAULT 0,
        saldo_valor DECIMAL(12, 4) DEFAULT 0,
        id_usuario INT REFERENCES usuarios(id_usuario),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_kardex_valorizado_producto_fecha
      ON kardex_valorizado(id_producto, fecha DESC, id_kardex DESC);
    `);

    await db.query(`
      INSERT INTO kardex_valorizado (
        id_producto, fecha, tipo, motivo, referencia,
        cantidad_entrada, costo_entrada, total_entrada,
        saldo_cantidad, costo_promedio, saldo_valor
      )
      SELECT p.id_producto, CURRENT_TIMESTAMP, 'INGRESO', 'SALDO_INICIAL_MIGRACION', 'PHASE19',
             COALESCE(p.stock_actual, 0), COALESCE(p.costo_promedio, p.precio_compra, 0),
             ROUND((COALESCE(p.stock_actual, 0) * COALESCE(p.costo_promedio, p.precio_compra, 0))::numeric, 4),
             COALESCE(p.stock_actual, 0), COALESCE(p.costo_promedio, p.precio_compra, 0),
             ROUND((COALESCE(p.stock_actual, 0) * COALESCE(p.costo_promedio, p.precio_compra, 0))::numeric, 4)
      FROM productos p
      WHERE COALESCE(p.stock_actual, 0) > 0
        AND NOT EXISTS (
          SELECT 1 FROM kardex_valorizado kv WHERE kv.id_producto = p.id_producto
        );
    `);

    await db.query('COMMIT');
    console.log('Phase 19 completada: inventario valorizado listo.');
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error en migracion Phase 19:', error);
    throw error;
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) {
  migratePhase19InventoryCosting().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = migratePhase19InventoryCosting;
