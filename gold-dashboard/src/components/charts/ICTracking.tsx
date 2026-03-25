'use client'
import { useMemo } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine,
} from 'recharts'
import { useICHistory } from '@/lib/useGoldData'

const FACTOR_SHORT: Record<string, string> = {
  F1_DXY: 'DXY 美元',
  F3_TIPS10Y: 'TIPS 实际利率',
  F4_BEI: 'BEI 通胀',
  F5_GPR: 'GPR 地缘',
  F6_GVZ: 'GVZ 波动',
  F8_ETFFlow: 'ETF 资金流',
  F9_GDXRatio: 'GDX 矿业比',
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/10 bg-[#0A1628]/98 backdrop-blur-sm p-3 shadow-xl text-xs">
      <div className="font-mono text-slate-400 mb-1.5">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span className="text-slate-500">{p.name}</span>
          <span className="font-mono font-bold" style={{ color: p.color }}>
            {p.value > 0 ? '+' : ''}{p.value?.toFixed(4)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function ICTracking() {
  const { data } = useICHistory()

  const rollingIC = data?.rolling_ic ?? []
  const factorIC = data?.factor_ic ?? []
  const cvMeanIC = data?.cv_mean_ic ?? 0

  // Compute chart data with 20-day MA
  const chartData = useMemo(() => {
    return rollingIC.map((d, i) => {
      const start = Math.max(0, i - 19)
      const window = rollingIC.slice(start, i + 1)
      const ma = window.reduce((s, w) => s + w.ic, 0) / window.length
      return { date: d.date, ic: d.ic, ic20ma: Math.round(ma * 10000) / 10000 }
    })
  }, [rollingIC])

  const recent20 = chartData.slice(-20)
  const ic20ma = recent20.length > 0 ? recent20.reduce((s, d) => s + d.ic, 0) / recent20.length : 0
  const icStd = recent20.length > 0
    ? Math.sqrt(recent20.reduce((s, d) => s + Math.pow(d.ic - ic20ma, 2), 0) / recent20.length)
    : 0
  const icirRaw = icStd > 0.005 ? ic20ma / icStd : 0
  const icir = Math.max(-5, Math.min(5, icirRaw))
  const latestIC = chartData.length > 0 ? chartData[chartData.length - 1].ic : 0

  // Sort factor ICs by absolute value
  const sortedFactorIC = [...factorIC].sort((a, b) => Math.abs(b.ic) - Math.abs(a.ic))

  if (!chartData.length) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
        加载 IC 追踪数据...
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-200">模型 IC 追踪</h3>
        <p className="text-[10px] text-slate-500 mt-0.5">
          滚动 60 日 OOS Spearman 秩相关系数 · {chartData.length} 个数据点
        </p>
      </div>

      {/* IC stats */}
      <div className="flex gap-3 mb-3">
        {[
          { label: 'IC(20d均值)', value: ic20ma.toFixed(4), color: ic20ma >= 0 ? '#22C55E' : '#EF4444' },
          { label: 'ICIR', value: icir.toFixed(3), color: Math.abs(icir) >= 0.5 ? '#22C55E' : '#F59E0B' },
          { label: '最新IC', value: latestIC.toFixed(4), color: latestIC >= 0 ? '#22C55E' : '#EF4444' },
          { label: 'CV均值IC', value: cvMeanIC.toFixed(4), color: cvMeanIC >= 0 ? '#22C55E' : '#F59E0B' },
        ].map(m => (
          <div key={m.label} className="flex-1 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-center">
            <div className="text-[9px] text-slate-600 mb-0.5">{m.label}</div>
            <div className="text-xs font-bold font-mono truncate" style={{ color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#475569', fontSize: 9 }}
              tickFormatter={v => v.slice(5)}
              interval={Math.max(1, Math.floor(chartData.length / 8))}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#475569', fontSize: 9 }}
              domain={['auto', 'auto']}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
            <ReferenceLine y={0.05} stroke="#22C55E" strokeDasharray="4 4" strokeOpacity={0.4} strokeWidth={1} />
            <ReferenceLine y={-0.05} stroke="#EF4444" strokeDasharray="4 4" strokeOpacity={0.4} strokeWidth={1} />
            <Line
              dataKey="ic"
              stroke="#3B82F6"
              strokeWidth={1.5}
              dot={false}
              name="IC(日)"
              activeDot={{ r: 3, fill: '#3B82F6' }}
            />
            <Line
              dataKey="ic20ma"
              stroke="#F59E0B"
              strokeWidth={1}
              dot={false}
              strokeDasharray="4 2"
              name="IC(20MA)"
              activeDot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Per-factor IC */}
      <div className="mt-3">
        <div className="text-[10px] text-slate-500 mb-1.5">单因子 OOS IC</div>
        <div className="flex flex-wrap gap-1.5">
          {sortedFactorIC.map(f => (
            <div
              key={f.factor}
              className="px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[9px] font-mono"
            >
              <span className="text-slate-500">{FACTOR_SHORT[f.factor] ?? f.factor}: </span>
              <span style={{ color: f.ic >= 0 ? '#22C55E' : '#EF4444' }}>
                {f.ic > 0 ? '+' : ''}{f.ic.toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ICIR warning */}
      {Math.abs(icir) < 0.5 && (
        <div className="mt-2 text-[10px] text-amber-400/80 text-center">
          ICIR = {icir.toFixed(2)} 低于 0.5 达标线，模型预测力偏弱
        </div>
      )}
    </div>
  )
}
