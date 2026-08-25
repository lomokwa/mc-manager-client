import { useEffect, useRef, useState } from 'react'
import { Gamepad2, Link2, Unlink, ShieldCheck, ShieldOff, Loader2, Crown, Camera, Trash2, UserRound, Check, KeyRound } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { usePermissions } from '../../context/PermissionsContext'
import { useToast } from '../../components/toast/ToastContext'
import { getAvatarColor } from '../../lib/avatar'
import { failureMessage } from '../../lib/api'
import { fetchPermissionSchema, OWNER_ROLE, type PermissionZone } from '../../lib/permissions'
import { fetchMcLink, startMcLink, verifyMcLink, unlinkMc, type McLink } from '../../lib/mclink'
import { avatarSrc, updateDisplayName, updateEmail, changePassword, uploadAvatar, removeAvatar, AVATAR_ACCEPT } from '../../lib/profile'
import AvatarCropper from '../../components/avatarCropper/AvatarCropper'
import './Account.css'

// A sanity cap on the SOURCE file the cropper is asked to decode -- distinct
// from services.AvatarMaxBytes on the backend, which bounds the cropped
// OUTPUT instead (a 512x512 PNG export is always small regardless of how
// large the original photo was). This just keeps a phone camera's 10-20MB
// photo from being rejected before it ever gets a chance to be cropped down,
// while still refusing to decode something absurd.
const MAX_SOURCE_BYTES = 25 * 1024 * 1024

type LinkStage = 'loading' | 'unlinked' | 'code-sent' | 'linked'

