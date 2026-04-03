'use client'
import { TopBar } from '@/components/layout/TopBar'
import { SignalBanner } from '@/components/layout/SignalBanner'
import { LeftPanel } from '@/components/layout/LeftPanel'
import { RightSidebar } from '@/components/layout/RightSidebar'
import { StatusBar } from '@/components/layout/StatusBar'

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen lg:h-screen bg-[#050B18]">
      {/* Top: logo + gold price + factor cards */}
      <div className="flex-shrink-0">
        <TopBar />
      </div>

      {/* Signal banner — prominent centered strip */}
      <div className="flex-shrink-0">
        <SignalBanner />
      </div>

      {/* Main body — natural flow on mobile, fixed side-by-side on desktop */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0 lg:overflow-hidden">
        {/* Left panel: charts with tabs */}
        <div className="flex-1 min-w-0 min-h-[450px] lg:min-h-0 overflow-hidden">
          <LeftPanel />
        </div>

        {/* Right sidebar: positions + account */}
        <div className="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 lg:overflow-y-auto border-t lg:border-t-0 lg:border-l border-white/[0.06]">
          <RightSidebar />
        </div>
      </div>

      {/* Bottom status bar */}
      <StatusBar />
    </div>
  )
}
