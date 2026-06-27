import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080/api'
const API_KEY = import.meta.env.VITE_API_KEY ?? ''

// Resolve the console WebSocket URL. An explicit relative path (e.g.
// "/api/console") is resolved against the current origin, so a Vite dev proxy
// — or a same-origin deployment behind a reverse proxy — works without
// hardcoding host/port. An absolute ws(s):// value is used as-is.
function resolveWsUrl(): string {
  const configured = import.meta.env.VITE_WS_URL as string | undefined
  if (configured && configured.startsWith('/')) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.host}${configured}`
  }
  return configured ?? 'ws://localhost:8080/api/console'
}

const WS_URL = resolveWsUrl()

type MessageListener = (data: string) => void

interface ServerContextType {
  running: boolean
  loading: boolean
  error: string | null
  logs: string[]
  appendLog: (line: string) => void
  handleStart: () => Promise<void>
  handleStop: () => Promise<void>
  sendCommand: (cmd: string) => void
  subscribe: (listener: MessageListener) => () => void
}

const ServerContext = createContext<ServerContextType | null>(null)

const MAX_LOG_LINES = 1000

export function ServerProvider({ children }: { children: ReactNode }) {
  const [running, setRunning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const listenersRef = useRef<Set<MessageListener>>(new Set())

  const appendLog = useCallback((line: string) => {
    setLogs((prev) => {
      const next = [...prev, line]
      return next.length > MAX_LOG_LINES ? next.slice(-MAX_LOG_LINES) : next
    })
  }, [])

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
    'ngrok-skip-browser-warning': 'true',
  }

  const refreshStatus = () => {
    fetch(`${API_BASE}/status`, { headers })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setRunning(data.data.running)
      })
      .catch(() => {})
  }

  const connectWs = useCallback(() => {
    if (wsRef.current) return
    const ws = new WebSocket(`${WS_URL}?key=${encodeURIComponent(API_KEY)}`)
    // Track the socket immediately (not in onopen) so the effect cleanup can
    // close it even while it is still CONNECTING, and so the guard above
    // prevents a second, duplicate connection from being opened.
    wsRef.current = ws
    ws.onmessage = (e) => {
      appendLog(e.data)
      listenersRef.current.forEach((fn) => fn(e.data))
    }
    ws.onclose = () => {
      // Only clear the ref if it still points at this socket — a newer
      // connection may already have replaced it.
      if (wsRef.current === ws) wsRef.current = null
      refreshStatus()
    }
  }, [])

  // Manage WebSocket lifecycle based on running state
  useEffect(() => {
    if (running) {
      connectWs()
    } else {
      wsRef.current?.close()
      wsRef.current = null
    }
    return () => {
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [running, connectWs])

  const sendCommand = useCallback((cmd: string) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(cmd)
  }, [])

  const subscribe = useCallback((listener: MessageListener) => {
    listenersRef.current.add(listener)
    return () => { listenersRef.current.delete(listener) }
  }, [])

  // Poll status so the UI reflects the server starting, stopping or crashing
  // even when that happens outside this client (not only on mount / WS close).
  useEffect(() => {
    refreshStatus()
    const id = setInterval(refreshStatus, 5000)
    return () => clearInterval(id)
  }, [])

  const handleStart = async () => {
    setLoading(true)
    setError(null)
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
      } else {
        setError(data.error ?? 'Failed to start the server')
      }
    } catch {
      setError('Could not reach the server')
    } finally {
      setLoading(false)
    }
  }

  const handleStop = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/stop`, {
        method: 'POST',
        headers,
      })
      const data = await res.json()
      if (data.success) {
        setRunning(false)
      } else {
        setError(data.error ?? 'Failed to stop the server')
      }
    } catch {
      setError('Could not reach the server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ServerContext.Provider value={{ running, loading, error, logs, appendLog, handleStart, handleStop, sendCommand, subscribe }}>
      {children}
    </ServerContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useServer() {
  const context = useContext(ServerContext)
  if (!context) throw new Error('useServer must be used within ServerProvider')
  return context
}
