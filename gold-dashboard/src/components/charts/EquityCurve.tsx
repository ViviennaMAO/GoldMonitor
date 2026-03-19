'use client'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { equityCurve } from '@/data/mockData'

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
  const start = equityCurve[0]?.equity ?? 100000
  const end = equityCurve[equityCurve.length - 1]?.equity ?? 100000
  const pnlPct = ((end - start) / start) * 100

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">账户净值曲线</h3>
          <p className="text-[10px] text-slate-500 mt-0.5">仿真账户 vs GLD 基准 (近90日)</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-600">账户收益率</div>
          <div className="text-base font-bold font-mono text-green-400">
            {pnlPct > 0 ? '+' : ''}{pnlPct.toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={equityCurve} margin={{ top: 4, right: 4, bottom: 4, left: -10 }}>
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
              interval={14}
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
    </div>
  )
}
