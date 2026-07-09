export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080/api'

/** Auth + common headers for API requests. */
export function authHeaders(token: string | null): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'ngrok-skip-browser-warning': 'true',
  }
}

/** Outcome of an API call, classified so callers can react precisely. */
export type ApiResult<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'unsupported' }            // 404: this server build lacks the endpoint
  | { kind: 'unauthorized' }           // 401: token missing/expired
  | { kind: 'error'; message: string } // reachable but failed (4xx/5xx or success:false)
  | { kind: 'network' }                // fetch threw: the server is truly unreachable

interface Envelope<T> { success: boolean; data?: T; error?: string }

/**
 * Fetch an API endpoint and classify the outcome. Checks `res.status` BEFORE
 * parsing: Gin answers unregistered routes with a text/plain 404, so calling
 * `res.json()` on it throws and would be misread as a network failure — which
 * is exactly how the Files/Backups pages showed "Could not reach the server"
 * against server builds that don't ship those endpoints.
 */
export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, init)
  } catch {
    return { kind: 'network' }
  }
  if (res.status === 404) return { kind: 'unsupported' }
  if (res.status === 401) return { kind: 'unauthorized' }
  try {
    const body = (await res.json()) as Envelope<T>
    if (body.success) return { kind: 'ok', data: body.data as T }
    return { kind: 'error', message: body.error ?? `Request failed (${res.status})` }
  } catch {
    return { kind: 'error', message: `Unexpected response (${res.status})` }
  }
}
