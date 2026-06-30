const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper para rellenar ceros del secuencial (e.g. 1 -> 000000001)
const formatSequential = (num) => {
  return String(num).padStart(9, '0');
};

// 1. Obtener lista de facturas emitidas (GET /api/invoices)
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT f.*, c.name as cliente_nombre, c.identification_number as cliente_identificacion, u.username
      FROM facturas f
      JOIN clients c ON f.id_cliente = c.id
      LEFT JOIN usuarios u ON f.id_usuario = u.id_usuario
      ORDER BY f.fecha_emision DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener facturas:', error);
    res.status(500).json({ error: 'Error al consultar facturas emitidas.' });
  }
});

// 2. Obtener detalle de una factura por ID (GET /api/invoices/:id)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Cabecera de la factura
    const invoiceRes = await db.query(`
      SELECT f.*, c.name as cliente_nombre, c.identification_number as cliente_identificacion,
             c.email as cliente_email, c.phone as cliente_telefono, c.address as cliente_direccion,
             s.codigo_establecimiento, s.punto_emision, s.nombre as sucursal_nombre,
             mp.nombre as metodo_pago_nombre
      FROM facturas f
      JOIN clients c ON f.id_cliente = c.id
      JOIN sucursales s ON f.id_sucursal = s.id_sucursal
      LEFT JOIN metodos_pago mp ON f.id_metodo_pago = mp.id_metodo
      WHERE f.id_factura = $1
    `, [id]);

    if (invoiceRes.rows.length === 0) {
      return res.status(404).json({ error: 'Factura no encontrada.' });
    }

    // 2. Detalles de la factura
    const detailsRes = await db.query(`
      SELECT fd.*, p.nombre as producto_nombre, p.codigo as producto_codigo
      FROM factura_detalles fd
      JOIN productos p ON fd.id_producto = p.id_producto
      WHERE fd.id_factura = $1
      ORDER BY fd.id_detalle ASC
    `, [id]);

    res.json({
      invoice: invoiceRes.rows[0],
      details: detailsRes.rows
    });
  } catch (error) {
    console.error('Error al obtener detalle de factura:', error);
    res.status(500).json({ error: 'Error al consultar el detalle de la factura.' });
  }
});

