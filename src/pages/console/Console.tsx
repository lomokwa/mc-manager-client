import { useEffect, useRef, useState } from 'react'
import { useServer } from '../../context/ServerContext'

function Console() {
  const { running, logs, appendLog, sendCommand } = useServer()
  const [command, setCommand] = useState('')
  const logsEndRef = useRef<HTMLDivElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  // Whether the view is pinned to the bottom. Only then do new lines
  // auto-scroll — scrolling up to read older output stays put instead of
  // being yanked back down on every incoming line.
  const pinnedRef = useRef(true)

  const handleScroll = () => {
    const el = outputRef.current
    if (!el) return
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }

  useEffect(() => {
    if (pinnedRef.current) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
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
      <div className="terminal-output" ref={outputRef} onScroll={handleScroll}>
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
