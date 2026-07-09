import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Trash2, Download } from 'lucide-react'
import { useServer } from '../../context/ServerContext'
import { getSuggestions, type Suggestion } from '../../lib/mcCommands'
import './Console.css'

function Console() {
  const { running, logs, appendLog, clearLogs, sendCommand } = useServer()
  const [command, setCommand] = useState('')
  const [filter, setFilter] = useState('')
  const [selIdx, setSelIdx] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const [focused, setFocused] = useState(false)
  const historyRef = useRef<string[]>([])
  const historyIdxRef = useRef(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return q ? logs.filter((l) => l.toLowerCase().includes(q)) : logs
  }, [logs, filter])

  // Command suggestions — a cheap prefix filter over the static registry.
  const suggest = useMemo(() => getSuggestions(command), [command])
  const showSuggest =
    focused && !dismissed && running && command.trim().length > 0 &&
    (suggest.items.length > 0 || !!suggest.command)
  const sel = Math.min(selIdx, Math.max(0, suggest.items.length - 1))

  // Auto-scroll to the newest line only when the user is already at the bottom.
  useEffect(() => {
    const el = outputRef.current
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight
  }, [filtered])

  const handleScroll = () => {
    const el = outputRef.current
    if (el) atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }

  const changeCommand = (value: string) => {
    setCommand(value)
    setSelIdx(0)
    setDismissed(false)
  }

  const accept = (s: Suggestion) => {
    const before = command.slice(0, suggest.replaceStart)
    const after = command.slice(suggest.replaceEnd)
    changeCommand(`${before}${s.value} ${after}`)
    inputRef.current?.focus()
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    const cmd = command.trim()
    if (!cmd) return
    sendCommand(cmd)
    appendLog(`> ${cmd}`)
    historyRef.current = [cmd, ...historyRef.current.filter((c) => c !== cmd)].slice(0, 100)
    historyIdxRef.current = -1
    setCommand('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const items = suggest.items
    // While the suggestion popup is open, arrows/Tab/Esc drive it.
    if (showSuggest && items.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelIdx((i) => (Math.min(i, items.length - 1) + 1) % items.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelIdx((i) => (Math.min(i, items.length - 1) - 1 + items.length) % items.length)
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        accept(items[sel])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setDismissed(true)
        return
      }
    }
    // Otherwise ↑/↓ walk the command history.
    const h = historyRef.current
    if (e.key === 'ArrowUp') {
      if (!h.length) return
      e.preventDefault()
      const idx = Math.min(historyIdxRef.current + 1, h.length - 1)
      historyIdxRef.current = idx
      changeCommand(h[idx])
    } else if (e.key === 'ArrowDown') {
      if (historyIdxRef.current < 0) return
      e.preventDefault()
      const idx = historyIdxRef.current - 1
      historyIdxRef.current = idx
      changeCommand(idx < 0 ? '' : h[idx])
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

  const usageParts = suggest.command ? splitUsage(suggest.command.usage) : null

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
        {showSuggest && (
          <div className="cmd-suggest" role="listbox" aria-label="Command suggestions">
            {usageParts && (
              <div className="cmd-preview">
                <span className="cmd-usage">
                  <span className="cmd-usage-name">{usageParts.name}</span>
                  {usageParts.rest && <span className="cmd-usage-args"> {usageParts.rest}</span>}
                </span>
                <span className="cmd-desc">{suggest.command?.desc}</span>
              </div>
            )}
            {suggest.items.map((s, i) => (
              <button
                type="button"
                key={s.value}
                role="option"
                aria-selected={i === sel}
                className={`cmd-item ${i === sel ? 'sel' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  accept(s)
                }}
              >
                <span className="cmd-item-value">{s.value}</span>
                {s.hint && <span className="cmd-item-hint">{s.hint}</span>}
              </button>
            ))}
          </div>
        )}
        <span className="prompt">&gt;</span>
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(e) => changeCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={running ? 'Type a command…  (Tab to complete, ↑/↓ history)' : 'Server is not running'}
          disabled={!running}
        />
      </form>
    </main>
  )
}

// Split "gamemode <mode> [target]" into name + the rest, for styled preview.
function splitUsage(usage: string): { name: string; rest: string } {
  const i = usage.indexOf(' ')
  return i === -1 ? { name: usage, rest: '' } : { name: usage.slice(0, i), rest: usage.slice(i + 1) }
}

export default Console
