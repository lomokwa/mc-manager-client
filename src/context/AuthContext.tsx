import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { API_BASE, apiFetch, authHeaders } from '../lib/api'
import type { User } from '../types/user'

// Read the username the server signed into the JWT (claims: user_id, username),
// so the UI can show who is logged in with no extra request or backend change.
function usernameFromToken(token: string | null): string | null {
  if (!token) return null
  try {
    const part = token.split('.')[1]
    if (!part) return null
    let b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    b64 += '='.repeat((4 - (b64.length % 4)) % 4)
    const claims = JSON.parse(atob(b64)) as { username?: unknown }
    return typeof claims.username === 'string' ? claims.username : null
  } catch {
    return null
  }
}

interface AuthContextType {
  token: string | null
  username: string | null
  isAuthenticated: boolean
  // The caller's profile (display name, avatar), fetched once per token from
  // GET /me. `meResolved` flips true once that fetch has settled (success or
  // not), so a consumer can tell "still loading" apart from "no profile data"
  // -- an older backend with no /api/me leaves `me` null forever, which
  // should read as "just show the username", not "loading".
  me: User | null
  meResolved: boolean
  // Re-fetches /me, e.g. after the Account page saves a display name or
  // avatar, so every consumer of `me` (the sidebar included) picks up the
  // change immediately instead of only on next login.
  refreshMe: () => void
  login: (username: string, password: string) => Promise<void>
  register: (invitationToken: string, username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  // undefined = not yet resolved for the current token.
  const [meState, setMeState] = useState<User | null | undefined>(undefined)
  // Bumped by refreshMe() to re-run the fetch effect below without changing
  // `token` -- the same pattern ServersContext uses for its refresh().
  const [meEpoch, setMeEpoch] = useState(0)
  const meResolved = meState !== undefined

  const isAuthenticated = !!token
  const username = useMemo(() => usernameFromToken(token), [token])

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token)
    } else {
      localStorage.removeItem('token')
    }
  }, [token])

  useEffect(() => {
    let cancelled = false
    // All state updates happen inside this .then(), never synchronously in
    // the effect body (react-hooks/set-state-in-effect) -- if there's no
    // token, GET /me simply comes back 401 and is treated the same as any
    // other reason there's no profile to show.
    apiFetch<User>('/me', { headers: authHeaders(token) }).then((r) => {
      if (cancelled) return
      setMeState(r.kind === 'ok' ? r.data : null)
    })
    return () => {
      cancelled = true
    }
  }, [token, meEpoch])

  const refreshMe = useCallback(() => setMeEpoch((e) => e + 1), [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (!data.success) {
      throw new Error(data.error || 'Login failed')
    }
    setToken(data.data.token)
  }, [])

  const register = useCallback(async (invitationToken: string, username: string, password: string) => {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: invitationToken, username, password }),
    })
    const data = await res.json()
    if (!data.success) {
      throw new Error(data.error || 'Registration failed')
    }
  }, [])

  const logout = useCallback(() => {
    setToken(null)
  }, [])

  return (
    <AuthContext.Provider value={{ token, username, isAuthenticated, me: meState ?? null, meResolved, refreshMe, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
