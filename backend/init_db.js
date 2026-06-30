const db = require('./db');

const createTablesSQL = `
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  identification_number VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  address VARCHAR(200),
  observation TEXT,
  person_type VARCHAR(20) DEFAULT 'NATURAL',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categorias (
  id_categoria SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS impuestos (
  id_impuesto SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  porcentaje DECIMAL(5, 2) NOT NULL,
  codigo_sri VARCHAR(10),
  activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS productos (
  id_producto SERIAL PRIMARY KEY,
  codigo VARCHAR(50) UNIQUE,
  sku VARCHAR(50) UNIQUE,
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT,
  id_categoria INT,
  precio_compra DECIMAL(12, 4) NOT NULL,
  precio_venta DECIMAL(12, 4) NOT NULL,
  id_impuesto INT,
  stock_actual DECIMAL(12, 2) DEFAULT 0.00,
  stock_minimo DECIMAL(12, 2) DEFAULT 0.00,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_categoria) REFERENCES categorias(id_categoria) ON DELETE SET NULL,
  FOREIGN KEY (id_impuesto) REFERENCES impuestos(id_impuesto) ON DELETE SET NULL
);
`;

async function initDB() {
  try {
    console.log('Iniciando creación de tablas en PostgreSQL...');
    await db.query(createTablesSQL);
    console.log('¡Tablas creadas exitosamente!');

    // Sembrar categorías si está vacía
    const catCheck = await db.query('SELECT count(*) FROM categorias');
    if (parseInt(catCheck.rows[0].count, 10) === 0) {
      console.log('Sembrando categorías iniciales...');
      await db.query(`
        INSERT INTO categorias (nombre, descripcion) VALUES 
        ('General', 'Categoría general por defecto'),
        ('Servicios', 'Servicios profesionales o técnicos'),
        ('Alimentos', 'Productos alimenticios y bebidas'),
        ('Tecnología', 'Equipos tecnológicos y accesorios');
      `);
    }

    // Sembrar impuestos si está vacía
    const impCheck = await db.query('SELECT count(*) FROM impuestos');
    if (parseInt(impCheck.rows[0].count, 10) === 0) {
      console.log('Sembrando impuestos iniciales...');
      await db.query(`
        INSERT INTO impuestos (nombre, porcentaje, codigo_sri) VALUES 
        ('IVA (15%)', 15.00, '2'),
        ('IVA (14%)', 14.00, '3'),
        ('IVA (13%)', 13.00, '10'),
        ('IVA (12%)', 12.00, '2'),
        ('IVA (0%)', 0.00, '0'),
        ('IVA (5%)', 5.00, '5'),
        ('EXENTO DE IVA', 0.00, '6'),
        ('NO OBJETO DE IMPUESTO', 0.00, '7'),
        ('IVA DIFERENCIADO', 0.00, '8');
      `);
    }

    console.log('¡Inicialización de base de datos completa!');
    process.exit(0);
  } catch (error) {
    console.error('Error al inicializar la base de datos:', error);
    process.exit(1);
  }
}

initDB();
