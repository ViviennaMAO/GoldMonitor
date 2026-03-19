'use client'
import { useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ReferenceArea, Legend,
} from 'recharts'
import { factors, icDataByFactor } from '@/data/mockData'
import { Factor } from '@/types'

const REGIME_COLORS = {
  rate_hike: 'rgba(239,68,68,0.06)',
  rate_cut:  'rgba(34,197,94,0.06)',
  neutral:   'rgba(100,116,139,0.04)',
}

const REGIME_LABELS = { rate_hike: '加息期', rate_cut: '降息期', neutral: '震荡期' }

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
  const [selectedFactor, setSelectedFactor] = useState<Factor>(factors[2]) // F3 default

  const data = icDataByFactor[selectedFactor.id]
  const recent = data.slice(-20)
  const ic20ma = recent.reduce((s, d) => s + d.ic, 0) / 20
  const icStd = Math.sqrt(recent.reduce((s, d) => s + Math.pow(d.ic - ic20ma, 2), 0) / 20)
  // Clamp ICIR to a reasonable display range
  const icirRaw = icStd > 0.005 ? ic20ma / icStd : 0
  const icir = Math.max(-5, Math.min(5, icirRaw))

  // Find regime regions
  const regimeRegions: Array<{ start: string; end: string; regime: string }> = []
  let currentRegime = data[0]?.regime
  let startIdx = 0
  data.forEach((d, i) => {
    if (d.regime !== currentRegime || i === data.length - 1) {
      regimeRegions.push({ start: data[startIdx].date, end: d.date, regime: currentRegime })
      currentRegime = d.regime
      startIdx = i
    }
  })

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">因子 IC 追踪</h3>
          <p className="text-[10px] text-slate-500 mt-0.5">滚动 252 日信息系数时序 · Regime 背景着色</p>
        </div>
        <div className="flex gap-1.5 text-[10px]">
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-red-500/30" /><span className="text-slate-600">加息期</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-green-500/30" /><span className="text-slate-600">降息期</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-slate-700/50" /><span className="text-slate-600">震荡期</span>
          </div>
        </div>
      </div>

      {/* Factor selector */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {factors.map(f => (
          <button
            key={f.id}
            onClick={() => setSelectedFactor(f)}
            className={`px-2 py-1 rounded-lg text-[10px] font-mono transition-all cursor-pointer border ${
              selectedFactor.id === f.id
                ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                : 'bg-white/[0.03] border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-white/10'
            }`}
          >
            {f.id}
          </button>
        ))}
      </div>

      {/* IC stats */}
      <div className="flex gap-3 mb-3">
        {[
          { label: 'IC(20d均值)', value: ic20ma.toFixed(4), color: ic20ma >= 0 ? '#22C55E' : '#EF4444' },
          { label: 'ICIR', value: icir.toFixed(3), color: Math.abs(icir) >= 0.5 ? '#22C55E' : '#F59E0B' },
          { label: '当日IC', value: data[data.length - 1]?.ic.toFixed(4), color: data[data.length - 1]?.ic >= 0 ? '#22C55E' : '#EF4444' },
          { label: '因子', value: selectedFactor.name, color: '#60A5FA' },
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
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#475569', fontSize: 9 }}
              tickFormatter={v => v.slice(5)}
              interval={41}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#475569', fontSize: 9 }}
              domain={[-0.25, 0.25]}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            {/* Regime backgrounds */}
            {regimeRegions.map((r, i) => (
              <ReferenceArea
                key={i}
                x1={r.start}
                x2={r.end}
                fill={REGIME_COLORS[r.regime as keyof typeof REGIME_COLORS]}
                fillOpacity={1}
              />
            ))}
            {/* Reference lines */}
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
            <ReferenceLine y={0.05} stroke="#22C55E" strokeDasharray="4 4" strokeOpacity={0.4} strokeWidth={1} />
            <ReferenceLine y={-0.05} stroke="#22C55E" strokeDasharray="4 4" strokeOpacity={0.4} strokeWidth={1} />
            <ReferenceLine y={ic20ma} stroke="#60A5FA" strokeDasharray="3 6" strokeOpacity={0.6} strokeWidth={1} />
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

      {/* ICIR warning */}
      {Math.abs(icir) < 0.5 && (
        <div className="mt-2 text-[10px] text-amber-400/80 text-center">
          ICIR = {icir.toFixed(2)} 低于 0.5 达标线，{selectedFactor.name}有效性偏弱
        </div>
      )}
    </div>
  )
}
