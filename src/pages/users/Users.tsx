import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Copy, Check, Plus, X } from 'lucide-react'
import { apiFetch, authHeaders } from '../../lib/api'
import type { User, Invitation } from '../../types/user'
import './Users.css'

const AVATAR_COLORS = [
  '#7c3aed', '#e03e6a', '#2563eb', '#0891b2', '#059669',
  '#d97706', '#dc2626', '#7c3aed', '#4f46e5', '#0d9488',
]

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function Users() {
  const { token, logout } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const headers = authHeaders(token)

  useEffect(() => {
    let cancelled = false

    apiFetch<User[]>('/users', { headers })
      .then((r) => {
        if (cancelled) return
        if (r.kind === 'ok') setUsers(r.data)
        else if (r.kind === 'unauthorized') logout()
        else if (r.kind === 'network') setError('Could not connect to server')
        // other kinds: leave the list empty (matches the prior silent path)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [token])

  const createInvitation = async () => {
    setCreating(true)
    setError(null)
    const r = await apiFetch<Invitation>('/admin/invitations', { method: 'POST', headers })
    if (r.kind === 'ok') setInviteLink(r.data.link)
    else if (r.kind === 'unauthorized') logout()
    else if (r.kind === 'network') setError('Could not connect to server')
    else setError(r.kind === 'error' ? r.message : 'Failed to create invitation')
    setCreating(false)
  }

  const copyToClipboard = () => {
    if (!inviteLink) return
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const dismissInvite = () => {
    setInviteLink(null)
    setCopied(false)
  }

  return (
    <div className="users-page">
      <div className="users-header">
        <h2>Users</h2>
        <button className="btn-invite" onClick={createInvitation} disabled={creating}>
          <Plus size={16} />
          {creating ? 'Creating...' : 'Invite User'}
        </button>
      </div>

      {error && <p className="users-error">{error}</p>}

      {inviteLink && (
        <div className="modal-overlay" onClick={dismissInvite}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Invitation Created</h3>
              <button className="btn-dismiss" onClick={dismissInvite} title="Close">
                <X size={16} />
              </button>
            </div>
            <p className="modal-description">Share this link with the user you want to invite:</p>
            <div className="invite-link-row">
              <code className="invite-link">{inviteLink}</code>
              <button className="btn-copy" onClick={copyToClipboard} title="Copy link">
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <span className="invite-note">Expires in 24 hours</span>
          </div>
        </div>
      )}

      {loading && <p className="users-loading">Loading users...</p>}

      {!loading && users.length === 0 && (
        <p className="users-empty">No users registered yet.</p>
      )}

      {!loading && users.length > 0 && (
        <div className="users-list">
          {users.map((user) => (
            <div key={user.id} className="user-card">
              <div className="user-avatar-placeholder" style={{ background: getAvatarColor(user.username) }}>
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="user-info">
                <span className="user-name">{user.username}</span>
                <span className="user-joined">Joined {new Date(user.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Users
