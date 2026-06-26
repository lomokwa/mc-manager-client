import { useCallback, useEffect, useRef, useState } from 'react'
import { useServer } from '../context/ServerContext'
import type { Player } from '../types/player'
import { apiFetch } from '../lib/api'
import './Players.css'

const JOIN_LEAVE_PATTERN = /joined the game|left the game/

function Players() {
  const { running, subscribe } = useServer()
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchPlayers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<Player[]>('/players')
      const sorted = [...data].sort((a, b) => {
        if (a.online !== b.online) return a.online ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      setPlayers(sorted)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect to server')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchPlayers()
  }, [fetchPlayers])

  // Subscribe to shared WebSocket for join/leave events
  useEffect(() => {
    if (!running) return

    const unsubscribe = subscribe((data) => {
      if (JOIN_LEAVE_PATTERN.test(data)) {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
          fetchPlayers()
        }, 500)
      }
    })

    return () => {
      unsubscribe()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [running, subscribe, fetchPlayers])

  return (
    <div className="players-page">
      <div className="players-header">
        <h2>Players</h2>
      </div>

      {loading && <p className="players-loading">Loading players...</p>}
      {error && <p className="players-error">{error}</p>}

      {!loading && !error && players.length === 0 && (
        <p className="players-empty">No players have joined this server yet.</p>
      )}

      {!loading && !error && players.length > 0 && (
        <div className="players-list">
          {players.map((player) => (
            <div
              key={player.uuid}
              className={`player-card ${player.online ? 'online' : 'offline'}`}
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
              <span className="player-status-text">{player.online ? 'Online' : 'Offline'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Players
