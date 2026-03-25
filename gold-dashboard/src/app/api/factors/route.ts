/**
 * GET /api/factors
 * Aggregates all 9 gold factor readings from:
 *   - FRED API (F1 DXY, F2 Fed Funds, F3 TIPS 10Y, F4 BEI)
 *   - Yahoo Finance (F5 GPR proxy, F6 GVZ, F8 ETF flow, F9 GDX ratio)
 *   - Stooq fallback for ETF history (GLD, IAU, GDX)
 * Falls back to mock data for any factor that fails.
 */
import { NextResponse } from 'next/server'
import { fetchFredSeries, percentileRank } from '@/lib/fred'
import { fetchYFQuotes, fetchYFHistory, computeZScore, roc, percentile52W } from '@/lib/yahoo'
import { fetchStooqHistory } from '@/lib/stooq'
import { readPipelineJson } from '@/lib/readPipelineJson'
import { factors as MOCK_FACTORS } from '@/data/mockData'

export const revalidate = 3600 // ISR: revalidate once per hour max

/** Fetch ETF history: try Yahoo Finance first, fall back to Stooq */
async function fetchEtfHistory(symbol: string, days: number) {
  const yf = await fetchYFHistory(symbol, days)
  if (yf && yf.length > 10) return yf
  const stooq = await fetchStooqHistory(symbol, days)
  if (!stooq) return null
  return stooq.map(b => ({ date: b.date, close: b.close }))
}

