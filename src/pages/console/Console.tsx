import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Trash2, Download } from 'lucide-react'
import { useServer } from '../../context/ServerContext'
import './Console.css'

function Console() {
  const { running, logs, appendLog, clearLogs, sendCommand } = useServer()
  const [command, setCommand] = useState('')
  const [filter, setFilter] = useState('')
  const historyRef = useRef<string[]>([])
  const historyIdxRef = useRef(-1)
  const outputRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return q ? logs.filter((l) => l.toLowerCase().includes(q)) : logs
  }, [logs, filter])

  // Auto-scroll to the newest line only when the user is already at the bottom,
  // so reading scroll-back isn't interrupted. Instant, to stay responsive under
  // heavy log volume.
  useEffect(() => {
    const el = outputRef.current
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight
  }, [filtered])

  const handleScroll = () => {
    const el = outputRef.current
    if (el) atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!command.trim()) return
    sendCommand(command)
    appendLog(`> ${command}`)
    // Most-recent-first history, de-duplicated, capped.
    historyRef.current = [command, ...historyRef.current.filter((c) => c !== command)].slice(0, 100)
    historyIdxRef.current = -1
    setCommand('')
  }

  // ↑/↓ walk the command history.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const h = historyRef.current
    if (e.key === 'ArrowUp') {
      if (!h.length) return
      e.preventDefault()
      const idx = Math.min(historyIdxRef.current + 1, h.length - 1)
      historyIdxRef.current = idx
      setCommand(h[idx])
    } else if (e.key === 'ArrowDown') {
      if (historyIdxRef.current < 0) return
      e.preventDefault()
      const idx = historyIdxRef.current - 1
      historyIdxRef.current = idx
      setCommand(idx < 0 ? '' : h[idx])
    }
  }

  const downloadLogs = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mc-console-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.log`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="terminal">
      <div className="terminal-toolbar">
        <div className="terminal-search">
          <Search size={14} className="terminal-search-icon" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter logs…"
            aria-label="Filter logs"
          />
        </div>
        <span className="terminal-count">{filter ? `${filtered.length} / ${logs.length}` : logs.length} lines</span>
        <button type="button" className="terminal-tool" onClick={downloadLogs} disabled={!logs.length} title="Download logs" aria-label="Download logs">
          <Download size={15} />
        </button>
        <button type="button" className="terminal-tool" onClick={clearLogs} disabled={!logs.length} title="Clear console" aria-label="Clear console">
          <Trash2 size={15} />
        </button>
      </div>

      <div className="terminal-output" ref={outputRef} onScroll={handleScroll}>
        {filtered.length === 0 ? (
          <div className="terminal-empty">{filter ? 'No lines match your filter.' : 'No console output yet.'}</div>
        ) : (
          filtered.map((line, i) => (
            <div key={i} className="log-line">
              {line}
            </div>
          ))
        )}
      </div>

      <form className="terminal-input" onSubmit={handleSend}>
        <span className="prompt">&gt;</span>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={running ? 'Type a command…  (↑/↓ for history)' : 'Server is not running'}
          disabled={!running}
        />
      </form>
    </main>
  )
}

export default Console
