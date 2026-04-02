/**
 * GET /api/factors
 * Aggregates 8 gold factor readings (P3: 4 base + 4 logical) from:
 *   - FRED API (F1 DXY, F4 BEI)
 *   - Yahoo Finance (F5 GPR/OVX proxy, F6 GVZ)
 *   - Pipeline signal.json (F10 TIPSBEISpread, F11 DXYMomentum, F13 GoldGDXDivergence, F14 GVZMomentum)
 * Falls back to mock data for any factor that fails.
 */
import { NextResponse } from 'next/server'
import { fetchFredSeries, percentileRank } from '@/lib/fred'
import { fetchYFQuotes, fetchYFHistory, computeZScore, percentile52W } from '@/lib/yahoo'
import { readPipelineJson } from '@/lib/readPipelineJson'
import { factors as MOCK_FACTORS } from '@/data/mockData'

export const revalidate = 3600 // ISR: revalidate once per hour max

// Map mock factor array index by factor id for easy lookup
const MOCK_BY_ID: Record<string, typeof MOCK_FACTORS[0]> = {}
for (const f of MOCK_FACTORS) MOCK_BY_ID[f.id] = f

export async function GET() {
  // ── Parallel data fetches ──────────────────────────────────────────
  const [
    fredDXY,          // F1: DTWEXBGS — Broad USD index
    fredBEI,          // F4: T10YIE — 10Y breakeven inflation
    yfQuotes,         // F5/F6 volatility quotes (Yahoo only)
    gvzHistory,       // F6: GVZ history (Yahoo only)
    ovxHistory,       // F5: OVX history (Yahoo only)
    pipelineSignal,   // F10/F11/F13/F14 derived factors
  ] = await Promise.all([
    fetchFredSeries('DTWEXBGS', 260),
    fetchFredSeries('T10YIE', 260),
    fetchYFQuotes(['^GVZ', '^OVX']),
    fetchYFHistory('^GVZ', 260),
    fetchYFHistory('^OVX', 260),
    readPipelineJson<{
      factors?: { name: string; label: string; zscore: number; raw_value: number | null }[]
    }>('signal.json', {}),
  ])

  const now = new Date().toISOString()

  // Pipeline factor map for derived factors and fallback
  const pipelineFactorMap: Record<string, { zscore: number; raw_value: number | null; label: string }> = {}
  if (pipelineSignal.factors) {
    for (const f of pipelineSignal.factors) {
      pipelineFactorMap[f.name] = { zscore: f.zscore, raw_value: f.raw_value, label: f.label }
    }
  }

  // ── F1: 美元强弱 (DXY) ──────────────────────────────────────────────
  const f1 = buildFredFactor('F1', fredDXY, {
    mockFactor: MOCK_BY_ID['F1'],
    invertDirection: true, // DXY up = bearish for gold
    label: 'DTWEXBGS',
    unit: 'idx',
    signalFn: (z) => z < -1 ? 'DXY走弱，金价看多支撑' : z > 1 ? 'DXY强势，金价承压' : 'DXY中性，方向不明',
  })

  // ── F4: 通胀预期 (BEI) ──────────────────────────────────────────────
  const f4 = buildFredFactor('F4', fredBEI, {
    mockFactor: MOCK_BY_ID['F4'],
    invertDirection: false, // higher BEI = bullish gold
    label: '5Y5Y BEI',
    unit: '%',
    signalFn: (z) => z > 1 ? '通胀预期升温，黄金抗缩水需求↑' : z < -1 ? '通胀预期降温，需求减弱' : '通胀预期温和',
  })

  // ── F5: 地缘政治风险 (GPR / OVX proxy) ────────────────────────────
  let f5 = MOCK_BY_ID['F5']
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
  let f6 = MOCK_BY_ID['F6']
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

  // ── F10: 实际利率-通胀利差 (TIPS-BEI Spread) ─────────────────────────
  const f10 = buildPipelineFactor('F10', 'F10_TIPSBEISpread', pipelineFactorMap, {
    mockFactor: MOCK_BY_ID['F10'],
    unit: '%',
    signalFn: (z) => z > 1 ? '利差大幅走阔，持有成本上升' : z < -1 ? '利差收窄，黄金吸引力增加' : '利差偏高，持有成本上升',
  })

  // ── F11: 美元动量 (DXY 20D Momentum) ────────────────────────────────
  const f11 = buildPipelineFactor('F11', 'F11_DXYMomentum', pipelineFactorMap, {
    mockFactor: MOCK_BY_ID['F11'],
    unit: '%',
    signalFn: (z) => z > 1 ? '美元加速走强，金价承压' : z < -1 ? '美元加速走弱，金价获支撑' : '美元动量中性',
  })

  // ── F13: 金价-矿业股背离 (Gold-GDX Divergence) ──────────────────────
  const f13 = buildPipelineFactor('F13', 'F13_GoldGDXDivergence', pipelineFactorMap, {
    mockFactor: MOCK_BY_ID['F13'],
    unit: 'z',
    signalFn: (z) => z > 1 ? '金价大幅跑赢矿业股，背离扩大' : z < -1 ? '矿业股领涨金价，背离收窄' : '金矿背离微弱，无明显信号',
  })

  // ── F14: 波动率动量 (GVZ Momentum) ──────────────────────────────────
  const f14 = buildPipelineFactor('F14', 'F14_GVZMomentum', pipelineFactorMap, {
    mockFactor: MOCK_BY_ID['F14'],
    unit: '%',
    signalFn: (z) => z > 1 ? '波动率急升，恐慌情绪蔓延' : z < -1 ? '波动率回落，市场趋于平静' : '波动率动量中性',
  })

  const result = {
    factors: [f1, f4, f5, f6, f10, f11, f13, f14],
    dataSource: {
      fred: !!(fredDXY || fredBEI),
      yahoo: !!(yfQuotes),
      pipeline: !!(pipelineSignal.factors),
      timestamp: now,
    },
  }

  return NextResponse.json(result)
}

// ── Helper: build factor from FRED result or fall back to mock ────────
function buildFredFactor(
  id: string,
  fredResult: Awaited<ReturnType<typeof fetchFredSeries>>,
  opts: {
    mockFactor: typeof MOCK_FACTORS[0]
    invertDirection: boolean
    label: string
    unit: string
    signalFn: (z: number) => string
  },
) {
  const { mockFactor, invertDirection, label, unit, signalFn } = opts

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
    shapValue: mockFactor.shapValue, // SHAP requires model — keep mock
    icir: mockFactor.icir,
  }
}

// ── Helper: build factor from pipeline signal.json or fall back to mock ──
function buildPipelineFactor(
  id: string,
  pipelineName: string,
  pipelineFactorMap: Record<string, { zscore: number; raw_value: number | null; label: string }>,
  opts: {
    mockFactor: typeof MOCK_FACTORS[0]
    unit: string
    signalFn: (z: number) => string
  },
) {
  const { mockFactor, unit, signalFn } = opts
  const pf = pipelineFactorMap[pipelineName]

  if (!pf) return mockFactor

  const z = pf.zscore
  const direction = z > 0.3 ? 'bullish' : z < -0.3 ? 'bearish' : 'neutral'

  return {
    ...mockFactor,
    rawValue: pf.raw_value != null ? parseFloat(pf.raw_value.toFixed(2)) : mockFactor.rawValue,
    rawUnit: unit,
    zScore: parseFloat(z.toFixed(2)),
    direction: direction as 'bullish' | 'bearish' | 'neutral',
    signal: signalFn(z),
    shapValue: mockFactor.shapValue,
    icir: mockFactor.icir,
  }
}
