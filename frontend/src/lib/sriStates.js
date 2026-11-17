const protectedSriStates = ['PENDIENTE_ENVIO', 'ENVIANDO', 'RECIBIDO', 'EN_PROCESO', 'AUTORIZADO'];

export function canProcessSri(document) {
  return document.estado !== 'ANULADA' && !protectedSriStates.includes(document.sri_estado);
}

export function canCancelLocally(document) {
  return document.estado !== 'ANULADA' && !protectedSriStates.includes(document.sri_estado);
}
