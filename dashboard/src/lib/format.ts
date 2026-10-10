/** Number, date and sign formatting. Every figure in the app goes through here
 *  so units, precision and sign treatment are consistent and auditable. */

export const nf = (v: number | null | undefined, d = 2): string =>
  v === null || v === undefined || !Number.isFinite(v)
    ? '—'
    : v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

export const nfInt = (v: number | null | undefined): string =>
  v === null || v === undefined || !Number.isFinite(v)
    ? '—'
    : Math.round(v).toLocaleString('en-US')

/** Ratio -> percent string. */
export const pct = (v: number | null | undefined, d = 1): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(d)}%`

/** Already-in-percent value -> percent string with an explicit sign. */
export const pctSigned = (v: number | null | undefined, d = 2): string =>
  v === null || v === undefined || !Number.isFinite(v)
    ? '—'
    : `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`

/** Ratio -> signed percent, for returns/IC-style quantities. */
export const ratioSigned = (v: number | null | undefined, d = 2): string =>
  v === null || v === undefined || !Number.isFinite(v)
    ? '—'
    : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(d)}%`

export const signed = (v: number | null | undefined, d = 2): string =>
  v === null || v === undefined || !Number.isFinite(v)
    ? '—'
    : `${v >= 0 ? '+' : ''}${v.toFixed(d)}`

export const money = (v: number | null | undefined, d = 2): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `$${nf(v, d)}`

export const bn = (v: number | null | undefined, d = 1): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `$${nf(v, d)}B`

export const mult = (v: number | null | undefined, d = 1): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v.toFixed(d)}x`

/** Basis points. */
export const bps = (v: number | null | undefined, d = 0): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v.toFixed(d)} bps`

/** ISO date -> "02 Jan 2020". */
export const fmtDate = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const fmtDateShort = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

export const fmtYear = (iso: string): string => iso.slice(0, 4)

/** Human category label: AI_COMPUTE -> "AI Compute". */
export const humanise = (s: string): string =>
  s
    .split('_')
    .map((w) => (w.length <= 3 ? w : w[0] + w.slice(1).toLowerCase()))
    .join(' ')

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

/** Direction of a value for colouring. */
export const dir = (v: number | null | undefined): 'pos' | 'neg' | 'flat' =>
  v === null || v === undefined || !Number.isFinite(v) || Math.abs(v) < 1e-12
    ? 'flat'
    : v > 0
      ? 'pos'
      : 'neg'
