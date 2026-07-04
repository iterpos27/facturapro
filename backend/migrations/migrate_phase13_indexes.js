/**
 * migrate_phase13_indexes.js
 * Agrega índices de rendimiento a las tablas más consultadas.
 * Safe: usa CREATE INDEX IF NOT EXISTS — no falla si ya existen.
 */
const db = require('../db');

const indexes = [
  // ── Facturas ────────────────────────────────────────────────────────────────
  'CREATE INDEX IF NOT EXISTS idx_facturas_fecha    ON facturas(fecha_emision DESC)',
  'CREATE INDEX IF NOT EXISTS idx_facturas_cliente  ON facturas(id_cliente)',
  'CREATE INDEX IF NOT EXISTS idx_facturas_estado   ON facturas(estado)',
  'CREATE INDEX IF NOT EXISTS idx_facturas_usuario  ON facturas(id_usuario)',

  // ── Movimientos de inventario ────────────────────────────────────────────────
  'CREATE INDEX IF NOT EXISTS idx_mov_producto ON movimientos_inventario(id_producto)',
  'CREATE INDEX IF NOT EXISTS idx_mov_fecha    ON movimientos_inventario(created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_mov_tipo     ON movimientos_inventario(tipo)',

  // ── Proformas ────────────────────────────────────────────────────────────────
  'CREATE INDEX IF NOT EXISTS idx_proformas_cliente ON proformas(id_cliente)',
  'CREATE INDEX IF NOT EXISTS idx_proformas_estado  ON proformas(estado)',
  'CREATE INDEX IF NOT EXISTS idx_proformas_fecha   ON proformas(created_at DESC)',

  // ── Compras ──────────────────────────────────────────────────────────────────
  'CREATE INDEX IF NOT EXISTS idx_compras_fecha     ON compras(fecha_compra DESC)',
  'CREATE INDEX IF NOT EXISTS idx_compras_proveedor ON compras(id_proveedor)',
  'CREATE INDEX IF NOT EXISTS idx_compras_estado    ON compras(estado)',

  // ── Retenciones ──────────────────────────────────────────────────────────────
  'CREATE INDEX IF NOT EXISTS idx_retenciones_compra  ON retenciones(id_compra)',
  'CREATE INDEX IF NOT EXISTS idx_retenciones_usuario ON retenciones(id_usuario)',

  // ── Notas de crédito ─────────────────────────────────────────────────────────
  'CREATE INDEX IF NOT EXISTS idx_nc_factura ON notas_credito(id_factura)',
  'CREATE INDEX IF NOT EXISTS idx_nc_estado  ON notas_credito(estado)',

  // ── Clientes ─────────────────────────────────────────────────────────────────
  'CREATE INDEX IF NOT EXISTS idx_clients_identification ON clients(identification_number)',

  // ── Auditoría ────────────────────────────────────────────────────────────────
  'CREATE INDEX IF NOT EXISTS idx_audit_entidad   ON audit_events(entidad)',
  'CREATE INDEX IF NOT EXISTS idx_audit_created   ON audit_events(created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_audit_usuario   ON audit_events(id_usuario)',
];

async function runMigration() {
  console.log('⏳ Creando índices de rendimiento...\n');
  let created = 0;
  let errors = 0;

  for (const sql of indexes) {
    const name = sql.match(/idx_\w+/)?.[0] || sql;
    try {
      await db.query(sql);
      console.log(`  ✅ ${name}`);
      created++;
    } catch (err) {
      // Si la tabla no existe aún, omitir el índice sin fallar
      if (err.code === '42P01') {
        console.log(`  ⏭️  ${name} — tabla no existe, omitido`);
      } else {
        console.error(`  ❌ ${name}: ${err.message}`);
        errors++;
      }
    }
  }

  console.log(`\n✔ Índices procesados: ${created} creados, ${errors} errores.`);
  process.exit(errors > 0 ? 1 : 0);
}

runMigration().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
