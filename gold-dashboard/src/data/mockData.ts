import { Factor, ShapBar, ICDataPoint, RegimeCell, Position, AlertItem, AccountStats, DailySignal } from '@/types'

// ─── Nine Gold Factors ────────────────────────────────────────────────
export const factors: Factor[] = [
  {
    id: 'F1', name: '美元强弱', nameEn: 'DXY Index', zScore: -1.42,
    rawValue: 101.32, rawUnit: 'pts', dayChange: -0.38, percentile52w: 22,
    icValue: -0.087, icir: -1.24, direction: 'bullish',
    signal: 'DXY走弱，金价看多支撑', shapValue: 0.042,
  },
  {
    id: 'F2', name: '货币政策预期', nameEn: 'Fed Funds Futures', zScore: 0.31,
    rawValue: 4.82, rawUnit: '%', dayChange: 0.02, percentile52w: 55,
    icValue: -0.041, icir: -0.68, direction: 'neutral',
    signal: '降息预期中性，方向不明', shapValue: 0.008,
  },
  {
    id: 'F3', name: '实际利率', nameEn: 'TIPS 10Y', zScore: -1.89,
    rawValue: 1.72, rawUnit: '%', dayChange: -0.05, percentile52w: 15,
    icValue: -0.142, icir: -2.31, direction: 'bullish',
    signal: '实际利率极低，看多压力强', shapValue: 0.281,
  },
  {
    id: 'F4', name: '通胀预期', nameEn: '5Y5Y BEI', zScore: 1.23,
    rawValue: 2.61, rawUnit: '%', dayChange: 0.04, percentile52w: 78,
    icValue: 0.093, icir: 1.42, direction: 'bullish',
    signal: '通胀预期升温，黄金抗缩水需求↑', shapValue: 0.192,
  },
  {
    id: 'F5', name: '地缘政治风险', nameEn: 'GPR Index', zScore: 0.67,
    rawValue: 142, rawUnit: 'idx', dayChange: 3.2, percentile52w: 64,
    icValue: 0.054, icir: 0.82, direction: 'bullish',
    signal: '地缘风险偏高，避险需求支撑', shapValue: -0.041,
  },
  {
    id: 'F6', name: '市场情绪', nameEn: 'GVZ + P/C Ratio', zScore: 1.14,
    rawValue: 18.4, rawUnit: 'GVZ', dayChange: 0.9, percentile52w: 72,
    icValue: 0.071, icir: 1.05, direction: 'bullish',
    signal: 'GVZ升温，黄金恐慌溢价↑', shapValue: 0.152,
  },
  {
    id: 'F7', name: '央行需求', nameEn: 'WGC CB Buying', zScore: 1.56,
    rawValue: 290, rawUnit: 't/Q', dayChange: 0, percentile52w: 88,
    icValue: 0.082, icir: 1.18, direction: 'bullish',
    signal: '央行购金持续，长期结构性支撑', shapValue: 0.121,
  },
  {
    id: 'F8', name: 'ETF资金流', nameEn: 'GLD+IAU Flow', zScore: -0.44,
    rawValue: -2.3, rawUnit: 't/5d', dayChange: -1.1, percentile52w: 38,
    icValue: 0.048, icir: 0.71, direction: 'bearish',
    signal: 'ETF小幅流出，短期情绪承压', shapValue: -0.082,
  },
  {
    id: 'F9', name: '金矿产能', nameEn: 'GDX vs Gold RS', zScore: -0.28,
    rawValue: 0.97, rawUnit: 'ratio', dayChange: 0.01, percentile52w: 45,
    icValue: -0.031, icir: -0.44, direction: 'neutral',
    signal: 'GDX表现平稳，无明显信号', shapValue: 0.067,
  },
]

