'use client'
import { useState } from 'react'
import { LineChart, Grid, Network, TrendingUp } from 'lucide-react'
import { ICTracking } from '@/components/charts/ICTracking'
import { RegimeHeatmap } from '@/components/charts/RegimeHeatmap'
import { CorrelationMatrix } from '@/components/charts/CorrelationMatrix'
import { EquityCurveChart } from '@/components/charts/EquityCurve'
import { TabId } from '@/types'
import clsx from 'clsx'

const TABS: Array<{ id: TabId | 'equity'; label: string; icon: React.ElementType; sublabel: string }> = [
  { id: 'ic', label: 'IC 追踪', icon: LineChart, sublabel: '信息系数' },
  { id: 'regime', label: 'Regime', icon: Grid, sublabel: '热力图' },
  { id: 'correlation', label: '相关性', icon: Network, sublabel: '矩阵' },
  { id: 'equity', label: '净值曲线', icon: TrendingUp, sublabel: '账户表现' },
]

export function LeftPanel() {
  const [activeTab, setActiveTab] = useState<string>('ic')

  return (
    <div className="flex flex-col h-full bg-[#050B18]">
      {/* Tab bar — scrollable on mobile */}
      <div className="flex gap-1 px-2 md:px-3 pt-2 md:pt-3 pb-0 border-b border-white/[0.06] flex-shrink-0 overflow-x-auto scrollbar-hide">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-2 rounded-t-lg text-[11px] md:text-xs font-medium transition-all cursor-pointer border-b-2 -mb-px whitespace-nowrap flex-shrink-0',
                isActive
                  ? 'bg-[#0A1628] border-blue-500 text-blue-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              <span className="text-[9px] text-slate-600 hidden lg:inline">· {tab.sublabel}</span>
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 p-2 md:p-4 overflow-auto">
        {activeTab === 'ic' && <ICTracking />}
        {activeTab === 'regime' && <RegimeHeatmap />}
        {activeTab === 'correlation' && <CorrelationMatrix />}
        {activeTab === 'equity' && <EquityCurveChart />}
      </div>
    </div>
  )
}
