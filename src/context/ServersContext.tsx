import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { fetchServers, type ServerInfo } from '../lib/servers'

const STORAGE_KEY = 'mcm.current_server'

interface ServersContextType {
  /** True once this backend build is confirmed to have the multi-server registry. */
  supported: boolean
  loading: boolean
  servers: ServerInfo[]
  currentServerId: string | null
  setCurrentServer: (id: string) => void
  refresh: () => void
}

const ServersContext = createContext<ServersContextType | null>(null)

function readPersistedId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    // Private-mode/locked-down browsers can throw on storage access -- treat
    // that exactly like nothing being persisted rather than crashing the app.
    return null
  }
}

function persistId(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // Best-effort: losing the pick just means choosing again next visit.
  }
}

export function ServersProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  // Pessimistic defaults, the mirror image of PermissionsContext-style
  // contexts (which default `supported` to true so an old backend doesn't
  // hide features it never gated). This one has to default the other way:
  // an old backend (404) and a network hiccup must produce IDENTICAL
  // behaviour -- every consumer falling back to the flat legacy routes --
  // and the only way to guarantee that is to never trust
  // `supported`/`currentServerId` until a real 200 from `/api/servers`
  // confirms the registry actually exists.
  const [supported, setSupported] = useState(false)
  const [loading, setLoading] = useState(true)
  const [servers, setServers] = useState<ServerInfo[]>([])
  const [currentServerId, setCurrentServerId] = useState<string | null>(null)
  const [epoch, setEpoch] = useState(0)

  const refresh = useCallback(() => setEpoch((e) => e + 1), [])

  useEffect(() => {
    let cancelled = false
    // loading starts true (see useState above) and only ever goes false,
    // once, below -- a refresh() re-fetches silently rather than flashing it
    // again. All state updates happen inside this .then(), never
    // synchronously in the effect body (react-hooks/set-state-in-effect).
    fetchServers(token).then((r) => {
      if (cancelled) return
      if (r.kind === 'ok') {
        setSupported(true)
        setServers(r.data)
        const persisted = readPersistedId()
        const resolved =
          persisted && r.data.some((s) => s.id === persisted) ? persisted : (r.data[0]?.id ?? null)
        setCurrentServerId(resolved)
      }
      // unsupported/network/error/unauthorized: leave supported/servers/
      // currentServerId at their safe defaults above -- see the state comment.
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [token, epoch])

  const setCurrentServer = useCallback((id: string) => {
    setCurrentServerId(id)
    persistId(id)
  }, [])

  return (
    <ServersContext.Provider value={{ supported, loading, servers, currentServerId, setCurrentServer, refresh }}>
      {children}
    </ServersContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useServers() {
  const ctx = useContext(ServersContext)
  if (!ctx) throw new Error('useServers must be used within ServersProvider')
  return ctx
}
