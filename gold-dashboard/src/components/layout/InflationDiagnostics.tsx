'use client'
import { AlertTriangle, TrendingUp, Activity, Zap, ArrowRight, Target, Shield } from 'lucide-react'
import { useSignal, useRegime } from '@/lib/useGoldData'
import clsx from 'clsx'

// ── Inflation mechanism → visual config ──────────────────────────────────────
const mechanismConfig = {
  low_inflation: {
    label: '低通胀·利率驱动',
    color: '#3B82F6',    // blue
    icon: TrendingUp,
    tone: 'supportive',
    desc: '实际利率驱动，黄金温和受益',
  },
  moderate_trap: {
    label: '温和通胀陷阱',
    color: '#EF4444',    // red
    icon: AlertTriangle,
    tone: 'negative',
    desc: 'CPI 2-4% + 预期锚定，黄金历史最差环境',
  },
  high_anchored: {
    label: '高通胀·锚定',
    color: '#F59E0B',    // amber
    icon: Activity,
    tone: 'neutral',
    desc: '央行仍有信誉，黄金受实际利率牵制',
  },
  high_unanchored: {
    label: '高通胀·脱锚',
    color: '#10B981',    // emerald
    icon: Zap,
    tone: 'turbo',
    desc: '黄金真正主场，非线性爆发区间',
  },
  unknown: {
    label: '通胀数据缺失',
    color: '#64748B',    // slate
    icon: Activity,
    tone: 'neutral',
    desc: '数据不足，回退到默认乘数',
  },
} as const

// ── Dual-force state → display ───────────────────────────────────────────────
const dualForceConfig = {
  both: { label: '两股力量同时发力', color: '#10B981', badge: '×1.15 加仓' },
  single: { label: '单一力量在工作', color: '#F59E0B', badge: '常规跟随' },
  none: { label: '两股力量都缺席', color: '#64748B', badge: '×0.92 普通商品' },
} as const

// ── Position signal → display ────────────────────────────────────────────────
const signalAConfig = {
  full: { label: '满配', color: '#10B981' },
  partial: { label: '部分', color: '#F59E0B' },
  exit: { label: '清零', color: '#EF4444' },
} as const

const signalBConfig = {
  hold: { label: '持有', color: '#3B82F6' },
  boost: { label: '加强', color: '#10B981' },
} as const

function classifySignal(s: string): 'buy' | 'sell' | 'neutral' {
  const lower = s.toLowerCase()
  if (lower.includes('buy')) return 'buy'
  if (lower.includes('sell')) return 'sell'
  return 'neutral'
}

