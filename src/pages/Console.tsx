import { useCallback, useEffect, useRef, useState } from 'react'
import { useServer } from '../context/ServerContext'

const WS_URL = 'ws://localhost:8080/api/console'
const API_KEY = import.meta.env.VITE_API_KEY ?? ''

function Console() {
  const { running } = useServer()
  const [logs, setLogs] = useState<string[]>([])
  const [command, setCommand] = useState('')
  const wsRef = useRef<WebSocket | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

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

  const handleSendCommand = (e: React.FormEvent) => {
    e.preventDefault()
    if (!command.trim() || !wsRef.current) return
    wsRef.current.send(command)
    setLogs((prev) => [...prev, `> ${command}`])
    setCommand('')
  }

  return (
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
  )
}

export default Console
