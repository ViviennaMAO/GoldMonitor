'use client'
import { useEffect, useState } from 'react'
import { Activity, Wifi, AlertCircle, ChevronRight, Database, RefreshCw } from 'lucide-react'
import { FactorCard } from '@/components/cards/FactorCard'
import { Badge } from '@/components/ui/Badge'
import { useGoldPrice, useFactors } from '@/lib/useGoldData'
import clsx from 'clsx'

export function TopBar() {
  const { data: priceData, isLoading: priceLoading } = useGoldPrice()
  const { factors, dataSource, isLoading: factorsLoading } = useFactors()
  const [time, setTime] = useState('')
  // Simulate live tick on top of polled price
  const [tickOffset, setTickOffset] = useState(0)

  useEffect(() => {
    const update = () =>
      setTime(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    update()
    const id = setInterval(() => {
      update()
      setTickOffset(d => d + (Math.random() - 0.49) * 0.8)
    }, 2000)
    return () => clearInterval(id)
  }, [])

  const basePrice = priceData?.price ?? 3124.5
  const livePrice = parseFloat((basePrice + tickOffset).toFixed(2))
  const baseChange = priceData?.change ?? 12.3
  const liveChange = parseFloat((baseChange + tickOffset).toFixed(2))
  const changePct = priceData?.changePct ?? 0.39
  const isLive = priceData?.source === 'yahoo' || priceData?.source === 'stooq'
  const priceSource = priceData?.source ?? 'mock'

  return (
    <header className="flex-shrink-0 border-b border-white/[0.06] bg-[#050B18]">
      {/* Title strip */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04]">
        {/* Left: logo + title */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center flex-shrink-0">
            <span className="text-black font-bold text-xs">Au</span>
          </div>
          <div>
            <div className="text-sm font-bold text-slate-100 leading-none">Gold Monitor</div>
            <div className="text-[10px] text-slate-600 mt-0.5">黄金因子量化交易看板 · v1.0</div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
          <Badge variant="purple" size="sm">R1: 实际利率主导</Badge>
          {/* Data source indicator */}
          <div className="flex items-center gap-1 text-[9px] font-mono">
            <Database className="w-2.5 h-2.5" style={{ color: dataSource?.fred ? '#22C55E' : '#F59E0B' }} />
            <span style={{ color: dataSource?.fred ? '#22C55E80' : '#F59E0B80' }}>
              {dataSource?.fred ? 'FRED' : 'MOCK'}
            </span>
            <span className="text-slate-800 mx-0.5">·</span>
            <span style={{ color: (dataSource?.yahoo || dataSource?.stooq) ? '#22C55E80' : '#F59E0B80' }}>
              {dataSource?.yahoo ? 'Yahoo' : dataSource?.stooq ? 'Stooq' : 'MOCK'}
            </span>
          </div>
        </div>

        {/* Center: gold price */}
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="flex items-center gap-1.5 justify-center mb-0.5">
              <span className="text-[10px] text-slate-600">XAU/USD</span>
              {isLive
                ? <span className="text-[9px] text-green-500/60 font-mono">{priceSource.toUpperCase()}</span>
                : <span className="text-[9px] text-amber-500/60 font-mono">SIMULATED</span>}
            </div>
            <div className="flex items-baseline gap-2">
              <span className={clsx(
                'text-2xl font-bold font-mono text-yellow-400 transition-all',
                priceLoading && 'opacity-40',
              )}>
                ${livePrice.toFixed(2)}
              </span>
              <span className={`text-sm font-mono font-semibold ${liveChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {liveChange >= 0 ? '+' : ''}{liveChange.toFixed(2)}
              </span>
              <span className={`text-xs font-mono ${liveChange >= 0 ? 'text-green-500/70' : 'text-red-500/70'}`}>
                ({liveChange >= 0 ? '+' : ''}{(changePct).toFixed(2)}%)
              </span>
            </div>
            {priceData && (
              <div className="flex items-center gap-2 text-[9px] text-slate-700 font-mono mt-0.5">
                <span>H:{priceData.high?.toFixed(1)}</span>
                <span>L:{priceData.low?.toFixed(1)}</span>
                <span>O:{priceData.open?.toFixed(1)}</span>
              </div>
            )}
          </div>

          <div className="w-px h-8 bg-white/[0.06]" />

          {/* Mini stats */}
          {[
            { label: '今日信号', value: '做多', color: '#22C55E' },
            { label: '预测收益', value: '+0.72%', color: '#22C55E' },
            { label: '仓位热度', value: '1.20%', color: '#F59E0B' },
            { label: '当前回撤', value: '-1.89%', color: '#EF4444' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="text-[9px] text-slate-600">{s.label}</div>
              <div className="text-xs font-bold font-mono mt-0.5" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Right: status */}
        <div className="flex items-center gap-3">
          {factorsLoading && (
            <RefreshCw className="w-3 h-3 text-slate-600 animate-spin" />
          )}
          <div className="flex items-center gap-1.5 text-[10px] text-green-400/80">
            <Wifi className="w-3.5 h-3.5" />
            <span>VSTAR 已连接</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-600">
            <Activity className="w-3 h-3 animate-pulse" />
            <span className="font-mono">{time}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-amber-400/80">
            <AlertCircle className="w-3 h-3" />
            <span>1 警告</span>
          </div>
        </div>
      </div>

      {/* Factor cards row — real data */}
      <div className="flex gap-2 px-4 py-2 overflow-x-auto">
        {factors.map(f => (
          <FactorCard key={f.id} factor={f} compact />
        ))}
      </div>
    </header>
  )
}
