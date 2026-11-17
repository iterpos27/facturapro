const router = require('express').Router();
const db = require('../db');
const { authorizeReceipt } = require('../services/sri_service');
const { refreshSriRecord } = require('../services/sri_monitor');
const { validateAccessKey } = require('../utils/sri_workflow');
const { authorizePermissions } = require('./auth');

/** Date.parse normaliza 31 de febrero; comparar el resultado evita aceptar ese día. */
function validFilterDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Consulta libre de solo lectura: el ambiente se deriva de la clave, no del formulario. */
router.get('/consult/:claveAcceso', async (req, res) => {
  let key;
  try { key = validateAccessKey(req.params.claveAcceso); }
  catch (error) { return res.status(400).json({ error: error.message }); }
  try {
    const company = (await db.query('SELECT * FROM empresas LIMIT 1')).rows[0];
    if (!company) return res.status(400).json({ error: 'Configure primero la empresa.' });
    const result = await authorizeReceipt(key.key, company, key.ambiente);
    // No devuelve el SOAP completo ni modifica documentos del sistema.
    res.json({ clave_acceso: key.key, ambiente: key.ambiente, estado: result.estado,
      numero_autorizacion: result.numeroAutorizacion, fecha_autorizacion: result.fechaAutorizacion, mensajes: result.mensajes });
  } catch (error) {
    res.status(502).json({ error: 'No se pudo consultar al SRI. Intente nuevamente.', detalle: error.code || undefined });
  }
});

/** Lista paginada e indicadores sobre el mismo conjunto filtrado, sin exponer XML firmados. */
router.get('/monitor', async (req, res) => {
  const page = Number(req.query.page || 1);
  const { estado = '', tipo = '', ambiente = '', desde = '', hasta = '' } = req.query;
  if (!Number.isInteger(page) || page < 1 || page > 100000 ||
    (tipo && !['01', '04', '07'].includes(tipo)) ||
    (ambiente && !['PRUEBAS', 'PRODUCCION'].includes(ambiente)) ||
    (estado && !['GENERADO', 'FIRMADO', 'PENDIENTE_ENVIO', 'ENVIANDO', 'RECIBIDO', 'EN_PROCESO', 'AUTORIZADO', 'DEVUELTO', 'NO_AUTORIZADO', 'ERROR'].includes(estado)) ||
    [desde, hasta].some((date) => date && !validFilterDate(date)) ||
    (desde && hasta && desde > hasta)) {
    return res.status(400).json({ error: 'Revise los filtros y el rango de fechas.' });
  }
  try {
    const where = `WHERE ($1='' OR estado=$1) AND ($2='' OR tipo_comprobante=$2)
      AND ($3='' OR ambiente=$3) AND ($4='' OR created_at >= NULLIF($4,'')::date)
      AND ($5='' OR created_at < NULLIF($5,'')::date + INTERVAL '1 day')`;
    const params = [estado, tipo, ambiente, desde, hasta];
    const result = await db.query(`SELECT id_sri,tipo_comprobante,numero_comprobante,clave_acceso,
      ambiente,estado,numero_autorizacion,fecha_autorizacion,mensajes,created_at,updated_at
      FROM sri_comprobantes ${where} ORDER BY created_at DESC, id_sri DESC LIMIT 25 OFFSET $6`, [...params, (page - 1) * 25]);
    const counts = await db.query(`SELECT estado, COUNT(*)::int AS cantidad FROM sri_comprobantes ${where} GROUP BY estado`, params);
    res.json({ records: result.rows, counts: counts.rows, total: counts.rows.reduce((sum, item) => sum + item.cantidad, 0), page, pageSize: 25 });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo cargar el panel SRI.' });
  }
});

/** Actualiza registro y documento de origen con permiso de procesamiento y auditoría. */
router.post('/monitor/:id/refresh', authorizePermissions('SRI_PROCESS'), async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Identificador inválido.' });
  try {
    const record = await refreshSriRecord(req.params.id, req.user?.id_usuario || req.user?.id);
    res.json({ estado: record.estado, numero_autorizacion: record.numero_autorizacion, mensajes: record.mensajes });
  } catch (error) {
    res.status(400).json({ error: error.message || 'No se pudo recuperar el estado SRI.' });
  }
});

module.exports = router;
