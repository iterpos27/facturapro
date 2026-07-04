const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const documentTypes = ['FACTURA', 'NOTA_CREDITO', 'RETENCION'];
const permissions = [
  ['SUPPLIERS_CRUD', 'Administracion completa de proveedores'],
  ['CATEGORIES_CRUD', 'Administracion completa de categorias'],
  ['INVENTORY_READ', 'Consulta de inventario y kardex'],
  ['PURCHASES_CRUD', 'Registro y anulacion de compras'],
  ['PROFORMAS_CRUD', 'Creacion, edicion y anulacion de proformas'],
  ['RECEIVABLES_CRUD', 'Gestion de cuentas por cobrar y cobros'],
  ['CREDIT_NOTES_CRUD', 'Emision y anulacion de notas de credito'],
  ['WITHHOLDINGS_CRUD', 'Emision y anulacion de retenciones'],
  ['REPORTS_READ', 'Consulta de reportes operativos'],
  ['CASH_REGISTER_CRUD', 'Apertura, cierre y control de caja'],
  ['AUDIT_READ', 'Consulta de auditoria'],
  ['SEQUENTIALS_UPDATE', 'Configuracion de secuenciales y puntos de emision'],
];

async function migrate() {
  console.log('Iniciando migracion de secuenciales y permisos...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const branches = await client.query('SELECT id_sucursal FROM sucursales');
    for (const branch of branches.rows) {
      for (const type of documentTypes) {
        await client.query(`
          INSERT INTO secuenciales (id_sucursal, tipo_comprobante, secuencial_actual, activo)
          VALUES ($1, $2, 1, true)
          ON CONFLICT (id_sucursal, tipo_comprobante) DO NOTHING
        `, [branch.id_sucursal, type]);
      }
    }

    for (const [name, description] of permissions) {
      await client.query(`
        INSERT INTO permisos (nombre, descripcion)
        VALUES ($1, $2)
        ON CONFLICT (nombre) DO NOTHING
      `, [name, description]);
    }

    await client.query(`
      INSERT INTO roles_permisos (id_rol, id_permiso)
      SELECT r.id_rol, p.id_permiso
      FROM roles r
      CROSS JOIN permisos p
      WHERE r.nombre = 'ADMINISTRADOR'
      ON CONFLICT DO NOTHING
    `);

    await client.query(`
      INSERT INTO roles_permisos (id_rol, id_permiso)
      SELECT r.id_rol, p.id_permiso
      FROM roles r
      JOIN permisos p ON p.nombre IN (
        'DASHBOARD_READ',
        'CLIENTS_CRUD',
        'PRODUCTS_CRUD',
        'INVOICES_CRUD',
        'PROFORMAS_CRUD',
        'RECEIVABLES_CRUD',
        'CASH_REGISTER_CRUD'
      )
      WHERE r.nombre = 'VENDEDOR'
      ON CONFLICT DO NOTHING
    `);

    await client.query(`
      INSERT INTO roles_permisos (id_rol, id_permiso)
      SELECT r.id_rol, p.id_permiso
      FROM roles r
      JOIN permisos p ON p.nombre IN (
        'DASHBOARD_READ',
        'CLIENTS_CRUD',
        'SUPPLIERS_CRUD',
        'PRODUCTS_CRUD',
        'CATEGORIES_CRUD',
        'INVENTORY_READ',
        'PURCHASES_CRUD',
        'PROFORMAS_CRUD',
        'INVOICES_CRUD',
        'RECEIVABLES_CRUD',
        'CREDIT_NOTES_CRUD',
        'WITHHOLDINGS_CRUD',
        'REPORTS_READ',
        'AUDIT_READ',
        'SRI_ELECTRONIC_BILLING'
      )
      WHERE r.nombre = 'CONTADOR'
      ON CONFLICT DO NOTHING
    `);

    await client.query('COMMIT');
    console.log('Migracion de secuenciales y permisos completada.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error durante migracion de secuenciales y permisos:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
