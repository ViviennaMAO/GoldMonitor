'use client'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useEquityCurve } from '@/lib/useGoldData'

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/10 bg-[#0A1628]/98 p-3 text-xs shadow-xl">
      <div className="font-mono text-slate-400 mb-1.5">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span className="text-slate-500">{p.name}</span>
          <span className="font-mono font-bold" style={{ color: p.color }}>
            ${p.value?.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

export function EquityCurveChart() {
  const { data: equityCurve } = useEquityCurve()
  const curve = equityCurve ?? []

  if (!curve.length) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
        加载净值曲线...
      </div>
    )
  }

  const start = curve[0]?.equity ?? 100000
  const end = curve[curve.length - 1]?.equity ?? 100000
  const pnlPct = ((end - start) / start) * 100

  const gldStart = curve[0]?.gld ?? start
  const gldEnd = curve[curve.length - 1]?.gld ?? end
  const gldPct = ((gldEnd - gldStart) / gldStart) * 100

  const maxDD = Math.max(...curve.map(e => e.drawdown ?? 0))

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">账户净值曲线</h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            OOS 回测 · {curve.length} 个交易日 · 最大回撤 {maxDD.toFixed(1)}%
          </p>
        </div>
        <div className="text-right flex gap-4">
          <div>
            <div className="text-[9px] text-slate-600">策略收益</div>
            <div className="text-sm font-bold font-mono" style={{ color: pnlPct >= 0 ? '#22C55E' : '#EF4444' }}>
              {pnlPct > 0 ? '+' : ''}{pnlPct.toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-[9px] text-slate-600">GLD基准</div>
            <div className="text-sm font-bold font-mono" style={{ color: gldPct >= 0 ? '#F59E0B' : '#EF4444' }}>
              {gldPct > 0 ? '+' : ''}{gldPct.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={curve} margin={{ top: 4, right: 4, bottom: 4, left: -10 }}>
            <defs>
              <linearGradient id="stratGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22C55E" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gldGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#475569', fontSize: 9 }}
              tickFormatter={v => v.slice(5)}
              interval={Math.max(1, Math.floor(curve.length / 8))}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#475569', fontSize: 9 }}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
              axisLine={false}
              tickLine={false}
              domain={['dataMin - 500', 'dataMax + 500']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="equity"
              stroke="#22C55E"
              strokeWidth={2}
              fill="url(#stratGrad)"
              name="策略净值"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="gld"
              stroke="#F59E0B"
              strokeWidth={1.5}
              fill="url(#gldGrad)"
              strokeDasharray="4 4"
              name="GLD基准"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Performance summary */}
      <div className="mt-2 flex items-center justify-center gap-6 text-[9px]">
        <div className="flex items-center gap-1">
          <div className="w-3 h-1 rounded bg-green-500" /><span className="text-slate-600">策略净值</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-1 rounded bg-amber-500 opacity-60" /><span className="text-slate-600">GLD 持有基准</span>
        </div>
        <span className="text-slate-700">
          超额: {(pnlPct - gldPct) > 0 ? '+' : ''}{(pnlPct - gldPct).toFixed(2)}%
        </span>
      </div>
    </div>
  )
}