export async function GET() {
  // ── Parallel data fetches ──────────────────────────────────────────
  const [
    fredDXY,          // F1: DTWEXBGS — Broad USD index
    fredFedFunds,     // F2: FEDFUNDS — Fed funds rate
    fredTIPS10Y,      // F3: DFII10 — 10Y TIPS real yield
    fredBEI,          // F4: T10YIE — 10Y breakeven inflation
    yfQuotes,         // F5/F6 volatility quotes (Yahoo only)
    gldHistory,       // F8: GLD daily history
    iauHistory,       // F8: IAU daily history
    gdxHistory,       // F9: GDX daily history
    gcHistory,        // F9: Gold futures history for ratio
    gvzHistory,       // F6: GVZ history (Yahoo only)
    ovxHistory,       // F5: OVX history (Yahoo only)
  ] = await Promise.all([
    fetchFredSeries('DTWEXBGS', 260),
    fetchFredSeries('FEDFUNDS', 260),
    fetchFredSeries('DFII10', 260),
    fetchFredSeries('T10YIE', 260),
    fetchYFQuotes(['^GVZ', '^OVX']),
    fetchEtfHistory('GLD', 260),
    fetchEtfHistory('IAU', 260),
    fetchEtfHistory('GDX', 260),
    fetchEtfHistory('GC=F', 260),
    fetchYFHistory('^GVZ', 260),
    fetchYFHistory('^OVX', 260),
  ])

  const now = new Date().toISOString()

  // ── F1: 美元强弱 (DXY) ──────────────────────────────────────────────
  const f1 = buildFactor('F1', fredDXY, {
    mockFactor: MOCK_FACTORS[0],
    invertDirection: true, // DXY up = bearish for gold
    label: 'DTWEXBGS',
    unit: 'idx',
    signalFn: (z) => z < -1 ? 'DXY走弱，金价看多支撑' : z > 1 ? 'DXY强势，金价承压' : 'DXY中性，方向不明',
    icValue: -0.087,
  })

  // ── F2: 货币政策预期 (Fed Funds) ────────────────────────────────────
  const f2 = buildFactor('F2', fredFedFunds, {
    mockFactor: MOCK_FACTORS[1],
    invertDirection: true,
    label: 'FEDFUNDS',
    unit: '%',
    signalFn: (z) => z < -0.5 ? '降息预期升温，金价支撑' : z > 0.5 ? '加息预期偏强，利率压制' : '降息预期中性，方向不明',
    icValue: -0.041,
  })

  // ── F3: 实际利率 (TIPS 10Y) ─────────────────────────────────────────
  const f3 = buildFactor('F3', fredTIPS10Y, {
    mockFactor: MOCK_FACTORS[2],
    invertDirection: true, // higher real rates = bearish gold
    label: 'TIPS 10Y',
    unit: '%',
    signalFn: (z) => z < -1.5 ? '实际利率极低，看多压力强' : z < -0.5 ? '实际利率偏低，金价获支撑' : z > 1 ? '实际利率偏高，看空压力' : '实际利率中性',
    icValue: -0.142,
  })

  // ── F4: 通胀预期 (BEI) ──────────────────────────────────────────────
  const f4 = buildFactor('F4', fredBEI, {
    mockFactor: MOCK_FACTORS[3],
    invertDirection: false, // higher BEI = bullish gold
    label: '5Y5Y BEI',
    unit: '%',
    signalFn: (z) => z > 1 ? '通胀预期升温，黄金抗缩水需求↑' : z < -1 ? '通胀预期降温，需求减弱' : '通胀预期温和',
    icValue: 0.093,
  })

  // ── Pipeline fallback: read signal.json for F5/F6 raw values if Yahoo quotes fail ──
  const pipelineSignal = await readPipelineJson<{
    factors?: { name: string; zscore: number; raw_value: number | null }[]
  }>('signal.json', {})
  const pipelineFactorMap: Record<string, { zscore: number; raw_value: number | null }> = {}
  if (pipelineSignal.factors) {
    for (const f of pipelineSignal.factors) {
      pipelineFactorMap[f.name] = { zscore: f.zscore, raw_value: f.raw_value }
    }
  }

  // ── F5: 地缘政治风险 (GPR / OVX proxy) ────────────────────────────
  let f5 = MOCK_FACTORS[4]
  if (ovxHistory && yfQuotes?.['^OVX']) {
    const ovxVal = yfQuotes['^OVX'].regularMarketPrice
    const ovxHist = ovxHistory.map(b => b.close)
    const z = computeZScore(ovxHist, ovxVal)
    const p52 = percentile52W(ovxHist, ovxVal)
    const prev = ovxHist[ovxHist.length - 2] ?? ovxVal
    f5 = {
      ...f5,
      rawValue: parseFloat(ovxVal.toFixed(1)),
      rawUnit: 'OVX',
      zScore: z,
      percentile52w: p52,
      dayChange: parseFloat((ovxVal - prev).toFixed(2)),
      direction: z > 0.5 ? 'bullish' : z < -0.5 ? 'bearish' : 'neutral',
      signal: z > 1 ? '地缘风险偏高，避险需求支撑' : z < -1 ? '地缘压力缓和' : '地缘风险中性',
    }
  } else if (pipelineFactorMap['F5_GPR']) {
    const pf = pipelineFactorMap['F5_GPR']
    const z = pf.zscore
    f5 = {
      ...f5,
      rawValue: pf.raw_value != null ? parseFloat(pf.raw_value.toFixed(1)) : f5.rawValue,
      rawUnit: 'GPR',
      zScore: parseFloat(z.toFixed(2)),
      direction: z > 0.5 ? 'bullish' : z < -0.5 ? 'bearish' : 'neutral',
      signal: z > 1 ? '地缘风险偏高，避险需求支撑' : z < -1 ? '地缘压力缓和' : '地缘风险中性',
    }
  }

  // ── F6: 市场情绪 (GVZ) ─────────────────────────────────────────────
  let f6 = MOCK_FACTORS[5]
  if (gvzHistory && yfQuotes?.['^GVZ']) {
    const gvzVal = yfQuotes['^GVZ'].regularMarketPrice
    const gvzHist = gvzHistory.map(b => b.close)
    const z = computeZScore(gvzHist, gvzVal)
    const p52 = percentile52W(gvzHist, gvzVal)
    const prev = gvzHist[gvzHist.length - 2] ?? gvzVal
    f6 = {
      ...f6,
      rawValue: parseFloat(gvzVal.toFixed(1)),
      rawUnit: 'GVZ',
      zScore: z,
      percentile52w: p52,
      dayChange: parseFloat((gvzVal - prev).toFixed(2)),
      direction: z > 0.5 ? 'bullish' : z < -0.5 ? 'bearish' : 'neutral',
      signal: gvzVal > 25 ? 'GVZ极高，黄金恐慌溢价↑↑' : gvzVal > 18 ? 'GVZ升温，黄金恐慌溢价↑' : 'GVZ平稳，恐慌溢价有限',
    }
  } else if (pipelineFactorMap['F6_GVZ']) {
    const pf = pipelineFactorMap['F6_GVZ']
    const z = pf.zscore
    const rawVal = pf.raw_value
    f6 = {
      ...f6,
      rawValue: rawVal != null ? parseFloat(rawVal.toFixed(1)) : f6.rawValue,
      rawUnit: 'GVZ',
      zScore: parseFloat(z.toFixed(2)),
      direction: z > 0.5 ? 'bullish' : z < -0.5 ? 'bearish' : 'neutral',
      signal: rawVal != null && rawVal > 25 ? 'GVZ极高，黄金恐慌溢价↑↑' : rawVal != null && rawVal > 18 ? 'GVZ升温，黄金恐慌溢价↑' : 'GVZ平稳，恐慌溢价有限',
    }
  }

  // ── F7: 央行需求 (WGC — no free API, keep mock) ────────────────────
  const f7 = MOCK_FACTORS[6]

  // ── F8: ETF资金流 (GLD + IAU 5日变化率) ────────────────────────────
  let f8 = MOCK_FACTORS[7]
  if (gldHistory && iauHistory && gldHistory.length >= 6 && iauHistory.length >= 6) {
    const gldFlow5d = (gldHistory.slice(-1)[0].close - gldHistory.slice(-6)[0].close)
    const iauFlow5d = (iauHistory.slice(-1)[0].close - iauHistory.slice(-6)[0].close)
    const totalFlow = parseFloat((gldFlow5d + iauFlow5d).toFixed(2))

    const gldHist = gldHistory.map(b => b.close)
    const flows = gldHist.slice(5).map((v, i) => v - gldHist[i])
    const z = computeZScore(flows, totalFlow)
    const p52 = percentile52W(flows, totalFlow)

    f8 = {
      ...f8,
      rawValue: totalFlow,
      rawUnit: 'pts/5d',
      zScore: z,
      percentile52w: p52,
      dayChange: parseFloat((gldFlow5d - (gldHistory.slice(-2)[0].close - gldHistory.slice(-7)[0].close)).toFixed(2)),
      direction: totalFlow > 0 ? 'bullish' : totalFlow < 0 ? 'bearish' : 'neutral',
      signal: totalFlow > 2 ? 'ETF持续流入，资金追多金价' : totalFlow < -2 ? 'ETF流出，短期情绪承压' : 'ETF资金流中性',
    }
  }

  // ── F9: 金矿产能 (GDX vs Gold 相对强弱) ─────────────────────────────
  let f9 = MOCK_FACTORS[8]
  if (gdxHistory && gcHistory && gdxHistory.length >= 6 && gcHistory.length >= 6) {
    const gdxNow = gdxHistory.slice(-1)[0].close
    const gcNow = gcHistory.slice(-1)[0].close
    const ratio = gcNow > 0 ? parseFloat((gdxNow / gcNow).toFixed(4)) : 0

    const ratios = gdxHistory.slice(-gcHistory.length).map((b, i) => {
      const gc = gcHistory[i + (gcHistory.length - gdxHistory.length + gdxHistory.length - gcHistory.length)]
      return gc?.close > 0 ? b.close / gc.close : 0
    }).filter(r => r > 0)

    const z = computeZScore(ratios, ratio)
    const p52 = percentile52W(ratios, ratio)
    const prevRatio = gdxHistory.slice(-2)[0].close / gcHistory.slice(-2)[0].close

    f9 = {
      ...f9,
      rawValue: ratio,
      rawUnit: 'ratio',
      zScore: z,
      percentile52w: p52,
      dayChange: parseFloat((ratio - prevRatio).toFixed(4)),
      direction: z < -0.5 ? 'bearish' : z > 0.5 ? 'bullish' : 'neutral',
      signal: z < -1 ? 'GDX相对弱势，矿商折价偏大' : z > 1 ? 'GDX强势领涨，产能扩张信号' : 'GDX表现平稳，无明显信号',
    }
  }

  const etfSource = gldHistory ? 'live' : null
  const result = {
    factors: [f1, f2, f3, f4, f5, f6, f7, f8, f9],
    dataSource: {
      fred: !!(fredTIPS10Y || fredBEI || fredDXY || fredFedFunds),
      yahoo: !!(yfQuotes),
      stooq: !!(etfSource),
      timestamp: now,
    },
  }

  return NextResponse.json(result)
}

