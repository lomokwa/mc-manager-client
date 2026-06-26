import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Search,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  LogOut,
  Ban,
  CircleCheck,
  UserPlus,
  UserMinus,
} from 'lucide-react'
import { useServer } from '../context/ServerContext'
import type { Player } from '../types/player'
import { apiFetch } from '../lib/api'
import { useToast } from '../components/toast/ToastContext'
import { playerActionCommand, ACTION_LABELS, DESTRUCTIVE_ACTIONS, type PlayerAction } from '../lib/playerCommands'
import './Players.css'

const JOIN_LEAVE_PATTERN = /joined the game|left the game/

function Players() {
  const { running, subscribe, sendCommand } = useServer()
  const { toast } = useToast()
  const [players, setPlayers] = useState<Player[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // `silent` refreshes (after an action or a join/leave event) skip the
  // full-page loading state so the list updates without flashing.
  const fetchPlayers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<Player[]>('/players')
      // Guard against a non-array body so a malformed response can't throw
      // during render (the spread below would otherwise crash the page).
      const list = Array.isArray(data) ? data : []
      const sorted = list.slice().sort((a, b) => {
        if (a.online !== b.online) return a.online ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      setPlayers(sorted)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect to server')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchPlayers()
  }, [fetchPlayers])

  // Subscribe to the shared console WebSocket for join/leave events so the
  // roster stays current while players come and go.
  useEffect(() => {
    if (!running) return
    const unsubscribe = subscribe((data) => {
      if (JOIN_LEAVE_PATTERN.test(data)) {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => fetchPlayers(true), 500)
      }
    })
    return () => {
      unsubscribe()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [running, subscribe, fetchPlayers])

  const runAction = (action: PlayerAction, player: Player) => {
    if (!running) return
    const command = playerActionCommand(action, player.name)
    if (!command) {
      toast(`"${player.name}" isn't a valid username`, 'error')
      return
    }
    if (DESTRUCTIVE_ACTIONS.has(action) && !window.confirm(`${action === 'ban' ? 'Ban' : 'Kick'} ${player.name}?`)) {
      return
    }
    sendCommand(command)
    toast(`${ACTION_LABELS[action]} ${player.name}`, action === 'ban' ? 'error' : 'success')
    // Give the server a moment to update ops/ban/whitelist files, then refresh.
    setTimeout(() => fetchPlayers(true), 800)
  }

  const onlineCount = useMemo(() => players.filter((p) => p.online).length, [players])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? players.filter((p) => p.name.toLowerCase().includes(q)) : players
  }, [players, query])

  return (
    <div className="players-page">
      <div className="players-header">
        <div className="players-title">
          <h2>Players</h2>
          {!loading && !error && (
            <span className="players-count">
              {onlineCount} online · {players.length} total
            </span>
          )}
        </div>
        <div className="players-toolbar">
          <div className="players-search">
            <Search size={15} className="players-search-icon" />
            <input
              type="text"
              placeholder="Search players…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search players"
            />
          </div>
          <button className="btn-refresh" onClick={() => fetchPlayers()} disabled={loading} title="Refresh" aria-label="Refresh players">
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {!running && !loading && !error && (
        <p className="players-hint">Server is stopped — start it to op, kick, ban or whitelist players.</p>
      )}

      {loading && <p className="players-loading">Loading players...</p>}
      {error && <p className="players-error">{error}</p>}

      {!loading && !error && players.length === 0 && (
        <p className="players-empty">No players have joined this server yet.</p>
      )}

      {!loading && !error && players.length > 0 && filtered.length === 0 && (
        <p className="players-empty">No players match “{query}”.</p>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="players-list">
          {filtered.map((player) => (
            <div key={player.uuid} className={`player-card ${player.online ? 'online' : 'offline'}`}>
              <div className="player-status-indicator" title={player.online ? 'Online' : 'Offline'} />
              <img
                className="player-avatar"
                src={`https://mc-heads.net/avatar/${player.uuid}/64`}
                alt={player.name}
              />
              <div className="player-info">
                <span className="player-name">{player.name}</span>
                <div className="player-badges">
                  {player.is_op && <span className="badge badge-op">OP</span>}
                  {player.is_banned && <span className="badge badge-banned">Banned</span>}
                  {player.is_whitelisted && <span className="badge badge-whitelisted">Whitelisted</span>}
                </div>
              </div>

              <div className="player-actions" aria-label={`Actions for ${player.name}`}>
                <button
                  type="button"
                  className="player-action"
                  disabled={!running}
                  title={running ? (player.is_op ? 'Remove operator' : 'Make operator') : 'Start the server to manage players'}
                  aria-label={player.is_op ? `Remove operator from ${player.name}` : `Make ${player.name} an operator`}
                  onClick={() => runAction(player.is_op ? 'deop' : 'op', player)}
                >
                  {player.is_op ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}
                </button>

                {player.online && (
                  <button
                    type="button"
                    className="player-action"
                    disabled={!running}
                    title={running ? 'Kick' : 'Start the server to manage players'}
                    aria-label={`Kick ${player.name}`}
                    onClick={() => runAction('kick', player)}
                  >
                    <LogOut size={16} />
                  </button>
                )}

                <button
                  type="button"
                  className={`player-action ${player.is_banned ? '' : 'danger'}`}
                  disabled={!running}
                  title={running ? (player.is_banned ? 'Unban' : 'Ban') : 'Start the server to manage players'}
                  aria-label={player.is_banned ? `Unban ${player.name}` : `Ban ${player.name}`}
                  onClick={() => runAction(player.is_banned ? 'pardon' : 'ban', player)}
                >
                  {player.is_banned ? <CircleCheck size={16} /> : <Ban size={16} />}
                </button>

                <button
                  type="button"
                  className="player-action"
                  disabled={!running}
                  title={running ? (player.is_whitelisted ? 'Remove from whitelist' : 'Add to whitelist') : 'Start the server to manage players'}
                  aria-label={player.is_whitelisted ? `Remove ${player.name} from the whitelist` : `Add ${player.name} to the whitelist`}
                  onClick={() => runAction(player.is_whitelisted ? 'whitelist-remove' : 'whitelist-add', player)}
                >
                  {player.is_whitelisted ? <UserMinus size={16} /> : <UserPlus size={16} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Players
