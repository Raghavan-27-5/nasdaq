import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { TICKERS } from './data'

// ---------------------------------------------------------------------------
// Routes - PROJECT_SPEC.md §18 mandates exactly these eight surfaces.
// ---------------------------------------------------------------------------

export const ROUTES = [
  { id: 'command', key: '1', label: 'Command Center', hint: 'Run status & headline research state' },
  { id: 'universe', key: '2', label: 'AI Universe', hint: '20-name factor ranking & screening' },
  { id: 'stock', key: '3', label: 'Stock Intelligence', hint: 'Per-name drill-down' },
  { id: 'ml', key: '4', label: 'ML Lab', hint: 'Walk-forward models & signal diagnostics' },
  { id: 'portfolio', key: '5', label: 'Portfolio Optimizer', hint: 'Constrained construction' },
  { id: 'risk', key: '6', label: 'Risk Terminal', hint: 'Covariance, correlation, contributions' },
  { id: 'backtest', key: '7', label: 'Backtest', hint: 'OOS performance & attribution' },
  { id: 'audit', key: '8', label: 'Research Audit', hint: 'Provenance, gates & limitations' },
] as const

export type RouteId = (typeof ROUTES)[number]['id']

interface AppState {
  route: RouteId
  navigate: (r: RouteId, ticker?: string) => void
  /** Cross-page selection. Selecting a name anywhere drills into it everywhere. */
  ticker: string
  selectTicker: (t: string) => void
  /** Reveals inline SIMULATED markers on every panel (audit defence mode). */
  auditMode: boolean
  toggleAuditMode: () => void
  paletteOpen: boolean
  setPaletteOpen: (v: boolean) => void
}

const Ctx = createContext<AppState | null>(null)

const parseHash = (): { route: RouteId; ticker?: string } => {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const [route, ticker] = raw.split('/')
  const valid = ROUTES.some((r) => r.id === route)
  return {
    route: (valid ? route : 'command') as RouteId,
    ticker: ticker && TICKERS.includes(ticker) ? ticker : undefined,
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [{ route, ticker: hashTicker }, setLoc] = useState(parseHash)
  const [ticker, setTicker] = useState(hashTicker ?? TICKERS[0])
  const [auditMode, setAuditMode] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Keep the URL and the app in sync so a view is shareable/reloadable.
  useEffect(() => {
    const onHash = () => {
      const p = parseHash()
      setLoc(p)
      if (p.ticker) setTicker(p.ticker)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = useCallback((r: RouteId, t?: string) => {
    const target = t ? `#/${r}/${t}` : `#/${r}`
    if (window.location.hash === target) return
    window.location.hash = target
  }, [])

  const selectTicker = useCallback((t: string) => {
    setTicker(t)
    const p = parseHash()
    if (p.route !== 'stock') navigate('stock', t)
    else window.location.hash = `#/stock/${t}`
  }, [navigate])

  // Terminal-style keyboard: 1-8 jump to a page, "/" or Cmd+K opens the palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const typing =
        el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if (typing) return

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }
      if (e.key === '/') {
        e.preventDefault()
        setPaletteOpen(true)
        return
      }
      if (e.key === 'Escape') setPaletteOpen(false)

      const hit = ROUTES.find((r) => r.key === e.key)
      if (hit) {
        e.preventDefault()
        navigate(hit.id, hit.id === 'stock' ? ticker : undefined)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, ticker])

  const value = useMemo<AppState>(
    () => ({
      route,
      navigate,
      ticker,
      selectTicker,
      auditMode,
      toggleAuditMode: () => setAuditMode((v) => !v),
      paletteOpen,
      setPaletteOpen,
    }),
    [route, navigate, ticker, selectTicker, auditMode, paletteOpen],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp must be used inside <AppProvider>')
  return v
}
