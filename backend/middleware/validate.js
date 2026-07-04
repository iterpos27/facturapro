/**
 * middleware/validate.js
 * Middleware reutilizable de validación con Joi.
 * Uso: router.post('/', validate(schema), handler)
 */
const Joi = require('joi');

/**
 * Crea un middleware que valida req.body contra el schema Joi dado.
 * Devuelve 400 con el mensaje de error si la validación falla.
 */
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,      // devuelve todos los errores, no solo el primero
      stripUnknown: true,     // elimina campos no declarados en el schema
      convert: true,          // convierte strings a números donde aplique
    });

    if (error) {
      const message = error.details.map((d) => d.message).join('; ');
      return res.status(400).json({ error: `Datos inválidos: ${message}` });
    }

    req.body = value; // reemplaza body con los valores limpios y convertidos
    next();
  };
}

// ── Schemas compartidos ────────────────────────────────────────────────────────

const Joi_id = Joi.number().integer().positive();
const Joi_money = Joi.number().min(0).precision(4);
const Joi_str = (max = 255) => Joi.string().trim().max(max);

// Schema de ítem de factura/compra/NC
const itemSchema = Joi.object({
  id_producto: Joi_id.required(),
  cantidad: Joi.number().positive().required(),
  precio_unitario: Joi_money.optional(),
  precio_total: Joi_money.optional(),
  costo_unitario: Joi_money.optional(),
  valor_iva: Joi_money.optional(),
  iva_porcentaje: Joi.number().min(0).max(100).optional(),
  discount: Joi_money.optional(),
  taxCode: Joi_str(20).optional(),
  taxPercent: Joi.number().min(0).max(100).optional(),
}).unknown(true); // permite campos extra por compatibilidad

// ── Schemas de rutas ──────────────────────────────────────────────────────────

const schemas = {
  // Facturas
  createInvoice: Joi.object({
    id_cliente: Joi_id.required(),
    id_metodo_pago: Joi_id.optional(),
    id_proforma: Joi_id.optional().allow(null),
    items: Joi.array().items(itemSchema).min(1).required(),
    monto_pago: Joi_money.optional(),
    anticipo: Joi_money.optional(),
    observacion: Joi_str(500).optional().allow(''),
    payments: Joi.array().optional(),
  }),

  cancelDoc: Joi.object({
    reason: Joi_str(500).required(),
  }),

  // Compras
  createPurchase: Joi.object({
    numero_factura_compra: Joi_str(50).required(),
    id_proveedor: Joi_id.required(),
    subtotal_iva_cero: Joi_money.required(),
    subtotal_con_iva: Joi_money.required(),
    descuento_total: Joi_money.optional().default(0),
    valor_iva: Joi_money.required(),
    total: Joi_money.required(),
    observacion: Joi_str(500).optional().allow(''),
    items: Joi.array().items(itemSchema).min(1).required(),
  }),

  // Notas de crédito
  createCreditNote: Joi.object({
    id_factura: Joi_id.required(),
    motivo: Joi_str(500).required(),
    items: Joi.array().items(itemSchema).min(1).required(),
  }),

  // Retenciones
  createWithholding: Joi.object({
    id_compra: Joi_id.required(),
    details: Joi.array().items(
      Joi.object({
        tipo: Joi_str(10).required(),
        codigo: Joi_str(10).required(),
        porcentaje: Joi.number().min(0).max(100).required(),
        base_imponible: Joi_money.required(),
        valor_retenido: Joi_money.required(),
      })
    ).min(1).required(),
  }),

  // Clientes
  createClient: Joi.object({
    name: Joi_str(200).required(),
    identification_type: Joi.string().valid('CEDULA', 'RUC', 'PASAPORTE', 'OTRO').required(),
    identification_number: Joi_str(20).required(),
    email: Joi.string().email({ tlds: { allow: false } }).optional().allow('', null),
    phone: Joi_str(20).optional().allow('', null),
    address: Joi_str(300).optional().allow('', null),
  }),

  // Productos
  createProduct: Joi.object({
    codigo: Joi_str(50).required(),
    nombre: Joi_str(200).required(),
    descripcion: Joi_str(500).optional().allow('', null),
    precio_venta: Joi_money.required(),
    precio_compra: Joi_money.optional().default(0),
    stock_actual: Joi.number().min(0).optional().default(0),
    stock_minimo: Joi.number().min(0).optional().default(0),
    id_categoria: Joi_id.optional().allow(null),
    id_impuesto: Joi_id.optional(),
    activo: Joi.boolean().optional().default(true),
    es_servicio: Joi.boolean().optional().default(false),
  }),
};

module.exports = { validate, schemas };