// 3. Registrar una nueva factura (POST /api/invoices)
router.post('/', async (req, res) => {
  const { id_cliente, id_usuario, id_metodo_pago, items } = req.body;

  if (!id_cliente || !id_usuario || !id_metodo_pago || !items || items.length === 0) {
    return res.status(400).json({ error: 'Faltan datos requeridos para emitir la factura.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Buscar la sucursal predeterminada activa
    const branchRes = await client.query(`
      SELECT s.id_sucursal, s.codigo_establecimiento, s.punto_emision 
      FROM sucursales s 
      WHERE s.activo = true 
      LIMIT 1
    `);
    if (branchRes.rows.length === 0) {
      throw new Error('No hay sucursales activas configuradas.');
    }
    const { id_sucursal, codigo_establecimiento, punto_emision } = branchRes.rows[0];

    // 2. Verificar si el usuario tiene una sesión de caja chica ABIERTA
    const boxSessionRes = await client.query(`
      SELECT id_sesion FROM sesiones_caja 
      WHERE id_usuario = $1 AND estado = 'ABIERTA' 
      ORDER BY fecha_apertura DESC LIMIT 1
    `, [id_usuario]);
    if (boxSessionRes.rows.length === 0) {
      throw new Error('Debe tener un turno de caja abierta para poder facturar.');
    }
    const id_sesion_caja = boxSessionRes.rows[0].id_sesion;

    // 3. Generar y bloquear secuencial atómico de facturación
    const seqRes = await client.query(`
      SELECT secuencial_actual FROM secuenciales 
      WHERE id_sucursal = $1 AND tipo_comprobante = 'FACTURA' 
      FOR UPDATE
    `, [id_sucursal]);

    let seqActual = 1;
    if (seqRes.rows.length > 0) {
      seqActual = seqRes.rows[0].secuencial_actual;
      await client.query(`
        UPDATE secuenciales 
        SET secuencial_actual = secuencial_actual + 1 
        WHERE id_sucursal = $1 AND tipo_comprobante = 'FACTURA'
      `, [id_sucursal]);
    } else {
      await client.query(`
        INSERT INTO secuenciales (id_sucursal, tipo_comprobante, secuencial_actual)
        VALUES ($1, 'FACTURA', 2)
      `, [id_sucursal]);
    }

    const secuencialStr = formatSequential(seqActual);
    const numeroFactura = `${codigo_establecimiento}-${punto_emision}-${secuencialStr}`;

    // 4. Calcular importes totales
    let subtotalSinImpuestos = 0;
    let subtotalConIva = 0;
    let subtotalIvaCero = 0;
    let valorIvaTotal = 0;

    // Resolver detalles y validar existencias
    const detailLines = [];
    for (const item of items) {
      const { id_producto, cantidad, precio_unitario, descuento } = item;
      const cantVal = parseFloat(cantidad) || 0;
      const priceVal = parseFloat(precio_unitario) || 0;
      const descVal = parseFloat(descuento) || 0;

      if (cantVal <= 0 || priceVal < 0) {
        throw new Error('La cantidad y precio unitario deben ser válidos.');
      }

      // Consultar tasa impositiva del producto
      const prodRes = await client.query(`
        SELECT p.nombre, p.stock_actual, p.id_impuesto, i.porcentaje, i.nombre as impuesto_nombre
        FROM productos p
        JOIN impuestos i ON p.id_impuesto = i.id_impuesto
        WHERE p.id_producto = $1
      `, [id_producto]);

      if (prodRes.rows.length === 0) {
        throw new Error(`Producto con ID ${id_producto} no encontrado.`);
      }

      const product = prodRes.rows[0];
      const stockActual = parseFloat(product.stock_actual);

      // Descontar inventario (sólo si no es servicio o si queremos validar stock)
      if (stockActual < cantVal) {
        throw new Error(`Stock insuficiente para "${product.nombre}". Disponible: ${stockActual}, Requerido: ${cantVal}`);
      }

      // Cálculos por línea
      const baseLine = (cantVal * priceVal) - descVal;
      const taxPercent = parseFloat(product.porcentaje);
      const lineIva = baseLine * (taxPercent / 100);
      const lineTotal = baseLine;

      subtotalSinImpuestos += lineTotal;
      if (taxPercent > 0) {
        subtotalConIva += lineTotal;
        valorIvaTotal += lineIva;
      } else {
        subtotalIvaCero += lineTotal;
      }

      detailLines.push({
        id_producto,
        cantidad: cantVal,
        precio_unitario: priceVal,
        descuento: descVal,
        id_impuesto: product.id_impuesto,
        porcentaje_iva: taxPercent,
        valor_iva: lineIva,
        precio_total: lineTotal,
        nombre_producto: product.nombre
      });
    }

    const totalFactura = subtotalSinImpuestos + valorIvaTotal;

    // 5. Insertar cabecera de Factura
    const insFacturaQuery = `
      INSERT INTO facturas (
        id_sucursal, secuencial, numero_factura, id_cliente, id_usuario, id_sesion_caja,
        subtotal_sin_impuestos, subtotal_con_iva, subtotal_iva_cero, valor_iva, total, id_metodo_pago
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    const invoiceInserted = await client.query(insFacturaQuery, [
      id_sucursal,
      secuencialStr,
      numeroFactura,
      id_cliente,
      id_usuario,
      id_sesion_caja,
      subtotalSinImpuestos,
      subtotalConIva,
      subtotalIvaCero,
      valorIvaTotal,
      totalFactura,
      id_metodo_pago
    ]);
    const id_factura = invoiceInserted.rows[0].id_factura;

    // 6. Insertar detalles de factura, registrar egresos y actualizar stock
    const insDetailQuery = `
      INSERT INTO factura_detalles (
        id_factura, id_producto, cantidad, precio_unitario, descuento, id_impuesto, porcentaje_iva, valor_iva, precio_total
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    for (const line of detailLines) {
      await client.query(insDetailQuery, [
        id_factura,
        line.id_producto,
        line.cantidad,
        line.precio_unitario,
        line.descuento,
        line.id_impuesto,
        line.porcentaje_iva,
        line.valor_iva,
        line.precio_total
      ]);

      // Registrar movimiento de inventario (Kárdex)
      await client.query(`
        INSERT INTO movimientos_inventario (id_producto, tipo, cantidad, motivo, referencia, id_usuario)
        VALUES ($1, 'EGRESO', $2, 'VENTA', $3, $4)
      `, [line.id_producto, line.cantidad, numeroFactura, id_usuario]);

      // Actualizar existencias en tabla productos
      await client.query(`
        UPDATE productos 
        SET stock_actual = stock_actual - $1 
        WHERE id_producto = $2
      `, [line.cantidad, line.id_producto]);
    }

    await client.query('COMMIT');
    res.status(201).json(invoiceInserted.rows[0]);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar factura:', error);
    res.status(400).json({ error: error.message || 'Error al emitir la factura.' });
  } finally {
    client.release();
  }
});

// 4. Anular factura (PUT /api/invoices/:id/cancel)
router.put('/:id/cancel', async (req, res) => {
  const { id } = req.params;
  const { id_usuario } = req.body; // Usuario que anula

  if (!id_usuario) {
    return res.status(400).json({ error: 'El ID de usuario es requerido para anular.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Obtener cabecera de la factura
    const factRes = await client.query('SELECT * FROM facturas WHERE id_factura = $1', [id]);
    if (factRes.rows.length === 0) {
      throw new Error('Factura no encontrada.');
    }
    const factura = factRes.rows[0];

    if (factura.estado === 'ANULADA') {
      throw new Error('La factura ya se encuentra anulada.');
    }

    // 2. Obtener detalles para devolver el stock
    const detailsRes = await client.query('SELECT * FROM factura_detalles WHERE id_factura = $1', [id]);

    // Devolver existencias y registrar movimientos en Kárdex
    for (const detail of detailsRes.rows) {
      // Registrar reingreso de inventario
      await client.query(`
        INSERT INTO movimientos_inventario (id_producto, tipo, cantidad, motivo, referencia, id_usuario)
        VALUES ($1, 'INGRESO', $2, 'DEVOLUCION', $3, $4)
      `, [detail.id_producto, detail.cantidad, factura.numero_factura, id_usuario]);

      // Sumar existencias
      await client.query(`
        UPDATE productos 
        SET stock_actual = stock_actual + $1 
        WHERE id_producto = $2
      `, [detail.cantidad, detail.id_producto]);
    }

    // 3. Cambiar estado a ANULADA
    const updRes = await client.query(`
      UPDATE facturas 
      SET estado = 'ANULADA' 
      WHERE id_factura = $1 
      RETURNING *
    `, [id]);

    await client.query('COMMIT');
    res.json(updRes.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al anular factura:', error);
    res.status(400).json({ error: error.message || 'Error al procesar la anulación.' });
  } finally {
    client.release();
  }
});

module.exports = router;
