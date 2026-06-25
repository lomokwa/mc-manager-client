import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const API_BASE = 'http://localhost:8080/api'
const API_KEY = import.meta.env.VITE_API_KEY ?? ''

interface ServerContextType {
  running: boolean
  loading: boolean
  handleStart: () => Promise<void>
  handleStop: () => Promise<void>
}

const ServerContext = createContext<ServerContextType | null>(null)

export function ServerProvider({ children }: { children: ReactNode }) {
  const [running, setRunning] = useState(false)
  const [loading, setLoading] = useState(false)

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
  }

  useEffect(() => {
    fetch(`${API_BASE}/status`, {
      headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setRunning(data.data.running)
      })
      .catch(() => {})
  }, [])

  const handleStart = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/start`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          createLaunchScript: true,
          configureProperties: false,
          properties: {},
        }),
      })
      const data = await res.json()
      if (data.success) {
        setRunning(true)
      }
    } catch {
      // handled by consumers
    } finally {
      setLoading(false)
    }
  }

  const handleStop = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/stop`, {
        method: 'POST',
        headers,
      })
      const data = await res.json()
      if (data.success) {
        setRunning(false)
      }
    } catch {
      // handled by consumers
    } finally {
      setLoading(false)
    }
  }

  return (
    <ServerContext.Provider value={{ running, loading, handleStart, handleStop }}>
      {children}
    </ServerContext.Provider>
  )
}

export function useServer() {
  const context = useContext(ServerContext)
  if (!context) throw new Error('useServer must be used within ServerProvider')
  return context
}
