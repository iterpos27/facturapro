const { writeAudit } = require('../utils/audit');
const { refreshSriRecord } = require('./sri_monitor');

const DOCUMENTS = {
  '01': ['facturas', 'id_factura'],
  '04': ['notas_credito', 'id_nota_credito'],
  '07': ['retenciones', 'id_retencion'],
};

/** Confirma recepción antes de consultar: una caída del SRI no debe provocar otro envío. */
async function confirmReceptionAndAuthorize(client, sri, reception, userId, dependencies = {}) {
  const [table, pk] = DOCUMENTS[sri.tipo_comprobante] || [];
  if (!table || reception.estado !== 'RECIBIDA') throw new Error('Recepción SRI no válida para confirmar.');
  const messages = JSON.stringify(reception.mensajes || []);
  await client.query(`UPDATE sri_comprobantes SET estado='RECIBIDO', mensajes=$2::jsonb,
    updated_at=CURRENT_TIMESTAMP WHERE id_sri=$1`, [sri.id_sri, messages]);
  const document = await client.query(`UPDATE ${table} SET sri_estado='RECIBIDO', sri_mensajes=$2::jsonb
    WHERE ${pk}=$1 AND clave_acceso=$3`, [sri.id_documento, messages, sri.clave_acceso]);
  if (document.rowCount !== 1) throw new Error('El documento no coincide con la recepción SRI.');
  await (dependencies.writeAudit || writeAudit)(client, {
    entity: table, entityId: sri.id_documento, action: 'RECIBIR_SRI', userId,
    detail: { clave_acceso: sri.clave_acceso, estado: 'RECIBIDO' },
  });
  // Desde este punto, un error de autorización deja una recepción durable para reconsultar.
  await client.query('COMMIT');
  return (dependencies.refreshSriRecord || refreshSriRecord)(sri.id_sri, userId, { client });
}

module.exports = { confirmReceptionAndAuthorize };
