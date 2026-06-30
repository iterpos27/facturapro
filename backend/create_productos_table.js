const db = require('./db');

const schemaSQL = `
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
    codigo_barras VARCHAR(50) UNIQUE,
    sku VARCHAR(50) UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    id_categoria INT,
    costo_compra DECIMAL(12, 4) NOT NULL,
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

async function setup() {
  try {
    console.log('Creando tablas categorias, impuestos y productos...');
    await db.query(schemaSQL);
    console.log('¡Tablas creadas exitosamente!');

    // Sembrar Categorías si están vacías
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

    // Sembrar Impuestos si están vacíos
    const impCheck = await db.query('SELECT count(*) FROM impuestos');
    if (parseInt(impCheck.rows[0].count, 10) === 0) {
      console.log('Sembrando impuestos iniciales (Ecuador SRI)...');
      await db.query(`
        INSERT INTO impuestos (nombre, porcentaje, codigo_sri) VALUES 
        ('IVA 15%', 15.00, '2'),
        ('IVA 0%', 0.00, '0'),
        ('Exento de IVA', 0.00, '6'),
        ('No Objeto de Impuesto', 0.00, '7');
      `);
    }

    console.log('¡Inicialización del módulo de productos completa!');
    process.exit(0);
  } catch (error) {
    console.error('Error al configurar las tablas del módulo de productos:', error);
    process.exit(1);
  }
}

setup();
