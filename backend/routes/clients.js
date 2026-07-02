const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('./auth');

// Proteger todas las rutas de clientes con autenticación
router.use(authenticateToken);

const CONSUMIDOR_FINAL_ID = '9999999999999';

function validateCedulaEcuador(value) {
  if (!/^\d{10}$/.test(value)) return false;
  const province = parseInt(value.slice(0, 2), 10);
  const thirdDigit = parseInt(value[2], 10);

  if (province < 1 || province > 24 || thirdDigit > 5) return false;

  const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  const total = coefficients.reduce((sum, coefficient, index) => {
    let result = parseInt(value[index], 10) * coefficient;
    if (result >= 10) result -= 9;
    return sum + result;
  }, 0);

  const verifier = (10 - (total % 10)) % 10;
  return verifier === parseInt(value[9], 10);
}

function validateRucEcuador(value) {
  if (!/^\d{13}$/.test(value)) return false;
  if (value === CONSUMIDOR_FINAL_ID) return true;

  const province = parseInt(value.slice(0, 2), 10);
  const thirdDigit = parseInt(value[2], 10);

  if (province < 1 || province > 24) return false;

  if (thirdDigit < 6) {
    return validateCedulaEcuador(value.slice(0, 10)) && value.slice(10) !== '000';
  }

  if (thirdDigit === 6) {
    const coefficients = [3, 2, 7, 6, 5, 4, 3, 2];
    const total = coefficients.reduce((sum, coefficient, index) => sum + parseInt(value[index], 10) * coefficient, 0);
    const verifier = 11 - (total % 11);
    const expected = verifier === 11 ? 0 : verifier;
    return expected === parseInt(value[8], 10) && value.slice(9) !== '0000';
  }

  if (thirdDigit === 9) {
    const coefficients = [4, 3, 2, 7, 6, 5, 4, 3, 2];
    const total = coefficients.reduce((sum, coefficient, index) => sum + parseInt(value[index], 10) * coefficient, 0);
    const verifier = 11 - (total % 11);
    const expected = verifier === 11 ? 0 : verifier;
    return expected === parseInt(value[9], 10) && value.slice(10) !== '000';
  }

  return false;
}

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

  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanIdentification = typeof identification_number === 'string' ? identification_number.trim() : '';
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const cleanPhone = typeof phone === 'string' ? phone.trim() : null;
  const cleanAddress = typeof address === 'string' ? address.trim() : null;
  const cleanObservation = typeof observation === 'string' ? observation.trim() : null;
  const cleanPersonType = person_type === 'JURIDICA' ? 'JURIDICA' : 'NATURAL';

  if (!cleanName || !cleanIdentification || !cleanEmail) {
    return res.status(400).json({ error: 'Nombre, identificacion y correo son obligatorios.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: 'El correo electronico no tiene un formato valido.' });
  }

  if (cleanIdentification !== CONSUMIDOR_FINAL_ID && cleanIdentification !== '9999999999') {
    if (cleanIdentification.length === 10) {
      if (!validateCedulaEcuador(cleanIdentification)) {
        return res.status(400).json({ error: 'La cedula ecuatoriana no es valida.' });
      }
    } else if (cleanIdentification.length === 13) {
      if (!validateRucEcuador(cleanIdentification)) {
        return res.status(400).json({ error: 'El RUC ecuatoriano no es valido.' });
      }
    } else {
      if (!/^[a-zA-Z0-9]+$/.test(cleanIdentification)) {
        return res.status(400).json({ error: 'La identificación debe ser alfanumérica válida.' });
      }
    }
  }

  try {
    const query = `
      INSERT INTO clients (name, identification_number, email, phone, address, observation, person_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const result = await db.query(query, [
      cleanName, 
      cleanIdentification, 
      cleanEmail, 
      cleanPhone, 
      cleanAddress, 
      cleanObservation, 
      cleanPersonType
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

  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanIdentification = typeof identification_number === 'string' ? identification_number.trim() : '';
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const cleanPhone = typeof phone === 'string' ? phone.trim() : null;
  const cleanAddress = typeof address === 'string' ? address.trim() : null;
  const cleanObservation = typeof observation === 'string' ? observation.trim() : null;
  const cleanPersonType = person_type === 'JURIDICA' ? 'JURIDICA' : 'NATURAL';

  if (!cleanName || !cleanIdentification || !cleanEmail) {
    return res.status(400).json({ error: 'Nombre, identificacion y correo son obligatorios.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: 'El correo electronico no tiene un formato valido.' });
  }

  if (cleanIdentification !== CONSUMIDOR_FINAL_ID && cleanIdentification !== '9999999999') {
    if (cleanIdentification.length === 10) {
      if (!validateCedulaEcuador(cleanIdentification)) {
        return res.status(400).json({ error: 'La cedula ecuatoriana no es valida.' });
      }
    } else if (cleanIdentification.length === 13) {
      if (!validateRucEcuador(cleanIdentification)) {
        return res.status(400).json({ error: 'El RUC ecuatoriano no es valido.' });
      }
    } else {
      if (!/^[a-zA-Z0-9]+$/.test(cleanIdentification)) {
        return res.status(400).json({ error: 'La identificación debe ser alfanumérica válida.' });
      }
    }
  }

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
      cleanName, 
      cleanIdentification, 
      cleanEmail, 
      cleanPhone, 
      cleanAddress, 
      cleanObservation, 
      cleanPersonType, 
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
