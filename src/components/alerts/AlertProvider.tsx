import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import '../../pages/auth/Auth.css'
import { AlertsContext, type AlertConfig, type AlertsApi } from './AlertContext'

const KEY_PREFIX = 'alertDismissed:'

function readDismissed(id: string): boolean {
  try {
    return sessionStorage.getItem(KEY_PREFIX + id) === '1'
  } catch {
    return false
  }
}

function writeDismissed(id: string) {
  try {
    sessionStorage.setItem(KEY_PREFIX + id, '1')
  } catch {
    // storage unavailable: dismissal lasts until reload
  }
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [queue, setQueue] = useState<AlertConfig[]>([])
  const dismissedRef = useRef(new Set<string>())

  const show = useCallback((alert: AlertConfig) => {
    if (dismissedRef.current.has(alert.id) || readDismissed(alert.id)) return
    setQueue((q) => {
      const i = q.findIndex((a) => a.id === alert.id)
      if (i === -1) return [...q, alert]
      const next = [...q]
      next[i] = alert // same id: update in place
      return next
    })
  }, [])

  const hide = useCallback((id: string) => {
    setQueue((q) => (q.some((a) => a.id === id) ? q.filter((a) => a.id !== id) : q))
  }, [])

  const api = useMemo<AlertsApi>(() => ({ show, hide }), [show, hide])

  const current = queue[0]

  const dismiss = (alert: AlertConfig) => {
    if (alert.remember !== false) {
      dismissedRef.current.add(alert.id)
      writeDismissed(alert.id)
    }
    hide(alert.id)
  }

  const runAction = (alert: AlertConfig) => {
    alert.action?.onClick?.()
    if (alert.action?.to) navigate(alert.action.to)
    hide(alert.id) // closes it without marking it dismissed
  }

  return (
    <AlertsContext.Provider value={api}>
      {children}
      {current && (
        <dialog
          key={current.id}
          ref={(el) => {
            if (el && !el.open) el.showModal()
          }}
          className="auth-card auth-modal"
          data-tone={current.tone ?? 'info'}
          aria-labelledby="global-alert-title"
          aria-describedby="global-alert-message"
          onCancel={(e) => {
            e.preventDefault() // we control closing through state
            if (current.dismissible !== false) dismiss(current)
          }}
        >
          <h1 id="global-alert-title">{current.title}</h1>
          <div id="global-alert-message" className="auth-modal-message">
            {current.message}
          </div>

          {current.action && (
            <button
              className="auth-submit auth-submit-centered"
              type="button"
              onClick={() => runAction(current)}
            >
              {current.action.label}
            </button>
          )}

          {current.dismissible !== false && (
            <div className="auth-link">
              <button
                type="button"
                className="auth-link-button"
                onClick={() => dismiss(current)}
              >
                {current.dismissLabel ?? 'Dismiss'}
              </button>
            </div>
          )}
        </dialog>
      )}
    </AlertsContext.Provider>
  )
}