// ─── Daily Signal ────────────────────────────────────────────────────
export const dailySignal: DailySignal = {
  signal: 'strong_buy',
  prediction: 0.72,
  confidence: 74,
  generatedAt: '2026-03-19 21:00 UTC',
  regime: 'R1: 实际利率主导',
  shapBars: [
    { factor: 'F3 实际利率', factorId: 'F3', value: 0.281, zScore: -1.89, rawValue: 'TIPS 10Y: 1.72%', economic: '实际利率下行驱动金价上涨' },
    { factor: 'F4 通胀预期', factorId: 'F4', value: 0.192, zScore: 1.23, rawValue: '5Y5Y BEI: 2.61%', economic: '通胀预期上升，抗缩水需求增加' },
    { factor: 'F6 市场情绪', factorId: 'F6', value: 0.152, zScore: 1.14, rawValue: 'GVZ: 18.4', economic: '恐慌指数偏高，避险情绪支撑金价' },
    { factor: 'F7 央行需求', factorId: 'F7', value: 0.121, zScore: 1.56, rawValue: '央行净买入 290t/Q', economic: '央行持续增储，结构性需求稳定' },
    { factor: 'F9 金矿产能', factorId: 'F9', value: 0.067, zScore: -0.28, rawValue: 'GDX/Gold: 0.97', economic: '矿商相对弱势，产量无扩张压力' },
    { factor: 'F1 美元强弱', factorId: 'F1', value: 0.042, zScore: -1.42, rawValue: 'DXY: 101.32', economic: 'DXY走弱，以美元计价的黄金获支撑' },
    { factor: 'F2 货币政策', factorId: 'F2', value: 0.008, zScore: 0.31, rawValue: 'FF Futures: 4.82%', economic: '货币政策预期中性，信号较弱' },
    { factor: 'F5 地缘风险', factorId: 'F5', value: -0.041, zScore: 0.67, rawValue: 'GPR: 142', economic: '地缘压力相对可控，避险需求边际减弱' },
    { factor: 'F8 ETF资金流', factorId: 'F8', value: -0.082, zScore: -0.44, rawValue: '-2.3t (5日净流出)', economic: 'ETF持仓减少，短期资金情绪偏弱' },
  ],
}

// ─── IC Historical Data (252 trading days per factor) ────────────────
function generateICData(baseIC: number, volatility: number): ICDataPoint[] {
  const data: ICDataPoint[] = []
  const regimes: Array<ICDataPoint['regime']> = ['rate_hike', 'rate_cut', 'neutral']
  // Use mean-reverting random walk for realistic IC series
  let ic = baseIC
  const window: number[] = []
  for (let i = 251; i >= 0; i--) {
    const d = new Date(2026, 2, 19)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    // Mean-reverting: pull toward baseIC, add noise
    const meanRevert = (baseIC - ic) * 0.08
    ic = ic + meanRevert + (Math.random() - 0.5) * volatility * 2
    ic = Math.max(-0.25, Math.min(0.25, ic))
    window.push(ic)
    if (window.length > 20) window.shift()
    const ic20ma = window.reduce((s, v) => s + v, 0) / window.length
    const regime = regimes[Math.floor(i / 84) % 3]
    data.push({ date: dateStr, ic: parseFloat(ic.toFixed(4)), ic20ma: parseFloat(ic20ma.toFixed(4)), regime })
  }
  return data
}

export const icDataByFactor: Record<string, ICDataPoint[]> = {
  F1: generateICData(-0.08, 0.04),
  F2: generateICData(-0.04, 0.06),
  F3: generateICData(-0.14, 0.03),
  F4: generateICData(0.09, 0.04),
  F5: generateICData(0.05, 0.07),
  F6: generateICData(0.07, 0.05),
  F7: generateICData(0.08, 0.03),
  F8: generateICData(0.05, 0.06),
  F9: generateICData(-0.03, 0.05),
}

// ─── Regime Heatmap ──────────────────────────────────────────────────
function generateRegimeData(): RegimeCell[] {
  const cells: RegimeCell[] = []
  const months = ['2025-04', '2025-05', '2025-06', '2025-07', '2025-08',
    '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03']
  const factorIds = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9']
  const baseSHAPs: Record<string, number> = {
    F1: 0.05, F2: 0.03, F3: 0.28, F4: 0.19, F5: 0.04, F6: 0.15, F7: 0.12, F8: -0.08, F9: 0.07,
  }
  months.forEach((month, mi) => {
    factorIds.forEach(fid => {
      const base = baseSHAPs[fid]
      const noise = (Math.random() - 0.5) * 0.12
      const phaseShift = Math.sin((mi / months.length) * Math.PI * 2) * 0.08
      const contrib = base + noise + phaseShift
      cells.push({ month, factorId: fid, shapContrib: parseFloat(contrib.toFixed(4)), direction: contrib >= 0 ? 1 : -1 })
    })
  })
  return cells
}

export const regimeData: RegimeCell[] = generateRegimeData()

