const db = require('./db');

const createTablesSQL = `
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  identification_type VARCHAR(20) NOT NULL, -- 'cedula', 'ruc', 'pasaporte', 'consumidor_final'
  identification_number VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  address VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  type VARCHAR(20) NOT NULL, -- 'producto', 'servicio'
  price DECIMAL(10, 2) NOT NULL,
  iva_rate VARCHAR(10) NOT NULL, -- '0', '15', 'exento', 'no_objeto'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

async function initDB() {
  try {
    console.log('Iniciando creación de tablas en PostgreSQL...');
    await db.query(createTablesSQL);
    console.log('¡Tablas creadas exitosamente!');
    process.exit(0);
  } catch (error) {
    console.error('Error al inicializar la base de datos:', error);
    process.exit(1);
  }
}

initDB();
