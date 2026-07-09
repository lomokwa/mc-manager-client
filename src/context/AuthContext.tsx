import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { API_BASE } from '../lib/api'

interface AuthContextType {
  token: string | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  register: (invitationToken: string, username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))

  const isAuthenticated = !!token

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token)
    } else {
      localStorage.removeItem('token')
    }
  }, [token])

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
    <AuthContext.Provider value={{ token, isAuthenticated, login, register, logout }}>
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
