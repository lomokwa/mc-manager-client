import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Folder, FileText, ChevronRight, ArrowUp, RefreshCw, Upload, Download, Save, X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/toast/ToastContext'
import { API_BASE, authHeaders } from '../../lib/api'
import { formatBytes } from '../../lib/format'
import './Files.css'

interface FileEntry {
  name: string
  is_dir: boolean
  size: number
  mod_time: string
}

interface APIResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

function parentPath(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? '' : path.slice(0, i)
}

function Files() {
  const { token } = useAuth()
  const { toast } = useToast()
  const [path, setPath] = useState('')
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ name: string; path: string; content: string } | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reload, setReload] = useState(0)
  const uploadRef = useRef<HTMLInputElement>(null)

  const headers = authHeaders(token)

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/files?path=${encodeURIComponent(path)}`, { headers })
      .then((r) => r.json())
      .then((data: APIResponse<FileEntry[]>) => {
        if (cancelled) return
        if (data.success && data.data) {
          const sorted = [...data.data].sort((a, b) => {
            if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1
            return a.name.localeCompare(b.name)
          })
          setEntries(sorted)
          setError(null)
        } else {
          setError(data.error ?? 'Failed to list files')
        }
      })
      .catch(() => !cancelled && setError('Could not reach the server'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, token, reload])

  const joinPath = (name: string) => (path ? `${path}/${name}` : name)

  const openEntry = useCallback(
    async (entry: FileEntry) => {
      if (entry.is_dir) {
        setPath(joinPath(entry.name))
        return
      }
      const filePath = joinPath(entry.name)
      try {
        const res = await fetch(`${API_BASE}/files/read?path=${encodeURIComponent(filePath)}`, { headers })
        const data: APIResponse<string> = await res.json()
        if (data.success && typeof data.data === 'string') {
          setEditing({ name: entry.name, path: filePath, content: data.data })
          setDirty(false)
        } else {
          toast(data.error ?? 'That file can’t be opened as text — try downloading it', 'error')
        }
      } catch {
        toast('Could not read the file', 'error')
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, token],
  )

  const saveFile = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/files?path=${encodeURIComponent(editing.path)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ content: editing.content }),
      })
      const data: APIResponse = await res.json()
      if (data.success) {
        toast(`Saved ${editing.name}`, 'success')
        setDirty(false)
      } else {
        toast(data.error ?? 'Failed to save', 'error')
      }
    } catch {
      toast('Could not save the file', 'error')
    } finally {
      setSaving(false)
    }
  }

  const download = async (entry: FileEntry) => {
    const filePath = joinPath(entry.name)
    try {
      const res = await fetch(`${API_BASE}/files/download?path=${encodeURIComponent(filePath)}`, { headers })
      if (!res.ok) {
        toast('Download failed', 'error')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = entry.name
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast('Download failed', 'error')
    }
  }

  const upload = async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch(`${API_BASE}/files/upload?path=${encodeURIComponent(path)}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
        body: form,
      })
      const data: APIResponse = await res.json()
      if (data.success) {
        toast(`Uploaded ${file.name}`, 'success')
        setReload((n) => n + 1)
      } else {
        toast(data.error ?? 'Upload failed', 'error')
      }
    } catch {
      toast('Upload failed', 'error')
    }
  }

  const crumbs = path ? path.split('/') : []

  if (editing) {
    return (
      <div className="files-page">
        <div className="file-editor">
          <div className="file-editor-bar">
            <FileText size={16} className="file-editor-icon" />
            <span className="file-editor-name">{editing.path}</span>
            {dirty && <span className="file-editor-dirty" title="Unsaved changes">●</span>}
            <button className="fbtn" onClick={saveFile} disabled={!dirty || saving}>
              <Save size={15} />
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="fbtn fbtn-ghost" onClick={() => setEditing(null)} aria-label="Close editor">
              <X size={15} />
            </button>
          </div>
          <textarea
            className="file-editor-area"
            value={editing.content}
            spellCheck={false}
            onChange={(e) => {
              setEditing((cur) => (cur ? { ...cur, content: e.target.value } : cur))
              setDirty(true)
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="files-page">
      <div className="files-bar">
        <nav className="files-crumbs" aria-label="Path">
          <button className="crumb" onClick={() => setPath('')}>server</button>
          {crumbs.map((seg, i) => (
            <span key={i} className="crumb-seg">
              <ChevronRight size={13} className="crumb-sep" />
              <button className="crumb" onClick={() => setPath(crumbs.slice(0, i + 1).join('/'))}>
                {seg}
              </button>
            </span>
          ))}
        </nav>
        <div className="files-actions">
          <button className="fbtn fbtn-icon" onClick={() => setPath(parentPath(path))} disabled={!path} title="Up one level" aria-label="Up one level">
            <ArrowUp size={15} />
          </button>
          <button className="fbtn fbtn-icon" onClick={() => setReload((n) => n + 1)} title="Refresh" aria-label="Refresh">
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
          <button className="fbtn" onClick={() => uploadRef.current?.click()}>
            <Upload size={15} />
            Upload
          </button>
          <input
            ref={uploadRef}
            type="file"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) upload(f)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      {loading && <p className="files-loading">Loading…</p>}
      {error && <p className="files-error">{error}</p>}

      {!loading && !error && entries.length === 0 && (
        <p className="files-empty">This folder is empty.</p>
      )}

      {!loading && !error && entries.length > 0 && (
        <ul className="files-list">
          {entries.map((entry, i) => (
            <li key={entry.name} className="file-row stagger-item" style={{ '--i': Math.min(i, 14) } as React.CSSProperties}>
              <button className="file-main" onClick={() => openEntry(entry)}>
                {entry.is_dir ? (
                  <Folder size={17} className="file-icon file-icon-dir" />
                ) : (
                  <FileText size={17} className="file-icon" />
                )}
                <span className="file-name">{entry.name}</span>
                {!entry.is_dir && <span className="file-size">{formatBytes(entry.size)}</span>}
                {entry.is_dir && <ChevronRight size={15} className="file-go" />}
              </button>
              {!entry.is_dir && (
                <button className="fbtn fbtn-icon file-dl" onClick={() => download(entry)} title="Download" aria-label={`Download ${entry.name}`}>
                  <Download size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default Files
