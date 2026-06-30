const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. Obtener todas las categorías (GET /api/products/categories)
router.get('/categories', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM categorias WHERE activo = TRUE ORDER BY nombre ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({ error: 'Error al obtener categorías de la base de datos.' });
  }
});

// 2. Obtener todos los impuestos (GET /api/products/taxes)
router.get('/taxes', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM impuestos WHERE activo = TRUE ORDER BY porcentaje ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener impuestos:', error);
    res.status(500).json({ error: 'Error al obtener impuestos de la base de datos.' });
  }
});

// 3. Obtener todos los productos (GET /api/products)
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT p.*, c.nombre as categoria_nombre, i.nombre as impuesto_nombre, i.porcentaje as impuesto_porcentaje 
      FROM productos p
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      LEFT JOIN impuestos i ON p.id_impuesto = i.id_impuesto
      ORDER BY p.id_producto DESC
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ error: 'Error al obtener productos de la base de datos.' });
  }
});

// 4. Obtener un producto por su ID (GET /api/products/:id)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('SELECT * FROM productos WHERE id_producto = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener producto:', error);
    res.status(500).json({ error: 'Error al obtener el producto.' });
  }
});

// 5. Registrar un nuevo producto (POST /api/products)
router.post('/', async (req, res) => {
  const {
    codigo,
    sku,
    nombre,
    descripcion,
    id_categoria,
    precio_compra,
    precio_venta,
    id_impuesto,
    stock_actual,
    stock_minimo,
    activo
  } = req.body;

  try {
    // Si no se envía el código, se autogenera una serie secuencial de 6 dígitos tipo 000001
    const query = `
      INSERT INTO productos (
        codigo, sku, nombre, descripcion, id_categoria, 
        precio_compra, precio_venta, id_impuesto, stock_actual, stock_minimo, activo
      )
      VALUES (
        COALESCE($1, (SELECT LPAD(CAST(COALESCE(MAX(id_producto), 0) + 1 AS VARCHAR), 6, '0') FROM productos)),
        $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )
      RETURNING *
    `;
    const result = await db.query(query, [
      codigo || null,
      sku || null,
      nombre,
      descripcion || '',
      id_categoria ? parseInt(id_categoria, 10) : null,
      precio_compra,
      precio_venta,
      id_impuesto ? parseInt(id_impuesto, 10) : null,
      stock_actual || 0.00,
      stock_minimo || 0.00,
      activo !== undefined ? activo : true
    ]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al registrar producto:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ya existe un producto con el mismo código o SKU.' });
    }
    res.status(500).json({ error: 'Error al registrar el producto.' });
  }
});

// 6. Modificar un producto existente (PUT /api/products/:id)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    codigo,
    sku,
    nombre,
    descripcion,
    id_categoria,
    precio_compra,
    precio_venta,
    id_impuesto,
    stock_actual,
    stock_minimo,
    activo
  } = req.body;

  try {
    const query = `
      UPDATE productos
      SET codigo = $1,
          sku = $2,
          nombre = $3,
          descripcion = $4,
          id_categoria = $5,
          precio_compra = $6,
          precio_venta = $7,
          id_impuesto = $8,
          stock_actual = $9,
          stock_minimo = $10,
          activo = $11,
          updated_at = CURRENT_TIMESTAMP
      WHERE id_producto = $12
      RETURNING *
    `;
    const result = await db.query(query, [
      codigo || null,
      sku || null,
      nombre,
      descripcion || '',
      id_categoria ? parseInt(id_categoria, 10) : null,
      precio_compra,
      precio_venta,
      id_impuesto ? parseInt(id_impuesto, 10) : null,
      stock_actual || 0.00,
      stock_minimo || 0.00,
      activo !== undefined ? activo : true,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ya existe otro producto con el mismo código o SKU.' });
    }
    res.status(500).json({ error: 'Error al actualizar el producto.' });
  }
});

// 7. Eliminar un producto (DELETE /api/products/:id)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM productos WHERE id_producto = $1 RETURNING id_producto', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    res.json({ message: 'Producto eliminado correctamente.', id_producto: result.rows[0].id_producto });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    res.status(500).json({ error: 'Error al eliminar el producto.' });
  }
});

module.exports = router;