function Account() {
  const { token, username, me, meResolved, refreshMe } = useAuth()
  const { supported, loading: permsLoading, role, can } = usePermissions()
  const { toast } = useToast()

  const [schema, setSchema] = useState<PermissionZone[] | null>(null)

  const [displayNameInput, setDisplayNameInput] = useState('')
  // Tracks which `me` the input was last synced from, so a change to `me`
  // (initial load, or this page's own save/upload via refreshMe()) can reset
  // the input during render -- React's documented alternative to an effect
  // for "adjust state when a prop/value changes" -- without an extra commit.
  const [emailInput, setEmailInput] = useState('')
  const [syncedMe, setSyncedMe] = useState<typeof me>(null)
  if (me !== syncedMe) {
    setSyncedMe(me)
    setDisplayNameInput(me?.display_name ?? '')
    setEmailInput(me?.email ?? '')
  }
  const [savingName, setSavingName] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const [linkStage, setLinkStage] = useState<LinkStage>('loading')
  const [link, setLink] = useState<McLink | null>(null)
  const [mcUsername, setMcUsername] = useState('')
  const [code, setCode] = useState('')
  const [codeExpiresAt, setCodeExpiresAt] = useState<string | null>(null)
  const [linkBusy, setLinkBusy] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  useEffect(() => {
    fetchPermissionSchema(token).then((r) => {
      if (r.kind === 'ok') setSchema(r.data)
    })
    fetchMcLink(token).then((r) => {
      if (r.kind === 'ok' && r.data) {
        setLink(r.data)
        setLinkStage('linked')
      } else {
        setLinkStage('unlinked')
      }
    })
  }, [token])

  const saveDisplayName = async () => {
    setSavingName(true)
    const r = await updateDisplayName(token, displayNameInput.trim())
    if (r.kind === 'ok') {
      refreshMe()
      toast('Display name updated', 'success')
    } else {
      toast(failureMessage(r, 'Failed to update display name'), 'error')
    }
    setSavingName(false)
  }

  const saveEmail = async () => {
    setEmailError(null)
    setSavingEmail(true)
    const r = await updateEmail(token, emailInput.trim())
    if (r.kind === 'ok') {
      refreshMe()
      toast('Email updated', 'success')
    } else {
      setEmailError(failureMessage(r, 'Failed to update email'))
    }
    setSavingEmail(false)
  }

  const submitPasswordChange = async () => {
    setPasswordError(null)

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }

    setPasswordBusy(true)
    const r = await changePassword(token, currentPassword, newPassword)
    if (r.kind === 'ok') {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast('Password changed', 'success')
    } else {
      setPasswordError(failureMessage(r, 'Failed to change password'))
    }
    setPasswordBusy(false)
  }

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // let picking the same file again re-trigger onChange
    if (!file) return

    setAvatarError(null)
    if (file.size > MAX_SOURCE_BYTES) {
      setAvatarError(`Image too large: max ${MAX_SOURCE_BYTES / (1024 * 1024)}MB`)
      return
    }

    setCropFile(file) // opens the crop dialog; the actual upload happens in handleCropped
  }

  const handleCropped = async (cropped: File) => {
    setCropFile(null)
    setAvatarBusy(true)
    const r = await uploadAvatar(token, cropped)
    if (r.kind === 'ok') {
      refreshMe()
      toast('Profile picture updated', 'success')
    } else {
      setAvatarError(failureMessage(r, 'Failed to upload image'))
    }
    setAvatarBusy(false)
  }

  const handleRemoveAvatar = async () => {
    setAvatarBusy(true)
    setAvatarError(null)
    const r = await removeAvatar(token)
    if (r.kind === 'ok') {
      refreshMe()
      toast('Profile picture removed', 'success')
    } else {
      setAvatarError(failureMessage(r, 'Failed to remove image'))
    }
    setAvatarBusy(false)
  }

  const sendCode = async () => {
    const name = mcUsername.trim()
    if (!name) return
    setLinkBusy(true)
    setLinkError(null)
    const r = await startMcLink(token, name)
    if (r.kind === 'ok') {
      setCodeExpiresAt(r.data.expires_at)
      setLinkStage('code-sent')
    } else {
      setLinkError(failureMessage(r, 'Could not reach the server'))
    }
    setLinkBusy(false)
  }

  const confirmCode = async () => {
    const value = code.trim()
    if (!value) return
    setLinkBusy(true)
    setLinkError(null)
    const r = await verifyMcLink(token, value)
    if (r.kind === 'ok') {
      setLink(r.data)
      setLinkStage('linked')
      setCode('')
      toast('Minecraft account linked', 'success')
    } else {
      setLinkError(failureMessage(r, 'Could not reach the server'))
    }
    setLinkBusy(false)
  }

  const doUnlink = async () => {
    setLinkBusy(true)
    const r = await unlinkMc(token)
    if (r.kind === 'ok') {
      setLink(null)
      setLinkStage('unlinked')
      setMcUsername('')
      toast('Minecraft account unlinked', 'success')
    } else {
      toast(failureMessage(r, 'Could not reach the server'), 'error')
    }
    setLinkBusy(false)
  }

  const isOwner = role === OWNER_ROLE

  return (
    <div className="account-page">
      <h2>My Account</h2>

      <section className="acct-identity">
        {avatarSrc(me?.avatar_url) ? (
          <img className="acct-avatar acct-avatar-img" src={avatarSrc(me?.avatar_url)!} alt="" />
        ) : (
          <span className="acct-avatar" style={{ background: getAvatarColor(username ?? '?') }}>
            {(me?.display_name || username || '?').charAt(0).toUpperCase()}
          </span>
        )}
        <div className="acct-identity-text">
          <span className="acct-name">{me?.display_name || username}</span>
          <span className="acct-sub">
            {me
              ? `Member since ${new Date(me.created_at).toLocaleDateString()}`
              : meResolved
                ? 'Signed in'
                : 'Loading…'}
            {role && <span className={`acct-role-badge ${isOwner ? 'is-owner' : ''}`}>{role}</span>}
          </span>
        </div>
      </section>

      <div className="acct-cols">
      <div className="acct-col">
      <section className="acct-card">
        <h3 className="acct-card-title">
          <UserRound size={16} /> Profile
        </h3>

        <div className="acct-profile-edit">
          <div className="acct-avatar-edit">
            {avatarSrc(me?.avatar_url) ? (
              <img className="acct-avatar acct-avatar-img" src={avatarSrc(me?.avatar_url)!} alt="" />
            ) : (
              <span className="acct-avatar" style={{ background: getAvatarColor(username ?? '?') }}>
                {(me?.display_name || username || '?').charAt(0).toUpperCase()}
              </span>
            )}
            <div className="acct-avatar-actions">
              <button
                className="acct-btn acct-btn-ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarBusy}
              >
                {avatarBusy ? <Loader2 size={15} className="acct-spin" /> : <Camera size={15} />}
                {me?.avatar_url ? 'Change photo' : 'Upload photo'}
              </button>
              {me?.avatar_url && (
                <button className="acct-btn acct-btn-ghost" onClick={handleRemoveAvatar} disabled={avatarBusy}>
                  <Trash2 size={15} /> Remove
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={AVATAR_ACCEPT}
                hidden
                onChange={handleAvatarFile}
              />
            </div>
          </div>
          {avatarError && <p className="acct-error">{avatarError}</p>}

          <div className="acct-field">
            <label className="acct-label" htmlFor="acct-display-name">Display name</label>
            <div className="acct-inline-form">
              <input
                id="acct-display-name"
                className="acct-input"
                placeholder={username ?? ''}
                value={displayNameInput}
                maxLength={32}
                disabled={savingName}
                onChange={(e) => setDisplayNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveDisplayName()}
              />
              <button
                className="acct-btn acct-btn-primary"
                onClick={saveDisplayName}
                disabled={savingName || displayNameInput === (me?.display_name ?? '')}
              >
                {savingName ? <Loader2 size={15} className="acct-spin" /> : <Check size={15} />}
                Save
              </button>
            </div>
            <p className="acct-hint">Shown instead of your username around the app. Leave blank to use your username.</p>
          </div>

          <div className="acct-field">
            <label className="acct-label" htmlFor="acct-email">Email</label>
            <div className="acct-inline-form">
              <input
                id="acct-email"
                className="acct-input"
                type="email"
                placeholder="you@example.com"
                value={emailInput}
                disabled={savingEmail}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveEmail()}
              />
              <button
                className="acct-btn acct-btn-primary"
                onClick={saveEmail}
                disabled={savingEmail || emailInput.trim() === (me?.email ?? '')}
              >
                {savingEmail ? <Loader2 size={15} className="acct-spin" /> : <Check size={15} />}
                Save
              </button>
            </div>
            {emailError && <p className="acct-error">{emailError}</p>}
            <p className="acct-hint">Not shown to other users. Leave blank to remove it.</p>
          </div>
        </div>
      </section>

      <section className="acct-card">
        <h3 className="acct-card-title">
          <KeyRound size={16} /> Security
        </h3>

        <div className="acct-field">
          <label className="acct-label" htmlFor="acct-current-password">Current password</label>
          <input
            id="acct-current-password"
            className="acct-input"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            disabled={passwordBusy}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div className="acct-field">
          <label className="acct-label" htmlFor="acct-new-password">New password</label>
          <input
            id="acct-new-password"
            className="acct-input"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            disabled={passwordBusy}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div className="acct-field">
          <label className="acct-label" htmlFor="acct-confirm-password">Confirm new password</label>
          <input
            id="acct-confirm-password"
            className="acct-input"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            disabled={passwordBusy}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitPasswordChange()}
          />
        </div>
        <button
          className="acct-btn acct-btn-primary"
          onClick={submitPasswordChange}
          disabled={passwordBusy || !currentPassword || !newPassword || !confirmPassword}
        >
          {passwordBusy ? <Loader2 size={15} className="acct-spin" /> : <KeyRound size={15} />}
          Change password
        </button>
        {passwordError && <p className="acct-error">{passwordError}</p>}
      </section>
      </div>

      <div className="acct-col">
      <section className="acct-card">
        <h3 className="acct-card-title">
          <Gamepad2 size={16} /> Minecraft account
        </h3>

        {linkStage === 'loading' && <p className="acct-hint">Loading…</p>}

        {linkStage === 'linked' && link && (
          <div className="acct-linked">
            <img
              className="acct-mc-head"
              src={`https://mc-heads.net/avatar/${link.mc_uuid || link.mc_username}/48`}
              alt=""
              aria-hidden="true"
            />
            <div className="acct-linked-text">
              <span className="acct-mc-name">{link.mc_username}</span>
              <span className="acct-sub">Linked {new Date(link.linked_at).toLocaleDateString()}</span>
            </div>
            <button className="acct-btn acct-btn-ghost" onClick={doUnlink} disabled={linkBusy}>
              <Unlink size={15} /> Unlink
            </button>
          </div>
        )}

        {linkStage === 'unlinked' && (
          <>
            <p className="acct-help">
              Link your Minecraft account to prove it's yours. You'll need to be online to receive the code.
            </p>
            <div className="acct-inline-form">
              <input
                className="acct-input"
                placeholder="Your Minecraft username"
                value={mcUsername}
                disabled={linkBusy}
                maxLength={16}
                onChange={(e) => setMcUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendCode()}
              />
              <button className="acct-btn acct-btn-primary" onClick={sendCode} disabled={linkBusy || !mcUsername.trim()}>
                {linkBusy ? <Loader2 size={15} className="acct-spin" /> : <Link2 size={15} />}
                Send code
              </button>
            </div>
            {linkError && <p className="acct-error">{linkError}</p>}
          </>
        )}

        {linkStage === 'code-sent' && (
          <>
            <p className="acct-help">
              Check your in-game chat for a private message with a 6-character code
              {codeExpiresAt && <> — it expires at {new Date(codeExpiresAt).toLocaleTimeString()}</>}.
            </p>
            <div className="acct-inline-form">
              <input
                className="acct-input acct-code-input"
                placeholder="CODE"
                value={code}
                disabled={linkBusy}
                maxLength={6}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && confirmCode()}
              />
              <button className="acct-btn acct-btn-primary" onClick={confirmCode} disabled={linkBusy || !code.trim()}>
                {linkBusy ? <Loader2 size={15} className="acct-spin" /> : <ShieldCheck size={15} />}
                Confirm
              </button>
              <button
                className="acct-btn acct-btn-ghost"
                disabled={linkBusy}
                onClick={() => {
                  setLinkStage('unlinked')
                  setCode('')
                  setLinkError(null)
                }}
              >
                Cancel
              </button>
            </div>
            {linkError && <p className="acct-error">{linkError}</p>}
          </>
        )}
      </section>

      <section className="acct-card">
        <h3 className="acct-card-title">
          <ShieldCheck size={16} /> My permissions
        </h3>

        {!supported ? (
          <p className="acct-hint">This server build doesn't support permissions yet.</p>
        ) : permsLoading || !schema ? (
          <p className="acct-hint">Loading…</p>
        ) : isOwner ? (
          <div className="acct-owner-banner">
            <Crown size={18} />
            You have full access to everything — you're the Owner.
          </div>
        ) : !role ? (
          <p className="acct-hint">
            No role assigned yet. Ask an admin to grant you access on the Users page.
          </p>
        ) : (
          <div className="acct-perm-zones">
            {schema.map((zone) => (
              <div className="acct-perm-zone" key={zone.key}>
                <h4 className="acct-perm-zone-title">{zone.label}</h4>
                <ul className="acct-perm-list">
                  {zone.permissions.map((p) => (
                    <li
                      key={p.key}
                      className={`acct-perm-row ${can(p.key) ? 'is-granted' : ''}`}
                      title={p.description}
                    >
                      {can(p.key) ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
                      {p.label}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
      </div>
      </div>

      {cropFile && (
        <AvatarCropper file={cropFile} onCancel={() => setCropFile(null)} onCropped={handleCropped} />
      )}
    </div>
  )
}

export default Account
