const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const db = require('../db');

async function migratePhase18Payables() {
  console.log('Iniciando migracion Phase 18: cuentas por pagar...');

  try {
    await db.query('BEGIN');

    await db.query(`
      ALTER TABLE compras
        ADD COLUMN IF NOT EXISTS tipo_compra VARCHAR(20) DEFAULT 'CONTADO',
        ADD COLUMN IF NOT EXISTS dias_credito INT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE,
        ADD COLUMN IF NOT EXISTS monto_pagado DECIMAL(12, 4) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS saldo DECIMAL(12, 4) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS estado_pago VARCHAR(30) DEFAULT 'PAGADA';
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS compra_pagos (
        id_pago SERIAL PRIMARY KEY,
        id_compra INT NOT NULL REFERENCES compras(id_compra) ON DELETE CASCADE,
        monto DECIMAL(12, 4) NOT NULL CHECK (monto > 0),
        metodo_pago VARCHAR(60) NOT NULL DEFAULT 'EFECTIVO',
        referencia VARCHAR(150),
        fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        id_usuario INT REFERENCES usuarios(id_usuario),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_compras_payables
      ON compras(estado_pago, fecha_vencimiento);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_compra_pagos_compra
      ON compra_pagos(id_compra, fecha_pago DESC);
    `);

    await db.query(`
      UPDATE compras
      SET tipo_compra = CASE WHEN COALESCE(saldo, 0) > 0 THEN 'CREDITO' ELSE COALESCE(tipo_compra, 'CONTADO') END,
          monto_pagado = COALESCE(monto_pagado, CASE WHEN COALESCE(saldo, 0) > 0 THEN GREATEST(total - saldo, 0) ELSE total END),
          saldo = COALESCE(saldo, 0),
          estado_pago = CASE
            WHEN COALESCE(saldo, 0) <= 0 THEN 'PAGADA'
            WHEN fecha_vencimiento IS NOT NULL AND fecha_vencimiento < CURRENT_DATE THEN 'VENCIDA'
            WHEN COALESCE(monto_pagado, 0) > 0 THEN 'ABONADA'
            ELSE 'PENDIENTE'
          END
      WHERE tipo_compra IS NULL
         OR monto_pagado IS NULL
         OR saldo IS NULL
         OR estado_pago IS NULL;
    `);

    await db.query('COMMIT');
    console.log('Phase 18 completada: cuentas por pagar listas.');
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error en migracion Phase 18:', error);
    throw error;
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) {
  migratePhase18Payables().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = migratePhase18Payables;
