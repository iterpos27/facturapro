const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')
const AUTH_LOGOUT_EVENT = 'auth:logout'

export { API_BASE_URL, AUTH_LOGOUT_EVENT }

export function apiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}

export function getStoredToken() {
  return localStorage.getItem('token')
}

export function clearSession() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

export function notifyAuthLogout() {
  window.dispatchEvent(new CustomEvent(AUTH_LOGOUT_EVENT))
}

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {})
  const token = getStoredToken()

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(apiUrl(path), {
    ...options,
    headers,
  })

  if (response.status === 401 || response.status === 403) {
    clearSession()
    notifyAuthLogout()
  }

  return response
}

export async function readApiResponse(response) {
  const contentType = response.headers.get('content-type') || ''
  const rawText = await response.text()

  if (contentType.includes('application/json')) {
    return rawText ? JSON.parse(rawText) : null
  }

  if (!rawText) return null

  const strippedText = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const preview = strippedText || rawText.slice(0, 180)
  throw new Error(
    response.status === 404
      ? 'Ruta API no disponible. Reinicia el backend y vuelve a intentar.'
      : `Respuesta inesperada del servidor: ${preview.slice(0, 180)}`
  )
}
