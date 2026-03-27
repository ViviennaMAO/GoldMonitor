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
  source: 'yahoo' | 'yahoo-chart' | 'stooq' | 'pipeline' | 'mock'
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

export interface RegimeLayer1 {
  quadrant: string
  quadrant_zh: string
  growth_direction: 'up' | 'down' | 'neutral'
  inflation_direction: 'up' | 'down' | 'neutral'
  fed_cycle: string
  fed_cycle_zh: string
  multiplier: number
}

export interface RegimeLayer2 {
  hmm_state: number
  hmm_label: 'Bull' | 'Neutral' | 'Bear'
  hmm_label_zh: string
  hmm_confidence: number
  hmm_available: boolean
  vol_level: 'high' | 'low'
  liq_level: 'good' | 'poor'
  market_regime: string
  market_regime_zh: string
  adj_factor: number
}

export interface RegimeLayer3 {
  rate_shock_detected: boolean
  shock_source: 'fragility' | 'expectation' | 'inflation' | null
  shock_source_zh: string | null
  dgs2_zscore: number | null
  shock_direction: 'up' | 'down' | null
  changepoint_detected: boolean
  days_since_changepoint: number | null
  n_breakpoints: number
  cp_available: boolean
  dollar_type: 'risk_off' | 'growth' | 'weak' | 'neutral'
  dollar_type_zh: string
  overlay_delta: number
}

export interface RegimeData {
  current: {
    regime: string
    regime_en?: string
    multiplier: number
    risk_off_score: number
    risk_on_score: number
    confidence?: number
    layer1?: RegimeLayer1
    layer2?: RegimeLayer2
    layer3?: RegimeLayer3
    version?: string
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
  gld: number
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

export interface ModelHealthData {
  timestamp: string
  status: 'healthy' | 'warning' | 'degraded' | 'insufficient_data' | 'unknown'
  warnings: string[]
  n_factors: number
  factors: string[]
  train_end: string
  oos_samples: number
  oos_ic: number
  recent_60d_ic: number
  high_corr_pairs: number
  factor_ics?: Record<string, number>
}

export function useModelHealth() {
  return useSWR<ModelHealthData>('/api/model-health', fetcher, {
    refreshInterval: HOURLY,
    revalidateOnFocus: false,
  })
}

// ── P0: Stress Test Data ────────────────────────────────────────────────────

export interface StressTestPeriod {
  name: string
  name_en: string
  start: string
  end: string
  description: string
  samples: number
  is_oos: boolean
  ic: number | null
  direction_hit_rate: number | null
  gold_return?: number
  gold_max_drawdown?: number
  pred_mean: number
  pred_std: number
  logic_breaks: Array<{
    type: string
    severity: string
    detail: string
  }>
  logic_break_count: number
  max_severity: string
  factor_analysis: Array<{
    factor: string
    mean_zscore: number
    max_abs_zscore: number
    pct_extreme: number
  }>
}

export interface StressTestData {
  generated_at: string
  periods: Record<string, StressTestPeriod>
  summary: {
    total_periods_tested: number
    periods_with_data: number
    total_logic_breaks: number
    high_severity_periods: number
    avg_crisis_ic: number | null
    avg_direction_hit_rate: number | null
    overall_assessment: string
  }
}

export function useStressTest() {
  return useSWR<StressTestData>('/api/stress-test', fetcher, {
    refreshInterval: HOURLY,
    revalidateOnFocus: false,
  })
}

// ── P2: Granger Causality Data ──────────────────────────────────────────────

export interface GrangerFactorResult {
  display_name: string
  contemporaneous_ic: number
  oos_ic: number | null
  granger_causes_gold: boolean
  optimal_lag_days: number | null
  optimal_lag_ic: number | null
  n_significant_lags: number
  verdict: string
}

export interface GrangerData {
  generated_at: string
  total_samples: number
  factors: Record<string, GrangerFactorResult>
  regime_ic: Record<string, {
    samples: number
    factor_ics: Record<string, number | null>
  }>
  summary: {
    granger_pass: number
    granger_fail: number
    total_factors: number
    pass_rate: number
    recommendation: string
  }
}

export function useGranger() {
  return useSWR<GrangerData>('/api/granger', fetcher, {
    refreshInterval: HOURLY,
    revalidateOnFocus: false,
  })
}
