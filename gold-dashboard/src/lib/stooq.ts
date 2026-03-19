/**
 * Stooq.com data client — free, no auth, reliable for US stocks/ETFs.
 * Returns CSV data with columns: Date, Open, High, Low, Close, Volume
 */

const STOOQ_BASE = 'https://stooq.com/q/d/l'

export interface StooqBar {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/** Map common symbols to Stooq symbol format */
const SYMBOL_MAP: Record<string, string> = {
  'GLD': 'gld.us',
  'IAU': 'iau.us',
  'GDX': 'gdx.us',
  'GC=F': 'gc.f',
  'GDXJ': 'gdxj.us',
  'XAUUSD': 'xauusd',   // Gold spot price in USD — use this for XAU/USD
}

/**
 * Fetch historical daily OHLCV data from Stooq.
 * Returns bars sorted oldest-to-newest, or null on failure.
 */
export async function fetchStooqHistory(
  symbol: string,
  days = 260,
): Promise<StooqBar[] | null> {
  try {
    const stooqSymbol = SYMBOL_MAP[symbol] ?? symbol.toLowerCase()
    const url = `${STOOQ_BASE}/?s=${stooqSymbol}&i=d`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible)',
        Accept: 'text/csv',
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) return null

    const text = await res.text()
    if (!text || text.includes('No data')) return null

    const lines = text.trim().split('\n')
    if (lines.length < 2) return null

    // Skip header line
    const bars: StooqBar[] = []
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',')
      if (parts.length < 5) continue
      const close = parseFloat(parts[4])
      if (isNaN(close)) continue
      bars.push({
        date: parts[0],
        open: parseFloat(parts[1]),
        high: parseFloat(parts[2]),
        low: parseFloat(parts[3]),
        close,
        volume: parseFloat(parts[5] ?? '0'),
      })
    }

    // Return last N days
    return bars.slice(-days)
  } catch {
    return null
  }
}

/**
 * Get latest quote (last day's OHLCV) for a symbol.
 */
export async function fetchStooqQuote(symbol: string): Promise<StooqBar | null> {
  const history = await fetchStooqHistory(symbol, 5)
  if (!history || history.length === 0) return null
  return history[history.length - 1]
}

/**
 * Derive approximate gold spot price (XAU/USD) from GLD ETF price.
 * GLD holds ~0.0963 oz/share, but we use 0.1 as a close approximation.
 */
export function gldToSpotPrice(gldClose: number): number {
  return parseFloat((gldClose / 0.0963).toFixed(2))
}
