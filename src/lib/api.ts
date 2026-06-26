// Shared API configuration and fetch helper for the mc-manager API.
import type { APIResponse } from '../types/player'

export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080/api'
export const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080/api/console'
export const API_KEY = import.meta.env.VITE_API_KEY ?? ''

export const apiHeaders: HeadersInit = {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY,
  'ngrok-skip-browser-warning': 'true',
}

// Fetch a JSON endpoint on the API. Resolves with the `data` payload and
// throws an Error (carrying the server's message when present) on a network
// failure, a non-2xx response, or `success: false`.
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...apiHeaders, ...init?.headers },
  })
  const body = (await res.json().catch(() => null)) as APIResponse<T> | null
  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? `request failed (${res.status})`)
  }
  return body.data as T
}
