export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080/api'

/** Auth + common headers for API requests. */
export function authHeaders(token: string | null): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'ngrok-skip-browser-warning': 'true',
  }
}