// ─── Correlation Matrix ───────────────────────────────────────────────
export const correlationMatrix: Record<string, Record<string, number>> = {
  F1: { F1: 1.00, F2: 0.61, F3: 0.72, F4: -0.43, F5: -0.18, F6: -0.22, F7: -0.15, F8: -0.31, F9: 0.28 },
  F2: { F1: 0.61, F2: 1.00, F3: 0.58, F4: -0.38, F5: -0.12, F6: -0.17, F7: -0.09, F8: -0.25, F9: 0.19 },
  F3: { F1: 0.72, F2: 0.58, F3: 1.00, F4: -0.55, F5: -0.21, F6: -0.29, F7: -0.18, F8: -0.38, F9: 0.33 },
  F4: { F1: -0.43, F2: -0.38, F3: -0.55, F4: 1.00, F5: 0.34, F6: 0.41, F7: 0.28, F8: 0.52, F9: -0.24 },
  F5: { F1: -0.18, F2: -0.12, F3: -0.21, F4: 0.34, F5: 1.00, F6: 0.67, F7: 0.22, F8: 0.18, F9: -0.09 },
  F6: { F1: -0.22, F2: -0.17, F3: -0.29, F4: 0.41, F5: 0.67, F6: 1.00, F7: 0.19, F8: 0.29, F9: -0.13 },
  F7: { F1: -0.15, F2: -0.09, F3: -0.18, F4: 0.28, F5: 0.22, F6: 0.19, F7: 1.00, F8: 0.36, F9: -0.07 },
  F8: { F1: -0.31, F2: -0.25, F3: -0.38, F4: 0.52, F5: 0.18, F6: 0.29, F7: 0.36, F8: 1.00, F9: -0.19 },
  F9: { F1: 0.28, F2: 0.19, F3: 0.33, F4: -0.24, F5: -0.09, F6: -0.13, F7: -0.07, F8: -0.19, F9: 1.00 },
}

// ─── Current Positions ───────────────────────────────────────────────
export const positions: Position[] = [
  {
    id: 'POS-001', direction: 'long', entryPrice: 3050.20, currentPrice: 3124.50,
    lots: 16, pnl: 74.30 * 16, pnlPct: 2.44, stopLoss: 2987.30,
    atrMultiple: 2.5, heatPct: 0.82, openDate: '2026-03-05',
    mainFactor: 'F3 实际利率', shapDriver: 'TIPS 10Y ↓ 8bps', stopType: 'trailing',
  },
  {
    id: 'POS-002', direction: 'long', entryPrice: 3089.10, currentPrice: 3124.50,
    lots: 8, pnl: 35.40 * 8, pnlPct: 1.15, stopLoss: 3089.10,
    atrMultiple: 2.5, heatPct: 0.38, openDate: '2026-03-12',
    mainFactor: 'F4 通胀预期', shapDriver: 'BEI +4bps', stopType: 'breakeven',
  },
]

// ─── Account Stats ───────────────────────────────────────────────────
export const accountStats: AccountStats = {
  equity: 101892.40, balance: 100000, drawdown: 1.89,
  portfolioHeat: 1.20, riskLevel: 'healthy',
  sharpe60d: 1.42, calmar: 2.81, maxDrawdown: 4.73,
  winRate: 67.3, profitFactor: 2.14, totalTrades: 49,
}

// ─── Equity Curve ────────────────────────────────────────────────────
function generateEquityCurve() {
  const data = []
  let equity = 100000
  let gld = 100000
  for (let i = 90; i >= 0; i--) {
    const d = new Date(2026, 2, 19)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    equity *= 1 + (Math.random() - 0.42) * 0.008
    gld *= 1 + (Math.random() - 0.44) * 0.006
    data.push({ date: dateStr, equity: Math.round(equity), gld: Math.round(gld) })
  }
  return data
}

export const equityCurve = generateEquityCurve()

// ─── Alerts ──────────────────────────────────────────────────────────
export const alerts: AlertItem[] = [
  { id: 'a1', level: 'info', message: '每日信号生成完成：做多 (预测 +0.72%)', time: '21:00' },
  { id: 'a2', level: 'info', message: 'Regime 维持 R1: 实际利率主导（第21日）', time: '21:01' },
  { id: 'a3', level: 'warning', message: 'F3 实际利率 SHAP 贡献 39.5%（接近 40% 阈值）', time: '21:02' },
  { id: 'a4', level: 'info', message: 'POS-001 移动止损更新：$2,987.30 → $3,012.10', time: '16:35' },
  { id: 'a5', level: 'daily', message: '日报已生成，Portfolio Heat: 1.20%（健康档）', time: '21:05' },
]

// ─── Gold Price (intraday mock) ──────────────────────────────────────
export function generateGoldPrice() {
  const data = []
  let price = 3080
  for (let i = 390; i >= 0; i--) {
    price += (Math.random() - 0.48) * 2.5
    data.push({
      time: `${String(Math.floor((390 - i) / 60 + 9)).padStart(2, '0')}:${String((390 - i) % 60).padStart(2, '0')}`,
      price: parseFloat(price.toFixed(2)),
    })
  }
  return data
}
