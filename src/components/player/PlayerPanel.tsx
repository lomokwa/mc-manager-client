import { useEffect, useState } from 'react'
import {
  X,
  ShieldCheck,
  ShieldOff,
  UserPlus,
  UserMinus,
  Navigation,
  MapPin,
  Crosshair,
  LogOut,
  Ban,
  ShieldBan,
  CircleCheck,
  Send,
  Terminal,
  Map as MapIcon,
  Clock,
  Timer,
  Skull,
} from 'lucide-react'
import type { Player } from '../../types/player'
import { useServer } from '../../context/ServerContext'
import { useToast } from '../toast/ToastContext'
import {
  playerActionCommand,
  teleportToPlayerCommand,
  teleportToCoordsCommand,
  kickCommand,
  banCommand,
  ipBanCommand,
  runAsCommand,
  directMessageCommand,
  TELLRAW_COLORS,
  type TellrawColor,
} from '../../lib/playerCommands'
import './PlayerPanel.css'

const BLUEMAP_URL = import.meta.env.VITE_BLUEMAP_URL as string | undefined

interface Props {
  player: Player | null
  onlinePlayers: Player[]
  worldSpawn?: { x: number; y: number; z: number } | null
  onClose: () => void
  onRefresh: () => void
}

function formatPlaytime(ticks?: number): string {
  if (ticks == null) return '—'
  const totalSec = Math.floor(ticks / 20)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${totalSec}s`
}

function formatSession(onlineSince?: string, online?: boolean): string {
  if (!online || !onlineSince) return '—'
  const start = Date.parse(onlineSince)
  if (Number.isNaN(start)) return '—'
  const sec = Math.max(0, Math.floor((Date.now() - start) / 1000))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function PlayerPanel({ player, onlinePlayers, worldSpawn, onClose, onRefresh }: Props) {
  const { running, sendCommand } = useServer()
  const { toast } = useToast()
  const [reason, setReason] = useState('')
  const [tpTarget, setTpTarget] = useState('')
  const [coords, setCoords] = useState({ x: '', y: '', z: '' })
  const [runCmd, setRunCmd] = useState('')
  const [dm, setDm] = useState('')
  const [dmColor, setDmColor] = useState<TellrawColor>('white')

  // Close on Escape.
  useEffect(() => {
    if (!player) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [player, onClose])

  // Reset the form when switching to a different player.
  useEffect(() => {
    setReason('')
    setTpTarget('')
    setCoords({ x: '', y: '', z: '' })
    setRunCmd('')
    setDm('')
    setDmColor('white')
  }, [player?.uuid])

  if (!player) return null
  const p = player

  const dispatch = (command: string | null, okMsg: string, opts?: { confirm?: string; danger?: boolean }) => {
    if (!running) {
      toast('Start the server to manage players', 'error')
      return
    }
    if (!command) {
      toast('Invalid input — check the values', 'error')
      return
    }
    if (opts?.confirm && !window.confirm(opts.confirm)) return
    sendCommand(command)
    toast(okMsg, opts?.danger ? 'error' : 'success')
    // Give the server a moment to update its files, then refresh the roster.
    setTimeout(onRefresh, 800)
  }

  const otherOnline = onlinePlayers.filter((o) => o.uuid !== p.uuid)
  const canModerate = running // op/whitelist/ban operate by name, server just needs to be up
  const canTarget = running && p.online // tp / kick / run-as / DM need a live entity
  const offlineHint = !running ? 'Start the server first' : !p.online ? `${p.name} is offline` : undefined

  return (
    <div className="panel-overlay" role="dialog" aria-modal="true" aria-label={`Manage ${p.name}`}>
      <button type="button" className="panel-backdrop" aria-label="Close" onClick={onClose} />
      <aside className="panel">
        <header className="panel-header">
          <img className="panel-avatar" src={`https://mc-heads.net/avatar/${p.uuid}/72`} alt={p.name} />
          <div className="panel-id">
            <h3>{p.name}</h3>
            <div className="panel-badges">
              <span className={`panel-status ${p.online ? 'online' : 'offline'}`}>{p.online ? 'Online' : 'Offline'}</span>
              {p.is_op && <span className="badge badge-op">OP</span>}
              {p.is_banned && <span className="badge badge-banned">Banned</span>}
              {p.is_whitelisted && <span className="badge badge-whitelisted">Whitelisted</span>}
            </div>
          </div>
          <button type="button" className="panel-close" aria-label="Close panel" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="panel-stats">
          <div className="panel-stat">
            <Clock size={15} />
            <span className="panel-stat-label">Total played</span>
            <span className="panel-stat-value">{formatPlaytime(p.total_playtime_ticks)}</span>
          </div>
          <div className="panel-stat">
            <Timer size={15} />
            <span className="panel-stat-label">This session</span>
            <span className="panel-stat-value">{formatSession(p.online_since, p.online)}</span>
          </div>
          <div className="panel-stat">
            <Skull size={15} />
            <span className="panel-stat-label">Deaths</span>
            <span className="panel-stat-value">{p.deaths ?? '—'}</span>
          </div>
        </div>

        <div className="panel-body">
          {/* Status */}
          <section className="panel-section">
            <h4>Status</h4>
            <div className="panel-row">
              <button
                type="button"
                className="panel-action"
                disabled={!canModerate}
                onClick={() => dispatch(playerActionCommand(p.is_op ? 'deop' : 'op', p.name), `${p.is_op ? 'De-opped' : 'Opped'} ${p.name}`)}
              >
                {p.is_op ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}
                {p.is_op ? 'Remove operator' : 'Make operator'}
              </button>
              <button
                type="button"
                className="panel-action"
                disabled={!canModerate}
                onClick={() =>
                  dispatch(
                    playerActionCommand(p.is_whitelisted ? 'whitelist-remove' : 'whitelist-add', p.name),
                    `${p.is_whitelisted ? 'Removed' : 'Added'} ${p.name} ${p.is_whitelisted ? 'from' : 'to'} whitelist`,
                  )
                }
              >
                {p.is_whitelisted ? <UserMinus size={16} /> : <UserPlus size={16} />}
                {p.is_whitelisted ? 'Remove from whitelist' : 'Add to whitelist'}
              </button>
            </div>
          </section>

          {/* Teleport */}
          <section className="panel-section">
            <h4>Teleport</h4>
            <div className="panel-row">
              <button
                type="button"
                className="panel-action"
                disabled={!canTarget || !worldSpawn}
                title={!worldSpawn ? 'Spawn location unavailable (needs server support)' : offlineHint}
                onClick={() => worldSpawn && dispatch(teleportToCoordsCommand(p.name, worldSpawn.x, worldSpawn.y, worldSpawn.z), `Teleported ${p.name} to spawn`)}
              >
                <Crosshair size={16} /> To spawn
              </button>
            </div>
            <div className="panel-inline">
              <Navigation size={16} className="panel-inline-icon" />
              <select value={tpTarget} disabled={!canTarget} onChange={(e) => setTpTarget(e.target.value)} aria-label="Teleport target">
                <option value="">To player…</option>
                {otherOnline.map((o) => (
                  <option key={o.uuid} value={o.name}>
                    {o.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="panel-go"
                disabled={!canTarget || !tpTarget}
                onClick={() => dispatch(teleportToPlayerCommand(p.name, tpTarget), `Teleported ${p.name} to ${tpTarget}`)}
              >
                Go
              </button>
            </div>
            <div className="panel-inline">
              <MapPin size={16} className="panel-inline-icon" />
              <input className="coord" type="number" placeholder="x" value={coords.x} disabled={!canTarget} onChange={(e) => setCoords({ ...coords, x: e.target.value })} aria-label="x" />
              <input className="coord" type="number" placeholder="y" value={coords.y} disabled={!canTarget} onChange={(e) => setCoords({ ...coords, y: e.target.value })} aria-label="y" />
              <input className="coord" type="number" placeholder="z" value={coords.z} disabled={!canTarget} onChange={(e) => setCoords({ ...coords, z: e.target.value })} aria-label="z" />
              <button
                type="button"
                className="panel-go"
                disabled={!canTarget || coords.x === '' || coords.y === '' || coords.z === ''}
                onClick={() => dispatch(teleportToCoordsCommand(p.name, Number(coords.x), Number(coords.y), Number(coords.z)), `Teleported ${p.name} to ${coords.x} ${coords.y} ${coords.z}`)}
              >
                Go
              </button>
            </div>
          </section>

          {/* Communicate */}
          <section className="panel-section">
            <h4>Communicate</h4>
            <div className="panel-inline">
              <Send size={16} className="panel-inline-icon" />
              <input
                type="text"
                placeholder="Direct message…"
                value={dm}
                disabled={!canTarget}
                onChange={(e) => setDm(e.target.value)}
                aria-label="Direct message"
              />
              <select value={dmColor} disabled={!canTarget} onChange={(e) => setDmColor(e.target.value as TellrawColor)} aria-label="Message colour">
                {TELLRAW_COLORS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button type="button" className="panel-go" disabled={!canTarget || !dm.trim()} onClick={() => dispatch(directMessageCommand(p.name, dm, dmColor), `Message sent to ${p.name}`)}>
                Send
              </button>
            </div>
            <div className="panel-inline">
              <Terminal size={16} className="panel-inline-icon" />
              <input
                type="text"
                placeholder="Run command as this player…"
                value={runCmd}
                disabled={!canTarget}
                onChange={(e) => setRunCmd(e.target.value)}
                aria-label="Run command as player"
              />
              <button type="button" className="panel-go" disabled={!canTarget || !runCmd.trim()} onClick={() => dispatch(runAsCommand(p.name, runCmd), `Ran command as ${p.name}`)}>
                Run
              </button>
            </div>
          </section>

          {/* Moderation */}
          <section className="panel-section">
            <h4>Moderation</h4>
            <div className="panel-inline">
              <input
                type="text"
                placeholder="Reason (optional)…"
                value={reason}
                disabled={!canModerate}
                onChange={(e) => setReason(e.target.value)}
                aria-label="Moderation reason"
              />
            </div>
            <div className="panel-row">
              <button
                type="button"
                className="panel-action danger"
                disabled={!canTarget}
                title={offlineHint}
                onClick={() => dispatch(kickCommand(p.name, reason), `Kicked ${p.name}`, { danger: true })}
              >
                <LogOut size={16} /> Kick
              </button>
              {p.is_banned ? (
                <button
                  type="button"
                  className="panel-action"
                  disabled={!canModerate}
                  onClick={() => dispatch(playerActionCommand('pardon', p.name), `Unbanned ${p.name}`)}
                >
                  <CircleCheck size={16} /> Unban
                </button>
              ) : (
                <button
                  type="button"
                  className="panel-action danger"
                  disabled={!canModerate}
                  onClick={() => dispatch(banCommand(p.name, reason), `Banned ${p.name}`, { danger: true, confirm: `Ban ${p.name}? They won't be able to rejoin until unbanned.` })}
                >
                  <Ban size={16} /> Ban
                </button>
              )}
              <button
                type="button"
                className="panel-action danger"
                disabled={!canModerate}
                onClick={() => dispatch(ipBanCommand(p.name, reason), `IP-banned ${p.name}`, { danger: true, confirm: `IP-ban ${p.name}? This blocks their IP address.` })}
              >
                <ShieldBan size={16} /> IP-ban
              </button>
            </div>
          </section>

          {/* External */}
          <section className="panel-section">
            <h4>External</h4>
            <div className="panel-row">
              {BLUEMAP_URL ? (
                <a className="panel-action" href={BLUEMAP_URL} target="_blank" rel="noreferrer">
                  <MapIcon size={16} /> View on BlueMap
                </a>
              ) : (
                <span className="panel-note" title="Set VITE_BLUEMAP_URL to your BlueMap address">
                  <MapIcon size={16} /> BlueMap not configured
                </span>
              )}
            </div>
          </section>
        </div>
      </aside>
    </div>
  )
}
