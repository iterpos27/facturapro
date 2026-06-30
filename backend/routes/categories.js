const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. Obtener todas las categorías (GET /api/categories)
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM categorias ORDER BY id_categoria DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({ error: 'Error al obtener categorías de la base de datos.' });
  }
});

// 2. Obtener una categoría por ID (GET /api/categories/:id)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('SELECT * FROM categorias WHERE id_categoria = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener categoría:', error);
    res.status(500).json({ error: 'Error al obtener la categoría.' });
  }
});

// 3. Crear una nueva categoría (POST /api/categories)
router.post('/', async (req, res) => {
  const { nombre, descripcion, activo } = req.body;
  try {
    const query = `
      INSERT INTO categorias (nombre, descripcion, activo)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await db.query(query, [
      nombre,
      descripcion || '',
      activo !== undefined ? activo : true
    ]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al registrar categoría:', error);
    res.status(500).json({ error: 'Error al registrar la categoría.' });
  }
});

// 4. Modificar una categoría existente (PUT /api/categories/:id)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, activo } = req.body;
  try {
    const query = `
      UPDATE categorias
      SET nombre = $1,
          descripcion = $2,
          activo = $3
      WHERE id_categoria = $4
      RETURNING *
    `;
    const result = await db.query(query, [
      nombre,
      descripcion || '',
      activo !== undefined ? activo : true,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar categoría:', error);
    res.status(500).json({ error: 'Error al actualizar la categoría.' });
  }
});

// 5. Eliminar una categoría (DELETE /api/categories/:id)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Si hay productos con esta categoría, se pondrá id_categoria a NULL gracias a ON DELETE SET NULL
    const result = await db.query('DELETE FROM categorias WHERE id_categoria = $1 RETURNING id_categoria', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada.' });
    }
    res.json({ message: 'Categoría eliminada correctamente.', id_categoria: result.rows[0].id_categoria });
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    res.status(500).json({ error: 'Error al eliminar la categoría.' });
  }
});

module.exports = router;
