const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. Obtener todos los clientes (GET /api/clients)
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM clients ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({ error: 'Error al obtener clientes de la base de datos.' });
  }
});

// 2. Obtener un cliente por su ID (GET /api/clients/:id)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('SELECT * FROM clients WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener cliente:', error);
    res.status(500).json({ error: 'Error al obtener el cliente.' });
  }
});

// 3. Registrar un nuevo cliente (POST /api/clients)
router.post('/', async (req, res) => {
  const { 
    name, 
    identification_number, 
    email, 
    phone, 
    address, 
    observation, 
    person_type 
  } = req.body;

  try {
    const query = `
      INSERT INTO clients (name, identification_number, email, phone, address, observation, person_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const result = await db.query(query, [
      name, 
      identification_number, 
      email, 
      phone, 
      address, 
      observation, 
      person_type || 'NATURAL'
    ]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al guardar cliente:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ya existe un cliente con este número de identificación.' });
    }
    res.status(500).json({ error: 'Error al registrar el cliente.' });
  }
});

// 4. Modificar los datos de un cliente existente (PUT /api/clients/:id)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { 
    name, 
    identification_number, 
    email, 
    phone, 
    address, 
    observation, 
    person_type 
  } = req.body;

  try {
    const query = `
      UPDATE clients
      SET name = $1, 
          identification_number = $2, 
          email = $3, 
          phone = $4, 
          address = $5, 
          observation = $6, 
          person_type = $7
      WHERE id = $8
      RETURNING *
    `;
    const result = await db.query(query, [
      name, 
      identification_number, 
      email, 
      phone, 
      address, 
      observation, 
      person_type || 'NATURAL', 
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar cliente:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ya existe otro cliente con este número de identificación.' });
    }
    res.status(500).json({ error: 'Error al actualizar el cliente.' });
  }
});

// 5. Eliminar un cliente por su ID (DELETE /api/clients/:id)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM clients WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado.' });
    }
    res.json({ message: 'Cliente eliminado correctamente.', id: result.rows[0].id });
  } catch (error) {
    console.error('Error al eliminar cliente:', error);
    res.status(500).json({ error: 'Error al eliminar el cliente.' });
  }
});

module.exports = router;
