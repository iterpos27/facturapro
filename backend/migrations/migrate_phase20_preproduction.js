const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const db = require('../db');

const permissions = [
  ['BANKS_CRUD', 'Gestion de bancos, depositos y conciliacion'],
  ['REPORTS_MANAGER_READ', 'Consulta de reportes gerenciales'],
  ['DOCUMENT_CANCEL', 'Anulacion de documentos comerciales'],
  ['SRI_PROCESS', 'Procesamiento de comprobantes electronicos SRI'],
  ['CASH_CLOSE', 'Cierre de caja'],
  ['PRODUCTION_SWITCH', 'Cambio de ambiente SRI a produccion'],
];

async function migratePhase20Preproduction() {
  console.log('Iniciando migracion Phase 20: preproduccion, bancos y permisos finos...');

  try {
    await db.query('BEGIN');

    await db.query(`
      CREATE TABLE IF NOT EXISTS cuentas_bancarias (
        id_cuenta SERIAL PRIMARY KEY,
        banco VARCHAR(120) NOT NULL,
        numero_cuenta VARCHAR(80) NOT NULL,
        tipo_cuenta VARCHAR(40) DEFAULT 'CORRIENTE',
        titular VARCHAR(160),
        saldo_inicial DECIMAL(12, 4) DEFAULT 0,
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS depositos_bancarios (
        id_deposito SERIAL PRIMARY KEY,
        id_cuenta INT NOT NULL REFERENCES cuentas_bancarias(id_cuenta) ON DELETE RESTRICT,
        id_sesion INT REFERENCES sesiones_caja(id_sesion) ON DELETE SET NULL,
        fecha_deposito DATE NOT NULL DEFAULT CURRENT_DATE,
        monto DECIMAL(12, 4) NOT NULL CHECK (monto > 0),
        referencia VARCHAR(160),
        observacion TEXT,
        estado VARCHAR(30) NOT NULL DEFAULT 'REGISTRADO',
        conciliado_at TIMESTAMP,
        conciliado_por INT REFERENCES usuarios(id_usuario),
        id_usuario INT REFERENCES usuarios(id_usuario),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS conciliaciones_bancarias (
        id_conciliacion SERIAL PRIMARY KEY,
        id_cuenta INT NOT NULL REFERENCES cuentas_bancarias(id_cuenta) ON DELETE RESTRICT,
        fecha_desde DATE NOT NULL,
        fecha_hasta DATE NOT NULL,
        saldo_banco DECIMAL(12, 4) NOT NULL DEFAULT 0,
        saldo_sistema DECIMAL(12, 4) NOT NULL DEFAULT 0,
        diferencia DECIMAL(12, 4) NOT NULL DEFAULT 0,
        estado VARCHAR(30) NOT NULL DEFAULT 'ABIERTA',
        observacion TEXT,
        id_usuario INT REFERENCES usuarios(id_usuario),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.query('CREATE INDEX IF NOT EXISTS idx_depositos_cuenta_fecha ON depositos_bancarios(id_cuenta, fecha_deposito DESC)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_depositos_estado ON depositos_bancarios(estado, fecha_deposito DESC)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_conciliaciones_cuenta ON conciliaciones_bancarias(id_cuenta, fecha_hasta DESC)');

    for (const [name, description] of permissions) {
      await db.query(`
        INSERT INTO permisos (nombre, descripcion)
        VALUES ($1, $2)
        ON CONFLICT (nombre) DO NOTHING
      `, [name, description]);
    }

    await db.query(`
      INSERT INTO roles_permisos (id_rol, id_permiso)
      SELECT r.id_rol, p.id_permiso
      FROM roles r
      CROSS JOIN permisos p
      WHERE r.nombre = 'ADMINISTRADOR'
      ON CONFLICT DO NOTHING
    `);

    await db.query(`
      INSERT INTO roles_permisos (id_rol, id_permiso)
      SELECT r.id_rol, p.id_permiso
      FROM roles r
      JOIN permisos p ON p.nombre IN (
        'BANKS_CRUD',
        'REPORTS_MANAGER_READ',
        'DOCUMENT_CANCEL',
        'SRI_PROCESS'
      )
      WHERE r.nombre = 'CONTADOR'
      ON CONFLICT DO NOTHING
    `);

    await db.query(`
      INSERT INTO roles_permisos (id_rol, id_permiso)
      SELECT r.id_rol, p.id_permiso
      FROM roles r
      JOIN permisos p ON p.nombre IN ('CASH_CLOSE')
      WHERE r.nombre = 'VENDEDOR'
      ON CONFLICT DO NOTHING
    `);

    await db.query('COMMIT');
    console.log('Phase 20 completada: preproduccion lista.');
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error en migracion Phase 20:', error);
    throw error;
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) {
  migratePhase20Preproduction().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = migratePhase20Preproduction;
