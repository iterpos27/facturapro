const db = require('./db');

const migrationSQL = `
-- 1. Renombrar columnas en productos
ALTER TABLE productos RENAME COLUMN codigo_barras TO codigo;
ALTER TABLE productos RENAME COLUMN costo_compra TO precio_compra;

-- 2. Limpiar impuestos anteriores e insertar el listado exacto de la imagen
DELETE FROM productos; -- Limpiar para evitar conflictos con claves foráneas temporales si cambiamos IDs
DELETE FROM impuestos;
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
`;

async function run() {
  try {
    console.log('Ejecutando migración de nombres de columna y semillas de IVA...');
    await db.query(migrationSQL);
    console.log('¡Migración completada exitosamente!');
    process.exit(0);
  } catch (error) {
    console.error('Error durante la migración:', error);
    process.exit(1);
  }
}

run();
