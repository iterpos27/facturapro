const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const db = require('../db');

async function migratePhase16CreditCollections() {
  console.log('Iniciando migracion Phase 16: credito y cobranza...');

  try {
    await db.query('BEGIN');

    await db.query(`
      ALTER TABLE facturas
        ADD COLUMN IF NOT EXISTS tipo_venta VARCHAR(20) DEFAULT 'CONTADO',
        ADD COLUMN IF NOT EXISTS dias_credito INT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE,
        ADD COLUMN IF NOT EXISTS estado_cobranza VARCHAR(30) DEFAULT 'PAGADA';
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS factura_gestiones_cobranza (
        id_gestion SERIAL PRIMARY KEY,
        id_factura INT NOT NULL REFERENCES facturas(id_factura) ON DELETE CASCADE,
        tipo_gestion VARCHAR(40) NOT NULL DEFAULT 'LLAMADA',
        nota TEXT NOT NULL,
        fecha_compromiso DATE,
        monto_compromiso DECIMAL(12, 4) DEFAULT 0,
        estado VARCHAR(30) NOT NULL DEFAULT 'ABIERTA',
        id_usuario INT REFERENCES usuarios(id_usuario),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_facturas_cobranza_estado
      ON facturas(estado_cobranza, fecha_vencimiento);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_gestiones_cobranza_factura
      ON factura_gestiones_cobranza(id_factura, created_at DESC);
    `);

    await db.query(`
      UPDATE facturas
      SET tipo_venta = CASE WHEN COALESCE(saldo, 0) > 0 THEN 'CREDITO' ELSE 'CONTADO' END,
          dias_credito = CASE WHEN COALESCE(saldo, 0) > 0 THEN COALESCE(NULLIF(dias_credito, 0), 15) ELSE 0 END,
          fecha_vencimiento = CASE
            WHEN COALESCE(saldo, 0) > 0 THEN COALESCE(fecha_vencimiento, (fecha_emision::date + INTERVAL '15 days')::date)
            ELSE fecha_vencimiento
          END,
          estado_cobranza = CASE
            WHEN COALESCE(saldo, 0) <= 0 THEN 'PAGADA'
            WHEN COALESCE(fecha_vencimiento, (fecha_emision::date + INTERVAL '15 days')::date) < CURRENT_DATE THEN 'VENCIDA'
            ELSE 'PENDIENTE'
          END
      WHERE tipo_venta IS NULL
         OR dias_credito IS NULL
         OR estado_cobranza IS NULL
         OR (COALESCE(saldo, 0) > 0 AND fecha_vencimiento IS NULL);
    `);

    await db.query('COMMIT');
    console.log('Phase 16 completada: credito y cobranza listos.');
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error en migracion Phase 16:', error);
    throw error;
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) {
  migratePhase16CreditCollections().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = migratePhase16CreditCollections;
