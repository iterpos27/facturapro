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
