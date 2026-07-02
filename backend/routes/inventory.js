const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('./auth');

// Proteger todas las rutas de inventario con autenticación
router.use(authenticateToken);

// 1. Obtener lista de movimientos de inventario (GET /api/inventory/movements)
router.get('/movements', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT m.*, p.nombre as producto_nombre, p.codigo as producto_codigo, u.username
      FROM movimientos_inventario m
      JOIN productos p ON m.id_producto = p.id_producto
      LEFT JOIN usuarios u ON m.id_usuario = u.id_usuario
      ORDER BY m.fecha DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener movimientos de stock:', error);
    res.status(500).json({ error: 'Error al consultar movimientos de inventario.' });
  }
});

router.get('/kardex/:id_producto', async (req, res) => {
  try {
    const productRes = await db.query(`
      SELECT id_producto, codigo, nombre, stock_actual, stock_minimo, precio_compra, precio_venta
      FROM productos
      WHERE id_producto = $1
    `, [req.params.id_producto]);

    if (productRes.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    const movementsRes = await db.query(`
      SELECT m.*, u.username
      FROM movimientos_inventario m
      LEFT JOIN usuarios u ON m.id_usuario = u.id_usuario
      WHERE m.id_producto = $1
      ORDER BY m.fecha ASC, m.id_movimiento ASC
    `, [req.params.id_producto]);

    let runningStock = 0;
    const movements = movementsRes.rows.map((movement) => {
      const quantity = Number(movement.cantidad || 0);
      const signedQuantity = movement.tipo === 'INGRESO' ? quantity : -quantity;
      runningStock += signedQuantity;
      return {
        ...movement,
        entrada: movement.tipo === 'INGRESO' ? quantity : 0,
        salida: movement.tipo === 'EGRESO' ? quantity : 0,
        saldo_calculado: runningStock,
      };
    });

    res.json({ product: productRes.rows[0], movements });
  } catch (error) {
    console.error('Error al consultar kardex:', error);
    res.status(500).json({ error: 'Error al consultar el kardex del producto.' });
  }
});

// 2. Registrar movimiento de stock y actualizar inventario del producto (POST /api/inventory/movements)
router.post('/movements', async (req, res) => {
  const { id_producto, tipo, cantidad, motivo, referencia, id_usuario } = req.body;
  const actorId = req.user?.id_usuario || id_usuario;

  if (!id_producto || !tipo || !cantidad || !motivo) {
    return res.status(400).json({ error: 'El producto, tipo de movimiento, cantidad y motivo son obligatorios.' });
  }

  const cantidadNum = parseFloat(cantidad);
  if (isNaN(cantidadNum) || cantidadNum <= 0) {
    return res.status(400).json({ error: 'La cantidad debe ser un número mayor a 0.' });
  }

  if (tipo !== 'INGRESO' && tipo !== 'EGRESO') {
    return res.status(400).json({ error: 'El tipo de movimiento debe ser INGRESO o EGRESO.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verificar existencia y stock actual del producto
    const prodRes = await client.query('SELECT stock_actual, nombre FROM productos WHERE id_producto = $1', [id_producto]);
    if (prodRes.rows.length === 0) {
      throw new Error('Producto no encontrado.');
    }

    const currentStock = parseFloat(prodRes.rows[0].stock_actual);

    // 2. Si es egreso, validar que no quede stock negativo (a menos que se permita sobregiro)
    if (tipo === 'EGRESO' && currentStock < cantidadNum) {
      throw new Error(`Stock insuficiente para "${prodRes.rows[0].nombre}". Stock actual: ${currentStock}, Cantidad requerida: ${cantidadNum}`);
    }

    // 3. Registrar el movimiento en movimientos_inventario
    const insQuery = `
      INSERT INTO movimientos_inventario (id_producto, tipo, cantidad, motivo, referencia, id_usuario)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const movResult = await client.query(insQuery, [
      parseInt(id_producto, 10),
      tipo,
      cantidadNum,
      motivo,
      referencia || null,
      actorId ? parseInt(actorId, 10) : null
    ]);

    // 4. Actualizar el stock_actual del producto en la tabla productos
    const stockQuery = tipo === 'INGRESO'
      ? 'UPDATE productos SET stock_actual = stock_actual + $1 WHERE id_producto = $2'
      : 'UPDATE productos SET stock_actual = stock_actual - $1 WHERE id_producto = $2';
    
    await client.query(stockQuery, [cantidadNum, parseInt(id_producto, 10)]);

    await client.query('COMMIT');
    res.status(201).json(movResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar movimiento de inventario:', error);
    res.status(400).json({ error: error.message || 'Error al procesar el movimiento de inventario.' });
  } finally {
    client.release();
  }
});

module.exports = router;
