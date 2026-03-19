'use client'
import { useState } from 'react'
import { correlationMatrix } from '@/data/mockData'
import { factors } from '@/data/mockData'
import clsx from 'clsx'

const FACTOR_IDS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9']
const HIGH_CORR_THRESHOLD = 0.7

function corrColor(v: number): string {
  if (v === 1) return 'rgba(59,130,246,0.3)'
  if (Math.abs(v) > HIGH_CORR_THRESHOLD) return v > 0 ? 'rgba(239,68,68,0.55)' : 'rgba(239,68,68,0.55)'
  if (v > 0.4) return `rgba(34,197,94,${v * 0.5})`
  if (v < -0.4) return `rgba(239,68,68,${Math.abs(v) * 0.5})`
  return `rgba(100,116,139,${Math.abs(v) * 0.4})`
}

export function CorrelationMatrix() {
  const [hoveredCell, setHoveredCell] = useState<{ row: string; col: string; val: number } | null>(null)

  const highCorrPairs = FACTOR_IDS.flatMap((r, i) =>
    FACTOR_IDS.slice(i + 1).filter(c => Math.abs(correlationMatrix[r][c]) > HIGH_CORR_THRESHOLD)
      .map(c => ({ pair: `${r}-${c}`, val: correlationMatrix[r][c] }))
  )

  const factorNames: Record<string, string> = {}
  factors.forEach(f => { factorNames[f.id] = f.name })

  return (
    <div className="w-full h-full flex flex-col">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-200">因子相关性矩阵</h3>
        <p className="text-[10px] text-slate-500 mt-0.5">60 日滚动相关性 · 红色高亮 |r| &gt; 0.7 警告</p>
      </div>

      {/* Matrix */}
      <div className="flex-1 overflow-auto">
        <table className="border-separate border-spacing-0.5">
          <thead>
            <tr>
              <th className="w-10" />
              {FACTOR_IDS.map(fid => (
                <th key={fid} className="text-[9px] text-slate-500 font-mono font-normal text-center w-9 pb-1">
                  {fid}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FACTOR_IDS.map(row => (
              <tr key={row}>
                <td className="text-[9px] text-slate-500 font-mono pr-2">{row}</td>
                {FACTOR_IDS.map(col => {
                  const val = correlationMatrix[row][col]
                  const isHigh = Math.abs(val) > HIGH_CORR_THRESHOLD && row !== col
                  const isHovered = hoveredCell?.row === row && hoveredCell?.col === col

                  return (
                    <td
                      key={col}
                      className="relative cursor-pointer"
                      onMouseEnter={() => setHoveredCell({ row, col, val })}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      <div
                        className={clsx(
                          'w-9 h-9 rounded flex items-center justify-center transition-all duration-200',
                          isHigh && 'ring-1 ring-red-500/50',
                          isHovered && 'ring-1 ring-white/30',
                        )}
                        style={{ backgroundColor: corrColor(val) }}
                      >
                        <span className={clsx('text-[9px] font-mono', row === col ? 'text-blue-400' : isHigh ? 'text-red-300' : 'text-slate-400')}>
                          {val.toFixed(2)}
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

      {/* Alerts */}
      {highCorrPairs.length > 0 && (
        <div className="mt-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
          <div className="text-[10px] font-semibold text-red-400 mb-1.5">
            高相关预警 (|r| &gt; 0.7) — 正交化效果可能需要更新
          </div>
          <div className="flex flex-wrap gap-1.5">
            {highCorrPairs.map(p => (
              <div key={p.pair} className="px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/20 text-[9px] font-mono text-red-400">
                {p.pair}: {p.val.toFixed(2)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hover info */}
      {hoveredCell && hoveredCell.row !== hoveredCell.col && (
        <div className="mt-2 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[10px]">
          <span className="text-slate-500">{hoveredCell.row} {factorNames[hoveredCell.row]} × {hoveredCell.col} {factorNames[hoveredCell.col]}</span>
          <span className="ml-2 font-mono font-bold" style={{ color: Math.abs(hoveredCell.val) > 0.7 ? '#EF4444' : hoveredCell.val > 0 ? '#22C55E' : '#94A3B8' }}>
            r = {hoveredCell.val.toFixed(3)}
          </span>
        </div>
      )}

      {/* Legend */}
      <div className="mt-2 flex items-center gap-4 text-[9px] text-slate-700 justify-center">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-green-500/40" /><span>正相关</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-red-500/40 ring-1 ring-red-500/50" /><span>高相关警告</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-blue-500/30" /><span>对角线</span>
        </div>
      </div>
    </div>
  )
}
