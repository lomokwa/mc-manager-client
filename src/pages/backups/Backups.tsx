import { useCallback, useEffect, useState } from 'react'
import { Archive, Plus, RotateCcw, Trash2, Save, Clock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useServer } from '../../context/ServerContext'
import { useToast } from '../../components/toast/ToastContext'
import { API_BASE, authHeaders } from '../../lib/api'
import { formatBytes, formatWhen } from '../../lib/format'
import './Backups.css'

interface BackupInfo {
  name: string
  size: number
  created: string
}

interface BackupConfig {
  enabled: boolean
  interval_minutes: number
  keep: number
}

interface APIResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

const INTERVALS = [
  { m: 60, label: 'Every hour' },
  { m: 180, label: 'Every 3 hours' },
  { m: 360, label: 'Every 6 hours' },
  { m: 720, label: 'Every 12 hours' },
  { m: 1440, label: 'Every day' },
]

function Backups() {
  const { token } = useAuth()
  const { running } = useServer()
  const { toast } = useToast()
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [config, setConfig] = useState<BackupConfig | null>(null)
  const [savingCfg, setSavingCfg] = useState(false)
  const [confirm, setConfirm] = useState<{ kind: 'restore' | 'delete'; name: string } | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [reload, setReload] = useState(0)

  const headers = authHeaders(token)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch(`${API_BASE}/backups`, { headers }).then((r) => r.json()),
      fetch(`${API_BASE}/backups/config`, { headers }).then((r) => r.json()),
    ])
      .then(([list, cfg]: [APIResponse<BackupInfo[]>, APIResponse<BackupConfig>]) => {
        if (cancelled) return
        if (list.success && list.data) {
          setBackups(list.data)
          setError(null)
        } else {
          setError(list.error ?? 'Failed to load backups')
        }
        if (cfg.success && cfg.data) setConfig(cfg.data)
      })
      .catch(() => !cancelled && setError('Could not reach the server'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, reload])

  const createNow = async () => {
    setCreating(true)
    toast('Creating a backup… this can take a moment', 'info')
    try {
      const res = await fetch(`${API_BASE}/backups`, { method: 'POST', headers })
      const data: APIResponse<BackupInfo> = await res.json()
      if (data.success) {
        toast('Backup created', 'success')
        setReload((n) => n + 1)
      } else {
        toast(data.error ?? 'Backup failed', 'error')
      }
    } catch {
      toast('Backup failed', 'error')
    } finally {
      setCreating(false)
    }
  }

  const doRestore = useCallback(
    async (name: string) => {
      try {
        const res = await fetch(`${API_BASE}/backups/restore`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name }),
        })
        const data: APIResponse = await res.json()
        if (data.success) toast(`Restored ${name}`, 'success')
        else toast(data.error ?? 'Restore failed', 'error')
      } catch {
        toast('Restore failed', 'error')
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token],
  )

  const doDelete = useCallback(
    async (name: string) => {
      try {
        const res = await fetch(`${API_BASE}/backups?name=${encodeURIComponent(name)}`, {
          method: 'DELETE',
          headers,
        })
        const data: APIResponse = await res.json()
        if (data.success) {
          toast('Backup deleted', 'success')
          setReload((n) => n + 1)
        } else {
          toast(data.error ?? 'Delete failed', 'error')
        }
      } catch {
        toast('Delete failed', 'error')
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token],
  )

  const runConfirm = () => {
    if (!confirm) return
    if (confirm.kind === 'restore') doRestore(confirm.name)
    else doDelete(confirm.name)
    setConfirm(null)
  }

  const saveConfig = async () => {
    if (!config) return
    setSavingCfg(true)
    try {
      const res = await fetch(`${API_BASE}/backups/config`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(config),
      })
      const data: APIResponse<BackupConfig> = await res.json()
      if (data.success) {
        toast('Schedule saved', 'success')
        if (data.data) setConfig(data.data)
      } else {
        toast(data.error ?? 'Failed to save schedule', 'error')
      }
    } catch {
      toast('Failed to save schedule', 'error')
    } finally {
      setSavingCfg(false)
    }
  }

  const intervalOptions = config && !INTERVALS.some((i) => i.m === config.interval_minutes)
    ? [{ m: config.interval_minutes, label: `Every ${config.interval_minutes} min` }, ...INTERVALS]
    : INTERVALS

  return (
    <div className="backups-page">
      <div className="backups-head">
        <div>
          <h2>Backups</h2>
          <p className="backups-note">Timestamped snapshots of your world.</p>
        </div>
        <button className="bbtn bbtn-primary" onClick={createNow} disabled={creating}>
          <Plus size={15} />
          {creating ? 'Creating…' : 'Back up now'}
        </button>
      </div>

      {/* Schedule */}
      {config && (
        <section className="backups-schedule">
          <div className="schedule-head">
            <Clock size={16} />
            <span>Automatic backups</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              />
              <span className="switch-track" />
            </label>
          </div>
          <div className="schedule-fields" data-enabled={config.enabled}>
            <label className="field">
              <span>Frequency</span>
              <select
                value={config.interval_minutes}
                onChange={(e) => setConfig({ ...config, interval_minutes: Number(e.target.value) })}
              >
                {intervalOptions.map((i) => (
                  <option key={i.m} value={i.m}>{i.label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Keep last</span>
              <input
                type="number"
                min={0}
                value={config.keep}
                onChange={(e) => setConfig({ ...config, keep: Math.max(0, Number(e.target.value)) })}
              />
            </label>
            <button className="bbtn" onClick={saveConfig} disabled={savingCfg}>
              <Save size={15} />
              {savingCfg ? 'Saving…' : 'Save'}
            </button>
          </div>
        </section>
      )}

      {loading && <p className="backups-loading">Loading…</p>}
      {error && <p className="backups-error">{error}</p>}

      {!loading && !error && backups.length === 0 && (
        <div className="backups-empty">
          <Archive size={22} />
          <p>No backups yet. Create one now, or enable automatic backups above.</p>
        </div>
      )}

      {!loading && !error && backups.length > 0 && (
        <ul className="backups-list">
          {backups.map((b) => (
            <li key={b.name} className="backup-row">
              <Archive size={17} className="backup-icon" />
              <div className="backup-info">
                <span className="backup-name">{b.name}</span>
                <span className="backup-meta">{formatBytes(b.size)} · {formatWhen(b.created, now)}</span>
              </div>
              {confirm && confirm.name === b.name ? (
                <div className="backup-confirm">
                  <span className="confirm-q">{confirm.kind === 'restore' ? 'Overwrite world?' : 'Delete?'}</span>
                  <button className={`bbtn ${confirm.kind === 'restore' ? 'bbtn-warn' : 'bbtn-danger'}`} onClick={runConfirm}>
                    Confirm
                  </button>
                  <button className="bbtn bbtn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
                </div>
              ) : (
                <div className="backup-actions">
                  <button
                    className="bbtn bbtn-icon"
                    onClick={() => setConfirm({ kind: 'restore', name: b.name })}
                    disabled={running}
                    title={running ? 'Stop the server to restore' : 'Restore this backup'}
                    aria-label="Restore"
                  >
                    <RotateCcw size={15} />
                  </button>
                  <button
                    className="bbtn bbtn-icon bbtn-danger-ghost"
                    onClick={() => setConfirm({ kind: 'delete', name: b.name })}
                    title="Delete this backup"
                    aria-label="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {running && backups.length > 0 && (
        <p className="backups-hint">Restore is disabled while the server is running — stop it first.</p>
      )}
    </div>
  )
}

export default Backups
