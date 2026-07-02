const express = require('express');
const router = express.Router();
const db = require('../db');
const { writeAudit } = require('../audit');

// 1. Obtener listado de compras (GET /api/purchases)
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT c.*, p.nombre AS proveedor_nombre, p.identificacion AS proveedor_identificacion, u.username
      FROM compras c
      JOIN proveedores p ON c.id_proveedor = p.id_proveedor
      JOIN usuarios u ON c.id_usuario = u.id_usuario
      ORDER BY c.fecha_compra DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener compras:', error);
    res.status(500).json({ error: 'Error al consultar las compras.' });
  }
});

// 2. Obtener detalle de una compra (GET /api/purchases/:id)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const compraRes = await db.query(`
      SELECT c.*, p.nombre AS proveedor_nombre, p.identificacion AS proveedor_identificacion,
             p.email AS proveedor_email, p.telefono AS proveedor_telefono, p.direccion AS proveedor_direccion,
             u.username
      FROM compras c
      JOIN proveedores p ON c.id_proveedor = p.id_proveedor
      JOIN usuarios u ON c.id_usuario = u.id_usuario
      WHERE c.id_compra = $1
    `, [id]);

    if (compraRes.rows.length === 0) {
      return res.status(404).json({ error: 'Compra no encontrada.' });
    }

    const detallesRes = await db.query(`
      SELECT cd.*, p.nombre AS producto_nombre, p.codigo AS producto_codigo
      FROM compra_detalles cd
      JOIN productos p ON cd.id_producto = p.id_producto
      WHERE cd.id_compra = $1
      ORDER BY cd.id_detalle ASC
    `, [id]);

    res.json({
      purchase: compraRes.rows[0],
      details: detallesRes.rows,
    });
  } catch (error) {
    console.error('Error al obtener detalle de compra:', error);
    res.status(500).json({ error: 'Error al consultar el detalle de la compra.' });
  }
});

// 3. Registrar una nueva compra (POST /api/purchases)
router.post('/', async (req, res) => {
  const {
    numero_factura_compra,
    id_proveedor,
    id_usuario,
    subtotal_iva_cero,
    subtotal_con_iva,
    descuento_total,
    valor_iva,
    total,
    observacion,
    items,
  } = req.body || {};

  if (!numero_factura_compra || !id_proveedor || !id_usuario || !items || items.length === 0) {
    return res.status(400).json({ error: 'Faltan datos obligatorios para registrar la compra.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insertar en compras
    const compraRes = await client.query(`
      INSERT INTO compras (
        numero_factura_compra, id_proveedor, id_usuario,
        subtotal_iva_cero, subtotal_con_iva, descuento_total,
        valor_iva, total, observacion
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      numero_factura_compra,
      id_proveedor,
      id_usuario,
      parseFloat(subtotal_iva_cero || 0),
      parseFloat(subtotal_con_iva || 0),
      parseFloat(descuento_total || 0),
      parseFloat(valor_iva || 0),
      parseFloat(total || 0),
      observacion || '',
    ]);

    const purchase = compraRes.rows[0];

    // 2. Procesar ítems y actualizar stock
    for (const item of items) {
      const { id_producto, cantidad, costo_unitario, precio_total, valor_iva: itemIva } = item;

      // Insertar detalle
      await client.query(`
        INSERT INTO compra_detalles (id_compra, id_producto, cantidad, costo_unitario, precio_total, valor_iva)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        purchase.id_compra,
        id_producto,
        parseFloat(cantidad),
        parseFloat(costo_unitario),
        parseFloat(precio_total),
        parseFloat(itemIva || 0),
      ]);

      // Incrementar stock en productos
      await client.query(`
        UPDATE productos
        SET stock_actual = stock_actual + $1
        WHERE id_producto = $2
      `, [parseFloat(cantidad), id_producto]);

      // Registrar movimiento de inventario
      await client.query(`
        INSERT INTO movimientos_inventario (id_producto, tipo, cantidad, motivo, referencia, id_usuario)
        VALUES ($1, 'INGRESO', $2, 'COMPRA', $3, $4)
      `, [id_producto, parseFloat(cantidad), numero_factura_compra, id_usuario]);
    }

    // 3. Registrar en Auditoría
    await writeAudit(client, {
      entity: 'compras',
      entityId: purchase.id_compra,
      action: 'REGISTRAR_COMPRA',
      userId: id_usuario,
      detail: {
        numero_factura_compra,
        id_proveedor,
        total: purchase.total,
      },
    });

    await client.query('COMMIT');
    res.status(201).json(purchase);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar compra:', error);
    res.status(400).json({ error: error.message || 'Error al procesar el registro de compra.' });
  } finally {
    client.release();
  }
});

module.exports = router;
