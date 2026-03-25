'use client'
import { TopBar } from '@/components/layout/TopBar'
import { LeftPanel } from '@/components/layout/LeftPanel'
import { RightSidebar } from '@/components/layout/RightSidebar'
import { StatusBar } from '@/components/layout/StatusBar'

export default function Home() {
  return (
    <div className="flex flex-col h-screen bg-[#050B18] overflow-hidden">
      {/* Top: logo + gold price + factor cards */}
      <TopBar />

      {/* Main body — stacked on mobile, side-by-side on desktop */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
        {/* Left panel: charts with tabs */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <LeftPanel />
        </div>

        {/* Right sidebar: signal + positions + account */}
        <div className="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 overflow-y-auto border-t lg:border-t-0 lg:border-l border-white/[0.06]">
          <RightSidebar />
        </div>
      </div>

      {/* Bottom status bar */}
      <StatusBar />
    </div>
  )
}
