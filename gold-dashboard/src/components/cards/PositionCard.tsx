'use client'
import { useState } from 'react'
import { TrendingUp, TrendingDown, Shield, Activity } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Position } from '@/types'
import clsx from 'clsx'

interface PositionCardProps {
  positions: Position[]
}

const stopTypeLabel: Record<Position['stopType'], string> = {
  initial: '初始止损',
  breakeven: '保本止损',
  trailing: '移动止损',
}

export function PositionCard({ positions }: PositionCardProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (positions.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-[#0A1628] p-4">
        <div className="text-center py-6 text-slate-600 text-sm">无持仓</div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0A1628] p-3 md:p-4 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" />
          持仓明细
        </div>
        <span className="text-[10px] text-slate-600">{positions.length} 笔活跃</span>
      </div>

      {positions.map(pos => {
        const isLong = pos.direction === 'long'
        const isExpanded = expanded === pos.id
        const pnlPositive = pos.pnl >= 0

        return (
          <div
            key={pos.id}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden cursor-pointer hover:bg-white/[0.04] transition-colors"
            onClick={() => setExpanded(isExpanded ? null : pos.id)}
          >
            {/* Main row */}
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={clsx(
                    'w-5 h-5 rounded-md flex items-center justify-center',
                    isLong ? 'bg-green-500/20' : 'bg-red-500/20',
                  )}>
                    {isLong
                      ? <TrendingUp className="w-3 h-3 text-green-400" />
                      : <TrendingDown className="w-3 h-3 text-red-400" />}
                  </div>
                  <span className="text-xs font-semibold text-slate-200">{pos.id}</span>
                  <Badge variant={isLong ? 'green' : 'red'} size="sm">
                    {isLong ? '多' : '空'} {pos.lots}手
                  </Badge>
                </div>
                <div className={clsx('text-sm font-bold font-mono', pnlPositive ? 'text-green-400' : 'text-red-400')}>
                  {pnlPositive ? '+' : ''}${pos.pnl.toFixed(0)}
                  <span className="text-[10px] ml-1">({pos.pnlPct.toFixed(2)}%)</span>
                </div>
              </div>

              {/* Price row */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 font-mono">
                <span>开仓 <span className="text-slate-300">${pos.entryPrice.toFixed(2)}</span></span>
                <span>→</span>
                <span>现价 <span className="text-slate-200 font-semibold">${pos.currentPrice.toFixed(2)}</span></span>
                <span className="ml-auto flex items-center gap-1 text-amber-400/80">
                  <Shield className="w-3 h-3" />
                  {stopTypeLabel[pos.stopType]}
                </span>
              </div>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="border-t border-white/[0.06] p-3 grid grid-cols-2 gap-2 text-[10px]">
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-600">止损位</span>
                    <span className="font-mono text-red-400">${pos.stopLoss.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">止损距离</span>
                    <span className="font-mono text-slate-300">{(pos.currentPrice - pos.stopLoss).toFixed(2)} pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">ATR倍数</span>
                    <span className="font-mono text-slate-300">{pos.atrMultiple}×</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-600">仓位热度</span>
                    <span className="font-mono text-amber-400">{pos.heatPct.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">开仓日期</span>
                    <span className="font-mono text-slate-300">{pos.openDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">主驱动</span>
                    <span className="font-mono text-purple-400">{pos.mainFactor}</span>
                  </div>
                </div>
                <div className="col-span-2 pt-1 border-t border-white/[0.04]">
                  <span className="text-slate-600">SHAP归因：</span>
                  <span className="text-green-400/80">{pos.shapDriver}</span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
