const { Pool } = require('pg');
require('dotenv').config();
const bcrypt = require('bcryptjs');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function migrate() {
  console.log('Iniciando migración de la Fase 1: Núcleo del Sistema...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Crear tabla de roles
    console.log('Creando tabla de roles...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id_rol SERIAL PRIMARY KEY,
        nombre VARCHAR(50) UNIQUE NOT NULL,
        descripcion TEXT,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Crear tabla de usuarios
    console.log('Creando tabla de usuarios...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id_usuario SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        id_rol INT REFERENCES roles(id_rol),
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Crear tabla de permisos
    console.log('Creando tabla de permisos...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS permisos (
        id_permiso SERIAL PRIMARY KEY,
        nombre VARCHAR(100) UNIQUE NOT NULL,
        descripcion TEXT
      );
    `);

    // 4. Crear tabla relacional roles_permisos
    console.log('Creando tabla roles_permisos...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles_permisos (
        id_rol INT REFERENCES roles(id_rol) ON DELETE CASCADE,
        id_permiso INT REFERENCES permisos(id_permiso) ON DELETE CASCADE,
        PRIMARY KEY (id_rol, id_permiso)
      );
    `);

    // 5. Crear tabla de empresas
    console.log('Creando tabla de empresas...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS empresas (
        id_empresa SERIAL PRIMARY KEY,
        ruc VARCHAR(13) UNIQUE NOT NULL,
        razon_social VARCHAR(255) NOT NULL,
        nombre_comercial VARCHAR(255),
        direccion_matriz VARCHAR(255) NOT NULL,
        obligado_contabilidad BOOLEAN DEFAULT FALSE,
        contribuyente_especial VARCHAR(50),
        regimen VARCHAR(100) DEFAULT 'RIMPE',
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Crear tabla de sucursales
    console.log('Creando tabla de sucursales...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS sucursales (
        id_sucursal SERIAL PRIMARY KEY,
        id_empresa INT REFERENCES empresas(id_empresa) ON DELETE CASCADE,
        codigo_establecimiento VARCHAR(3) NOT NULL,
        punto_emision VARCHAR(3) NOT NULL,
        nombre VARCHAR(150) NOT NULL,
        direccion VARCHAR(255) NOT NULL,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. Sembrar Datos Iniciales (Seeders)
    console.log('Sembrando roles...');
    await client.query(`
      INSERT INTO roles (nombre, descripcion) VALUES 
      ('ADMINISTRADOR', 'Acceso total y configuración del sistema.'),
      ('VENDEDOR', 'Acceso a facturación y consulta de productos/clientes.'),
      ('CONTADOR', 'Acceso a reportes, facturas emitidas y consulta.')
      ON CONFLICT (nombre) DO NOTHING;
    `);

    const adminRoleRes = await client.query("SELECT id_rol FROM roles WHERE nombre = 'ADMINISTRADOR'");
    const adminRoleId = adminRoleRes.rows[0].id_rol;

    console.log('Sembrando permisos iniciales...');
    const permissions = [
      ['DASHBOARD_READ', 'Acceso al panel de estadísticas'],
      ['USERS_CRUD', 'Administración completa de usuarios'],
      ['ROLES_CRUD', 'Administración completa de roles y permisos'],
      ['COMPANY_UPDATE', 'Modificación de la configuración de la empresa'],
      ['BRANCHES_CRUD', 'Administración completa de sucursales y puntos de emisión'],
      ['CLIENTS_CRUD', 'Administración completa del padrón de clientes'],
      ['PRODUCTS_CRUD', 'Administración completa del catálogo de productos'],
      ['INVOICES_CRUD', 'Creación y anulación de facturas comerciales'],
      ['SRI_ELECTRONIC_BILLING', 'Firma y envío de facturas electrónicas al SRI']
    ];

    for (const [pName, pDesc] of permissions) {
      await client.query(`
        INSERT INTO permisos (nombre, descripcion) 
        VALUES ($1, $2) 
        ON CONFLICT (nombre) DO NOTHING
      `, [pName, pDesc]);
    }

    console.log('Asociando todos los permisos al rol de ADMINISTRADOR...');
    await client.query(`
      INSERT INTO roles_permisos (id_rol, id_permiso)
      SELECT ${adminRoleId}, id_permiso FROM permisos
      ON CONFLICT DO NOTHING;
    `);

    console.log('Creando usuario administrador predeterminado...');
    const passwordHash = await bcrypt.hash('admin', 10);
    await client.query(`
      INSERT INTO usuarios (username, password_hash, email, id_rol) 
      VALUES ('admin', $1, 'admin@facturapro.com.ec', $2)
      ON CONFLICT (username) DO NOTHING;
    `, [passwordHash, adminRoleId]);

    console.log('Creando empresa de demostración...');
    await client.query(`
      INSERT INTO empresas (ruc, razon_social, nombre_comercial, direccion_matriz, obligado_contabilidad)
      VALUES ('1792345678001', 'FACTURAPRO S.A. ECUADOR', 'FacturaPro', 'Av. Amazonas N24-24 y Av. Colón, Quito', true)
      ON CONFLICT (ruc) DO NOTHING;
    `);

    const companyRes = await client.query("SELECT id_empresa FROM empresas WHERE ruc = '1792345678001'");
    if (companyRes.rows.length > 0) {
      const companyId = companyRes.rows[0].id_empresa;
      console.log('Creando establecimiento / sucursal predeterminada (001-001)...');
      await client.query(`
        INSERT INTO sucursales (id_empresa, codigo_establecimiento, punto_emision, nombre, direccion)
        VALUES ($1, '001', '001', 'Matriz Centro Norte', 'Av. Amazonas N24-24 y Av. Colón, Quito')
        ON CONFLICT DO NOTHING;
      `, [companyId]);
    }

    await client.query('COMMIT');
    console.log('¡Migración y siembra de la Fase 1 completada con éxito!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error durante la migración de la Fase 1:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
