/**
 * migrate_all.js — Script maestro de migraciones FacturaPro.
 * Ejecuta todas las fases de migración en orden.
 * Uso: node migrations/migrate_all.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const phases = [
  { name: 'Phase 1 — Estructura base', file: './migrate_phase1' },
  { name: 'Phase 2-3 — Inventario y complementos', file: './migrate_phase2_3' },
  { name: 'Phase 4 — Relaciones avanzadas', file: './migrate_phase4' },
  { name: 'Phase 5 — Proformas', file: './migrate_phase5_proformas' },
  { name: 'Phase 6 — Factura-Proforma link', file: './migrate_phase6_invoice_proformas' },
  { name: 'Phase 7 — Hardening comercial', file: './migrate_phase7_commercial_hardening' },
  { name: 'Phase 8 — Comercial profesional', file: './migrate_phase8_professional_commercial' },
  { name: 'Phase 9a — Compras', file: './migrate_phase9_purchases' },
  { name: 'Phase 9b — Cuentas por cobrar', file: './migrate_phase9_receivables' },
  { name: 'Phase 9c — Complementarios', file: './migrate_phase9_complementary' },
  { name: 'Phase 10 — Denominaciones de caja', file: './migrate_phase10_cash_denominations' },
  { name: 'Phase 11 — Acabado profesional', file: './migrate_phase11_professional_finish' },
  { name: 'Phase 12 — SRI pruebas', file: './migrate_phase12_sri_test' },
  { name: 'Phase 13 — Índices de BD', file: './migrate_phase13_indexes' },
  { name: 'Phase 14 — Secuenciales y permisos', file: './migrate_phase14_sequentials_permissions' },
  { name: 'Phase 15 — SRI complementarios', file: './migrate_phase15_sri_complementary' },
  { name: 'Phase 16 — Gestiones de cobranza', file: './migrate_phase16_credit_collections' },
  { name: 'Phase 17 - Historial de emails SRI', file: './migrate_phase17_email_history' },
  { name: 'Phase 18 - Cuentas por pagar', file: './migrate_phase18_payables' },
  { name: 'Phase 19 - Kardex valorizado y costo promedio', file: './migrate_phase19_inventory_costing' },
  { name: 'Phase 20 - Preproduccion, bancos y permisos finos', file: './migrate_phase20_preproduction' },
  { name: 'Phase 21 - Longitudes SRI flexibles', file: './migrate_phase21_sri_field_lengths' },
  { name: 'Phase 22 - Agente de retencion en empresas', file: './migrate_phase22_agente_retencion' },
];

async function runAll() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  FacturaPro — Migración Completa de Base de Datos');
  console.log('═══════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  for (const phase of phases) {
    console.log(`▶  ${phase.name}...`);
    try {
      const migFn = require(phase.file);
      // Algunas migraciones exportan una función, otras se ejecutan al importar
      if (typeof migFn === 'function') {
        await migFn();
      }
      console.log(`   ✅ Completada\n`);
      passed++;
    } catch (error) {
      console.error(`   ❌ ERROR: ${error.message}\n`);
      failed++;
      // Continuar con las siguientes migraciones para ver todos los errores
    }
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Resultado: ${passed} completadas, ${failed} con error`);
  console.log('═══════════════════════════════════════════════════════');

  if (failed > 0) {
    process.exit(1);
  }
}

runAll().catch((err) => {
  console.error('Error fatal en migración:', err);
  process.exit(1);
});
