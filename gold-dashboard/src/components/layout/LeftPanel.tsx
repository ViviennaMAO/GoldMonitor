'use client'
import { useState } from 'react'
import { BarChart2, LineChart, Grid, Network, TrendingUp } from 'lucide-react'
import { ShapWaterfall } from '@/components/charts/ShapWaterfall'
import { ICTracking } from '@/components/charts/ICTracking'
import { RegimeHeatmap } from '@/components/charts/RegimeHeatmap'
import { CorrelationMatrix } from '@/components/charts/CorrelationMatrix'
import { EquityCurveChart } from '@/components/charts/EquityCurve'
import { useSignal, useShapValues } from '@/lib/useGoldData'
import { TabId, ShapBar } from '@/types'
import clsx from 'clsx'

const TABS: Array<{ id: TabId | 'equity'; label: string; icon: React.ElementType; sublabel: string }> = [
  { id: 'shap', label: 'SHAP 归因', icon: BarChart2, sublabel: '瀑布图' },
  { id: 'ic', label: 'IC 追踪', icon: LineChart, sublabel: '信息系数' },
  { id: 'regime', label: 'Regime', icon: Grid, sublabel: '热力图' },
  { id: 'correlation', label: '相关性', icon: Network, sublabel: '矩阵' },
  { id: 'equity', label: '净值曲线', icon: TrendingUp, sublabel: '账户表现' },
]

export function LeftPanel() {
  const [activeTab, setActiveTab] = useState<string>('shap')
  const { data: shapData } = useShapValues()
  const { data: signalData } = useSignal()

  // Build SHAP bars from API
  const shapBars: ShapBar[] = shapData
    ? shapData.bars.map(b => ({
        factor: b.label,
        factorId: b.factor,
        value: b.value / 100,
        zScore: b.raw_feature,
        rawValue: `Z: ${b.raw_feature.toFixed(2)}`,
        economic: '',
      }))
    : []

  const prediction = signalData?.predicted_return ?? 0

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
        {activeTab === 'shap' && (
          <ShapWaterfall bars={shapBars} prediction={prediction} />
        )}
        {activeTab === 'ic' && <ICTracking />}
        {activeTab === 'regime' && <RegimeHeatmap />}
        {activeTab === 'correlation' && <CorrelationMatrix />}
        {activeTab === 'equity' && <EquityCurveChart />}
      </div>
    </div>
  )
}
