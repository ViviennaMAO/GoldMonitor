'use client'
import { SignalCard } from '@/components/cards/SignalCard'
import { PositionCard } from '@/components/cards/PositionCard'
import { AccountCard } from '@/components/cards/AccountCard'
import { ShapWaterfall } from '@/components/charts/ShapWaterfall'
import { dailySignal, positions, accountStats } from '@/data/mockData'

export function RightSidebar() {
  return (
    <div className="h-full flex flex-col gap-2 md:gap-3 p-2 md:p-3 overflow-y-auto bg-[#050B18] lg:border-l border-white/[0.06]">
      {/* Signal card */}
      <SignalCard signal={dailySignal} />

      {/* SHAP waterfall */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#0A1628] p-3 md:p-4">
        <ShapWaterfall bars={dailySignal.shapBars} prediction={dailySignal.prediction} />
      </div>

      {/* Position management */}
      <PositionCard positions={positions} />

      {/* Account dashboard */}
      <AccountCard stats={accountStats} />
    </div>
  )
}
