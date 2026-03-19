'use client'
import { Wallet, Flame, TrendingUp, Award } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { AccountStats } from '@/types'
import { ResponsiveContainer, AreaChart, Area } from 'recharts'
import { equityCurve } from '@/data/mockData'

interface AccountCardProps {
  stats: AccountStats
}

const riskConfig = {
  healthy: { label: '健康档', variant: 'green' as const, heatColor: 'green' as const },
  warning: { label: '预警档', variant: 'amber' as const, heatColor: 'amber' as const },
  circuit_break: { label: '熔断档', variant: 'red' as const, heatColor: 'red' as const },
}

export function AccountCard({ stats }: AccountCardProps) {
  const rc = riskConfig[stats.riskLevel]
  const equity = stats.equity
  const pnl = equity - stats.balance
  const pnlPct = (pnl / stats.balance) * 100

  // heat bar color
  const heatColor = stats.portfolioHeat > 1.8 ? 'red' : stats.portfolioHeat > 1.2 ? 'amber' : 'green'

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0A1628] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
          <Wallet className="w-3.5 h-3.5" />
          仿真账户 (VSTAR)
        </div>
        <Badge variant={rc.variant} size="sm" dot>
          {rc.label}
        </Badge>
      </div>

      {/* Equity */}
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] text-slate-600 mb-0.5">账户净值</div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            ${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs font-mono mt-0.5" style={{ color: pnl >= 0 ? '#22C55E' : '#EF4444' }}>
            {pnl >= 0 ? '+' : ''}${Math.abs(pnl).toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
          </div>
        </div>
        {/* Mini equity chart */}
        <div className="h-12 w-28">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={equityCurve.slice(-60)}>
              <defs>
                <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="equity" stroke="#22C55E" strokeWidth={1.5} fill="url(#eqGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Portfolio Heat */}
      <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.04]">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <Flame className="w-3 h-3" />
            Portfolio Heat
          </div>
          <span className="text-xs font-bold font-mono" style={{
            color: stats.portfolioHeat > 1.8 ? '#EF4444' : stats.portfolioHeat > 1.2 ? '#F59E0B' : '#22C55E',
          }}>
            {stats.portfolioHeat.toFixed(2)}% / 2.00%
          </span>
        </div>
        <ProgressBar value={stats.portfolioHeat} max={2} color={heatColor} height={6} />
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-slate-700">0%</span>
          <span className="text-[9px] text-amber-600">1.8% 预警</span>
          <span className="text-[9px] text-red-700">2%</span>
        </div>
      </div>

      {/* Performance metrics */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Sharpe(60d)', value: stats.sharpe60d.toFixed(2), color: stats.sharpe60d > 1 ? 'text-green-400' : 'text-amber-400' },
          { label: '最大回撤', value: `-${stats.maxDrawdown.toFixed(2)}%`, color: 'text-red-400' },
          { label: '胜率', value: `${stats.winRate.toFixed(1)}%`, color: 'text-blue-400' },
        ].map(m => (
          <div key={m.label} className="text-center p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <div className="text-[9px] text-slate-600 mb-0.5">{m.label}</div>
            <div className={`text-sm font-bold font-mono ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* More metrics */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Calmar', value: stats.calmar.toFixed(2), color: 'text-purple-400' },
          { label: '盈亏比', value: stats.profitFactor.toFixed(2), color: 'text-slate-300' },
          { label: '总交易', value: stats.totalTrades.toString(), color: 'text-slate-400' },
        ].map(m => (
          <div key={m.label} className="text-center p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <div className="text-[9px] text-slate-600 mb-0.5">{m.label}</div>
            <div className={`text-sm font-bold font-mono ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Risk multiplier indicator */}
      <div className="flex items-center gap-2 p-2 rounded-xl border border-white/[0.06]">
        <Award className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
        <div className="flex-1">
          <div className="text-[9px] text-slate-600">当前回撤 {stats.drawdown.toFixed(2)}% · 风险乘数 1.0×</div>
          <div className="flex gap-1 mt-1">
            {['< 5%', '5-15%', '> 15%'].map((stage, i) => (
              <div key={stage} className={`flex-1 h-1 rounded-full ${i === 0 ? 'bg-green-500' : 'bg-slate-800'}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
