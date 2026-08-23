import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, ChevronRight, Pencil, Trash2, Check } from 'lucide-react'
import { useServer } from '../../context/ServerContext'
import { useAuth } from '../../context/AuthContext'
import { usePermissions } from '../../context/PermissionsContext'
import { useToast } from '../../components/toast/ToastContext'
import PlayerPanel from '../../components/player/PlayerPanel'
import { apiFetch, authHeaders, failureMessage } from '../../lib/api'
import type { Player, PlayerDeletionResult, WorldInfo } from '../../types/player'
import './Players.css'

const JOIN_LEAVE_PATTERN = /joined the game|left the game/

function Players() {
  const { running, subscribe } = useServer()
  const { token, logout } = useAuth()
  const { can } = usePermissions()
  const { toast } = useToast()
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null)
  const [worldSpawn, setWorldSpawn] = useState<{ x: number; y: number; z: number } | undefined>()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [fetchTrigger, setFetchTrigger] = useState(0)

  // Edit mode: select multiple players from the roster and delete them —
  // deopped/un-whitelisted (and kicked, if online) live if the server is
  // running, or edited directly out of ops.json/whitelist.json if not (see
  // the backend's DeletePlayer). Gated on players.moderate since that's what
  // DELETE /players/:uuid itself requires server-side.
  const canModerate = can('players.moderate')
  const [editMode, setEditMode] = useState(false)
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set())
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Fetch players when fetchTrigger changes
  useEffect(() => {
    let cancelled = false
    const headers = authHeaders(token)

    apiFetch<Player[]>('/players', { headers })
      .then((r) => {
        if (cancelled) return
        if (r.kind === 'ok') {
          const sorted = [...r.data].sort((a, b) => {
            if (a.online !== b.online) return a.online ? -1 : 1
            return a.name.localeCompare(b.name)
          })
          setPlayers(sorted)
          setError(null) // recover from a prior transient error on refetch
        } else if (r.kind === 'unauthorized') {
          logout()
        } else if (r.kind === 'network') {
          setError('Could not connect to server')
        } else {
          setError(failureMessage(r, 'Failed to fetch players'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [token, fetchTrigger, logout])

  // World spawn (for "teleport to spawn"). Optional — degrades if unavailable.
  useEffect(() => {
    let cancelled = false
    const headers = authHeaders(token)
    apiFetch<WorldInfo>('/world', { headers }).then((r) => {
      if (cancelled) return
      if (r.kind === 'ok' && r.data?.spawn) setWorldSpawn(r.data.spawn)
      else if (r.kind === 'unauthorized') logout()
      // unsupported/error/network: no spawn data, the To-spawn button stays hidden
    })
    return () => { cancelled = true }
  }, [token, logout])

  // Subscribe to shared WebSocket for join/leave events
  useEffect(() => {
    if (!running) return

    const unsubscribe = subscribe((data) => {
      if (JOIN_LEAVE_PATTERN.test(data)) {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
          setFetchTrigger((n) => n + 1)
        }, 500)
      }
    })

    return () => {
      unsubscribe()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [running, subscribe])

  const selected = selectedUuid ? players.find((p) => p.uuid === selectedUuid) ?? null : null
  const onlinePlayers = players.filter((p) => p.online)

  const closePanel = useCallback(() => setSelectedUuid(null), [])
  const refreshRoster = useCallback(() => setFetchTrigger((n) => n + 1), [])

  const enterEditMode = useCallback(() => {
    closePanel()
    setEditMode(true)
  }, [closePanel])

  const exitEditMode = useCallback(() => {
    setEditMode(false)
    setSelectedForDelete(new Set())
    setConfirmingDelete(false)
  }, [])

  const toggleSelectForDelete = useCallback((uuid: string) => {
    setSelectedForDelete((prev) => {
      const next = new Set(prev)
      if (next.has(uuid)) next.delete(uuid)
      else next.add(uuid)
      return next
    })
  }, [])

  const doBulkDelete = useCallback(async () => {
    const uuids = Array.from(selectedForDelete)
    setDeleting(true)

    let successCount = 0
    for (const uuid of uuids) {
      const r = await apiFetch<PlayerDeletionResult>(`/players/${uuid}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      })
      if (r.kind === 'ok') {
        successCount++
      } else if (r.kind === 'unauthorized') {
        setDeleting(false)
        logout()
        return
      }
      // unsupported/forbidden/error/network: leave this one out of the
      // success count and keep going with the rest of the batch.
    }

    setDeleting(false)
    const failCount = uuids.length - successCount
    if (failCount === 0) {
      toast(`Deleted ${successCount} player${successCount === 1 ? '' : 's'}`, 'success')
    } else if (successCount === 0) {
      toast(`Failed to delete ${failCount} player${failCount === 1 ? '' : 's'}`, 'error')
    } else {
      toast(`Deleted ${successCount}, failed to delete ${failCount}`, 'error')
    }
    exitEditMode()
    refreshRoster()
  }, [selectedForDelete, token, logout, toast, exitEditMode, refreshRoster])

  return (
    <>
      <div className="players-page">
        <div className="players-header">
          <h2>Players</h2>
          <div className="players-header-actions">
            {canModerate && !editMode && (
              <button
                className="btn-edit"
                onClick={enterEditMode}
                disabled={loading || players.length === 0}
              >
                <Pencil size={14} />
                Edit
              </button>
            )}
            <button
              className="btn-refresh"
              onClick={refreshRoster}
              disabled={loading}
              aria-label="Refresh players"
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {editMode && (
          <div className={`players-editbar ${confirmingDelete ? 'confirming' : ''}`}>
            {confirmingDelete ? (
              <>
                <span className="players-editbar-text">
                  Delete {selectedForDelete.size} player{selectedForDelete.size === 1 ? '' : 's'}? This can't be undone.
                </span>
                <div className="players-editbar-actions">
                  <button className="btn-danger" onClick={doBulkDelete} disabled={deleting}>
                    {deleting ? 'Deleting…' : 'Confirm'}
                  </button>
                  <button className="btn-ghost" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="players-editbar-text">{selectedForDelete.size} selected</span>
                <div className="players-editbar-actions">
                  <button
                    className="btn-danger-ghost"
                    onClick={() => setConfirmingDelete(true)}
                    disabled={selectedForDelete.size === 0}
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                  <button className="btn-ghost" onClick={exitEditMode}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {loading && <p className="players-loading">Loading players…</p>}
        {error && <p className="players-error">{error}</p>}

        {!loading && !error && players.length === 0 && (
          <div className="players-empty">
            <p className="players-empty-title">No players yet</p>
            <p className="players-empty-sub">
              Once someone joins the server they'll show up here — select any player to op, teleport,
              message, or moderate them.
            </p>
          </div>
        )}

        {!loading && !error && players.length > 0 && (
          <div className="players-list">
            {players.map((player, i) => {
              const isChecked = selectedForDelete.has(player.uuid)
              return (
                <button
                  key={player.uuid}
                  type="button"
                  className={`player-card stagger-item ${player.online ? 'online' : 'offline'} ${
                    editMode ? `edit-mode ${isChecked ? 'checked' : ''}` : selectedUuid === player.uuid ? 'selected' : ''
                  }`}
                  style={{ '--i': Math.min(i, 12) } as React.CSSProperties}
                  onClick={() => (editMode ? toggleSelectForDelete(player.uuid) : setSelectedUuid(player.uuid))}
                  aria-haspopup={editMode ? undefined : 'dialog'}
                  role={editMode ? 'checkbox' : undefined}
                  aria-checked={editMode ? isChecked : undefined}
                >
                  {editMode ? (
                    <span className={`player-checkbox ${isChecked ? 'checked' : ''}`} aria-hidden="true">
                      {isChecked && <Check size={13} />}
                    </span>
                  ) : (
                    <span className="player-status-indicator" title={player.online ? 'Online' : 'Offline'} />
                  )}
                  <img
                    className="player-avatar"
                    src={`https://mc-heads.net/avatar/${player.uuid}/64`}
                    alt=""
                    aria-hidden="true"
                  />
                  <div className="player-info">
                    <span className="player-name">{player.name}</span>
                    <div className="player-badges">
                      {player.is_op && <span className="badge badge-op">OP</span>}
                      {player.is_banned && <span className="badge badge-banned">Banned</span>}
                      {player.is_whitelisted && <span className="badge badge-whitelisted">Whitelisted</span>}
                    </div>
                  </div>
                  {!editMode && (
                    <>
                      <span className="player-status-text">{player.online ? 'Online' : 'Offline'}</span>
                      <ChevronRight size={16} className="player-chevron" aria-hidden="true" />
                    </>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selected && !editMode && (
        <PlayerPanel
          key={selected.uuid}
          player={selected}
          onlinePlayers={onlinePlayers}
          worldSpawn={worldSpawn}
          onClose={closePanel}
          onRefresh={refreshRoster}
        />
      )}
    </>
  )
}

export default Players
