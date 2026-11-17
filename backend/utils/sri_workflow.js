const { DOMParser } = require('@xmldom/xmldom');

/** Devuelve el día civil de Ecuador, independientemente de la zona del servidor. */
function ecuadorDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (name) => parts.find((item) => item.type === name).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Comprueba la fecha contenida en el XML que realmente se enviará, sin modificarlo. */
function assertTransmissionDate(xml, now = new Date()) {
  if (!String(xml || '').trim()) throw new Error('No se puede verificar la fecha de un XML vacío.');
  let date;
  try {
    const document = new DOMParser().parseFromString(xml, 'text/xml');
    const dates = document.getElementsByTagName('fechaEmision');
    if (dates.length === 1) date = dates[0].textContent.trim();
  } catch { /* Un XML ilegible se comunica como fecha no verificable. */ }
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date || '');
  if (!match) throw new Error('No se puede enviar: fecha de emisión del XML ausente o inválida.');
  const [, day, month, year] = match;
  const formatted = `${year}-${month}-${day}`;
  const parsed = new Date(`${formatted}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== formatted) {
    throw new Error('La fecha de emisión del XML no existe.');
  }
  const today = ecuadorDate(now);
  if (formatted !== today) {
    throw new Error(`No se puede transmitir: fecha de emisión ${formatted}; fecha actual en Ecuador ${today}. Puede consultar el estado de comprobantes anteriores desde el panel SRI.`);
  }
}

/** Diferencia rechazo explícito de autorización todavía pendiente; no degrada autorizados. */
function authorizationState(value, previous) {
  if (previous === 'AUTORIZADO') return previous;
  const state = String(value || '').trim().toUpperCase().replace(/\s+/g, '_');
  if (state === 'AUTORIZADO' || state === 'NO_AUTORIZADO') return state;
  if (['SIN_AUTORIZACION', 'EN_PROCESO', 'POR_PROCESAR', 'RECIBIDO', 'RECIBIDA'].includes(state)) return 'RECIBIDO';
  throw new Error('El SRI devolvió una respuesta de autorización no reconocida. No se modificó el estado.');
}

/** Valida formato y dígito verificador y obtiene el ambiente codificado en la clave. */
function validateAccessKey(value) {
  const key = String(value || '').trim();
  if (!/^\d{49}$/.test(key)) throw new Error('La clave de acceso debe contener 49 dígitos.');
  let sum = 0;
  for (let i = 47, factor = 2; i >= 0; i--, factor = factor === 7 ? 2 : factor + 1) {
    sum += Number(key[i]) * factor;
  }
  const remainder = 11 - (sum % 11);
  const check = remainder === 11 ? 0 : remainder === 10 ? 1 : remainder;
  if (check !== Number(key[48])) throw new Error('El dígito verificador de la clave no es válido.');
  if (!['1', '2'].includes(key[23])) throw new Error('El ambiente de la clave no es válido.');
  return { key, ambiente: key[23] === '2' ? 'PRODUCCION' : 'PRUEBAS', ruc: key.slice(10, 23) };
}

function assertLocalCancellationAllowed(document, sriRecord) {
  const protectedStates = ['PENDIENTE_ENVIO', 'ENVIANDO', 'RECIBIDO', 'EN_PROCESO', 'AUTORIZADO'];
  if (protectedStates.includes(document?.sri_estado) || protectedStates.includes(sriRecord?.estado)) {
    throw new Error('Este comprobante está pendiente de envío o pudo haber sido recibido por el SRI. Consulte su estado y tramite la anulación tributaria antes de marcarlo como anulado en el sistema.');
  }
}

module.exports = { ecuadorDate, assertTransmissionDate, authorizationState, validateAccessKey, assertLocalCancellationAllowed };
