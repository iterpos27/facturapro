const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('./auth');
const logger = require('../utils/logger');
const { validate, schemas } = require('../middleware/validate');

// Proteger todas las rutas de productos con autenticación
router.use(authenticateToken);

// 1. Obtener todas las categorías (GET /api/products/categories)
router.get('/categories', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM categorias WHERE activo = TRUE ORDER BY nombre ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({ error: 'Error al obtener categorías de la base de datos.' });
  }
});

// 2. Obtener todos los impuestos (GET /api/products/taxes)
router.get('/taxes', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM impuestos WHERE activo = TRUE ORDER BY porcentaje ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener impuestos:', error);
    res.status(500).json({ error: 'Error al obtener impuestos de la base de datos.' });
  }
});

// 3. Obtener productos con paginación y búsqueda (GET /api/products)
// Query params: page, limit, search (nombre o código), activo (true/false)
router.get('/', async (req, res) => {
  const page   = Math.max(parseInt(req.query.page   || '1',  10), 1);
  const limit  = Math.min(parseInt(req.query.limit  || '50', 10), 500);
  const offset = (page - 1) * limit;
  const search = (req.query.search || '').trim();
  const soloActivos = req.query.activo !== 'false'; // por defecto solo activos

  try {
    const params = [];
    const where  = [];

    if (soloActivos) {
      where.push('p.activo = TRUE');
    }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(p.nombre ILIKE $${params.length} OR p.codigo ILIKE $${params.length})`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [dataRes, countRes] = await Promise.all([
      db.query(
        `SELECT p.*, c.nombre AS categoria_nombre, i.nombre AS impuesto_nombre, i.porcentaje AS impuesto_porcentaje
         FROM productos p
         LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
         LEFT JOIN impuestos i ON p.id_impuesto = i.id_impuesto
         ${whereClause}
         ORDER BY p.nombre ASC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      db.query(`SELECT COUNT(*) FROM productos p ${whereClause}`, params),
    ]);

    const total = parseInt(countRes.rows[0].count, 10);
    res.json({
      data: dataRes.rows,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error({ err: error }, 'Error al obtener productos');
    res.status(500).json({ error: 'Error al obtener productos de la base de datos.' });
  }
});
// 3.5. Obtener el siguiente código secuencial disponible (GET /api/products/next-code)
router.get('/next-code', async (req, res) => {
  try {
    const nextIdRes = await db.query("SELECT COALESCE(MAX(id_producto), 0) + 100001 AS next_val FROM productos");
    const nextVal = String(nextIdRes.rows[0].next_val).padStart(6, '0');
    res.json({ nextCode: nextVal });
  } catch (error) {
    console.error('Error al obtener el siguiente código:', error);
    res.status(500).json({ error: 'Error al obtener el siguiente código.' });
  }
});

// 4. Obtener un producto por su ID (GET /api/products/:id)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('SELECT * FROM productos WHERE id_producto = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener producto:', error);
    res.status(500).json({ error: 'Error al obtener el producto.' });
  }
});

// 5. Registrar un nuevo producto (POST /api/products)
router.post('/', validate(schemas.createProduct), async (req, res) => {
  const {
    codigo,
    sku,
    nombre,
    descripcion,
    id_categoria,
    precio_compra,
    precio_venta,
    id_impuesto,
    stock_actual,
    stock_minimo,
    activo,
    marca,
    referencia
  } = req.body;

  const cleanCodigo = typeof codigo === 'string' && codigo.trim() ? codigo.trim().toUpperCase() : null;
  const cleanSku = typeof sku === 'string' && sku.trim() ? sku.trim().toUpperCase() : null;
  const cleanNombre = typeof nombre === 'string' ? nombre.trim() : '';
  const cleanDescripcion = typeof descripcion === 'string' ? descripcion.trim() : '';
  const cleanMarca = typeof marca === 'string' ? marca.trim() : '';
  const cleanReferencia = typeof referencia === 'string' ? referencia.trim() : '';

  const precioCompraNum = parseFloat(precio_compra);
  const precioVentaNum = parseFloat(precio_venta);
  const stockActualNum = stock_actual !== undefined && stock_actual !== null && stock_actual !== '' ? parseFloat(stock_actual) : 0;
  const stockMinimoNum = stock_minimo !== undefined && stock_minimo !== null && stock_minimo !== '' ? parseFloat(stock_minimo) : 0;

  if (!cleanNombre) {
    return res.status(400).json({ error: 'El nombre del producto es obligatorio.' });
  }

  if (
    [precioCompraNum, precioVentaNum, stockActualNum, stockMinimoNum].some(
      (value) => Number.isNaN(value) || value < 0
    )
  ) {
    return res.status(400).json({ error: 'Precios y stock deben ser numeros validos mayores o iguales a 0.' });
  }

  try {
    let generatedCodigo = cleanCodigo;
    if (!generatedCodigo) {
      const nextIdRes = await db.query("SELECT COALESCE(MAX(id_producto), 0) + 100001 AS next_val FROM productos");
      generatedCodigo = String(nextIdRes.rows[0].next_val).padStart(6, '0');
    }
    const generatedSku = cleanSku || ('0' + generatedCodigo);

    const query = `
      INSERT INTO productos (
        codigo, sku, nombre, descripcion, id_categoria, 
        precio_compra, precio_venta, id_impuesto, stock_actual, stock_minimo, activo,
        marca, referencia
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      )
      RETURNING *
    `;
    const result = await db.query(query, [
      generatedCodigo,
      generatedSku,
      cleanNombre,
      cleanDescripcion,
      id_categoria ? parseInt(id_categoria, 10) : null,
      precioCompraNum,
      precioVentaNum,
      id_impuesto ? parseInt(id_impuesto, 10) : null,
      stockActualNum,
      stockMinimoNum,
      activo !== undefined ? activo : true,
      cleanMarca,
      cleanReferencia
    ]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al registrar producto:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ya existe un producto con el mismo código o SKU.' });
    }
    res.status(500).json({ error: 'Error al registrar el producto.' });
  }
});

