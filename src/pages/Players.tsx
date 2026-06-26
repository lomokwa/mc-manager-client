import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, RefreshCw, ChevronRight } from 'lucide-react'
import { useServer } from '../context/ServerContext'
import type { Player } from '../types/player'
import { apiFetch } from '../lib/api'
import { PlayerPanel } from '../components/player/PlayerPanel'
import './Players.css'

const JOIN_LEAVE_PATTERN = /joined the game|left the game/

function Players() {
  const { running, subscribe } = useServer()
  const [players, setPlayers] = useState<Player[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Player | null>(null)
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

  // Keep the open panel's data fresh as the roster refreshes.
  useEffect(() => {
    if (!selected) return
    const latest = players.find((p) => p.uuid === selected.uuid)
    if (latest && latest !== selected) setSelected(latest)
  }, [players, selected])

  const onlineCount = useMemo(() => players.filter((p) => p.online).length, [players])
  const onlinePlayers = useMemo(() => players.filter((p) => p.online), [players])
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
        <p className="players-hint">Server is stopped — start it to manage players.</p>
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
            <button
              key={player.uuid}
              type="button"
              className={`player-card ${player.online ? 'online' : 'offline'}`}
              onClick={() => setSelected(player)}
              aria-label={`Manage ${player.name}`}
            >
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
              <ChevronRight size={18} className="player-chevron" />
            </button>
          ))}
        </div>
      )}

      <PlayerPanel
        player={selected}
        onlinePlayers={onlinePlayers}
        worldSpawn={null}
        onClose={() => setSelected(null)}
        onRefresh={() => fetchPlayers(true)}
      />
    </div>
  )
}

export default Players
