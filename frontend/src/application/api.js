export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

export async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const fallback = response.status === 413
      ? 'The audio file is too large. The maximum size is 20 MB.'
      : `Request failed with status ${response.status}.`
    throw new Error(body.message || fallback)
  }
  return body
}

export function trackContentUrl(trackId) {
  return `${API_BASE_URL}/tracks/${encodeURIComponent(trackId)}/content`
}
