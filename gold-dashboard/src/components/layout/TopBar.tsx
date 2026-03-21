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
      <div className="flex items-center justify-between px-3 md:px-4 py-2 border-b border-white/[0.04] gap-2 flex-wrap md:flex-nowrap">
        {/* Left: logo + title */}
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center flex-shrink-0">
            <span className="text-black font-bold text-xs">Au</span>
          </div>
          <div>
            <div className="text-sm font-bold text-slate-100 leading-none">Gold Monitor</div>
            <div className="text-[10px] text-slate-600 mt-0.5 hidden sm:block">黄金因子量化交易看板 · v1.0</div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-700 hidden md:block" />
          <Badge variant="purple" size="sm"><span className="hidden md:inline">R1: </span>实际利率主导</Badge>
          {/* Data source indicator */}
          <div className="items-center gap-1 text-[9px] font-mono hidden lg:flex">
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
        <div className="flex items-center gap-2 md:gap-4 order-3 md:order-none w-full md:w-auto justify-center md:justify-start">
          <div className="text-center">
            <div className="flex items-center gap-1.5 justify-center mb-0.5">
              <span className="text-[10px] text-slate-600">XAU/USD</span>
              {isLive
                ? <span className="text-[9px] text-green-500/60 font-mono">{priceSource.toUpperCase()}</span>
                : <span className="text-[9px] text-amber-500/60 font-mono">SIMULATED</span>}
            </div>
            <div className="flex items-baseline gap-2">
              <span className={clsx(
                'text-xl md:text-2xl font-bold font-mono text-yellow-400 transition-all',
                priceLoading && 'opacity-40',
              )}>
                ${livePrice.toFixed(2)}
              </span>
              <span className={`text-xs md:text-sm font-mono font-semibold ${liveChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {liveChange >= 0 ? '+' : ''}{liveChange.toFixed(2)}
              </span>
              <span className={`text-[10px] md:text-xs font-mono ${liveChange >= 0 ? 'text-green-500/70' : 'text-red-500/70'}`}>
                ({liveChange >= 0 ? '+' : ''}{(changePct).toFixed(2)}%)
              </span>
            </div>
            {priceData && (
              <div className="hidden sm:flex items-center gap-2 text-[9px] text-slate-700 font-mono mt-0.5">
                <span>H:{priceData.high?.toFixed(1)}</span>
                <span>L:{priceData.low?.toFixed(1)}</span>
                <span>O:{priceData.open?.toFixed(1)}</span>
              </div>
            )}
          </div>

          <div className="w-px h-8 bg-white/[0.06] hidden md:block" />

          {/* Mini stats — hidden on mobile */}
          {[
            { label: '今日信号', value: '做多', color: '#22C55E' },
            { label: '预测收益', value: '+0.72%', color: '#22C55E' },
            { label: '仓位热度', value: '1.20%', color: '#F59E0B' },
            { label: '当前回撤', value: '-1.89%', color: '#EF4444' },
          ].map(s => (
            <div key={s.label} className="text-center hidden lg:block">
              <div className="text-[9px] text-slate-600">{s.label}</div>
              <div className="text-xs font-bold font-mono mt-0.5" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Right: status + VSTAR button */}
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          {factorsLoading && (
            <RefreshCw className="w-3 h-3 text-slate-600 animate-spin" />
          )}
          <div className="items-center gap-1.5 text-[10px] text-green-400/80 hidden sm:flex">
            <Wifi className="w-3.5 h-3.5" />
            <span className="hidden md:inline">VSTAR 已连接</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-600">
            <Activity className="w-3 h-3 animate-pulse" />
            <span className="font-mono">{time}</span>
          </div>
          <div className="items-center gap-1 text-[10px] text-amber-400/80 hidden md:flex">
            <AlertCircle className="w-3 h-3" />
            <span>1 警告</span>
          </div>
          <a
            href="https://share.vstarau.com/sign-page/?lang=zh_CN&inviteCode=s7f5qfhy"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 px-2 md:px-3 py-1.5 rounded-md bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black text-[10px] md:text-[11px] font-bold transition-all hover:shadow-lg hover:shadow-amber-500/20 flex items-center gap-1 flex-shrink-0"
          >
            <span className="hidden sm:inline">VSTAR </span><span>开户交易</span>
            <ChevronRight className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Factor cards row — horizontally scrollable */}
      <div className="flex gap-1.5 md:gap-2 px-3 md:px-4 py-2 overflow-x-auto scrollbar-hide">
        {factors.map(f => (
          <FactorCard key={f.id} factor={f} compact />
        ))}
      </div>
    </header>
  )
}
