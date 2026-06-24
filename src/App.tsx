import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'

const API_BASE = 'http://localhost:8080/api'
const WS_URL = 'ws://localhost:8080/api/console'
const API_KEY = import.meta.env.VITE_API_KEY ?? ''

function App() {
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [command, setCommand] = useState('')
  const [loading, setLoading] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

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

  const connectWs = useCallback(() => {
    if (wsRef.current) return
    const ws = new WebSocket(`${WS_URL}?key=${encodeURIComponent(API_KEY)}`)
    ws.onopen = () => {
      wsRef.current = ws
    }
    ws.onmessage = (e) => {
      setLogs((prev) => [...prev, e.data])
    }
    ws.onclose = () => {
      wsRef.current = null
    }
    ws.onerror = () => {
      wsRef.current = null
    }
  }, [])

  useEffect(() => {
    if (running) connectWs()
    return () => {
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [running, connectWs])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

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
      } else {
        setLogs((prev) => [...prev, `[ERROR] ${data.error}`])
      }
    } catch {
      setLogs((prev) => [...prev, `[ERROR] Failed to start server`])
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
      } else {
        setLogs((prev) => [...prev, `[ERROR] ${data.error}`])
      }
    } catch {
      setLogs((prev) => [...prev, `[ERROR] Failed to stop server`])
    } finally {
      setLoading(false)
    }
  }

  const handleSendCommand = (e: React.FormEvent) => {
    e.preventDefault()
    if (!command.trim() || !wsRef.current) return
    wsRef.current.send(command)
    setLogs((prev) => [...prev, `> ${command}`])
    setCommand('')
  }

  return (
    <div className="app">
      <header className="header">
        <h1>MC Manager</h1>
        <div className="controls">
          <span className={`status-dot ${running ? 'online' : 'offline'}`} />
          <span className="status-text">{running ? 'Running' : 'Stopped'}</span>
          {running ? (
            <button onClick={handleStop} disabled={loading} className="btn btn-stop">
              Stop Server
            </button>
          ) : (
            <button onClick={handleStart} disabled={loading} className="btn btn-start">
              Start Server
            </button>
          )}
        </div>
      </header>

      <main className="terminal">
        <div className="terminal-output">
          {logs.map((line, i) => (
            <div key={i} className="log-line">{line}</div>
          ))}
          <div ref={logsEndRef} />
        </div>
        <form className="terminal-input" onSubmit={handleSendCommand}>
          <span className="prompt">&gt;</span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder={running ? 'Type a command...' : 'Server is not running'}
            disabled={!running}
          />
        </form>
      </main>
    </div>
  )
}

export default App
