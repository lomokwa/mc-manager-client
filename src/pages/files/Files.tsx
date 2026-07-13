import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Folder, FileText, ChevronRight, ArrowUp, RefreshCw, Upload, UploadCloud, Download, Save, X, Braces,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/toast/ToastContext'
import { API_BASE, authHeaders, apiFetch } from '../../lib/api'
import { formatBytes } from '../../lib/format'
import { languageFor, checkJson } from '../../lib/jsonHighlight'
import CodeEditor from '../../components/editor/CodeEditor'
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
  const { token, logout } = useAuth()
  const { toast } = useToast()
  const [path, setPath] = useState('')
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ name: string; path: string; content: string } | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reload, setReload] = useState(0)
  const [unsupported, setUnsupported] = useState(false)
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)
  const uploadRef = useRef<HTMLInputElement>(null)

  const headers = authHeaders(token)

  useEffect(() => {
    let cancelled = false
    apiFetch<FileEntry[]>(`/files?path=${encodeURIComponent(path)}`, { headers })
      .then((r) => {
        if (cancelled) return
        if (r.kind === 'ok') {
          const sorted = [...r.data].sort((a, b) => {
            if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1
            return a.name.localeCompare(b.name)
          })
          setEntries(sorted)
          setError(null)
          setUnsupported(false)
        } else if (r.kind === 'unsupported') {
          setUnsupported(true)
          setError(null)
        } else if (r.kind === 'unauthorized') {
          logout()
        } else if (r.kind === 'network') {
          setError('Could not reach the server')
        } else {
          setError(r.message)
        }
      })
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
      const r = await apiFetch<string>(`/files/read?path=${encodeURIComponent(filePath)}`, { headers })
      if (r.kind === 'ok') {
        setEditing({ name: entry.name, path: filePath, content: r.data ?? '' })
        setDirty(false)
      } else if (r.kind === 'unauthorized') {
        logout()
      } else if (r.kind === 'unsupported') {
        toast('This server build doesn’t support the file API', 'error')
      } else if (r.kind === 'network') {
        toast('Could not read the file', 'error')
      } else {
        toast(r.message || 'That file can’t be opened as text — try downloading it', 'error')
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, token],
  )

  const saveFile = async () => {
    if (!editing) return
    // Never upload broken JSON over a working config.
    if (languageFor(editing.name) === 'json') {
      const check = checkJson(editing.content)
      if (!check.ok) {
        toast(`Won't save invalid JSON${check.line ? ` (line ${check.line})` : ''} — fix it first`, 'error')
        return
      }
    }
    setSaving(true)
    const r = await apiFetch(`/files?path=${encodeURIComponent(editing.path)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ content: editing.content }),
    })
    if (r.kind === 'ok') {
      toast(`Saved ${editing.name}`, 'success')
      setDirty(false)
    } else if (r.kind === 'unauthorized') {
      logout()
    } else if (r.kind === 'unsupported') {
      toast('This server build doesn’t support the file API', 'error')
    } else if (r.kind === 'network') {
      toast('Could not save the file', 'error')
    } else {
      toast(r.message || 'Failed to save', 'error')
    }
    setSaving(false)
  }

  const download = async (entry: FileEntry) => {
    const filePath = joinPath(entry.name)
    try {
      const res = await fetch(`${API_BASE}/files/download?path=${encodeURIComponent(filePath)}`, { headers })
      if (res.status === 401) { logout(); return }
      if (res.status === 404) {
        toast('This server build doesn’t support the file API', 'error')
        return
      }
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

  // Upload each file as its own request — the backend takes one file per POST,
  // so multiple selected/dropped files fan out into N uploads.
  const uploadFiles = async (files: File[]) => {
    if (!files.length) return
    let ok = 0
    for (const file of files) {
      const form = new FormData()
      form.append('file', file)
      try {
        const res = await fetch(`${API_BASE}/files/upload?path=${encodeURIComponent(path)}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
          body: form,
        })
        if (res.status === 401) { logout(); return }
        if (res.status === 404) { toast('This server build doesn’t support the file API', 'error'); return }
        const data: APIResponse = await res.json()
        if (data.success) ok += 1
        else toast(data.error ?? `Couldn’t upload ${file.name}`, 'error')
      } catch {
        toast(`Couldn’t upload ${file.name}`, 'error')
      }
    }
    if (ok > 0) {
      toast(files.length === 1 ? `Uploaded ${files[0].name}` : `Uploaded ${ok} of ${files.length} files`, 'success')
      setReload((n) => n + 1)
    }
  }

  // Drag-and-drop upload. A depth counter keeps the overlay from flickering as
  // dragenter/leave fire across nested children.
  const hasFiles = (e: React.DragEvent) => !!e.dataTransfer?.types?.includes('Files')
  const onDragEnter = (e: React.DragEvent) => {
    if (unsupported || !hasFiles(e)) return
    e.preventDefault()
    dragDepth.current += 1
    setDragging(true)
  }
  const onDragOver = (e: React.DragEvent) => {
    if (!unsupported && hasFiles(e)) e.preventDefault() // required for the drop to fire
  }
  const onDragLeave = (e: React.DragEvent) => {
    if (!hasFiles(e)) return
    dragDepth.current -= 1
    if (dragDepth.current <= 0) {
      dragDepth.current = 0
      setDragging(false)
    }
  }
  const onDrop = (e: React.DragEvent) => {
    if (unsupported || !hasFiles(e)) return
    e.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    const dropped = e.dataTransfer?.files
    if (dropped && dropped.length) uploadFiles(Array.from(dropped))
  }

  const crumbs = path ? path.split('/') : []

  if (editing) {
    const lang = languageFor(editing.name)
    const jsonState = lang === 'json' ? checkJson(editing.content) : null
    const lineCount = editing.content ? editing.content.split('\n').length : 0
    const formatJson = () => {
      try {
        const pretty = JSON.stringify(JSON.parse(editing.content), null, 2)
        setEditing((cur) => (cur ? { ...cur, content: pretty } : cur))
        setDirty(true)
        toast('Formatted', 'success')
      } catch {
        toast("Can't format — the JSON isn't valid yet", 'error')
      }
    }
    return (
      <div className="files-page">
        <div className="file-editor">
          <div className="file-editor-bar">
            <FileText size={16} className="file-editor-icon" />
            <span className="file-editor-name">{editing.path}</span>
            {dirty && <span className="file-editor-dirty" title="Unsaved changes">●</span>}
            {lang === 'json' && (
              <button className="fbtn fbtn-ghost" onClick={formatJson} title="Format JSON">
                <Braces size={15} />
                Format
              </button>
            )}
            <button className="fbtn" onClick={saveFile} disabled={!dirty || saving}>
              <Save size={15} />
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="fbtn fbtn-ghost" onClick={() => setEditing(null)} aria-label="Close editor">
              <X size={15} />
            </button>
          </div>
          <CodeEditor
            value={editing.content}
            language={lang}
            ariaLabel={`Editing ${editing.name}`}
            onChange={(content) => {
              setEditing((cur) => (cur ? { ...cur, content } : cur))
              setDirty(true)
            }}
          />
          <div className="file-editor-status">
            {jsonState ? (
              jsonState.ok ? (
                <span className="fe-ok"><span className="fe-dot" />Valid JSON</span>
              ) : (
                <span className="fe-bad"><span className="fe-dot" />Invalid JSON{jsonState.line ? ` · line ${jsonState.line}` : ''}</span>
              )
            ) : (
              <span className="fe-muted">{lang === 'properties' ? 'Properties' : 'Plain text'}</span>
            )}
            <span className="fe-meta">{lineCount} lines · {editing.content.length.toLocaleString()} chars</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`files-page ${dragging ? 'is-dragging' : ''}`}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragging && (
        <div className="files-dropzone" aria-hidden="true">
          <UploadCloud size={34} />
          <p>Drop files to upload{path ? ` to ${path}` : ''}</p>
        </div>
      )}
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
            multiple
            hidden
            onChange={(e) => {
              const fs = e.target.files
              if (fs && fs.length) uploadFiles(Array.from(fs))
              e.target.value = ''
            }}
          />
        </div>
      </div>

      {loading && <p className="files-loading">Loading…</p>}
      {error && <p className="files-error">{error}</p>}

      {!loading && unsupported && (
        <div className="files-unsupported">
          <Folder size={22} />
          <p>This server build doesn’t include the file API yet, so browsing files from here isn’t available.</p>
          <p className="files-unsupported-sub">Everything else keeps working — this page lights up automatically once the server adds <code>/api/files</code>.</p>
        </div>
      )}

      {!loading && !error && !unsupported && entries.length === 0 && (
        <p className="files-empty">This folder is empty.</p>
      )}

      {!loading && !error && !unsupported && entries.length > 0 && (
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
