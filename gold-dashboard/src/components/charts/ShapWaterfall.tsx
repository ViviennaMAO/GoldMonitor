'use client'
import { useState } from 'react'
import { ShapBar } from '@/types'

interface ShapWaterfallProps {
  bars: ShapBar[]
  prediction: number
}

export function ShapWaterfall({ bars, prediction }: ShapWaterfallProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  const maxAbs = Math.max(...bars.map(b => Math.abs(b.value)))
  const base = 0 // baseline E[f(x)]

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">SHAP 因子归因瀑布图</h3>
          <p className="text-[10px] text-slate-500 mt-0.5">每日信号驱动因子分解 · 基准值 E[f(x)] = 0.00%</p>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-green-500/70" />
            <span className="text-slate-500">看多贡献</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-red-500/70" />
            <span className="text-slate-500">看空贡献</span>
          </div>
        </div>
      </div>

      {/* Prediction summary */}
      <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
        <div className="text-[10px] text-slate-500">基准值</div>
        <div className="text-sm font-mono text-slate-400">0.00%</div>
        <div className="flex-1 h-px bg-white/[0.06]" />
        <div className="text-[10px] text-slate-500">预测值</div>
        <div className="text-lg font-bold font-mono" style={{ color: prediction >= 0 ? '#22C55E' : '#EF4444' }}>
          {prediction > 0 ? '+' : ''}{prediction.toFixed(2)}%
        </div>
      </div>

      {/* Bars */}
      <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
        {bars.map((bar, i) => {
          const isPositive = bar.value >= 0
          const widthPct = (Math.abs(bar.value) / maxAbs) * 100
          const isHovered = hovered === bar.factorId

          return (
            <div
              key={bar.factorId}
              className="relative cursor-pointer group"
              onMouseEnter={() => setHovered(bar.factorId)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                {/* Factor label */}
                <div className="w-28 flex-shrink-0">
                  <div className="text-xs text-slate-300 font-medium">{bar.factor}</div>
                  <div className="text-[9px] text-slate-600 font-mono mt-0.5">{bar.rawValue}</div>
                </div>

                {/* Bar chart */}
                <div className="flex-1 flex items-center gap-1 h-6">
                  {/* Negative side */}
                  <div className="w-1/2 flex justify-end">
                    {!isPositive && (
                      <div
                        className="h-5 rounded-l transition-all duration-500"
                        style={{
                          width: `${widthPct}%`,
                          backgroundColor: '#EF4444',
                          opacity: isHovered ? 0.9 : 0.65,
                        }}
                      />
                    )}
                  </div>
                  {/* Center line */}
                  <div className="w-px h-6 bg-white/20 flex-shrink-0" />
                  {/* Positive side */}
                  <div className="w-1/2 flex justify-start">
                    {isPositive && (
                      <div
                        className="h-5 rounded-r transition-all duration-500"
                        style={{
                          width: `${widthPct}%`,
                          backgroundColor: '#22C55E',
                          opacity: isHovered ? 0.9 : 0.65,
                        }}
                      />
                    )}
                  </div>
                </div>

                {/* Value */}
                <div className="w-16 text-right flex-shrink-0">
                  <span
                    className="text-xs font-bold font-mono"
                    style={{ color: isPositive ? '#22C55E' : '#EF4444' }}
                  >
                    {bar.value > 0 ? '+' : ''}{(bar.value * 100).toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Hover tooltip */}
              {isHovered && (
                <div className="absolute left-0 top-full mt-1 z-50 w-72 rounded-xl border border-white/10 bg-[#0A1628]/98 backdrop-blur-sm p-3 shadow-2xl pointer-events-none">
                  <div className="font-semibold text-sm text-slate-200 mb-2">{bar.factor}</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>原始数据</span><span className="font-mono text-slate-200">{bar.rawValue}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Z-Score</span><span className="font-mono text-slate-200">{bar.zScore.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>SHAP贡献</span>
                      <span className="font-mono font-bold" style={{ color: bar.value >= 0 ? '#22C55E' : '#EF4444' }}>
                        {bar.value > 0 ? '+' : ''}{(bar.value * 100).toFixed(3)}%
                      </span>
                    </div>
                    <div className="pt-1 border-t border-white/[0.06] text-slate-500 text-[10px]">{bar.economic}</div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary total */}
      <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-1 h-8 rounded bg-gradient-to-b from-green-500 to-transparent" />
          <div>
            <div className="text-[10px] text-slate-500">看多因子合计</div>
            <div className="text-sm font-bold font-mono text-green-400">
              +{(bars.filter(b => b.value > 0).reduce((s, b) => s + b.value, 0) * 100).toFixed(2)}%
            </div>
          </div>
        </div>
        <div className="text-2xl font-bold font-mono" style={{ color: prediction >= 0 ? '#22C55E' : '#EF4444' }}>
          {prediction > 0 ? '+' : ''}{prediction.toFixed(2)}%
        </div>
        <div className="flex items-center gap-1.5">
          <div>
            <div className="text-[10px] text-slate-500 text-right">看空因子合计</div>
            <div className="text-sm font-bold font-mono text-red-400 text-right">
              {(bars.filter(b => b.value < 0).reduce((s, b) => s + b.value, 0) * 100).toFixed(2)}%
            </div>
          </div>
          <div className="w-1 h-8 rounded bg-gradient-to-b from-red-500 to-transparent" />
        </div>
      </div>
    </div>
  )
}
