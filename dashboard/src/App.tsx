import { useEffect, useRef } from 'react'
import { AppProvider, useApp } from '@/lib/store'
import { Sidebar } from '@/components/shell/Sidebar'
import { Topbar } from '@/components/shell/Topbar'
import { CommandPalette } from '@/components/shell/CommandPalette'

import { CommandCenter } from '@/pages/CommandCenter'
import { AIUniverse } from '@/pages/AIUniverse'
import { StockIntelligence } from '@/pages/StockIntelligence'
import { MLLab } from '@/pages/MLLab'
import { PortfolioOptimizer } from '@/pages/PortfolioOptimizer'
import { RiskTerminal } from '@/pages/RiskTerminal'
import { Backtest } from '@/pages/Backtest'
import { ResearchAudit } from '@/pages/ResearchAudit'

const PAGES = {
  command: CommandCenter,
  universe: AIUniverse,
  stock: StockIntelligence,
  ml: MLLab,
  portfolio: PortfolioOptimizer,
  risk: RiskTerminal,
  backtest: Backtest,
  audit: ResearchAudit,
} as const

function Shell() {
  const { route } = useApp()
  const Page = PAGES[route]
  const scrollRef = useRef<HTMLDivElement>(null)

  // Each navigation starts at the top, like a real page transition.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [route])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-ink-950">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div key={route} className="animate-fade-in">
            <Page />
          </div>
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}

export function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