export function InflationDiagnostics() {
  const { data: signal } = useSignal()
  const { data: regime } = useRegime()

  // Fallback when pipeline hasn't run yet
  if (!signal || signal.inflation_mechanism === undefined) {
    return null
  }

  const mechanism = signal.inflation_mechanism ?? 'unknown'
  const cfg = mechanismConfig[mechanism]
  const Icon = cfg.icon
  const dualForce = signal.dual_force ?? 'none'
  const dualCfg = dualForceConfig[dualForce]

  const l4 = regime?.current?.layer4
  const cpi = signal.cpi_yoy ?? l4?.cpi_yoy
  const t5yifr = signal.t5yifr ?? l4?.t5yifr
  const turbo = signal.t5yifr_turbo ?? l4?.t5yifr_turbo ?? false
  const tipsChg = l4?.tips_60d_chg

  // Inflation multiplier (from layer4) vs final composite multiplier
  const inflMult = l4?.inflation_multiplier ?? 1.0
  const finalMult = signal.regime_multiplier ?? 1.0
  // Derive base (pre-inflation) multiplier: final = base × inflMult → base = final / inflMult
  const baseMult = inflMult > 0 ? finalMult / inflMult : finalMult
  const multDeltaPct = baseMult > 0 ? ((finalMult - baseMult) / baseMult) * 100 : 0

  const signalA = signal.signal_a ?? l4?.signal_a ?? 'partial'
  const signalB = signal.signal_b ?? l4?.signal_b ?? 'hold'
  const aCfg = signalAConfig[signalA]
  const bCfg = signalBConfig[signalB]

  const predCls = classifySignal(signal.signal)
  const predColor = predCls === 'buy' ? '#22C55E' : predCls === 'sell' ? '#EF4444' : '#F59E0B'

  // Conflict detection: model bullish but mechanism dampens
  const modelBullish = signal.predicted_return > 0.5
  const mechanismDampens = inflMult < 0.9
  const hasConflict = modelBullish && mechanismDampens

  return (
    <div
      className={clsx(
        'border-b border-white/[0.06] bg-[#060E1E]',
        'bg-gradient-to-r to-transparent',
      )}
      style={{
        backgroundImage: `linear-gradient(to right, ${cfg.color}10, transparent)`,
      }}
    >
      <div className="max-w-[1600px] mx-auto px-3 md:px-5 py-2.5 md:py-3">
        <div className="flex items-start gap-4 md:gap-6 flex-wrap lg:flex-nowrap">

          {/* ── Left: Mechanism badge + CPI/T5YIFR ─────────────────────── */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div
              className="w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: cfg.color + '18', border: `1px solid ${cfg.color}35` }}
            >
              <Icon className="w-5 h-5" style={{ color: cfg.color }} />
            </div>
            <div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">
                通胀机制判定
                {regime?.current?.version && (
                  <span className="ml-1.5 text-slate-700">({regime.current.version})</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm md:text-base font-bold" style={{ color: cfg.color }}>
                  {cfg.label}
                </span>
                {turbo && (
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                    style={{ backgroundColor: '#10B98125', color: '#10B981', border: '1px solid #10B98140' }}
                  >
                    🔥 TURBO
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-slate-500">
                <span>
                  CPI: <span className="text-slate-300">{cpi !== null && cpi !== undefined ? `${cpi.toFixed(2)}%` : '—'}</span>
                </span>
                <span>
                  T5YIFR: <span className="text-slate-300">{t5yifr !== null && t5yifr !== undefined ? t5yifr.toFixed(2) : '—'}</span>
                </span>
                {tipsChg !== null && tipsChg !== undefined && (
                  <span>
                    TIPS 60D: <span className={tipsChg < 0 ? 'text-green-400' : 'text-red-400'}>
                      {tipsChg > 0 ? '+' : ''}{tipsChg.toFixed(2)}pp
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Center: Multiplier adjustment flow ─────────────────────── */}
          <div className="flex items-center gap-2 md:gap-3 flex-1 justify-center min-w-0">
            <div className="text-center flex-shrink-0">
              <div className="text-[9px] text-slate-600 uppercase tracking-wider mb-0.5">基准乘数</div>
              <div className="text-sm md:text-base font-mono font-bold text-slate-400">
                {baseMult.toFixed(3)}
              </div>
            </div>

            <div className="flex flex-col items-center flex-shrink-0">
              <div className="text-[9px] text-slate-600 mb-0.5">通胀机制</div>
              <div
                className="px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                style={{
                  backgroundColor: cfg.color + '18',
                  color: cfg.color,
                  border: `1px solid ${cfg.color}30`,
                }}
              >
                ×{inflMult.toFixed(2)}
              </div>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-600 flex-shrink-0" />

            <div className="text-center flex-shrink-0">
              <div className="text-[9px] text-slate-600 uppercase tracking-wider mb-0.5">实际乘数</div>
              <div
                className="text-base md:text-lg font-mono font-bold"
                style={{ color: cfg.color }}
              >
                {finalMult.toFixed(3)}
              </div>
              <div
                className="text-[9px] font-mono"
                style={{ color: multDeltaPct < 0 ? '#EF4444' : '#10B981' }}
              >
                {multDeltaPct >= 0 ? '+' : ''}{multDeltaPct.toFixed(1)}%
              </div>
            </div>

            {/* Dual force badge */}
            <div className="flex flex-col items-center flex-shrink-0 ml-2 md:ml-4 border-l border-white/10 pl-3 md:pl-4">
              <div className="text-[9px] text-slate-600 uppercase tracking-wider mb-0.5">双力量</div>
              <div
                className="px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap"
                style={{
                  backgroundColor: dualCfg.color + '18',
                  color: dualCfg.color,
                  border: `1px solid ${dualCfg.color}30`,
                }}
              >
                {dualCfg.label}
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5 font-mono">{dualCfg.badge}</div>
            </div>
          </div>

          {/* ── Right: A/B dual positions ────────────────────────────── */}
          <div className="flex items-center gap-3 md:gap-4 flex-shrink-0 border-l border-white/10 pl-3 md:pl-4">
            {/* Position A — real-rate */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Target className="w-3 h-3 text-blue-400" />
                <span className="text-[9px] text-slate-500 uppercase tracking-wider">A仓位</span>
              </div>
              <div
                className="text-[11px] font-bold"
                style={{ color: aCfg.color }}
              >
                {aCfg.label}
              </div>
              <div className="text-[9px] text-slate-600 font-mono">反实际利率</div>
              {signal.position_a !== undefined && (
                <div className="text-[9px] font-mono text-slate-400 mt-0.5">
                  {signal.position_a.toFixed(2)}
                </div>
              )}
            </div>

            {/* Position B — tail hedge */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Shield className="w-3 h-3 text-emerald-400" />
                <span className="text-[9px] text-slate-500 uppercase tracking-wider">B仓位</span>
              </div>
              <div
                className="text-[11px] font-bold"
                style={{ color: bCfg.color }}
              >
                {bCfg.label}
              </div>
              <div className="text-[9px] text-slate-600 font-mono">尾部保险</div>
              {signal.position_b !== undefined && (
                <div className="text-[9px] font-mono text-slate-400 mt-0.5">
                  {signal.position_b.toFixed(2)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Conflict narrative (when model bullish but mechanism dampens) ── */}
        {hasConflict && (
          <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: cfg.color }} />
            <div className="text-[10px] md:text-[11px] text-slate-400 leading-relaxed">
              <span className="font-semibold" style={{ color: predColor }}>
                模型 {signal.signal} ({signal.predicted_return >= 0 ? '+' : ''}{signal.predicted_return.toFixed(2)}%)
              </span>
              <span className="mx-1.5 text-slate-600">但</span>
              <span className="font-semibold" style={{ color: cfg.color }}>
                通胀机制判定为"{cfg.label}"
              </span>
              <span className="mx-1.5 text-slate-600">→</span>
              <span>
                仓位从基准 <span className="text-slate-300 font-mono">{baseMult.toFixed(3)}</span>
                {' '}压至
                {' '}<span className="text-slate-300 font-mono">{finalMult.toFixed(3)}</span>
                {' '}(<span style={{ color: '#EF4444' }}>{multDeltaPct.toFixed(1)}%</span>)。
              </span>
              <span className="ml-1.5 text-slate-500 italic">{cfg.desc}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