// ── Helper: build factor from FRED result or fall back to mock ────────
function buildFactor(
  id: string,
  fredResult: Awaited<ReturnType<typeof fetchFredSeries>>,
  opts: {
    mockFactor: typeof MOCK_FACTORS[0]
    invertDirection: boolean
    label: string
    unit: string
    signalFn: (z: number) => string
    icValue: number
  },
) {
  const { mockFactor, invertDirection, label, unit, signalFn, icValue } = opts

  if (!fredResult) return mockFactor

  const z = fredResult.zScore
  const effectiveZ = invertDirection ? -z : z
  const direction = effectiveZ > 0.3 ? 'bullish' : effectiveZ < -0.3 ? 'bearish' : 'neutral'

  // Day-over-day change
  const obs = fredResult.observations
  const latest = fredResult.latestValue
  const prev = obs.length >= 2
    ? parseFloat(obs[1].value !== '.' ? obs[1].value : '0')
    : latest
  const dayChange = parseFloat((latest - prev).toFixed(3))

  const p52 = percentileRank(fredResult.history, latest)

  return {
    ...mockFactor,
    rawValue: latest,
    rawUnit: unit,
    zScore: parseFloat(effectiveZ.toFixed(2)),
    dayChange,
    percentile52w: invertDirection ? 100 - p52 : p52,
    direction: direction as 'bullish' | 'bearish' | 'neutral',
    signal: signalFn(effectiveZ),
    icValue,
    shapValue: mockFactor.shapValue, // SHAP requires model — keep mock
    icir: mockFactor.icir,
  }
}
