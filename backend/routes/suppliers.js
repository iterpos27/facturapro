const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. Obtener lista de proveedores (GET /api/suppliers)
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM proveedores ORDER BY nombre ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener proveedores:', error);
    res.status(500).json({ error: 'Error al consultar proveedores de la base de datos.' });
  }
});

// 2. Crear proveedor (POST /api/suppliers)
router.post('/', async (req, res) => {
  const { tipo_identificacion, identificacion, nombre, email, telefono, direccion, activo } = req.body;

  if (!tipo_identificacion || !identificacion || !nombre || !email) {
    return res.status(400).json({ error: 'Tipo, identificación, nombre y correo son obligatorios.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO proveedores (tipo_identificacion, identificacion, nombre, email, telefono, direccion, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tipo_identificacion, identificacion, nombre, email, telefono, direccion, activo !== undefined ? activo : true]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear proveedor:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'La identificación del proveedor ya se encuentra registrada.' });
    }
    res.status(500).json({ error: 'Error al registrar el proveedor.' });
  }
});

// 3. Actualizar proveedor (PUT /api/suppliers/:id)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { tipo_identificacion, identificacion, nombre, email, telefono, direccion, activo } = req.body;

  if (!tipo_identificacion || !identificacion || !nombre || !email) {
    return res.status(400).json({ error: 'Tipo, identificación, nombre y correo son obligatorios.' });
  }

  try {
    const result = await db.query(
      `UPDATE proveedores
       SET tipo_identificacion = $1, identificacion = $2, nombre = $3, email = $4, telefono = $5, direccion = $6, activo = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id_proveedor = $8
       RETURNING *`,
      [tipo_identificacion, identificacion, nombre, email, telefono, direccion, activo, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proveedor no encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar proveedor:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'La identificación ingresada ya le pertenece a otro proveedor.' });
    }
    res.status(500).json({ error: 'Error al actualizar el proveedor.' });
  }
});

// 4. Eliminar proveedor (DELETE /api/suppliers/:id)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM proveedores WHERE id_proveedor = $1 RETURNING id_proveedor', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proveedor no encontrado.' });
    }
    res.json({ message: 'Proveedor eliminado correctamente.', id_proveedor: result.rows[0].id_proveedor });
  } catch (error) {
    console.error('Error al eliminar proveedor:', error);
    res.status(500).json({ error: 'Error al eliminar el proveedor de la base de datos.' });
  }
});

module.exports = router;