// 6. Modificar un producto existente (PUT /api/products/:id)
router.put('/:id', validate(schemas.createProduct), async (req, res) => {
  const { id } = req.params;
  const {
    codigo,
    sku,
    nombre,
    descripcion,
    id_categoria,
    precio_compra,
    precio_venta,
    id_impuesto,
    stock_actual,
    stock_minimo,
    activo,
    marca,
    referencia
  } = req.body;

  const cleanCodigo = typeof codigo === 'string' && codigo.trim() ? codigo.trim().toUpperCase() : null;
  const cleanSku = typeof sku === 'string' && sku.trim() ? sku.trim().toUpperCase() : null;
  const cleanNombre = typeof nombre === 'string' ? nombre.trim() : '';
  const cleanDescripcion = typeof descripcion === 'string' ? descripcion.trim() : '';
  const cleanMarca = typeof marca === 'string' ? marca.trim() : '';
  const cleanReferencia = typeof referencia === 'string' ? referencia.trim() : '';

  const precioCompraNum = parseFloat(precio_compra);
  const precioVentaNum = parseFloat(precio_venta);
  const stockMinimoNum = stock_minimo !== undefined && stock_minimo !== null && stock_minimo !== '' ? parseFloat(stock_minimo) : 0;

  if (!cleanNombre) {
    return res.status(400).json({ error: 'El nombre del producto es obligatorio.' });
  }

  if (
    [precioCompraNum, precioVentaNum, stockMinimoNum].some(
      (value) => Number.isNaN(value) || value < 0
    )
  ) {
    return res.status(400).json({ error: 'Precios y stock minimo deben ser numeros validos mayores o iguales a 0.' });
  }

  try {
    const generatedSku = cleanSku || ('0' + cleanCodigo);

    const query = `
      UPDATE productos
      SET codigo = $1,
          sku = $2,
          nombre = $3,
          descripcion = $4,
          id_categoria = $5,
          precio_compra = $6,
          precio_venta = $7,
          id_impuesto = $8,
          stock_minimo = $9,
          activo = $10,
          marca = $11,
          referencia = $12,
          updated_at = CURRENT_TIMESTAMP
      WHERE id_producto = $13
      RETURNING *
    `;
    const result = await db.query(query, [
      cleanCodigo,
      generatedSku,
      cleanNombre,
      cleanDescripcion,
      id_categoria ? parseInt(id_categoria, 10) : null,
      precioCompraNum,
      precioVentaNum,
      id_impuesto ? parseInt(id_impuesto, 10) : null,
      stockMinimoNum,
      activo !== undefined ? activo : true,
      cleanMarca,
      cleanReferencia,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ya existe otro producto con el mismo código o SKU.' });
    }
    res.status(500).json({ error: 'Error al actualizar el producto.' });
  }
});

// 7. Eliminar un producto (DELETE /api/products/:id)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const movementCountResult = await db.query('SELECT COUNT(*)::int AS total FROM movimientos_inventario WHERE id_producto = $1', [id]);
    const invoiceCountResult = await db.query('SELECT COUNT(*)::int AS total FROM factura_detalles WHERE id_producto = $1', [id]);

    if (movementCountResult.rows[0].total > 0 || invoiceCountResult.rows[0].total > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar el producto porque ya tiene movimientos o facturas asociadas.',
      });
    }

    const result = await db.query('DELETE FROM productos WHERE id_producto = $1 RETURNING id_producto', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    res.json({ message: 'Producto eliminado correctamente.', id_producto: result.rows[0].id_producto });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    if (error.code === '42P01') {
      return res.status(400).json({ error: 'No se puede validar el historial del producto porque faltan tablas del modulo de inventario o facturacion.' });
    }
    res.status(500).json({ error: 'Error al eliminar el producto.' });
  }
});

module.exports = router;
