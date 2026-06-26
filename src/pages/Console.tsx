import { useEffect, useRef, useState } from 'react'
import { useServer } from '../context/ServerContext'

function Console() {
  const { running, logs, appendLog, sendCommand } = useServer()
  const [command, setCommand] = useState('')
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const handleSendCommand = (e: React.FormEvent) => {
    e.preventDefault()
    if (!command.trim()) return
    sendCommand(command)
    appendLog(`> ${command}`)
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
