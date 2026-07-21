const fs = require('fs');
const path = require('path');
const db = require('../db');

const checks = [
  { key: 'company', label: 'Empresa unica configurada', sql: 'SELECT COUNT(*)::int AS count FROM empresas', expectedCount: 1 },
  { key: 'products', label: 'Productos activos', sql: "SELECT COUNT(*)::int AS count FROM productos WHERE COALESCE(activo, true) = true" },
  { key: 'clients', label: 'Clientes', sql: 'SELECT COUNT(*)::int AS count FROM clients' },
  { key: 'suppliers', label: 'Proveedores', sql: 'SELECT COUNT(*)::int AS count FROM proveedores' },
  { key: 'purchases', label: 'Compras registradas', sql: "SELECT COUNT(*)::int AS count FROM compras WHERE estado <> 'ANULADA'" },
  { key: 'proformas', label: 'Proformas creadas', sql: 'SELECT COUNT(*)::int AS count FROM proformas' },
  { key: 'invoices', label: 'Facturas emitidas', sql: "SELECT COUNT(*)::int AS count FROM facturas WHERE estado <> 'ANULADA'" },
  { key: 'collections', label: 'Cobros o pagos de factura', sql: 'SELECT COUNT(*)::int AS count FROM factura_pagos' },
  { key: 'credit_notes', label: 'Notas de credito', sql: "SELECT COUNT(*)::int AS count FROM notas_credito WHERE estado <> 'ANULADA'" },
  { key: 'withholdings', label: 'Retenciones', sql: "SELECT COUNT(*)::int AS count FROM retenciones WHERE estado <> 'ANULADA'" },
  { key: 'cash_close', label: 'Cierre de caja', sql: "SELECT COUNT(*)::int AS count FROM sesiones_caja WHERE estado = 'CERRADA'" },
  { key: 'bank_accounts', label: 'Cuentas bancarias', sql: 'SELECT COUNT(*)::int AS count FROM cuentas_bancarias WHERE COALESCE(activo, true) = true', optional: true },
  { key: 'bank_deposits', label: 'Depositos bancarios', sql: 'SELECT COUNT(*)::int AS count FROM depositos_bancarios', optional: true },
];

async function countRows(check) {
  try {
    const result = await db.query(check.sql);
    return { ...check, count: Number(result.rows[0]?.count || 0), error: null };
  } catch (error) {
    if (['42P01', '42703'].includes(error.code)) {
      return { ...check, count: 0, error: `Tabla o columna pendiente (${error.code})` };
    }
    throw error;
  }
}

function checkBackups() {
  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    return { key: 'backups', label: 'Backup SQL disponible', count: 0, error: 'Directorio backups no existe' };
  }

  const files = fs.readdirSync(backupDir).filter((file) => file.toLowerCase().endsWith('.sql'));
  if (files.length === 0) {
    return { key: 'backups', label: 'Backup SQL reciente', count: 0, error: 'No hay backups SQL', ok: false };
  }

  const latestTimestamp = Math.max(...files.map((file) => fs.statSync(path.join(backupDir, file)).mtimeMs));
  const ageHours = (Date.now() - latestTimestamp) / (60 * 60 * 1000);
  const maxAgeHours = Number(process.env.BACKUP_MAX_AGE_HOURS || 26);
  const isRecent = ageHours <= maxAgeHours;
  return {
    key: 'backups',
    label: 'Backup SQL reciente',
    count: files.length,
    error: isRecent ? null : `Ultimo backup hace ${Math.floor(ageHours)} horas (maximo ${maxAgeHours})`,
    ok: isRecent,
  };
}

async function main() {
  const results = [];

  for (const check of checks) {
    results.push(await countRows(check));
  }
  results.push(checkBackups());

  console.log('FacturaPro - chequeo preproduccion');
  console.log('-----------------------------------');

  let missingRequired = 0;
  for (const result of results) {
    const ok = result.ok ?? (result.expectedCount !== undefined
      ? result.count === result.expectedCount
      : result.count > 0);
    const prefix = ok ? 'OK' : result.optional ? 'INFO' : 'PENDIENTE';
    const detail = result.error ? ` - ${result.error}` : ` - registros: ${result.count}`;
    console.log(`${prefix} ${result.label}${detail}`);
    if (!ok && !result.optional) missingRequired += 1;
  }

  if (missingRequired > 0) {
    console.log('-----------------------------------');
    console.log(`Pendientes obligatorios: ${missingRequired}. Completa esos flujos desde la UI antes de produccion.`);
    process.exitCode = 1;
  } else {
    console.log('-----------------------------------');
    console.log('Base lista para prueba funcional completa con datos reales.');
  }
}

main()
  .catch((error) => {
    console.error('Error en chequeo preproduccion:', error);
    process.exitCode = 1;
  })
  .finally(() => db.pool.end());
