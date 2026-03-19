/**
 * GET /api/gold-price
 * Returns real-time XAU/USD price.
 * Data source priority: Yahoo Finance → Stooq XAUUSD (spot) → mock
 */
import { NextResponse } from 'next/server'
import { fetchYFQuotes } from '@/lib/yahoo'
import { fetchStooqHistory } from '@/lib/stooq'

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

export async function GET() {
  // ── 1. Try Yahoo Finance ─────────────────────────────────────────────
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
    // Fall through to Stooq
  }

  // ── 2. Fall back to Stooq XAUUSD spot price (direct, not GLD-derived) ─
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
    // Fall through to mock
  }

  // ── 3. Final fallback: mock data ─────────────────────────────────────
  return NextResponse.json({ ...MOCK_PRICE, timestamp: new Date().toISOString() })
}
