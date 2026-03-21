'use client'
import useSWR from 'swr'
import { Factor } from '@/types'
import { factors as MOCK_FACTORS } from '@/data/mockData'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const REFRESH = 60_000 // 60s

export interface GoldPriceData {
  price: number
  change: number
  changePct: number
  open: number
  high: number
  low: number
  prevClose: number
  week52High?: number
  week52Low?: number
  source: 'yahoo' | 'stooq' | 'mock'
  timestamp: string
}

export interface FactorsData {
  factors: Factor[]
  dataSource: {
    fred: boolean
    yahoo: boolean
    stooq?: boolean
    timestamp: string
  }
}

export function useGoldPrice() {
  const { data, error, isLoading } = useSWR<GoldPriceData>(
    '/api/gold-price',
    fetcher,
    {
      refreshInterval: REFRESH,
      revalidateOnFocus: false,
      fallbackData: {
        price: 3124.5,
        change: 12.3,
        changePct: 0.39,
        open: 3112.2,
        high: 3138.0,
        low: 3108.5,
        prevClose: 3112.2,
        source: 'mock' as const,
        timestamp: new Date().toISOString(),
      },
    },
  )
  return { data, error, isLoading }
}

export function useFactors() {
  const { data, error, isLoading } = useSWR<FactorsData>(
    '/api/factors',
    fetcher,
    {
      refreshInterval: REFRESH * 60, // refresh hourly
      revalidateOnFocus: false,
      fallbackData: {
        factors: MOCK_FACTORS,
        dataSource: { fred: false, yahoo: false, timestamp: new Date().toISOString() },
      },
    },
  )
  return {
    factors: data?.factors ?? MOCK_FACTORS,
    dataSource: data?.dataSource,
    error,
    isLoading,
  }
}

// ── Pipeline Data Hooks ───────────────────────────────────────────────────

export interface SignalData {
  date: string
  timestamp?: string
  signal: string
  predicted_return: number
  confidence: number
  gold_price: number
  gold_open?: number
  gold_high?: number
  gold_low?: number
  atr: number
  stop_loss: number
  take_profit: number
  position_size: number
  regime: string
  regime_multiplier: number
  factors: Array<{
    name: string
    label: string
    zscore: number
    raw_value: number | null
  }>
}

export interface ShapData {
  base_value: number
  prediction: number
  bars: Array<{
    factor: string
    label: string
    value: number
    raw_feature: number
  }>
}

export interface ICHistoryData {
  rolling_ic: Array<{ date: string; ic: number }>
  factor_ic: Array<{ factor: string; ic: number }>
  cv_mean_ic: number
}

export interface RegimeData {
  current: {
    regime: string
    multiplier: number
    risk_off_score: number
    risk_on_score: number
  }
  heatmap: Array<{
    month: string
    factors: Record<string, number>
  }>
}

export interface CorrelationData {
  factors: string[]
  matrix: Array<{ x: string; y: string; value: number }>
}

export interface PositionsData {
  active: Array<{
    symbol: string
    direction: string
    size: number
    entry_price: number
    current_price: number
    stop_loss: number
    unrealized_pnl: number
    return_pct: number
  }>
  recent_trades: Array<{
    date: string
    type: string
    direction: string
    entry: number
    exit: number
    pnl: number
    return_pct: number
  }>
}

export interface AccountData {
  initial_equity: number
  final_equity: number
  total_return: number
  total_trades: number
  win_rate: number
  winners: number
  losers: number
  max_drawdown: number
  sharpe_ratio: number
  avg_win: number
  avg_loss: number
}

export interface EquityCurvePoint {
  date: string
  equity: number
  drawdown: number
  gold_price: number
}

const HOURLY = REFRESH * 60

export function useSignal() {
  return useSWR<SignalData>('/api/signal', fetcher, {
    refreshInterval: HOURLY,
    revalidateOnFocus: false,
  })
}

export function useShapValues() {
  return useSWR<ShapData>('/api/shap', fetcher, {
    refreshInterval: HOURLY,
    revalidateOnFocus: false,
  })
}

export function useICHistory() {
  return useSWR<ICHistoryData>('/api/ic-history', fetcher, {
    refreshInterval: HOURLY,
    revalidateOnFocus: false,
  })
}

export function useRegime() {
  return useSWR<RegimeData>('/api/regime', fetcher, {
    refreshInterval: HOURLY,
    revalidateOnFocus: false,
  })
}

export function useCorrelation() {
  return useSWR<CorrelationData>('/api/correlation', fetcher, {
    refreshInterval: HOURLY,
    revalidateOnFocus: false,
  })
}

export function usePositions() {
  return useSWR<PositionsData>('/api/positions', fetcher, {
    refreshInterval: HOURLY,
    revalidateOnFocus: false,
  })
}

export function useAccount() {
  return useSWR<AccountData>('/api/account', fetcher, {
    refreshInterval: HOURLY,
    revalidateOnFocus: false,
  })
}

export function useEquityCurve() {
  return useSWR<EquityCurvePoint[]>('/api/equity-curve', fetcher, {
    refreshInterval: HOURLY,
    revalidateOnFocus: false,
  })
}
