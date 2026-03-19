'use client'
import { TopBar } from '@/components/layout/TopBar'
import { LeftPanel } from '@/components/layout/LeftPanel'
import { RightSidebar } from '@/components/layout/RightSidebar'
import { StatusBar } from '@/components/layout/StatusBar'

export default function Home() {
  return (
    <div className="flex flex-col h-screen bg-[#050B18] overflow-hidden">
      {/* Top: logo + gold price + 9 factor cards */}
      <TopBar />

      {/* Main body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left panel: 60% — charts with tabs */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <LeftPanel />
        </div>

        {/* Right sidebar: 40% — signal + positions + account */}
        <div className="w-[380px] xl:w-[420px] flex-shrink-0 overflow-y-auto">
          <RightSidebar />
        </div>
      </div>

      {/* Bottom status bar */}
      <StatusBar />
    </div>
  )
}
