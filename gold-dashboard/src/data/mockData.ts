import { Factor, ShapBar, ICDataPoint, RegimeCell, Position, AlertItem, AccountStats, DailySignal } from '@/types'

// ─── Eight Gold Factors (P3: 4 base + 4 logical) ─────────────────────
export const factors: Factor[] = [
  {
    id: 'F1', name: '美元指数', nameEn: 'DXY Index', zScore: -0.22,
    rawValue: 120.89, rawUnit: 'idx', dayChange: 0.50, percentile52w: 36,
    icValue: 0.329, icir: 1.48, direction: 'neutral',
    signal: 'DXY中性，方向不明', shapValue: 0.15,
  },
  {
    id: 'F4', name: '通胀预期', nameEn: 'BEI 10Y', zScore: -0.05,
    rawValue: 2.31, rawUnit: '%', dayChange: 0.01, percentile52w: 48,
    icValue: -0.387, icir: -1.82, direction: 'neutral',
    signal: '通胀预期期限温和', shapValue: -0.01,
  },
  {
    id: 'F5', name: '地缘政治风险', nameEn: 'GPR Index', zScore: -0.39,
    rawValue: 371.1, rawUnit: 'GPR', dayChange: 3.20, percentile52w: 64,
    icValue: 0.048, icir: 0.82, direction: 'neutral',
    signal: '地缘风险中性', shapValue: -0.06,
  },
  {
    id: 'F6', name: '市场情绪', nameEn: 'GVZ', zScore: 2.88,
    rawValue: 42.7, rawUnit: 'GVZ', dayChange: 0.90, percentile52w: 72,
    icValue: -0.527, icir: -2.45, direction: 'bearish',
    signal: 'GVZ极高，黄金恐慌溢价↑↑', shapValue: 0.15,
  },
  {
    id: 'F10', name: '实际利率-通胀利差', nameEn: 'TIPS-BEI Spread', zScore: 0.53,
    rawValue: -0.30, rawUnit: '%', dayChange: -0.04, percentile52w: 55,
    icValue: 0.728, icir: 3.21, direction: 'bearish',
    signal: '利差偏高，持有成本上升', shapValue: -0.11,
  },
  {
    id: 'F11', name: '美元动量', nameEn: 'DXY 20D Momentum', zScore: 1.32,
    rawValue: 1.07, rawUnit: '%', dayChange: 0.12, percentile52w: 68,
    icValue: -0.270, icir: -1.35, direction: 'bearish',
    signal: '美元加速走强', shapValue: -0.07,
  },
  {
    id: 'F13', name: '金价-矿业股背离', nameEn: 'Gold-GDX Divergence', zScore: 0.09,
    rawValue: 0.09, rawUnit: 'z', dayChange: 0.01, percentile52w: 52,
    icValue: -0.268, icir: -1.28, direction: 'neutral',
    signal: '金矿背离微弱，无明显信号', shapValue: 0.02,
  },
  {
    id: 'F14', name: '波动率动量', nameEn: 'GVZ Momentum', zScore: 1.51,
    rawValue: 15.2, rawUnit: '%', dayChange: 0.50, percentile52w: 65,
    icValue: -0.174, icir: -0.92, direction: 'bearish',
    signal: '波动率上升加速', shapValue: 0.02,
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
    { factor: 'F6 市场情绪', factorId: 'F6', value: 0.341, zScore: 2.88, rawValue: 'GVZ: 42.7', economic: 'GVZ极高，黄金恐慌溢价显著' },
    { factor: 'F14 波动率动量', factorId: 'F14', value: 0.182, zScore: 1.51, rawValue: 'GVZ Mom: 15.2%', economic: '波动率上升加速，恐慌蔓延' },
    { factor: 'F10 利率通胀利差', factorId: 'F10', value: 0.139, zScore: 0.53, rawValue: 'Spread: -0.30%', economic: '利差偏高，持有成本上升' },
    { factor: 'F4 通胀预期', factorId: 'F4', value: 0.108, zScore: -0.05, rawValue: '5Y5Y BEI: 2.31%', economic: '通胀预期温和' },
    { factor: 'F11 美元动量', factorId: 'F11', value: 0.095, zScore: 1.32, rawValue: 'DXY Mom: 1.07%', economic: '美元加速走强' },
    { factor: 'F1 美元强弱', factorId: 'F1', value: 0.062, zScore: -0.22, rawValue: 'DXY: 120.89', economic: 'DXY中性，方向不明' },
    { factor: 'F13 金矿背离', factorId: 'F13', value: 0.042, zScore: 0.09, rawValue: 'Divergence: 0.09z', economic: '金矿背离微弱，无明显信号' },
    { factor: 'F5 地缘风险', factorId: 'F5', value: 0.031, zScore: -0.39, rawValue: 'GPR: 371', economic: '地缘风险中性' },
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

// P3: 8 factors (removed F2, F3, F8, F9, F12)
export const icDataByFactor: Record<string, ICDataPoint[]> = {
  F1: generateICData(0.329, 0.04),
  F4: generateICData(-0.387, 0.05),
  F5: generateICData(0.048, 0.07),
  F6: generateICData(-0.527, 0.04),
  F10: generateICData(0.728, 0.03),
  F11: generateICData(-0.270, 0.05),
  F13: generateICData(-0.268, 0.06),
  F14: generateICData(-0.174, 0.05),
}

// ─── Regime Heatmap ──────────────────────────────────────────────────
function generateRegimeData(): RegimeCell[] {
  const cells: RegimeCell[] = []
  const months = ['2025-04', '2025-05', '2025-06', '2025-07', '2025-08',
    '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03']
  const factorIds = ['F1', 'F4', 'F5', 'F6', 'F10', 'F11', 'F13', 'F14']
  const baseSHAPs: Record<string, number> = {
    F1: 0.15, F4: -0.01, F5: -0.06, F6: 0.15, F10: -0.11, F11: -0.07, F13: 0.02, F14: 0.02,
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
// P3: 8-factor correlation matrix
export const correlationMatrix: Record<string, Record<string, number>> = {
  F1:  { F1: 1.00, F4: -0.43, F5: -0.18, F6: -0.22, F10: 0.35, F11: 0.72, F13: -0.15, F14: -0.18 },
  F4:  { F1: -0.43, F4: 1.00, F5: 0.34, F6: 0.41, F10: -0.68, F11: -0.38, F13: 0.22, F14: 0.35 },
  F5:  { F1: -0.18, F4: 0.34, F5: 1.00, F6: 0.67, F10: -0.21, F11: -0.12, F13: 0.08, F14: 0.55 },
  F6:  { F1: -0.22, F4: 0.41, F5: 0.67, F6: 1.00, F10: -0.29, F11: -0.17, F13: 0.11, F14: 0.74 },
  F10: { F1: 0.35, F4: -0.68, F5: -0.21, F6: -0.29, F10: 1.00, F11: 0.28, F13: -0.19, F14: -0.25 },
  F11: { F1: 0.72, F4: -0.38, F5: -0.12, F6: -0.17, F10: 0.28, F11: 1.00, F13: -0.10, F14: -0.14 },
  F13: { F1: -0.15, F4: 0.22, F5: 0.08, F6: 0.11, F10: -0.19, F11: -0.10, F13: 1.00, F14: 0.09 },
  F14: { F1: -0.18, F4: 0.35, F5: 0.55, F6: 0.74, F10: -0.25, F11: -0.14, F13: 0.09, F14: 1.00 },
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
