const db = require('../db');
const { authorizeReceipt } = require('./sri_service');
const { authorizationState, validateAccessKey } = require('../utils/sri_workflow');
const { writeAudit } = require('../utils/audit');

// Lista cerrada: los nombres de tablas nunca provienen de parámetros del navegador.
const DOCUMENTS = {
  '01': ['facturas', 'id_factura'],
  '04': ['notas_credito', 'id_nota_credito'],
  '07': ['retenciones', 'id_retencion'],
};

/** Recupera una autorización sin firmar, reenviar ni enviar correos al receptor. */
async function refreshSriRecord(id, userId, dependencies = {}) {
  const database = dependencies.db || db;
  const authorize = dependencies.authorizeReceipt || authorizeReceipt;
  const audit = dependencies.writeAudit || writeAudit;
  const reader = dependencies.client || database;
  const record = (await reader.query('SELECT * FROM sri_comprobantes WHERE id_sri = $1', [id])).rows[0];
  const company = (await reader.query('SELECT * FROM empresas LIMIT 1')).rows[0];
  if (!record || !company) throw new Error('No se encontró el comprobante o la empresa.');
  const key = validateAccessKey(record.clave_acceso);
  if (key.ruc !== String(company.ruc).trim() || key.ambiente !== record.ambiente) {
    throw new Error('La clave no coincide con la empresa o el ambiente del comprobante.');
  }
  if (!DOCUMENTS[record.tipo_comprobante]) throw new Error('Tipo de comprobante no soportado.');
  if (record.estado === 'AUTORIZADO') return record;
  // La llamada de red ocurre antes de abrir la transacción para no retener bloqueos 30 segundos.
  const response = await authorize(key.key, company, key.ambiente);
  const state = authorizationState(response.estado);
  if (state === 'AUTORIZADO' && (!response.numeroAutorizacion || !response.fechaAutorizacion)) {
    throw new Error('La autorización recibida está incompleta; se conserva el estado anterior.');
  }
  // El flujo de emisión puede reutilizar su conexión ya confirmada para no agotar el pool.
  const client = dependencies.client || await database.pool.connect();
  try {
    await client.query('BEGIN');
    const current = (await client.query('SELECT * FROM sri_comprobantes WHERE id_sri = $1 FOR UPDATE', [id])).rows[0];
    if (!current || current.clave_acceso !== key.key || current.ambiente !== key.ambiente) {
      throw new Error('El comprobante cambió durante la consulta. Vuelva a consultar.');
    }
    // Otra solicitud pudo autorizar el comprobante mientras esperábamos al SRI.
    if (current.estado === 'AUTORIZADO') {
      await client.query('COMMIT');
      return current;
    }
    // Sin autorización no prueba recepción: conservar documentos nunca enviados o devueltos.
    if (state === 'RECIBIDO' && ['GENERADO', 'FIRMADO', 'DEVUELTO', 'PENDIENTE_ENVIO', 'ENVIANDO'].includes(current.estado)) {
      await client.query('COMMIT');
      return current;
    }
    const values = [id, state, response.numeroAutorizacion || null, response.fechaAutorizacion || '', JSON.stringify(response.mensajes || [])];
    const result = await client.query(`UPDATE sri_comprobantes SET estado=$2, numero_autorizacion=$3,
      fecha_autorizacion=NULLIF($4, '')::timestamp, mensajes=$5::jsonb, updated_at=CURRENT_TIMESTAMP
      WHERE id_sri=$1 RETURNING *`, values);
    const [table, pk] = DOCUMENTS[current.tipo_comprobante];
    const document = await client.query(`UPDATE ${table} SET sri_estado=$2, sri_numero_autorizacion=$3,
      sri_fecha_autorizacion=NULLIF($4, '')::timestamp, sri_mensajes=$5::jsonb
      WHERE ${pk}=$1 AND clave_acceso=$6`, [current.id_documento, ...values.slice(1), key.key]);
    if (document.rowCount !== 1) throw new Error('El documento original no coincide con la clave consultada.');
    await audit(client, { entity: table, entityId: current.id_documento, action: 'RECONSULTAR_SRI', userId,
      detail: { clave_acceso: key.key, anterior: current.estado, estado: state } });
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    if (!dependencies.client) client.release();
  }
}

module.exports = { refreshSriRecord };
