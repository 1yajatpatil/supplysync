import { useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { 
  Box, 
  ArrowLeft, 
  CheckCircle2,
  Play
} from 'lucide-react';

export function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'app'>('landing');
  const [activeTab, setActiveTab] = useState<'overview' | 'inventory' | 'demand' | 'optimization' | 'comparison'>('overview');

  if (currentView === 'landing') {
    return (
      <LandingPage 
        onStartDemo={() => {
          setCurrentView('app');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onExploreFeatures={() => {
          const el = document.getElementById('features');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F4] text-[#191B19] flex flex-col font-sans">
      {/* Top Application Header */}
      <header className="sticky top-0 z-40 bg-[#F7F7F4]/90 backdrop-blur-md border-b border-[#E5E6E0]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentView('landing')}
              className="flex items-center gap-1.5 text-xs font-medium text-[#70736E] hover:text-[#191B19] transition-colors px-2.5 py-1.5 rounded-lg border border-[#E5E6E0] bg-white cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </button>

            <div className="h-4 w-px bg-[#E5E6E0]" />

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#526B50] flex items-center justify-center text-white">
                <Box className="w-4 h-4" />
              </div>
              <span className="font-bold tracking-tight text-lg">SupplySync</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#EBF1EA] text-[#526B50] font-medium border border-[#D3DFD2]">
                PS2 Console
              </span>
            </div>
          </div>

          {/* Quick tab switcher */}
          <div className="flex items-center gap-1 bg-[#EBECE6] p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'overview' ? 'bg-white text-[#191B19] shadow-xs font-semibold' : 'text-[#70736E] hover:text-[#191B19]'
              }`}
            >
              Network Overview
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'inventory' ? 'bg-white text-[#191B19] shadow-xs font-semibold' : 'text-[#70736E] hover:text-[#191B19]'
              }`}
            >
              Inventory Batches
            </button>
            <button
              onClick={() => setActiveTab('demand')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'demand' ? 'bg-white text-[#191B19] shadow-xs font-semibold' : 'text-[#70736E] hover:text-[#191B19]'
              }`}
            >
              Demand Forecasts
            </button>
            <button
              onClick={() => setActiveTab('optimization')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'optimization' ? 'bg-white text-[#191B19] shadow-xs font-semibold' : 'text-[#70736E] hover:text-[#191B19]'
              }`}
            >
              Distribution Engine
            </button>
            <button
              onClick={() => setActiveTab('comparison')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'comparison' ? 'bg-white text-[#191B19] shadow-xs font-semibold' : 'text-[#70736E] hover:text-[#191B19]'
              }`}
            >
              Baseline Audit
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-[#526B50] font-medium">
              <span className="w-2 h-2 rounded-full bg-[#526B50] animate-pulse" />
              OR-Tools Solver Online
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full">
        {/* Workspace banner */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs">
          <div>
            <div className="text-xs font-bold text-[#526B50] uppercase tracking-wider mb-0.5">
              FMCG Distribution Planning Environment
            </div>
            <h1 className="text-xl font-bold text-[#191B19]">
              Regional Distribution Intelligence Console
            </h1>
            <p className="text-xs text-[#70736E] mt-0.5">
              Synthesized realistic FMCG distribution network with regional demand imbalances, batch expiry schedules, and constrained transport routes.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveTab('optimization')}
              className="bg-[#526B50] hover:bg-[#41553F] text-white text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-xs cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Constrained Optimizer</span>
            </button>
          </div>
        </div>

        {/* Tab content placeholder for upcoming milestones */}
        <div className="p-8 bg-white border border-[#E5E6E0] rounded-2xl shadow-xs">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EBF1EA] text-[#526B50] text-xs font-medium mb-3">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Milestone 2 Verified: Landing Page & Workspace Shell Active</span>
            </div>
            <h2 className="text-xl font-bold text-[#191B19] mb-2">
              Distribution Engine Foundation Established
            </h2>
            <p className="text-sm text-[#70736E] leading-relaxed mb-6">
              The application foundation, landing page matching the visual reference, and interactive workspace routing are live. The FMCG master data schemas, synthetic realistic dataset, OR-Tools mixed-integer optimization engine, and side-by-side baseline audit will be integrated in the subsequent milestones.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#F7F7F4] border border-[#E5E6E0]">
                <div className="text-xs text-[#70736E]">Target Model</div>
                <div className="text-sm font-bold text-[#191B19] mt-0.5">OR-Tools MILP Solver</div>
              </div>
              <div className="p-4 rounded-xl bg-[#F7F7F4] border border-[#E5E6E0]">
                <div className="text-xs text-[#70736E]">Expiry Policy</div>
                <div className="text-sm font-bold text-[#191B19] mt-0.5">FEFO Batch Prioritization</div>
              </div>
              <div className="p-4 rounded-xl bg-[#F7F7F4] border border-[#E5E6E0]">
                <div className="text-xs text-[#70736E]">Benchmark Strategy</div>
                <div className="text-sm font-bold text-[#191B19] mt-0.5">Demand-Priority Baseline</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
