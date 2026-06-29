const express = require('express');
const router = express.Router();
const db = require('../db');

// Función de validación de Cédula y RUC de Ecuador (SRI)
function validarIdentificacion(tipo, numero) {
  if (tipo === 'consumidor_final') return numero === '9999999999999';
  if (!/^\d+$/.test(numero)) return false;

  if (tipo === 'cedula') {
    if (numero.length !== 10) return false;
    const prov = parseInt(numero.substring(0, 2), 10);
    if (prov < 1 || prov > 24) return false;

    const d = numero.split('').map(Number);
    let suma = 0;
    for (let i = 0; i < 9; i++) {
      let val = d[i];
      if (i % 2 === 0) {
        val = val * 2;
        if (val > 9) val -= 9;
      }
      suma += val;
    }
    const verificador = (10 - (suma % 10)) % 10;
    return verificador === d[9];
  }

  if (tipo === 'ruc') {
    if (numero.length !== 13) return false;
    const prov = parseInt(numero.substring(0, 2), 10);
    if (prov < 1 || prov > 24) return false;

    const tercerDigito = parseInt(numero[2], 10);
    if (tercerDigito === 9) {
      // Persona jurídica
      const coeficientes = [4, 3, 2, 7, 6, 5, 4, 3, 2];
      let suma = 0;
      for (let i = 0; i < 9; i++) {
        suma += parseInt(numero[i], 10) * coeficientes[i];
      }
      const residuo = suma % 11;
      const verificador = residuo === 0 ? 0 : 11 - residuo;
      return verificador === parseInt(numero[9], 10) && numero.substring(10, 13) !== '000';
    } else if (tercerDigito === 6) {
      // Entidad pública
      const coeficientes = [3, 2, 7, 6, 5, 4, 3, 2];
      let suma = 0;
      for (let i = 0; i < 8; i++) {
        suma += parseInt(numero[i], 10) * coeficientes[i];
      }
      const residuo = suma % 11;
      const verificador = residuo === 0 ? 0 : 11 - residuo;
      return verificador === parseInt(numero[8], 10) && numero.substring(9, 13) !== '0000';
    } else if (tercerDigito < 6) {
      // Persona natural (cédula + 001)
      const cedula = numero.substring(0, 10);
      return validarIdentificacion('cedula', cedula) && numero.substring(10, 13) === '001';
    }
    return false;
  }

  if (tipo === 'pasaporte') {
    return numero.length >= 5 && numero.length <= 20;
  }

  return false;
}

// 1. Obtener todos los clientes (GET /api/clients)
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM clients ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({ error: 'Error al obtener clientes de la base de datos.' });
  }
});

// 2. Obtener un cliente por ID (GET /api/clients/:id)
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

// 3. Registrar un cliente (POST /api/clients)
router.post('/', async (req, res) => {
  const { name, identification_type, identification_number, email, phone, address } = req.body;

  if (!name || !identification_type || !identification_number || !email) {
    return res.status(400).json({ error: 'Los campos name, identification_type, identification_number y email son obligatorios.' });
  }

  if (!validarIdentificacion(identification_type, identification_number)) {
    return res.status(400).json({ error: `Identificación inválida o mal formateada para el tipo: ${identification_type}.` });
  }

  try {
    // Validar unicidad de identificación
    const duplicate = await db.query('SELECT id FROM clients WHERE identification_number = $1', [identification_number]);
    if (duplicate.rows.length > 0) {
      return res.status(400).json({ error: 'Ya existe un cliente con este número de identificación.' });
    }

    const query = `
      INSERT INTO clients (name, identification_type, identification_number, email, phone, address)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await db.query(query, [name, identification_type, identification_number, email, phone, address]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al guardar cliente:', error);
    res.status(500).json({ error: 'Error al registrar el cliente.' });
  }
});

// 4. Modificar un cliente (PUT /api/clients/:id)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, identification_type, identification_number, email, phone, address } = req.body;

  if (!name || !identification_type || !identification_number || !email) {
    return res.status(400).json({ error: 'Los campos name, identification_type, identification_number y email son obligatorios.' });
  }

  if (!validarIdentificacion(identification_type, identification_number)) {
    return res.status(400).json({ error: `Identificación inválida o mal formateada para el tipo: ${identification_type}.` });
  }

  try {
    // Validar que no choque con la identificación de otro cliente
    const duplicate = await db.query('SELECT id FROM clients WHERE identification_number = $1 AND id <> $2', [identification_number, id]);
    if (duplicate.rows.length > 0) {
      return res.status(400).json({ error: 'Ya existe otro cliente con este número de identificación.' });
    }

    const query = `
      UPDATE clients
      SET name = $1, identification_type = $2, identification_number = $3, email = $4, phone = $5, address = $6
      WHERE id = $7
      RETURNING *
    `;
    const result = await db.query(query, [name, identification_type, identification_number, email, phone, address, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar cliente:', error);
    res.status(500).json({ error: 'Error al actualizar el cliente.' });
  }
});

// 5. Eliminar un cliente (DELETE /api/clients/:id)
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
