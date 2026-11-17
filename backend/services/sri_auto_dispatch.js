const db = require('../db');
const sriRoutes = require('../routes/sri');
const { refreshSriRecord } = require('./sri_monitor');
const logger = require('../utils/logger');

async function runSriDispatchCycle({ database = db, dispatch = sriRoutes.dispatchQueuedDocument } = {}) {
  const result = await database.query(`
    SELECT id_sri, tipo_comprobante, id_documento
    FROM sri_comprobantes
    WHERE estado = 'PENDIENTE_ENVIO' AND ambiente = 'PRUEBAS'
    ORDER BY id_sri ASC LIMIT 5
  `);
  const failures = [];
  for (const item of result.rows) {
    try {
      const response = await dispatch(item);
      if (response.statusCode >= 400) {
        failures.push({ id_sri: item.id_sri, error: response.body?.error || 'No se pudo procesar SRI.' });
      }
    } catch (error) {
      failures.push({ id_sri: item.id_sri, error: error.message });
    }
  }
  return failures;
}

async function runSriRecoveryCycle({ database = db, refresh = refreshSriRecord } = {}) {
  const result = await database.query(`
    SELECT id_sri FROM sri_comprobantes
    WHERE estado IN ('ENVIANDO', 'RECIBIDO', 'EN_PROCESO') AND ambiente = 'PRUEBAS'
      AND updated_at < CURRENT_TIMESTAMP - INTERVAL '30 seconds'
    ORDER BY updated_at ASC LIMIT 5
  `);
  const failures = [];
  for (const item of result.rows) {
    try {
      await refresh(item.id_sri, null);
    } catch (error) {
      failures.push({ id_sri: item.id_sri, error: error.message });
    }
  }
  return failures;
}

function startSriDispatchWorker() {
  let dispatchBusy = false;
  let recoveryBusy = false;
  const dispatch = async () => {
    if (dispatchBusy) return;
    dispatchBusy = true;
    try {
      for (const failure of await runSriDispatchCycle()) logger.error(failure, 'Despacho SRI pendiente');
    } catch (error) {
      logger.error({ err: error }, 'Error del despachador SRI');
    } finally {
      dispatchBusy = false;
    }
  };
  const recover = async () => {
    if (recoveryBusy) return;
    recoveryBusy = true;
    try {
      for (const failure of await runSriRecoveryCycle()) logger.error(failure, 'Reconsulta SRI pendiente');
    } catch (error) {
      logger.error({ err: error }, 'Error de recuperación SRI');
    } finally {
      recoveryBusy = false;
    }
  };
  setImmediate(dispatch);
  setInterval(dispatch, 5000).unref();
  setInterval(recover, 60000).unref();
}

module.exports = { runSriDispatchCycle, runSriRecoveryCycle, startSriDispatchWorker };
