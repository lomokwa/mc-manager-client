import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080/api'
const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080/api/console'
const API_KEY = import.meta.env.VITE_API_KEY ?? ''

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
    ws.onopen = () => {
      wsRef.current = ws
    }
    ws.onmessage = (e) => {
      appendLog(e.data)
      listenersRef.current.forEach((fn) => fn(e.data))
    }
    ws.onclose = () => {
      wsRef.current = null
      refreshStatus()
    }
    ws.onerror = () => {
      wsRef.current = null
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
    wsRef.current?.send(cmd)
  }, [])

  const subscribe = useCallback((listener: MessageListener) => {
    listenersRef.current.add(listener)
    return () => { listenersRef.current.delete(listener) }
  }, [])

  useEffect(() => {
    refreshStatus()
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

export function useServer() {
  const context = useContext(ServerContext)
  if (!context) throw new Error('useServer must be used within ServerProvider')
  return context
}
