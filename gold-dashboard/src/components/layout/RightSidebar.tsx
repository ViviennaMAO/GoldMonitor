'use client'
import { SignalCard } from '@/components/cards/SignalCard'
import { PositionCard } from '@/components/cards/PositionCard'
import { AccountCard } from '@/components/cards/AccountCard'
import { dailySignal, positions, accountStats } from '@/data/mockData'

export function RightSidebar() {
  return (
    <div className="h-full flex flex-col gap-3 p-3 overflow-y-auto bg-[#050B18] border-l border-white/[0.06]">
      {/* Signal card */}
      <SignalCard signal={dailySignal} />

      {/* Position management */}
      <PositionCard positions={positions} />

      {/* Account dashboard */}
      <AccountCard stats={accountStats} />
    </div>
  )
}
