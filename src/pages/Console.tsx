import { useEffect, useRef, useState } from 'react'
import { useServer } from '../context/ServerContext'

function Console() {
  const { running, logs, appendLog, sendCommand } = useServer()
  const [command, setCommand] = useState('')
  const outputRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)

  // Auto-scroll to the newest line only when the user is already at the
  // bottom, so reading scroll-back isn't interrupted. Instant (not smooth)
  // to stay responsive under heavy log volume.
  useEffect(() => {
    const el = outputRef.current
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight
  }, [logs])

  const handleScroll = () => {
    const el = outputRef.current
    if (el) atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }

  const handleSendCommand = (e: React.FormEvent) => {
    e.preventDefault()
    if (!command.trim()) return
    sendCommand(command)
    appendLog(`> ${command}`)
    setCommand('')
  }

  return (
    <main className="terminal">
      <div className="terminal-output" ref={outputRef} onScroll={handleScroll}>
        {logs.map((line, i) => (
          <div key={i} className="log-line">{line}</div>
        ))}
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
