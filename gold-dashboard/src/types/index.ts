export interface Factor {
  id: string
  name: string
  nameEn: string
  zScore: number
  rawValue: number
  rawUnit: string
  dayChange: number
  percentile52w: number
  icValue: number
  icir: number
  direction: 'bullish' | 'bearish' | 'neutral'
  signal: string
  shapValue: number
}

export interface ShapBar {
  factor: string
  factorId: string
  value: number
  zScore: number
  rawValue: string
  economic: string
}

export interface ICDataPoint {
  date: string
  ic: number
  ic20ma: number
  regime: 'rate_hike' | 'rate_cut' | 'neutral'
}

export interface RegimeCell {
  month: string
  factorId: string
  shapContrib: number
  direction: number
}

export interface Position {
  id: string
  direction: 'long' | 'short'
  entryPrice: number
  currentPrice: number
  lots: number
  pnl: number
  pnlPct: number
  stopLoss: number
  atrMultiple: number
  heatPct: number
  openDate: string
  mainFactor: string
  shapDriver: string
  stopType: 'initial' | 'breakeven' | 'trailing'
}

export interface AlertItem {
  id: string
  level: 'critical' | 'warning' | 'info' | 'daily'
  message: string
  time: string
}

export interface AccountStats {
  equity: number
  balance: number
  drawdown: number
  portfolioHeat: number
  riskLevel: 'healthy' | 'warning' | 'circuit_break'
  sharpe60d: number
  calmar: number
  maxDrawdown: number
  winRate: number
  profitFactor: number
  totalTrades: number
}

export type Signal = 'strong_buy' | 'neutral' | 'strong_sell'

export interface DailySignal {
  signal: Signal
  prediction: number
  confidence: number
  generatedAt: string
  regime: string
  shapBars: ShapBar[]
}

export type TabId = 'shap' | 'ic' | 'regime' | 'correlation'
