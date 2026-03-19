/**
 * Yahoo Finance unofficial API — server-side only (bypasses CORS).
 * Uses cookie+crumb authentication required by Yahoo's v7/v8 endpoints.
 */

const YF_BASE = 'https://query1.finance.yahoo.com'
const YF_BASE2 = 'https://query2.finance.yahoo.com'

export interface YFQuote {
  symbol: string
  regularMarketPrice: number
  regularMarketChange: number
  regularMarketChangePercent: number
  regularMarketPreviousClose: number
  regularMarketOpen: number
  regularMarketDayHigh: number
  regularMarketDayLow: number
  regularMarketVolume: number
  fiftyTwoWeekHigh: number
  fiftyTwoWeekLow: number
  shortName: string
}

export interface YFBar {
  date: string
  close: number
}

const YF_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  Origin: 'https://finance.yahoo.com',
  Referer: 'https://finance.yahoo.com/',
}

// Cache crumb+cookie for 50 minutes to avoid hammering auth endpoint
let crumbCache: { crumb: string; cookie: string; ts: number } | null = null
// Cache failure to avoid retrying for 5 minutes
let crumbFailedAt = 0
const CRUMB_FAIL_COOLDOWN = 5 * 60 * 1000

/** Fetch with a hard timeout. Returns null if timeout or error. */
async function fetchWithTimeout(url: string, opts: RequestInit & { next?: { revalidate?: number } }, ms = 4000): Promise<Response | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal })
    clearTimeout(timer)
    return res
  } catch {
    clearTimeout(timer)
    return null
  }
}

async function getYahooCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  // Return cached crumb if fresh
  if (crumbCache && Date.now() - crumbCache.ts < 50 * 60 * 1000) {
    return { crumb: crumbCache.crumb, cookie: crumbCache.cookie }
  }
  // Don't retry too soon after a failure
  if (Date.now() - crumbFailedAt < CRUMB_FAIL_COOLDOWN) return null

  try {
    // Attempt to get crumb directly (fast, no cookie fetch)
    for (const base of [YF_BASE, YF_BASE2]) {
      const crumbRes = await fetchWithTimeout(`${base}/v1/test/getcrumb`, {
        headers: { ...YF_HEADERS },
        cache: 'no-store',
      }, 3000)

      if (crumbRes?.ok) {
        const crumb = await crumbRes.text()
        if (crumb && !crumb.includes('<') && crumb.length < 20) {
          crumbCache = { crumb: crumb.trim(), cookie: '', ts: Date.now() }
          return { crumb: crumb.trim(), cookie: '' }
        }
      }
    }

    crumbFailedAt = Date.now()
    return null
  } catch {
    crumbFailedAt = Date.now()
    return null
  }
}

/** Returns true if Yahoo Finance is known to be rate-limited/unavailable */
function isYahooUnavailable(): boolean {
  return Date.now() - crumbFailedAt < CRUMB_FAIL_COOLDOWN
}

/**
 * Get real-time quotes for a list of symbols.
 * Returns null if fetch fails (caller should fall back to mock).
 */
