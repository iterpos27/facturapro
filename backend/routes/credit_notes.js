const express = require('express');
const router = express.Router();
const db = require('../db');
const { writeAudit } = require('../audit');
const { generarClaveAccesoSRI } = require('../sri_utils');
const { authenticateToken, authorizeRoles } = require('./auth');
const { validate, schemas } = require('../middleware/validate');

// Proteger todas las rutas de notas de crédito con autenticación y autorización
router.use(authenticateToken);
router.use(authorizeRoles('ADMINISTRADOR', 'CONTADOR'));

router.get('/', async (req, res) => {
  const page  = Math.max(parseInt(req.query.page  || '1',  10), 1);
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
  const offset = (page - 1) * limit;
  try {
    const [dataRes, countRes] = await Promise.all([
      db.query(`
        SELECT nc.*, f.numero_factura, c.name AS cliente_nombre,
               c.identification_number AS cliente_identificacion, u.username
        FROM notas_credito nc
        JOIN facturas f ON nc.id_factura = f.id_factura
        JOIN clients c ON f.id_cliente = c.id
        JOIN usuarios u ON nc.id_usuario = u.id_usuario
        ORDER BY nc.fecha_emision DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]),
      db.query('SELECT COUNT(*) FROM notas_credito'),
    ]);
    const total = parseInt(countRes.rows[0].count, 10);
    res.json({ data: dataRes.rows, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Error al obtener notas de credito:', error);
    res.status(500).json({ error: 'Error al consultar las notas de credito.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const ncRes = await db.query(`
      SELECT nc.*, f.numero_factura, f.fecha_emision AS factura_fecha,
             c.name AS cliente_nombre, c.identification_number AS cliente_identificacion,
             c.email AS cliente_email, c.phone AS cliente_telefono, c.address AS cliente_direccion,
             u.username
      FROM notas_credito nc
      JOIN facturas f ON nc.id_factura = f.id_factura
      JOIN clients c ON f.id_cliente = c.id
      JOIN usuarios u ON nc.id_usuario = u.id_usuario
      WHERE nc.id_nota_credito = $1
    `, [req.params.id]);

    if (ncRes.rows.length === 0) {
      return res.status(404).json({ error: 'Nota de credito no encontrada.' });
    }

    const detallesRes = await db.query(`
      SELECT ncd.*, p.nombre AS producto_nombre, p.codigo AS producto_codigo
      FROM nota_credito_detalles ncd
      JOIN productos p ON ncd.id_producto = p.id_producto
      WHERE ncd.id_nota_credito = $1
      ORDER BY ncd.id_detalle ASC
    `, [req.params.id]);

    res.json({
      creditNote: ncRes.rows[0],
      details: detallesRes.rows,
    });
  } catch (error) {
    console.error('Error al obtener detalle de nota de credito:', error);
    res.status(500).json({ error: 'Error al consultar el detalle de la nota de credito.' });
  }
});

router.post('/', async (req, res) => {
  const { id_factura, motivo, items } = req.body || {};
  const id_usuario = req.user.id_usuario;

  if (!id_factura || !String(motivo || '').trim() || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Faltan datos obligatorios para emitir la nota de credito.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const factRes = await client.query(
      'SELECT id_factura, numero_factura, total, saldo, estado, id_cliente FROM facturas WHERE id_factura = $1 FOR UPDATE',
      [id_factura]
    );

    if (factRes.rows.length === 0) {
      throw new Error('Factura original no encontrada.');
    }

    const factura = factRes.rows[0];
    if (factura.estado === 'ANULADA') {
      throw new Error('No se puede emitir una nota de credito sobre una factura anulada.');
    }

    const invoiceDetailsRes = await client.query(`
      SELECT fd.id_producto, fd.cantidad, fd.precio_unitario, fd.porcentaje_iva,
             p.nombre AS producto_nombre
      FROM factura_detalles fd
      JOIN productos p ON fd.id_producto = p.id_producto
      WHERE fd.id_factura = $1
    `, [id_factura]);

    const detailsByProduct = new Map(
      invoiceDetailsRes.rows.map((detail) => [String(detail.id_producto), detail])
    );

    const validatedItems = [];
    for (const item of items) {
      const idProducto = item.id_producto;
      const quantity = parseFloat(item.cantidad) || 0;
      const price = parseFloat(item.precio_unitario) || 0;
      const originalDetail = detailsByProduct.get(String(idProducto));

      if (!originalDetail) {
        throw new Error(`El producto ${idProducto} no pertenece a la factura seleccionada.`);
      }
      if (quantity <= 0) {
        throw new Error('La nota de credito debe incluir al menos un producto con cantidad mayor a cero.');
      }
      if (quantity > parseFloat(originalDetail.cantidad)) {
        throw new Error(`La cantidad devuelta de "${originalDetail.producto_nombre}" supera la cantidad facturada.`);
      }
      if (price < 0) {
        throw new Error('El precio unitario devuelto no puede ser negativo.');
      }

      const taxPercent = parseFloat(originalDetail.porcentaje_iva || 0);
      const subtotal = quantity * price;
      const iva = subtotal * (taxPercent / 100);

      validatedItems.push({
        id_producto: idProducto,
        quantity,
        price,
        taxPercent,
        subtotal,
        iva,
      });
    }

    let subtotalConIva = 0;
    let subtotalIvaCero = 0;
    let valorIva = 0;
    for (const item of validatedItems) {
      valorIva += item.iva;
      if (item.taxPercent > 0) {
        subtotalConIva += item.subtotal;
      } else {
        subtotalIvaCero += item.subtotal;
      }
    }
    const totalNc = subtotalConIva + subtotalIvaCero + valorIva;

    const countRes = await client.query('SELECT COUNT(*)::int AS total FROM notas_credito');
    const nextSeq = Number(countRes.rows[0].total || 0) + 1;
    const numeroNotaCredito = `NC-001-001-${String(nextSeq).padStart(9, '0')}`;
    const companyRes = await client.query('SELECT ruc FROM empresas LIMIT 1');
    if (companyRes.rows.length === 0 || !companyRes.rows[0].ruc) {
      throw new Error('Configure el RUC de la empresa antes de emitir notas de credito.');
    }

    const accessKey = generarClaveAccesoSRI({
      fechaEmision: new Date(),
      tipoComprobante: '04',
      ruc: companyRes.rows[0].ruc,
      ambiente: '1',
      establecimiento: '001',
      puntoEmision: '001',
      secuencial: nextSeq,
    });

    const ncInsertRes = await client.query(`
      INSERT INTO notas_credito (
        numero_nota_credito, id_factura, id_usuario,
        subtotal_iva_cero, subtotal_con_iva, valor_iva,
        total, motivo, clave_acceso
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      numeroNotaCredito,
      id_factura,
      id_usuario,
      subtotalIvaCero,
      subtotalConIva,
      valorIva,
      totalNc,
      String(motivo).trim(),
      accessKey,
    ]);

    const creditNote = ncInsertRes.rows[0];

    for (const item of validatedItems) {
      await client.query(`
        INSERT INTO nota_credito_detalles (
          id_nota_credito, id_producto, cantidad, precio_unitario, precio_total, valor_iva
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        creditNote.id_nota_credito,
        item.id_producto,
        item.quantity,
        item.price,
        item.subtotal,
        item.iva,
      ]);

      await client.query(`
        UPDATE productos
        SET stock_actual = stock_actual + $1
        WHERE id_producto = $2
      `, [item.quantity, item.id_producto]);

      await client.query(`
        INSERT INTO movimientos_inventario (id_producto, tipo, cantidad, motivo, referencia, id_usuario)
        VALUES ($1, 'INGRESO', $2, 'DEVOLUCION_NC', $3, $4)
      `, [item.id_producto, item.quantity, numeroNotaCredito, id_usuario]);
    }

    const currentSaldo = parseFloat(factura.saldo || 0);
    const newSaldo = Math.max(currentSaldo - totalNc, 0);
    await client.query(
      'UPDATE facturas SET saldo = $1::numeric WHERE id_factura = $2',
      [newSaldo, id_factura]
    );

    await writeAudit(client, {
      entity: 'notas_credito',
      entityId: creditNote.id_nota_credito,
      action: 'EMITIR_NOTA_CREDITO',
      userId: id_usuario,
      detail: {
        numero_nota_credito: numeroNotaCredito,
        numero_factura: factura.numero_factura,
        total: totalNc,
        motivo: String(motivo).trim(),
      },
    });

    await client.query('COMMIT');
    res.status(201).json(creditNote);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al emitir nota de credito:', error);
    res.status(400).json({ error: error.message || 'Error al procesar la nota de credito.' });
  } finally {
    client.release();
  }
});

router.put('/:id/cancel', async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body || {};
  const id_usuario = req.user.id_usuario;

  if (!String(reason || '').trim()) {
    return res.status(400).json({ error: 'Usuario y motivo de anulacion son obligatorios.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const ncRes = await client.query('SELECT * FROM notas_credito WHERE id_nota_credito = $1 FOR UPDATE', [id]);
    if (ncRes.rows.length === 0) {
      throw new Error('Nota de credito no encontrada.');
    }
    const note = ncRes.rows[0];
    if (note.estado === 'ANULADA') {
      throw new Error('La nota de credito ya se encuentra anulada.');
    }

    const detailsRes = await client.query('SELECT * FROM nota_credito_detalles WHERE id_nota_credito = $1', [id]);
    for (const detail of detailsRes.rows) {
      await client.query(`
        UPDATE productos
        SET stock_actual = stock_actual - $1
        WHERE id_producto = $2
      `, [detail.cantidad, detail.id_producto]);

      await client.query(`
        INSERT INTO movimientos_inventario (id_producto, tipo, cantidad, motivo, referencia, id_usuario)
        VALUES ($1, 'EGRESO', $2, 'NOTA_CREDITO_ANULADA', $3, $4)
      `, [detail.id_producto, detail.cantidad, note.numero_nota_credito, id_usuario]);
    }

    await client.query(`
      UPDATE facturas
      SET saldo = LEAST(total, COALESCE(saldo, 0) + $1::numeric)
      WHERE id_factura = $2
    `, [note.total, note.id_factura]);

    const updateRes = await client.query(`
      UPDATE notas_credito
      SET estado = 'ANULADA',
          motivo_anulacion = $1,
          anulada_at = CURRENT_TIMESTAMP,
          anulada_por = $2
      WHERE id_nota_credito = $3
      RETURNING *
    `, [String(reason).trim(), id_usuario, id]);

    await writeAudit(client, {
      entity: 'notas_credito',
      entityId: id,
      action: 'ANULAR_NOTA_CREDITO',
      userId: id_usuario,
      detail: { numero_nota_credito: note.numero_nota_credito, reason: String(reason).trim() },
    });

    await client.query('COMMIT');
    res.json(updateRes.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al anular nota de credito:', error);
    res.status(400).json({ error: error.message || 'Error al anular la nota de credito.' });
  } finally {
    client.release();
  }
});

module.exports = router;
