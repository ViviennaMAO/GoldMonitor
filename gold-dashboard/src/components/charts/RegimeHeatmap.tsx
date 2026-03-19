'use client'
import { useState } from 'react'
import { regimeData } from '@/data/mockData'
import { factors } from '@/data/mockData'
import clsx from 'clsx'

const MONTHS = ['2025-04', '2025-05', '2025-06', '2025-07', '2025-08',
  '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03']
const FACTOR_IDS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9']

function getColor(value: number): string {
  const abs = Math.min(Math.abs(value), 0.3)
  const intensity = abs / 0.3
  if (value > 0) {
    const r = Math.round(34 + (22 - 34) * intensity)
    const g = Math.round(197 + (197 - 100) * intensity)
    const b = Math.round(94 + (94 - 50) * intensity)
    return `rgba(${r},${g},${b},${0.2 + intensity * 0.6})`
  } else {
    const opacity = 0.2 + intensity * 0.6
    return `rgba(239,68,68,${opacity})`
  }
}

export function RegimeHeatmap() {
  const [tooltip, setTooltip] = useState<{ month: string; factorId: string; value: number } | null>(null)

  const factorNames: Record<string, string> = {}
  factors.forEach(f => { factorNames[f.id] = f.name })

  return (
    <div className="w-full h-full flex flex-col">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-200">Regime 稳定性热力图</h3>
        <p className="text-[10px] text-slate-500 mt-0.5">月度 SHAP 贡献度 · 暖色=看多 冷色=看空</p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {[-0.25, -0.15, -0.05, 0.05, 0.15, 0.25].map(v => (
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
              {MONTHS.map(m => (
                <th key={m} className="text-[9px] text-slate-600 text-center pb-1 font-mono font-normal">
                  {m.slice(2)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FACTOR_IDS.map(fid => (
              <tr key={fid}>
                <td className="text-[10px] text-slate-400 pr-2 font-mono py-0.5">
                  <div>{fid}</div>
                  <div className="text-[8px] text-slate-700 leading-none">{factorNames[fid]?.slice(0, 4)}</div>
                </td>
                {MONTHS.map(month => {
                  const cell = regimeData.find(r => r.month === month && r.factorId === fid)
                  const val = cell?.shapContrib ?? 0
                  const isHovered = tooltip?.month === month && tooltip?.factorId === fid

                  return (
                    <td
                      key={month}
                      className="relative cursor-pointer"
                      onMouseEnter={() => setTooltip({ month, factorId: fid, value: val })}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      <div
                        className={clsx(
                          'rounded transition-all duration-200',
                          isHovered && 'ring-1 ring-white/30 scale-110',
                        )}
                        style={{
                          height: 28,
                          backgroundColor: getColor(val),
                          transform: isHovered ? 'scale(1.1)' : undefined,
                        }}
                      />
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
            <span className="text-slate-400 font-mono">{tooltip.month} · {tooltip.factorId} {factorNames[tooltip.factorId]}</span>
            <span
              className="font-bold font-mono"
              style={{ color: tooltip.value >= 0 ? '#22C55E' : '#EF4444' }}
            >
              SHAP {tooltip.value > 0 ? '+' : ''}{(tooltip.value * 100).toFixed(1)}%
            </span>
          </div>
          <div className="mt-1 text-[10px] text-slate-600">
            {tooltip.value > 0.1
              ? '主要看多驱动因子'
              : tooltip.value < -0.1
              ? '主要看空压制因子'
              : '中性贡献，方向不明显'}
          </div>
        </div>
      )}

      {/* Note */}
      <div className="mt-2 text-[10px] text-slate-700 text-center">
        颜色深浅代表 SHAP 贡献度大小 · 点击格子查看该月该因子详细统计
      </div>
    </div>
  )
}
