const fs = require('fs');
const path = require('path');
const db = require('../db');
const { evaluateSriReadiness } = require('../utils/sri_readiness');
const { validateCertificateConfig } = require('../services/sri_service');

const checks = [
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
  return { key: 'backups', label: 'Backup SQL disponible', count: files.length, error: null };
}

async function main() {
  const results = [];

  const companyRows = await db.query('SELECT ruc, ambiente_sri, certificado_path, certificado_clave FROM empresas ORDER BY id_empresa');
  const sriReadiness = evaluateSriReadiness(companyRows.rows);

  for (const check of checks) {
    results.push(await countRows(check));
  }
  results.push(checkBackups());

  console.log('FacturaPro - chequeo preproduccion');
  console.log('-----------------------------------');

  let missingRequired = 0;
  for (const result of results) {
    const ok = result.count > 0;
    const prefix = ok ? 'OK' : result.optional ? 'INFO' : 'PENDIENTE';
    const detail = result.error ? ` - ${result.error}` : ` - registros: ${result.count}`;
    console.log(`${prefix} ${result.label}${detail}`);
    if (!ok && !result.optional) missingRequired += 1;
  }

  if (sriReadiness.ok) {
    console.log('OK Configuración SRI local de pruebas');
    try {
      const certificate = validateCertificateConfig(companyRows.rows[0]);
      console.log(`OK Certificado de firma vigente hasta ${new Date(certificate.validTo).toISOString().slice(0, 10)}`);
    } catch (error) {
      console.log(`PENDIENTE SRI - Certificado de firma: ${error.message}`);
      missingRequired += 1;
    }
  } else {
    for (const problem of sriReadiness.problems) console.log(`PENDIENTE SRI - ${problem}`);
    missingRequired += sriReadiness.problems.length;
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    console.log('OK Configuración SMTP presente (envío real aún requiere prueba)');
  } else {
    console.log('PENDIENTE Entrega por correo - configure SMTP_HOST, SMTP_USER y SMTP_PASS para probar el envío real.');
    missingRequired += 1;
  }

  if (missingRequired > 0) {
    console.log('-----------------------------------');
    console.log(`Pendientes obligatorios: ${missingRequired}. Corrige la configuración y valida los flujos en SRI PRUEBAS antes de producción.`);
    process.exitCode = 1;
  } else {
    console.log('-----------------------------------');
    console.log('Chequeos locales superados. Aún se requiere una prueba real de extremo a extremo en SRI PRUEBAS.');
  }
}

main()
  .catch((error) => {
    console.error('Error en chequeo preproduccion:', error);
    process.exitCode = 1;
  })
  .finally(() => db.pool.end());
