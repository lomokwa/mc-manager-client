import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { failureMessage } from '../../lib/api'
import './Auth.css'
import { sendForgotPassword } from '../../lib/auth'

const RESEND_COOLDOWN_SECONDS = 60

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [resent, setResent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // When each address last got an email (ms timestamps), keyed by normalized email.
  const [sentAt, setSentAt] = useState<Record<string, number>>({})
  // Only drives re-rendering the countdown. Set when a send succeeds and by the interval below.
  const [now, setNow] = useState(0)

  const emailKey = email.trim().toLowerCase()

  // Pure: the caller supplies the current time, so this is safe to call during render.
  const remainingFor = (key: string, at: number) => {
    const last = sentAt[key]
    if (!last) return 0
    return Math.max(0, Math.ceil((last + RESEND_COOLDOWN_SECONDS * 1000 - at) / 1000))
  }

  const cooldown = remainingFor(emailKey, now) // used by the JSX
  const cooling = cooldown > 0

  // Tick once per second while the current address is cooling down.
  useEffect(() => {
    if (!cooling) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [cooling])

  // Returns true if the request went through, so callers decide what to show.
  const sendLink = async (): Promise<boolean> => {
    setError(null)
    setLoading(true)
    try {
      const r = await sendForgotPassword(email.trim())
      if (r.kind === 'error') {
        setError(failureMessage(r, 'Failed to send email, try again later'))
        return false
      }
      const t = Date.now()
      setSentAt((prev) => ({ ...prev, [emailKey]: t }))
      setNow(t)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email, try again later')
      return false
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    // Same address inside the window: an email already went out, so don't send another.
    if (remainingFor(emailKey, Date.now()) > 0) {
      setResent(false)
      setEmailSent(true)
      return
    }

    if (await sendLink()) {
      setResent(false)
      setEmailSent(true)
    }
  }

  const handleResend = async () => {
    if (loading || remainingFor(emailKey, Date.now()) > 0) return
    setResent(false)
    setResent(await sendLink())
  }

  const handleChangeEmail = () => {
    setEmailSent(false)
    setResent(false)
    setError(null)
  }

  if (emailSent) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Check your email</h1>
          <p>
            If an account exists for <strong className="auth-email">{email}</strong>, we've sent
            instructions to reset your password.
          </p>
          <p className="auth-note">
            The link expires in 15 minutes. Check your spam folder if you don't see it.
          </p>

          <div aria-live="polite">
            {error && <div className="auth-error">{error}</div>}
            {resent && !error && <p>Another email is on its way.</p>}
          </div>

          <button
            className="auth-submit auth-submit-centered"
            type="button"
            onClick={handleResend}
            disabled={loading || cooldown > 0}
          >
            {loading
              ? 'Sending...'
              : cooldown > 0
                ? `Resend email in ${cooldown}s`
                : 'Resend email'}
          </button>

          <div className="auth-link">
            <button type="button" className="auth-link-button" onClick={handleChangeEmail}>
              Use a different email
            </button>
          </div>
          <div className="auth-link">
            <Link to="/login">Back to login</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Forgot Password</h1>
        <p>Enter your account email and we'll send you a link to reset your password.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}
          <div className="auth-field">
            <input
              id="email"
              type="email"
              value={email}
              placeholder='your@email.com'
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send Link'}
          </button>
        </form>
        <div className="auth-link">
          <Link to="/login">Back to login</Link>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword