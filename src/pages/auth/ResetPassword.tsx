import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { failureMessage } from '../../lib/api'
import './Auth.css'
import { sendResetPassword } from '../../lib/auth'

// Keep these in sync with validatePassword on the backend.
const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_BYTES = 72 // bcrypt only uses the first 72 bytes

function validate(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return `Password must be at most ${MAX_PASSWORD_BYTES} characters`
  }
  if (password !== confirm) {
    return 'Passwords do not match'
  }
  return null
}

function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Read the token once into state, then strip it from the address bar below.
  const [token] = useState(() => searchParams.get('token') ?? '')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  // Keeps the token out of browser history, screenshots, and the Referer header.
  useEffect(() => {
    if (token) navigate('/reset-password', { replace: true })
  }, [token, navigate])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    const problem = validate(password, confirm)
    if (problem) {
      setError(problem)
      return
    }

    setError(null)
    setLoading(true)
    try {
      const r = await sendResetPassword(token, password)
      if (r.kind === 'error') {
        setError(failureMessage(r, 'Failed to reset password, try again later'))
        return
      }
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password, try again later')
    } finally {
      setLoading(false)
    }
  }

  // No token in the URL (or the page was refreshed after it was stripped).
  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Invalid link</h1>
          <p>This password reset link is missing or no longer valid. Request a new one to continue.</p>
          <div className="auth-link">
            <Link to="/forgot-password">Request a new link</Link>
          </div>
          <div className="auth-link">
            <Link to="/login">Back to login</Link>
          </div>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Password updated</h1>
          <p>Your password has been changed. You can now log in with your new password.</p>
          <div className="auth-link">
            <Link to="/login">Go to login</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Reset Password</h1>
        <p>Choose a new password for your account.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <div className="auth-field">
            <label htmlFor="password">New password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <small className="auth-hint">
              {MIN_PASSWORD_LENGTH}–{MAX_PASSWORD_BYTES} characters
            </small>
          </div>
          <div className="auth-field">
            <label htmlFor="confirm">Confirm new password</label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Updating...' : 'Reset Password'}
          </button>
        </form>
        <div className="auth-link">
          <Link to="/forgot-password">Request a new link</Link>
        </div>
      </div>
    </div>
  )
}

export default ResetPassword