'use client'
import { SignalCard } from '@/components/cards/SignalCard'
import { PositionCard } from '@/components/cards/PositionCard'
import { AccountCard } from '@/components/cards/AccountCard'
import { ShapWaterfall } from '@/components/charts/ShapWaterfall'
import { useSignal, useShapValues, usePositions, useAccount } from '@/lib/useGoldData'
import { DailySignal, ShapBar, Position, AccountStats, Signal } from '@/types'

/** Map API signal string to component Signal type */
function mapSignal(s: string): Signal {
  const lower = s.toLowerCase().replace(/[\s_]/g, '')
  if (lower.includes('strongbuy') || lower.includes('buy')) return 'strong_buy'
  if (lower.includes('strongsell') || lower.includes('sell')) return 'strong_sell'
  return 'neutral'
}

const EMPTY_SIGNAL: DailySignal = {
  signal: 'neutral',
  prediction: 0,
  confidence: 0,
  generatedAt: '--',
  regime: 'Neutral',
  shapBars: [],
}

const EMPTY_ACCOUNT: AccountStats = {
  equity: 100000,
  balance: 100000,
  drawdown: 0,
  portfolioHeat: 0,
  riskLevel: 'healthy',
  sharpe60d: 0,
  calmar: 0,
  maxDrawdown: 0,
  winRate: 0,
  profitFactor: 0,
  totalTrades: 0,
}

export function RightSidebar() {
  const { data: signalData } = useSignal()
  const { data: shapData } = useShapValues()
  const { data: posData } = usePositions()
  const { data: acctData } = useAccount()

  // ── Build SHAP bars from API ──
  const shapBars: ShapBar[] = shapData
    ? shapData.bars.map(b => ({
        factor: b.label,
        factorId: b.factor,
        value: b.value / 100,
        zScore: b.raw_feature,
        rawValue: `Z: ${b.raw_feature.toFixed(2)}`,
        economic: '',
      }))
    : []

  // ── Build DailySignal from API ──
  const dailySignal: DailySignal = signalData
    ? {
        signal: mapSignal(signalData.signal),
        prediction: signalData.predicted_return,
        confidence: signalData.confidence,
        generatedAt: signalData.timestamp ?? signalData.date,
        regime: signalData.regime,
        shapBars,
      }
    : EMPTY_SIGNAL

  // ── Build Positions from API ──
  const positions: Position[] = posData?.active?.length
    ? posData.active.map((p, i) => ({
        id: `POS-${String(i + 1).padStart(3, '0')}`,
        direction: p.direction.toLowerCase() as 'long' | 'short',
        entryPrice: p.entry_price,
        currentPrice: p.current_price,
        lots: Math.round(p.size),
        pnl: p.unrealized_pnl,
        pnlPct: p.return_pct,
        stopLoss: p.stop_loss,
        atrMultiple: 2.5,
        heatPct: Math.abs(p.return_pct) * 0.5,
        openDate: signalData?.date ?? new Date().toISOString().slice(0, 10),
        mainFactor: signalData?.factors?.[0]?.label ?? 'N/A',
        shapDriver: shapBars[0]?.factor ?? 'N/A',
        stopType: 'initial' as const,
      }))
    : []

  // ── Build AccountStats from API ──
  const accountStats: AccountStats = acctData
    ? {
        equity: acctData.final_equity,
        balance: acctData.initial_equity,
        drawdown: acctData.max_drawdown,
        portfolioHeat: positions.reduce((s, p) => s + Math.abs(p.pnlPct) * 0.5, 0),
        riskLevel: acctData.max_drawdown > 15 ? 'circuit_break' : acctData.max_drawdown > 5 ? 'warning' : 'healthy',
        sharpe60d: acctData.sharpe_ratio,
        calmar: acctData.max_drawdown > 0
          ? acctData.total_return / acctData.max_drawdown
          : 0,
        maxDrawdown: acctData.max_drawdown,
        winRate: acctData.win_rate,
        profitFactor: acctData.avg_win && acctData.avg_loss
          ? Math.abs(acctData.avg_win / acctData.avg_loss)
          : 0,
        totalTrades: acctData.total_trades,
      }
    : EMPTY_ACCOUNT

  return (
    <div className="h-full flex flex-col gap-2 md:gap-3 p-2 md:p-3 overflow-y-auto bg-[#050B18]">
      {/* Position management */}
      <PositionCard positions={positions} />

      {/* Account dashboard */}
      <AccountCard stats={accountStats} />
    </div>
  )
}
