import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080/api'
const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080/api/console'

type MessageListener = (data: string) => void

export interface ServerInfo {
  serverType: string
  gameVersion: string
  loaderVersion?: string
}

interface ServerContextType {
  running: boolean
  loading: boolean
  serverExists: boolean
  serverInfo: ServerInfo | null
  logs: string[]
  appendLog: (line: string) => void
  handleStart: () => Promise<void>
  handleStop: () => Promise<void>
  createServer: (config: CreateServerConfig) => Promise<void>
  deleteServer: () => Promise<void>
  updateProperties: (properties: Record<string, string>) => Promise<void>
  fetchProperties: () => Promise<Record<string, string>>
  sendCommand: (cmd: string) => void
  subscribe: (listener: MessageListener) => () => void
}

export interface CreateServerConfig {
  serverType: string
  releaseVersion: string
  loaderVersion?: string
  createLaunchScript: boolean
  configureProperties: boolean
  properties: Record<string, string>
}

const ServerContext = createContext<ServerContextType | null>(null)

const MAX_LOG_LINES = 1000

export function ServerProvider({ children }: { children: ReactNode }) {
  const { token, logout } = useAuth()
  const [running, setRunning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [serverExists, setServerExists] = useState(false)
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null)
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
    'Authorization': `Bearer ${token}`,
    'ngrok-skip-browser-warning': 'true',
  }

  const refreshStatus = () => {
    fetch(`${API_BASE}/status`, { headers })
      .then((res) => {
        if (res.status === 401) { logout(); return }
        return res.json()
      })
      .then((data) => {
        if (data?.success) setRunning(data.data.running)
      })
      .catch(() => {})
  }

  const refreshServerExists = () => {
    fetch(`${API_BASE}/server`, { headers })
      .then((res) => {
        if (res.status === 401) { logout(); return }
        return res.json()
      })
      .then((data) => {
        if (data?.success) {
          setServerExists(data.data.exists)
          if (data.data.exists && data.data.serverType) {
            setServerInfo({
              serverType: data.data.serverType,
              gameVersion: data.data.gameVersion,
              loaderVersion: data.data.loaderVersion,
            })
          } else {
            setServerInfo(null)
          }
        }
      })
      .catch(() => {})
  }

  const connectWs = useCallback(() => {
    if (wsRef.current) return
    const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token ?? '')}`)
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
  }, [token])

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
    refreshServerExists()
  }, [])

  const handleStart = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/start`, {
        method: 'POST',
        headers,
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

  const createServer = async (config: CreateServerConfig) => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/server`, {
        method: 'POST',
        headers,
        body: JSON.stringify(config),
      })
      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to create server')
      }
      setServerExists(true)
      setServerInfo({
        serverType: config.serverType,
        gameVersion: config.releaseVersion,
        loaderVersion: config.loaderVersion,
      })
    } finally {
      setLoading(false)
    }
  }

  const deleteServer = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/server`, {
        method: 'DELETE',
        headers,
      })
      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete server')
      }
      setServerExists(false)
      setServerInfo(null)
    } finally {
      setLoading(false)
    }
  }

  const updateProperties = async (properties: Record<string, string>) => {
    const res = await fetch(`${API_BASE}/properties`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ properties }),
    })
    if (res.status === 401) { logout(); return }
    const data = await res.json()
    if (!data.success) {
      throw new Error(data.error || 'Failed to update properties')
    }
  }

  const fetchProperties = async (): Promise<Record<string, string>> => {
    const res = await fetch(`${API_BASE}/properties`, { headers })
    if (res.status === 401) { logout(); return {} }
    const data = await res.json()
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch properties')
    }
    return data.data
  }

  return (
    <ServerContext.Provider value={{ running, loading, serverExists, serverInfo, logs, appendLog, handleStart, handleStop, createServer, deleteServer, updateProperties, fetchProperties, sendCommand, subscribe }}>
      {children}
    </ServerContext.Provider>
  )
}

export function useServer() {
  const context = useContext(ServerContext)
  if (!context) throw new Error('useServer must be used within ServerProvider')
  return context
}
