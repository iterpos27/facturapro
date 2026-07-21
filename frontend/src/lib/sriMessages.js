const MESSAGE_LABELS = {
  identificador: 'Identificador',
  mensaje: 'Mensaje',
  informacionAdicional: 'Informacion adicional',
  tipo: 'Tipo',
};

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeSriMessage(message) {
  if (!message) return '';
  if (typeof message === 'string') return message.trim();

  const priority = [
    message.mensaje,
    message.informacionAdicional,
    message.identificador,
    message.tipo,
  ].map((value) => String(value || '').trim()).filter(Boolean);

  if (priority.length > 0) {
    return priority.join(' - ');
  }

  if (typeof message === 'object') {
    return Object.entries(message)
      .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
      .map(([key, value]) => `${MESSAGE_LABELS[key] || key}: ${value}`)
      .join(' - ');
  }

  return String(message).trim();
}

export function formatSriMessages(messages = []) {
  return messages
    .map(normalizeSriMessage)
    .filter(Boolean)
    .map((message) => `<li>${escapeHtml(message)}</li>`)
    .join('');
}

export function sriResultHtml(data) {
  const messages = formatSriMessages(data.mensajes || []);
  const estado = escapeHtml(data.estado || 'PENDIENTE');
  const ambiente = escapeHtml(data.ambiente || 'PRUEBAS');
  const clave = escapeHtml(data.clave_acceso || 'Sin clave generada');

  return `
    <div class="sri-result-dialog">
      <div><strong>Estado:</strong> ${estado}</div>
      <div><strong>Ambiente:</strong> ${ambiente}</div>
      <div><strong>Clave:</strong></div>
      <div class="sri-result-key">${clave}</div>
      ${messages ? `<ul class="sri-result-messages">${messages}</ul>` : ''}
    </div>
  `;
}
