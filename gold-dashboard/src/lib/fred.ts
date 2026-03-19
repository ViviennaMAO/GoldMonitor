/**
 * FRED (Federal Reserve Economic Data) API client
 * Free API — get key at https://fred.stlouisfed.org/docs/api/api_key.html
 */

const FRED_BASE = 'https://api.stlouisfed.org/fred'
const API_KEY = process.env.FRED_API_KEY || ''

export interface FredObservation {
  date: string
  value: string
}

export interface FredResult {
  series_id: string
  observations: FredObservation[]
  latestDate: string
  latestValue: number
  /** Rolling 252-day Z-Score */
  zScore: number
  history: number[]
}

/**
 * Fetch the last `limit` observations for a FRED series.
 */
export async function fetchFredSeries(
  seriesId: string,
  limit = 260,
): Promise<FredResult | null> {
  if (!API_KEY || API_KEY === 'your_fred_api_key_here') {
    return null // no key configured — caller falls back to mock
  }

  try {
    const url = new URL(`${FRED_BASE}/series/observations`)
    url.searchParams.set('series_id', seriesId)
    url.searchParams.set('api_key', API_KEY)
    url.searchParams.set('file_type', 'json')
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('sort_order', 'desc')

    const res = await fetch(url.toString(), {
      next: { revalidate: 3600 }, // cache 1 hour in Next.js
    })
    if (!res.ok) return null

    const json = await res.json()
    const obs: FredObservation[] = (json.observations ?? []).filter(
      (o: FredObservation) => o.value !== '.' && o.value !== '',
    )
    if (!obs.length) return null

    // FRED returns desc order — reverse for oldest-first
    const chronological = [...obs].reverse()
    const values = chronological.map(o => parseFloat(o.value))

    // Rolling 252-day Z-Score (use all available if < 252)
    const window = values.slice(-252)
    const mean = window.reduce((s, v) => s + v, 0) / window.length
    const std = Math.sqrt(
      window.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / window.length,
    )
    const latestValue = values[values.length - 1]
    const zScore = std > 0 ? (latestValue - mean) / std : 0

    return {
      series_id: seriesId,
      observations: obs,
      latestDate: obs[0].date,
      latestValue,
      zScore: parseFloat(zScore.toFixed(4)),
      history: window,
    }
  } catch {
    return null
  }
}

/** Compute percentile rank of latest value within the 252-day window */
export function percentileRank(history: number[], value: number): number {
  const below = history.filter(v => v < value).length
  return Math.round((below / history.length) * 100)
}
