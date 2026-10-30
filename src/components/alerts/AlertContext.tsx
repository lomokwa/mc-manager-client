import { createContext, useContext, useEffect, type ReactNode } from 'react'

export interface AlertAction {
  label: string
  to?: string          // navigate here when clicked
  onClick?: () => void // and/or run this
}

export interface AlertConfig {
  id: string                          // unique per alert type; also the dismissal key
  title: string
  message: ReactNode
  tone?: 'info' | 'warning' | 'error' // default 'info'
  action?: AlertAction                // primary button
  dismissLabel?: string               // default 'Dismiss'
  dismissible?: boolean               // default true; false removes the dismiss link and ignores Esc
  remember?: boolean                  // default true; stay dismissed for the browser session
}

export interface AlertsApi {
  show: (alert: AlertConfig) => void
  hide: (id: string) => void
}

export const AlertsContext = createContext<AlertsApi | null>(null)

export function useAlerts(): AlertsApi {
  const ctx = useContext(AlertsContext)
  if (!ctx) throw new Error('useAlerts must be used inside <AlertProvider>')
  return ctx
}

// Declarative: the alert is shown while `config` is non-null and hidden when it
// becomes null or the component unmounts. Memoize `config` with useMemo.
export function useGlobalAlert(config: AlertConfig | null) {
  const { show, hide } = useAlerts()
  useEffect(() => {
    if (!config) return
    show(config)
    return () => hide(config.id)
  }, [config, show, hide])
}