import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useGlobalAlert, type AlertConfig } from './AlertContext'

const ACCOUNT_PATH = '/account' // adjust to your Account page route

export function MissingEmailAlert() {
  const { isAuthenticated, username, me, meResolved } = useAuth()
  const { pathname } = useLocation()

  // Wait for /me to settle, and never show it to a logged-out user.
  // `me` is null when /me failed (older backend), which counts as "unknown", not "no email".
  const active =
    isAuthenticated &&
    meResolved &&
    !!me &&
    !me.email?.trim() &&
    pathname !== ACCOUNT_PATH

  const config = useMemo<AlertConfig | null>(
    () =>
      active
        ? {
            id: `missing-email-${username}`, // per user, so one account's dismissal doesn't hide it for another
            title: 'Add your email',
            message:
              "Your account doesn't have an email address yet. Add one so you can reset your password if you ever get locked out.",
            tone: 'warning',
            action: { label: 'Go to account', to: ACCOUNT_PATH },
            dismissLabel: 'Remind me later',
          }
        : null,
    [active, username],
  )

  useGlobalAlert(config)
  return null
}