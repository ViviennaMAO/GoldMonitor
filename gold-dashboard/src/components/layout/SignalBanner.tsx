'use client'
import { TrendingUp, TrendingDown, Minus, Cpu, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { useSignal, useShapValues } from '@/lib/useGoldData'
import clsx from 'clsx'

const signalConfig = {
  strong_buy: {
    label: '做多 · Strong Buy',
    icon: TrendingUp,
    color: '#22C55E',
    bgFrom: 'from-green-500/8',
    border: 'border-green-500/20',
  },
  neutral: {
    label: '中性 · Neutral',
    icon: Minus,
    color: '#F59E0B',
    bgFrom: 'from-amber-500/8',
    border: 'border-amber-500/20',
  },
  strong_sell: {
    label: '做空 · Strong Sell',
    icon: TrendingDown,
    color: '#EF4444',
    bgFrom: 'from-red-500/8',
    border: 'border-red-500/20',
  },
}

type Signal = 'strong_buy' | 'neutral' | 'strong_sell'

function mapSignal(s: string): Signal {
  const lower = s.toLowerCase().replace(/[\s_]/g, '')
  if (lower.includes('strongbuy') || lower.includes('buy')) return 'strong_buy'
  if (lower.includes('strongsell') || lower.includes('sell')) return 'strong_sell'
  return 'neutral'
}

export function SignalBanner() {
  const { data: signalData } = useSignal()
  const { data: shapData } = useShapValues()

  const signalType: Signal = signalData ? mapSignal(signalData.signal) : 'neutral'
  const cfg = signalConfig[signalType]
  const Icon = cfg.icon
  const prediction = signalData?.predicted_return ?? 0
  const confidence = signalData?.confidence ?? 0
  const regime = signalData?.regime ?? 'Neutral'
  const timestamp = signalData?.timestamp ?? signalData?.date ?? '--'
  const timeOnly = typeof timestamp === 'string' ? timestamp.split(' ')[1] ?? timestamp.split('T')[1]?.slice(0, 5) ?? '--' : '--'

  // Top 3 SHAP drivers
  const topShap = shapData?.bars?.slice(0, 3) ?? []

  return (
    <div className={clsx(
      'border-b', cfg.border,
      'bg-gradient-to-r', cfg.bgFrom, 'to-transparent',
      'bg-[#060E1E]',
    )}>
      <div className="max-w-[1600px] mx-auto px-3 md:px-5 py-2.5 md:py-3">
        <div className="flex items-center justify-between gap-3 md:gap-6 flex-wrap md:flex-nowrap">

          {/* Left: regime + signal */}
          <div className="flex items-center gap-3 md:gap-4 flex-shrink-0">
            {/* Signal icon */}
            <div
              className="w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: cfg.color + '18', border: `1px solid ${cfg.color}30` }}
            >
              <Icon className="w-5 h-5 md:w-6 md:h-6" style={{ color: cfg.color }} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Badge variant="purple" size="sm">
                  <Cpu className="w-3 h-3" />
                  {regime}
                </Badge>
                <span className="text-[9px] text-slate-600 font-mono hidden sm:inline">
                  <Clock className="w-2.5 h-2.5 inline mr-0.5" />{timeOnly}
                </span>
              </div>
              <div className="text-base md:text-lg font-bold leading-tight" style={{ color: cfg.color }}>
                {cfg.label}
              </div>
            </div>
          </div>

          {/* Center: prediction stats */}
          <div className="flex items-center gap-4 md:gap-8 flex-1 justify-center order-3 md:order-none w-full md:w-auto">
            <div className="text-center">
              <div className="text-[10px] text-slate-500 mb-0.5">预测20日收益</div>
              <div className="text-lg md:text-xl font-bold font-mono" style={{ color: cfg.color }}>
                {prediction > 0 ? '+' : ''}{prediction.toFixed(2)}%
              </div>
            </div>
            <div className="w-px h-8 bg-white/10 flex-shrink-0" />
            <div className="text-center">
              <div className="text-[10px] text-slate-500 mb-0.5">模型置信度</div>
              <div className="text-lg md:text-xl font-bold font-mono text-slate-200">
                {confidence.toFixed(1)}%
              </div>
            </div>
            <div className="w-px h-8 bg-white/10 flex-shrink-0" />
            <div className="text-center">
              <div className="text-[10px] text-slate-500 mb-0.5">信号阈值</div>
              <div className="text-lg md:text-xl font-bold font-mono text-slate-400">±0.8%</div>
            </div>
          </div>

          {/* Right: top SHAP drivers */}
          <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
            <div className="w-px h-8 bg-white/10" />
            <div className="min-w-[200px]">
              <div className="text-[9px] text-slate-600 uppercase tracking-wider mb-1">Top 驱动因子</div>
              <div className="space-y-0.5">
                {topShap.map(bar => (
                  <div key={bar.factor} className="flex items-center gap-1.5">
                    <span className="text-[9px] text-slate-500 font-mono w-20 truncate">{bar.label}</span>
                    <div className="flex-1 h-2 rounded bg-white/[0.04] overflow-hidden w-16">
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${Math.min(Math.abs(bar.value) * 3, 100)}%`,
                          backgroundColor: bar.value >= 0 ? '#22C55E' : '#EF4444',
                          opacity: 0.6,
                        }}
                      />
                    </div>
                    <span className="text-[9px] font-mono w-10 text-right" style={{ color: bar.value >= 0 ? '#22C55E' : '#EF4444' }}>
                      {bar.value > 0 ? '+' : ''}{bar.value.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
