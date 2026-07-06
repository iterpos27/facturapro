import { apiFetch } from './api';
import { showToast } from './toast';

export async function openRidePdf(type, id) {
  try {
    const response = await apiFetch(`/api/rides/${type}/${id}.pdf`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'No se pudo generar el PDF.');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
  } catch (error) {
    showToast(error.message, 'error');
  }
}
