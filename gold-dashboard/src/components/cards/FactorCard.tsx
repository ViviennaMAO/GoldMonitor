'use client'
import { useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import clsx from 'clsx'
import { Factor } from '@/types'

interface FactorCardProps {
  factor: Factor
  compact?: boolean
}

function getPercentileColor(p: number) {
  if (p >= 80) return '#22C55E'
  if (p >= 50) return '#F59E0B'
  if (p >= 20) return '#F97316'
  return '#EF4444'
}

function getZScoreColor(z: number, direction: Factor['direction']) {
  if (direction === 'bullish') return 'text-green-400'
  if (direction === 'bearish') return 'text-red-400'
  return 'text-slate-400'
}

export function FactorCard({ factor, compact }: FactorCardProps) {
  const [hovered, setHovered] = useState(false)

  const pColor = getPercentileColor(factor.percentile52w)
  const positive = factor.dayChange >= 0

  return (
    <div
      className={clsx(
        'relative rounded-xl border border-white/[0.06] p-3 cursor-pointer transition-all duration-200',
        'bg-[#0A1628] hover:bg-[#0F1F3D] hover:border-white/10',
        compact ? 'min-w-[140px]' : 'min-w-[155px]',
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold text-slate-500 tracking-wider uppercase">{factor.id}</span>
        <span className="text-[10px] text-slate-500 font-mono">IC {factor.icValue.toFixed(3)}</span>
      </div>

      <div className="text-xs text-slate-300 font-medium mb-2 leading-tight">{factor.name}</div>

      {/* Z-Score */}
      <div className={clsx('text-2xl font-bold font-mono tabular-nums mb-0.5', getZScoreColor(factor.zScore, factor.direction))}>
        {factor.zScore > 0 ? '+' : ''}{factor.zScore.toFixed(2)}
      </div>

      {/* Raw value + change */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-slate-500 font-mono">
          {factor.rawValue}{factor.rawUnit}
        </span>
        <span className={clsx(
          'flex items-center gap-0.5 text-[10px] font-mono',
          positive ? 'text-green-400' : 'text-red-400',
        )}>
          {positive
            ? <TrendingUp className="w-2.5 h-2.5" />
            : <TrendingDown className="w-2.5 h-2.5" />}
          {positive ? '+' : ''}{factor.dayChange.toFixed(2)}
        </span>
      </div>

      {/* 52w Percentile bar */}
      <div className="mb-2">
        <div className="flex justify-between mb-0.5">
          <span className="text-[9px] text-slate-600">52W 百分位</span>
          <span className="text-[9px] font-mono" style={{ color: pColor }}>{factor.percentile52w}%</span>
        </div>
        <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${factor.percentile52w}%`, backgroundColor: pColor }}
          />
        </div>
      </div>

      {/* Signal text */}
      <div className={clsx(
        'text-[10px] leading-tight transition-all duration-200',
        factor.direction === 'bullish' ? 'text-green-400/80' :
          factor.direction === 'bearish' ? 'text-red-400/80' : 'text-slate-500',
      )}>
        {factor.signal}
      </div>

      {/* Direction icon */}
      <div className="absolute top-3 right-3">
        {factor.direction === 'bullish' && <TrendingUp className="w-3.5 h-3.5 text-green-500/40" />}
        {factor.direction === 'bearish' && <TrendingDown className="w-3.5 h-3.5 text-red-500/40" />}
        {factor.direction === 'neutral' && <Minus className="w-3.5 h-3.5 text-slate-600" />}
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div className="absolute left-0 top-full mt-1 z-50 w-56 rounded-xl border border-white/10 bg-[#0A1628]/95 backdrop-blur-sm p-3 shadow-2xl text-xs pointer-events-none">
          <div className="font-semibold text-slate-200 mb-2">{factor.id} · {factor.nameEn}</div>
          <div className="space-y-1 text-slate-400">
            <div className="flex justify-between"><span>Z-Score</span><span className="font-mono text-slate-200">{factor.zScore.toFixed(3)}</span></div>
            <div className="flex justify-between"><span>IC(20d均值)</span><span className="font-mono text-slate-200">{factor.icValue.toFixed(3)}</span></div>
            <div className="flex justify-between"><span>ICIR</span><span className="font-mono text-slate-200">{factor.icir.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>SHAP贡献</span><span className={clsx('font-mono', factor.shapValue >= 0 ? 'text-green-400' : 'text-red-400')}>{factor.shapValue > 0 ? '+' : ''}{(factor.shapValue * 100).toFixed(1)}%</span></div>
          </div>
        </div>
      )}
    </div>
  )
}
