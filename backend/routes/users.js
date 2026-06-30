const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');

// 1. Obtener lista de usuarios (GET /api/users)
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT u.id_usuario, u.username, u.email, u.id_rol, u.activo, u.created_at, r.nombre as rol_nombre
      FROM usuarios u
      JOIN roles r ON u.id_rol = r.id_rol
      ORDER BY u.id_usuario ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios de la base de datos.' });
  }
});

// 2. Obtener lista de roles para dropdown (GET /api/users/roles)
router.get('/roles', async (req, res) => {
  try {
    const result = await db.query('SELECT id_rol, nombre, descripcion FROM roles WHERE activo = true ORDER BY nombre ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener roles:', error);
    res.status(500).json({ error: 'Error al obtener los roles.' });
  }
});

// 3. Crear usuario (POST /api/users)
router.post('/', async (req, res) => {
  const { username, email, password, id_rol, activo } = req.body;

  if (!username || !email || !password || !id_rol) {
    return res.status(400).json({ error: 'Todos los campos obligatorios deben completarse.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO usuarios (username, email, password_hash, id_rol, activo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id_usuario, username, email, id_rol, activo`,
      [username, email, passwordHash, parseInt(id_rol, 10), activo !== undefined ? activo : true]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear usuario:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'El nombre de usuario o correo electrónico ya está registrado.' });
    }
    res.status(500).json({ error: 'Error al registrar el usuario.' });
  }
});

// 4. Actualizar usuario (PUT /api/users/:id)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { username, email, password, id_rol, activo } = req.body;

  if (!username || !email || !id_rol) {
    return res.status(400).json({ error: 'Los campos username, email y rol son requeridos.' });
  }

  try {
    let result;
    if (password && password.trim() !== '') {
      // Si se provee contraseña, actualizar con hashing
      const passwordHash = await bcrypt.hash(password, 10);
      result = await db.query(
        `UPDATE usuarios 
         SET username = $1, email = $2, password_hash = $3, id_rol = $4, activo = $5, updated_at = CURRENT_TIMESTAMP
         WHERE id_usuario = $6
         RETURNING id_usuario, username, email, id_rol, activo`,
        [username, email, passwordHash, parseInt(id_rol, 10), activo, id]
      );
    } else {
      // Si no se provee contraseña, conservar la anterior
      result = await db.query(
        `UPDATE usuarios 
         SET username = $1, email = $2, id_rol = $3, activo = $4, updated_at = CURRENT_TIMESTAMP
         WHERE id_usuario = $5
         RETURNING id_usuario, username, email, id_rol, activo`,
        [username, email, parseInt(id_rol, 10), activo, id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'El nombre de usuario o correo electrónico ya existe.' });
    }
    res.status(500).json({ error: 'Error al actualizar el usuario.' });
  }
});

// 5. Eliminar usuario (DELETE /api/users/:id)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Evitar que el administrador se elimine a sí mismo
    const checkAdmin = await db.query('SELECT username FROM usuarios WHERE id_usuario = $1', [id]);
    if (checkAdmin.rows.length > 0 && checkAdmin.rows[0].username === 'admin') {
      return res.status(400).json({ error: 'El usuario administrador principal no puede ser eliminado.' });
    }

    const result = await db.query('DELETE FROM usuarios WHERE id_usuario = $1 RETURNING id_usuario', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    res.json({ message: 'Usuario eliminado correctamente.', id_usuario: result.rows[0].id_usuario });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ error: 'Error al eliminar el usuario de la base de datos.' });
  }
});

module.exports = router;
