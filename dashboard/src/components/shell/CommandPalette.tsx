import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { ROUTES, useApp } from '@/lib/store'
import { TICKERS, TICKER_META, FUND } from '@/lib/data'
import { humanise } from '@/lib/format'

interface Item {
  id: string
  label: string
  group: string
  hint?: string
  run: () => void
}

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, navigate, selectTicker } = useApp()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const items = useMemo<Item[]>(() => {
    const routes: Item[] = ROUTES.map((r) => ({
      id: `r-${r.id}`,
      label: r.label,
      group: 'Navigate',
      hint: r.hint,
      run: () => navigate(r.id),
    }))
    const stocks: Item[] = TICKERS.map((t) => ({
      id: `s-${t}`,
      label: `${t} · ${TICKER_META[t].company}`,
      group: 'Constituent',
      hint: `${humanise(TICKER_META[t].ai_category)} · rank #${FUND[t].rank}`,
      run: () => selectTicker(t),
    }))
    return [...routes, ...stocks]
  }, [navigate, selectTicker])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return items
    return items.filter(
      (i) =>
        i.label.toLowerCase().includes(s) ||
        i.hint?.toLowerCase().includes(s) ||
        i.group.toLowerCase().includes(s),
    )
  }, [q, items])

  useEffect(() => {
    if (paletteOpen) {
      setQ('')
      setActive(0)
      // rAF lets the dialog paint before we steal focus.
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [paletteOpen])

  useEffect(() => setActive(0), [q])

  useEffect(() => {
    if (!paletteOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((a) => Math.min(a + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((a) => Math.max(a - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const hit = filtered[active]
        if (hit) {
          hit.run()
          setPaletteOpen(false)
        }
      } else if (e.key === 'Escape') {
        setPaletteOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paletteOpen, filtered, active, setPaletteOpen])

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!paletteOpen) return null

  let lastGroup = ''

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[14vh] backdrop-blur-[2px]"
      onClick={() => setPaletteOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-[560px] overflow-hidden rounded-md border border-ink-650 bg-ink-850 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-ink-700 px-3.5">
          <svg width="12" height="12" viewBox="0 0 10 10" aria-hidden className="shrink-0 text-fg-mute">
            <circle cx="4" cy="4" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <path d="M6 6l2.4 2.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Jump to a page or a constituent…"
            className="h-11 flex-1 bg-transparent text-[13px] text-fg-hi outline-none placeholder:text-fg-mute"
          />
          <kbd className="shrink-0 rounded-xs border border-ink-650 px-1.5 py-px font-mono text-3xs text-fg-mute">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-1.5">
          {filtered.length === 0 && (
            <div className="px-3.5 py-6 text-center font-mono text-micro text-fg-mute">
              No matches for “{q}”
            </div>
          )}
          {filtered.map((it, i) => {
            const showGroup = it.group !== lastGroup
            lastGroup = it.group
            return (
              <div key={it.id}>
                {showGroup && (
                  <div className="px-3.5 pb-1 pt-2.5 text-3xs font-semibold uppercase tracking-[0.13em] text-fg-mute">
                    {it.group}
                  </div>
                )}
                <button
                  type="button"
                  data-idx={i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => {
                    it.run()
                    setPaletteOpen(false)
                  }}
                  className={clsx(
                    'flex w-full items-center gap-3 px-3.5 py-[7px] text-left transition-colors',
                    i === active ? 'bg-sig-pos/[0.09]' : 'hover:bg-ink-800',
                  )}
                >
                  <span
                    className={clsx(
                      'h-3.5 w-[2px] shrink-0 rounded-full',
                      i === active ? 'bg-sig-pos' : 'bg-transparent',
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] text-fg-hi">{it.label}</span>
                    {it.hint && (
                      <span className="block truncate text-3xs text-fg-mute">{it.hint}</span>
                    )}
                  </span>
                </button>
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-4 border-t border-ink-700 px-3.5 py-2 font-mono text-3xs text-fg-mute">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
          <span className="ml-auto">{filtered.length} results</span>
        </div>
      </div>
    </div>
  )
}
