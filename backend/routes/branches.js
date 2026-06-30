const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. Obtener lista de sucursales (GET /api/branches)
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT s.*, e.razon_social as empresa_nombre
      FROM sucursales s
      JOIN empresas e ON s.id_empresa = e.id_empresa
      ORDER BY s.codigo_establecimiento ASC, s.punto_emision ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener sucursales:', error);
    res.status(500).json({ error: 'Error al consultar las sucursales de la base de datos.' });
  }
});

// 2. Crear una nueva sucursal (POST /api/branches)
router.post('/', async (req, res) => {
  const { codigo_establecimiento, punto_emision, nombre, direccion, activo } = req.body;

  if (!codigo_establecimiento || !punto_emision || !nombre || !direccion) {
    return res.status(400).json({ error: 'Todos los campos requeridos deben ser completados.' });
  }

  try {
    // Obtener la empresa activa
    const companyRes = await db.query('SELECT id_empresa FROM empresas LIMIT 1');
    if (companyRes.rows.length === 0) {
      return res.status(400).json({ error: 'Debe configurar primero los datos de la empresa.' });
    }
    const id_empresa = companyRes.rows[0].id_empresa;

    const result = await db.query(
      `INSERT INTO sucursales (id_empresa, codigo_establecimiento, punto_emision, nombre, direccion, activo)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id_empresa, codigo_establecimiento, punto_emision, nombre, direccion, activo !== undefined ? activo : true]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear sucursal:', error);
    res.status(500).json({ error: 'Error al registrar la sucursal/punto de emisión.' });
  }
});

// 3. Actualizar una sucursal (PUT /api/branches/:id)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { codigo_establecimiento, punto_emision, nombre, direccion, activo } = req.body;

  if (!codigo_establecimiento || !punto_emision || !nombre || !direccion) {
    return res.status(400).json({ error: 'Todos los campos obligatorios deben completarse.' });
  }

  try {
    const result = await db.query(
      `UPDATE sucursales 
       SET codigo_establecimiento = $1, punto_emision = $2, nombre = $3, direccion = $4, activo = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id_sucursal = $6
       RETURNING *`,
      [codigo_establecimiento, punto_emision, nombre, direccion, activo, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sucursal no encontrada.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar sucursal:', error);
    res.status(500).json({ error: 'Error al actualizar la sucursal.' });
  }
});

// 4. Eliminar una sucursal (DELETE /api/branches/:id)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM sucursales WHERE id_sucursal = $1 RETURNING id_sucursal', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sucursal no encontrada.' });
    }
    res.json({ message: 'Sucursal eliminada correctamente.', id_sucursal: result.rows[0].id_sucursal });
  } catch (error) {
    console.error('Error al eliminar sucursal:', error);
    res.status(500).json({ error: 'Error al eliminar la sucursal de la base de datos.' });
  }
});

module.exports = router;