export async function fetchYFQuotes(
  symbols: string[],
): Promise<Record<string, YFQuote> | null> {
  if (isYahooUnavailable()) return null
  try {
    const auth = await getYahooCrumb()
    const fields = 'regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose,regularMarketOpen,regularMarketDayHigh,regularMarketDayLow,regularMarketVolume,fiftyTwoWeekHigh,fiftyTwoWeekLow,shortName'

    const crumbParam = auth ? `&crumb=${encodeURIComponent(auth.crumb)}` : ''
    const url = `${YF_BASE}/v7/finance/quote?symbols=${symbols.join(',')}&fields=${fields}${crumbParam}`

    const headers: Record<string, string> = {
      ...YF_HEADERS,
      ...(auth ? { Cookie: auth.cookie } : {}),
    }

    const res = await fetchWithTimeout(url, { headers, next: { revalidate: 60 } }, 5000)

    if (!res?.ok) {
      // Fallback: try query2
      const url2 = `${YF_BASE2}/v7/finance/quote?symbols=${symbols.join(',')}&fields=${fields}${crumbParam}`
      const res2 = await fetchWithTimeout(url2, { headers, next: { revalidate: 60 } }, 5000)
      if (!res2?.ok) return null

      const json2 = await res2!.json()
      const results2: YFQuote[] = json2?.quoteResponse?.result ?? []
      if (!results2.length) return null
      const map2: Record<string, YFQuote> = {}
      results2.forEach(q => { map2[q.symbol] = q })
      return map2
    }

    const json = await res!.json()
    const results: YFQuote[] = json?.quoteResponse?.result ?? []
    if (!results.length) return null
    const map: Record<string, YFQuote> = {}
    results.forEach(q => { map[q.symbol] = q })
    return map
  } catch {
    return null
  }
}

/**
 * Get historical daily closes for a symbol (last `days` trading days).
 */
export async function fetchYFHistory(
  symbol: string,
  days = 260,
): Promise<YFBar[] | null> {
  if (isYahooUnavailable()) return null
  try {
    const auth = await getYahooCrumb()
    const period2 = Math.floor(Date.now() / 1000)
    const period1 = period2 - days * 24 * 60 * 60 * 1.5 // add buffer for weekends
    const crumbParam = auth ? `&crumb=${encodeURIComponent(auth.crumb)}` : ''
    const url = `${YF_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&period1=${period1}&period2=${period2}${crumbParam}`

    const headers: Record<string, string> = {
      ...YF_HEADERS,
      ...(auth ? { Cookie: auth.cookie } : {}),
    }

    const res = await fetchWithTimeout(url, { headers, next: { revalidate: 3600 } }, 5000)

    if (!res?.ok) {
      // Fallback: try query2
      const url2 = `${YF_BASE2}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&period1=${period1}&period2=${period2}${crumbParam}`
      const res2 = await fetchWithTimeout(url2, { headers, next: { revalidate: 3600 } }, 5000)
      if (!res2?.ok) return null

      const json2 = await res2!.json()
      return parseChartResult(json2, days)
    }

    const json = await res!.json()
    return parseChartResult(json, days)
  } catch {
    return null
  }
}

function parseChartResult(json: unknown, days: number): YFBar[] | null {
  const j = json as Record<string, unknown>
  const chart = (j?.chart as Record<string, unknown>)?.result as unknown[]
  const result = chart?.[0] as Record<string, unknown> | undefined
  if (!result) return null

  const timestamps: number[] = (result.timestamp as number[]) ?? []
  const closes: number[] =
    ((result.indicators as Record<string, unknown>)?.quote as Record<string, unknown>[])?.[0]
      ?.close as number[] ?? []

  const bars = timestamps
    .map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      close: closes[i],
    }))
    .filter(b => b.close != null)
    .slice(-days)

  return bars.length ? bars : null
}

/** Compute rolling 252-day Z-Score from a price series */
export function computeZScore(history: number[], latest: number): number {
  const window = history.slice(-252)
  if (window.length < 20) return 0
  const mean = window.reduce((s, v) => s + v, 0) / window.length
  const std = Math.sqrt(window.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / window.length)
  return std > 0 ? parseFloat(((latest - mean) / std).toFixed(4)) : 0
}

/** Compute N-day rate of change */
export function roc(history: number[], n: number): number {
  if (history.length < n + 1) return 0
  const prev = history[history.length - 1 - n]
  const curr = history[history.length - 1]
  return prev !== 0 ? parseFloat(((curr - prev) / prev * 100).toFixed(4)) : 0
}

/** Compute 52W percentile rank */
export function percentile52W(history: number[], value: number): number {
  const window = history.slice(-252)
  const below = window.filter(v => v < value).length
  return Math.round((below / window.length) * 100)
}
