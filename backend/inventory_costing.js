function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round4(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 10000) / 10000;
}

async function recordInventoryCostMovement(client, options) {
  const {
    id_producto,
    tipo,
    cantidad,
    motivo,
    referencia,
    id_usuario,
    costo_unitario,
    documento_tipo,
    documento_id,
  } = options;

  const productId = Number(id_producto);
  const quantity = toNumber(cantidad);
  if (!productId || quantity <= 0) {
    throw new Error('Producto y cantidad son obligatorios para valorizar inventario.');
  }

  const normalizedType = String(tipo || '').toUpperCase();
  if (!['INGRESO', 'EGRESO'].includes(normalizedType)) {
    throw new Error('El tipo de movimiento debe ser INGRESO o EGRESO.');
  }

  const productRes = await client.query(`
    SELECT id_producto, nombre, stock_actual, precio_compra,
           COALESCE(costo_promedio, precio_compra, 0) AS costo_promedio
    FROM productos
    WHERE id_producto = $1
    FOR UPDATE
  `, [productId]);

  if (productRes.rows.length === 0) {
    throw new Error('Producto no encontrado para valorizar inventario.');
  }

  const product = productRes.rows[0];
  const currentStock = toNumber(product.stock_actual);
  const currentAverage = round4(toNumber(product.costo_promedio, toNumber(product.precio_compra)));
  const unitCost = round4(costo_unitario !== undefined && costo_unitario !== null ? costo_unitario : currentAverage);

  if (normalizedType === 'EGRESO' && currentStock < quantity) {
    throw new Error(`Stock insuficiente para "${product.nombre}". Stock actual: ${currentStock}, Cantidad requerida: ${quantity}`);
  }

  const movementRes = await client.query(`
    INSERT INTO movimientos_inventario (id_producto, tipo, cantidad, motivo, referencia, id_usuario)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [
    productId,
    normalizedType,
    quantity,
    motivo,
    referencia || null,
    id_usuario || null,
  ]);

  let newStock = currentStock;
  let newAverage = currentAverage;
  let saldoValue = round4(currentStock * currentAverage);
  let entryQty = 0;
  let entryCost = 0;
  let entryTotal = 0;
  let exitQty = 0;
  let exitCost = 0;
  let exitTotal = 0;

  if (normalizedType === 'INGRESO') {
    entryQty = quantity;
    entryCost = unitCost;
    entryTotal = round4(quantity * unitCost);
    const previousValue = round4(currentStock * currentAverage);
    newStock = round4(currentStock + quantity);
    saldoValue = round4(previousValue + entryTotal);
    newAverage = newStock > 0 ? round4(saldoValue / newStock) : unitCost;
  } else {
    exitQty = quantity;
    exitCost = currentAverage;
    exitTotal = round4(quantity * currentAverage);
    newStock = round4(currentStock - quantity);
    saldoValue = round4(newStock * currentAverage);
  }

  await client.query(`
    UPDATE productos
    SET stock_actual = $1,
        costo_promedio = $2,
        valor_inventario = $3,
        precio_compra = CASE WHEN $4::numeric > 0 THEN $4 ELSE precio_compra END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id_producto = $5
  `, [newStock, newAverage, saldoValue, normalizedType === 'INGRESO' ? unitCost : 0, productId]);

  await client.query(`
    INSERT INTO kardex_valorizado (
      id_producto, id_movimiento, fecha, tipo, motivo, referencia,
      documento_tipo, documento_id,
      cantidad_entrada, costo_entrada, total_entrada,
      cantidad_salida, costo_salida, total_salida,
      saldo_cantidad, costo_promedio, saldo_valor, id_usuario
    )
    VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
  `, [
    productId,
    movementRes.rows[0].id_movimiento,
    normalizedType,
    motivo,
    referencia || null,
    documento_tipo || null,
    documento_id || null,
    entryQty,
    entryCost,
    entryTotal,
    exitQty,
    exitCost,
    exitTotal,
    newStock,
    newAverage,
    saldoValue,
    id_usuario || null,
  ]);

  return {
    movement: movementRes.rows[0],
    stock_actual: newStock,
    costo_promedio: newAverage,
    valor_inventario: saldoValue,
  };
}

module.exports = {
  recordInventoryCostMovement,
  round4,
  toNumber,
};
