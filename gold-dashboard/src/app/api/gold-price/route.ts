/**
 * GET /api/gold-price
 * Returns real-time XAU/USD price.
 * Data source priority: Yahoo v7 quotes → Yahoo v8 chart → Stooq → Pipeline signal.json → mock
 */
import { NextResponse } from 'next/server'
import { fetchYFQuotes } from '@/lib/yahoo'
import { fetchStooqHistory } from '@/lib/stooq'
import { readPipelineJson } from '@/lib/readPipelineJson'

const MOCK_PRICE = {
  price: 3124.5,
  change: 12.3,
  changePct: 0.39,
  open: 3112.2,
  high: 3138.0,
  low: 3108.5,
  prevClose: 3112.2,
  source: 'mock',
  timestamp: new Date().toISOString(),
}

/** Fetch latest price from Yahoo v8 chart API (no crumb needed) */
async function fetchYahooChartPrice(): Promise<{
  price: number; change: number; changePct: number;
  open: number; high: number; low: number; prevClose: number;
} | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 6000)

    const res = await fetch(
      'https://query2.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=5d',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
          Accept: 'application/json',
        },
        signal: ctrl.signal,
        next: { revalidate: 60 },
      },
    )
    clearTimeout(timer)

    if (!res.ok) return null
    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) return null

    const meta = result.meta
    const price = meta?.regularMarketPrice
    const prevClose = meta?.chartPreviousClose ?? meta?.previousClose
    if (!price) return null

    const quote = result.indicators?.quote?.[0]
    const timestamps = result.timestamp ?? []
    const lastIdx = timestamps.length - 1

    return {
      price,
      change: prevClose ? parseFloat((price - prevClose).toFixed(2)) : 0,
      changePct: prevClose ? parseFloat(((price - prevClose) / prevClose * 100).toFixed(4)) : 0,
      open: quote?.open?.[lastIdx] ?? price,
      high: quote?.high?.[lastIdx] ?? price,
      low: quote?.low?.[lastIdx] ?? price,
      prevClose: prevClose ?? price,
    }
  } catch {
    return null
  }
}

export async function GET() {
  // ── 1. Try Yahoo Finance v7 quotes (crumb-based) ─────────────────────
  try {
    const quotes = await fetchYFQuotes(['GC=F'])
    if (quotes?.['GC=F']) {
      const q = quotes['GC=F']
      return NextResponse.json({
        price: q.regularMarketPrice,
        change: parseFloat(q.regularMarketChange.toFixed(2)),
        changePct: parseFloat(q.regularMarketChangePercent.toFixed(4)),
        open: q.regularMarketOpen,
        high: q.regularMarketDayHigh,
        low: q.regularMarketDayLow,
        prevClose: q.regularMarketPreviousClose,
        week52High: q.fiftyTwoWeekHigh,
        week52Low: q.fiftyTwoWeekLow,
        source: 'yahoo',
        timestamp: new Date().toISOString(),
      })
    }
  } catch {
    // Fall through
  }

  // ── 2. Try Yahoo Finance v8 chart API (no crumb needed) ─────────────
  try {
    const chartData = await fetchYahooChartPrice()
    if (chartData) {
      return NextResponse.json({
        ...chartData,
        source: 'yahoo-chart',
        timestamp: new Date().toISOString(),
      })
    }
  } catch {
    // Fall through
  }

  // ── 3. Fall back to Stooq XAUUSD spot price ─────────────────────────
  try {
    const xauBars = await fetchStooqHistory('XAUUSD', 5)
    if (xauBars && xauBars.length >= 2) {
      const today = xauBars[xauBars.length - 1]
      const yesterday = xauBars[xauBars.length - 2]

      const price = today.close
      const prevClose = yesterday.close
      const change = parseFloat((price - prevClose).toFixed(2))
      const changePct = parseFloat(((change / prevClose) * 100).toFixed(4))

      return NextResponse.json({
        price,
        change,
        changePct,
        open: today.open,
        high: today.high,
        low: today.low,
        prevClose,
        source: 'stooq',
        timestamp: new Date().toISOString(),
      })
    }
  } catch {
    // Fall through
  }

  // ── 4. Fall back to pipeline signal.json (daily update) ─────────────
  try {
    const signal = await readPipelineJson<{
      gold_price?: number; gold_open?: number; gold_high?: number; gold_low?: number; date?: string
    }>('signal.json', {})

    if (signal.gold_price && signal.gold_price > 0) {
      return NextResponse.json({
        price: signal.gold_price,
        change: 0,
        changePct: 0,
        open: signal.gold_open ?? signal.gold_price,
        high: signal.gold_high ?? signal.gold_price,
        low: signal.gold_low ?? signal.gold_price,
        prevClose: signal.gold_price,
        source: 'pipeline',
        timestamp: new Date().toISOString(),
      })
    }
  } catch {
    // Fall through
  }

  // ── 5. Final fallback: mock data ────────────────────────────────────
  return NextResponse.json({ ...MOCK_PRICE, timestamp: new Date().toISOString() })
}
