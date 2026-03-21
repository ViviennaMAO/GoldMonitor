'use client'
import { TrendingUp, TrendingDown, Minus, Clock, Cpu, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { DailySignal } from '@/types'

interface SignalCardProps {
  signal: DailySignal
}

const signalConfig = {
  strong_buy: {
    label: '做多 · Strong Buy',
    icon: TrendingUp,
    color: '#22C55E',
    bg: 'from-green-500/10 to-transparent',
    border: 'border-green-500/20',
    badge: 'green' as const,
    glow: '0 0 40px rgba(34, 197, 94, 0.12)',
  },
  neutral: {
    label: '中性 · Neutral',
    icon: Minus,
    color: '#F59E0B',
    bg: 'from-amber-500/10 to-transparent',
    border: 'border-amber-500/20',
    badge: 'amber' as const,
    glow: '0 0 40px rgba(245, 158, 11, 0.12)',
  },
  strong_sell: {
    label: '做空 · Strong Sell',
    icon: TrendingDown,
    color: '#EF4444',
    bg: 'from-red-500/10 to-transparent',
    border: 'border-red-500/20',
    badge: 'red' as const,
    glow: '0 0 40px rgba(239, 68, 68, 0.12)',
  },
}

export function SignalCard({ signal }: SignalCardProps) {
  const cfg = signalConfig[signal.signal]
  const Icon = cfg.icon

  return (
    <div
      className={`rounded-2xl border ${cfg.border} bg-gradient-to-b ${cfg.bg} bg-[#0A1628] p-3 md:p-4 relative overflow-hidden`}
      style={{ boxShadow: cfg.glow }}
    >
      {/* Regime badge */}
      <div className="flex items-center justify-between mb-3">
        <Badge variant="purple" size="sm">
          <Cpu className="w-3 h-3" />
          {signal.regime}
        </Badge>
        <Badge variant="gray" size="sm">
          <Clock className="w-3 h-3" />
          {signal.generatedAt.split(' ')[1]}
        </Badge>
      </div>

      {/* Main signal */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: cfg.color + '20', border: `1px solid ${cfg.color}30` }}
        >
          <Icon className="w-6 h-6" style={{ color: cfg.color }} />
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-0.5">今日交易信号</div>
          <div className="text-lg font-bold" style={{ color: cfg.color }}>{cfg.label}</div>
        </div>
      </div>

      {/* Prediction */}
      <div className="flex items-center justify-around gap-2 md:gap-4 mb-3 p-2 md:p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
        <div className="text-center min-w-0">
          <div className="text-[10px] text-slate-500 mb-0.5">预测20日收益</div>
          <div className="text-base md:text-xl font-bold font-mono" style={{ color: cfg.color }}>
            {signal.prediction > 0 ? '+' : ''}{signal.prediction.toFixed(2)}%
          </div>
        </div>
        <div className="w-px h-8 bg-white/10 flex-shrink-0" />
        <div className="text-center min-w-0">
          <div className="text-[10px] text-slate-500 mb-0.5">模型置信度</div>
          <div className="text-base md:text-xl font-bold font-mono text-slate-200">{signal.confidence}%</div>
        </div>
        <div className="w-px h-8 bg-white/10 flex-shrink-0" />
        <div className="text-center min-w-0">
          <div className="text-[10px] text-slate-500 mb-0.5">信号阈值</div>
          <div className="text-base md:text-xl font-bold font-mono text-slate-400">±0.8%</div>
        </div>
      </div>

      {/* Top SHAP drivers */}
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">主要驱动因子 (SHAP)</div>
        <div className="space-y-1.5">
          {signal.shapBars.slice(0, 3).map(bar => (
            <div key={bar.factorId} className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 font-mono w-16 flex-shrink-0">{bar.factorId}</span>
              <div className="flex-1 h-3 rounded bg-white/[0.03] overflow-hidden relative">
                <div
                  className="absolute top-0 bottom-0 rounded transition-all duration-700"
                  style={{
                    width: `${Math.abs(bar.value) * 300}%`,
                    maxWidth: '100%',
                    backgroundColor: bar.value >= 0 ? '#22C55E' : '#EF4444',
                    opacity: 0.7,
                  }}
                />
              </div>
              <span className="text-[10px] font-mono w-14 text-right" style={{ color: bar.value >= 0 ? '#22C55E' : '#EF4444' }}>
                {bar.value > 0 ? '+' : ''}{(bar.value * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Warning indicator */}
      {signal.shapBars[0].value > 0.35 && (
        <div className="mt-3 flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-400/80">单因子贡献接近阈值，请关注信号集中风险</p>
        </div>
      )}
    </div>
  )
}
