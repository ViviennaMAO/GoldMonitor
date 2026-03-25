'use client'
import { useState } from 'react'
import { useRegime } from '@/lib/useGoldData'
import clsx from 'clsx'

const FACTOR_SHORT: Record<string, string> = {
  F1_DXY: 'DXY',
  F3_TIPS10Y: 'TIPS',
  F4_BEI: 'BEI',
  F5_GPR: 'GPR',
  F6_GVZ: 'GVZ',
  F8_ETFFlow: 'ETF',
  F9_GDXRatio: 'GDX',
}

const FACTOR_LABEL: Record<string, string> = {
  F1_DXY: '美元',
  F3_TIPS10Y: '实际利率',
  F4_BEI: '通胀',
  F5_GPR: '地缘',
  F6_GVZ: '波动',
  F8_ETFFlow: 'ETF',
  F9_GDXRatio: '矿业',
}

function getColor(value: number): string {
  const abs = Math.min(Math.abs(value), 2.5)
  const intensity = abs / 2.5
  if (value > 0) {
    return `rgba(34,197,94,${0.15 + intensity * 0.65})`
  } else {
    return `rgba(239,68,68,${0.15 + intensity * 0.65})`
  }
}

export function RegimeHeatmap() {
  const { data } = useRegime()
  const [tooltip, setTooltip] = useState<{ month: string; factor: string; value: number } | null>(null)

  const current = data?.current
  const heatmap = data?.heatmap ?? []
  const factorKeys = heatmap.length > 0 ? Object.keys(heatmap[0].factors) : []

  if (!heatmap.length) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
        加载 Regime 热力图...
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Regime 热力图</h3>
          <p className="text-[10px] text-slate-500 mt-0.5">月末因子 Z-Score · 绿色=利多 红色=利空</p>
        </div>
        {current && (
          <div className={clsx(
            'px-2.5 py-1 rounded-lg text-[10px] font-semibold border',
            current.regime === 'Risk-On' || current.regime === 'Favorable'
              ? 'bg-green-500/15 border-green-500/30 text-green-400'
              : current.regime === 'Risk-Off' || current.regime === 'Cautious'
              ? 'bg-red-500/15 border-red-500/30 text-red-400'
              : 'bg-slate-500/15 border-slate-500/30 text-slate-400',
          )}>
            {current.regime} · {current.multiplier}x
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {[-2, -1.2, -0.4, 0.4, 1.2, 2].map(v => (
              <div
                key={v}
                className="w-5 h-4 rounded-sm"
                style={{ backgroundColor: getColor(v) }}
              />
            ))}
          </div>
          <span className="text-[9px] text-slate-600">看空 ← 中性 → 看多</span>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-separate border-spacing-0.5">
          <thead>
            <tr>
              <th className="text-[9px] text-slate-600 text-left pb-1 w-16 font-normal">因子</th>
              {heatmap.map(h => (
                <th key={h.month} className="text-[9px] text-slate-600 text-center pb-1 font-mono font-normal">
                  {h.month.slice(2)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {factorKeys.map(fid => (
              <tr key={fid}>
                <td className="text-[10px] text-slate-400 pr-2 font-mono py-0.5">
                  <div>{FACTOR_SHORT[fid] ?? fid.replace(/^F\d+_/, '')}</div>
                  <div className="text-[8px] text-slate-700 leading-none">{FACTOR_LABEL[fid] ?? ''}</div>
                </td>
                {heatmap.map(h => {
                  const val = h.factors[fid] ?? 0
                  const isHovered = tooltip?.month === h.month && tooltip?.factor === fid

                  return (
                    <td
                      key={h.month}
                      className="relative cursor-pointer"
                      onMouseEnter={() => setTooltip({ month: h.month, factor: fid, value: val })}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      <div
                        className={clsx(
                          'rounded transition-all duration-200 flex items-center justify-center',
                          isHovered && 'ring-1 ring-white/30 scale-110',
                        )}
                        style={{
                          height: 28,
                          backgroundColor: getColor(val),
                          transform: isHovered ? 'scale(1.1)' : undefined,
                        }}
                      >
                        <span className={clsx(
                          'text-[8px] font-mono',
                          Math.abs(val) > 1.5 ? 'text-white/80' : 'text-slate-400/60',
                        )}>
                          {val.toFixed(1)}
                        </span>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="mt-2 p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-mono">
              {tooltip.month} · {FACTOR_SHORT[tooltip.factor] ?? tooltip.factor}
              {FACTOR_LABEL[tooltip.factor] ? ` ${FACTOR_LABEL[tooltip.factor]}` : ''}
            </span>
            <span
              className="font-bold font-mono"
              style={{ color: tooltip.value >= 0 ? '#22C55E' : '#EF4444' }}
            >
              Z = {tooltip.value > 0 ? '+' : ''}{tooltip.value.toFixed(2)}
            </span>
          </div>
          <div className="mt-1 text-[10px] text-slate-600">
            {tooltip.value > 1.0
              ? '强利多信号'
              : tooltip.value > 0.3
              ? '温和利多'
              : tooltip.value < -1.0
              ? '强利空信号'
              : tooltip.value < -0.3
              ? '温和利空'
              : '中性，方向不明显'}
          </div>
        </div>
      )}

      {/* Regime scores */}
      {current && (
        <div className="mt-2 flex items-center justify-center gap-4 text-[9px]">
          <span className="text-red-400/60">Risk-Off: {current.risk_off_score}/5</span>
          <span className="text-green-400/60">Risk-On: {current.risk_on_score}/5</span>
        </div>
      )}
    </div>
  )
}
