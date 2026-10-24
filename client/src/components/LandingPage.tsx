import React from 'react';
import { 
  BarChart3, 
  Box, 
  Truck, 
  ArrowRight, 
  CheckCircle2, 
  ChevronRight
} from 'lucide-react';

interface LandingPageProps {
  onStartDemo: () => void;
  onExploreFeatures?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStartDemo, onExploreFeatures }) => {
  return (
    <div className="min-h-screen bg-[#F7F7F4] text-[#191B19] flex flex-col font-sans selection:bg-[#EBF1EA] selection:text-[#526B50]">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-[#F7F7F4]/90 backdrop-blur-md border-b border-[#E5E6E0]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 rounded-lg bg-[#526B50] flex items-center justify-center text-white shadow-sm">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-[#191B19]">SupplySync</span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-[15px] font-medium text-[#70736E]">
            <a href="#product" className="hover:text-[#191B19] transition-colors">Product</a>
            <a href="#solutions" className="hover:text-[#191B19] transition-colors">Solutions</a>
            <a href="#features" className="hover:text-[#191B19] transition-colors">Features</a>
            <button 
              onClick={onStartDemo} 
              className="hover:text-[#526B50] transition-colors font-medium cursor-pointer"
            >
              Demo
            </button>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-4">
            <button 
              onClick={onStartDemo}
              className="text-[15px] font-medium text-[#191B19] hover:text-[#526B50] transition-colors hidden sm:block cursor-pointer px-2 py-1"
            >
              Login
            </button>
            <button
              onClick={onStartDemo}
              className="bg-[#191B19] hover:bg-[#2E312E] text-white text-[14px] font-medium px-5 py-2.5 rounded-full flex items-center gap-2 transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-6 pt-12 pb-20 w-full flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center mb-16">
          {/* Hero Copy (Left 6-7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EBF1EA] border border-[#D3DFD2] text-[#526B50] text-xs font-semibold tracking-wide shadow-xs">
              <Box className="w-3.5 h-3.5" />
              <span>AI-Powered Supply Chain</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-extrabold tracking-tight text-[#191B19] leading-[1.12]">
              Smarter Distribution.<br />
              <span className="text-[#191B19]">Lower Costs. </span>
              <span className="text-[#526B50]">No Stockouts.</span>
            </h1>

            {/* Supporting Copy */}
            <p className="text-lg text-[#70736E] max-w-xl leading-relaxed">
              An intelligent platform that forecasts demand, optimizes inventory, and recommends the best distribution plan across your network.
            </p>

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={onStartDemo}
                className="bg-[#191B19] hover:bg-[#2E312E] text-white font-medium text-base px-6 py-3.5 rounded-xl flex items-center gap-3 transition-all shadow-md hover:shadow-lg active:scale-95 cursor-pointer"
              >
                <span>Try Demo</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <a
                href="#features"
                onClick={onExploreFeatures}
                className="bg-white hover:bg-[#F2F2EE] text-[#191B19] font-medium text-base px-6 py-3.5 rounded-xl border border-[#E5E6E0] transition-all hover:border-[#D5D6D0] active:scale-95 cursor-pointer"
              >
                Learn More
              </a>
            </div>

            {/* Verification Tag */}
            <div className="pt-2 flex items-center gap-6 text-xs text-[#70736E]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#526B50]" />
                Google OR-Tools Mixed-Integer Engine
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#526B50]" />
                FEFO Expiry-Aware Logic
              </span>
            </div>
          </div>

          {/* Hero Visual / Illustration (Right 5 cols) */}
          <div className="lg:col-span-5 relative">
            {/* Visual Canvas Card */}
            <div className="relative rounded-3xl bg-linear-to-b from-[#EFEFE9] to-[#E5E5DD] p-6 border border-[#E5E6E0] shadow-xl overflow-hidden min-h-[380px] flex items-center justify-center">
              
              {/* Perspective Map SVG Illustration */}
              <svg viewBox="0 0 500 360" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Background topographic contours */}
                <path d="M40 260 C 140 220, 220 280, 320 230 C 400 190, 440 220, 480 200" stroke="#DDDED6" strokeWidth="2" strokeDasharray="4 4" />
                <path d="M20 300 C 120 260, 200 320, 300 270 C 400 230, 450 280, 490 250" stroke="#E2E3DC" strokeWidth="2" />
                
                {/* Distribution Route Arcs */}
                <path d="M260 210 Q 320 130 360 130" stroke="#526B50" strokeWidth="2.5" strokeDasharray="6 4" className="animate-pulse" opacity="0.85" />
                <path d="M260 210 Q 340 190 410 200" stroke="#526B50" strokeWidth="2.5" strokeDasharray="6 4" opacity="0.85" />
                <path d="M260 210 Q 380 260 430 250" stroke="#526B50" strokeWidth="2.5" strokeDasharray="6 4" opacity="0.85" />
                <path d="M260 210 Q 300 100 320 120" stroke="#526B50" strokeWidth="2" strokeDasharray="4 4" opacity="0.6" />

                {/* Warehouse Building */}
                <g transform="translate(180, 170)">
                  {/* Foundation shadow */}
                  <ellipse cx="60" cy="80" rx="70" ry="12" fill="#000000" fillOpacity="0.08" />
                  
                  {/* Warehouse Wall */}
                  <polygon points="10,40 10,75 80,75 80,40" fill="#E2E4DC" stroke="#C8CBC0" strokeWidth="1.5" />
                  <polygon points="80,40 80,75 125,58 125,25" fill="#C5C9BE" stroke="#B0B5A7" strokeWidth="1.5" />
                  
                  {/* Warehouse Roof */}
                  <polygon points="5,40 45,18 115,10 80,40" fill="#758273" />
                  <polygon points="80,40 115,10 130,25 90,45" fill="#5F6D5D" />
                  
                  {/* Loading Bay Door */}
                  <rect x="42" y="48" width="28" height="27" rx="2" fill="#2D332C" />
                  <line x1="42" y1="55" x2="70" y2="55" stroke="#485346" strokeWidth="1" />
                  <line x1="42" y1="62" x2="70" y2="62" stroke="#485346" strokeWidth="1" />
                  <line x1="42" y1="69" x2="70" y2="69" stroke="#485346" strokeWidth="1" />
                  
                  {/* Cargo crates near door */}
                  <rect x="47" y="63" width="9" height="9" rx="1" fill="#D29A5B" />
                  <rect x="57" y="63" width="9" height="9" rx="1" fill="#B88045" />
                  <rect x="52" y="55" width="9" height="8" rx="1" fill="#E0A768" />
                  
                  {/* Warehouse Label */}
                  <text x="18" y="32" fill="#526B50" fontSize="8" fontWeight="700" letterSpacing="0.5">HUB 01</text>
                </g>

                {/* FMCG Distribution Truck */}
                <g transform="translate(295, 215)">
                  <ellipse cx="35" cy="38" rx="30" ry="6" fill="#000000" fillOpacity="0.1" />
                  {/* Truck Container */}
                  <rect x="5" y="10" width="40" height="22" rx="2" fill="#FFFFFF" stroke="#CCD0C4" strokeWidth="1" />
                  <rect x="8" y="13" width="34" height="3" rx="1" fill="#526B50" />
                  {/* Truck Cab */}
                  <path d="M45 18 L55 18 L60 26 L60 32 L45 32 Z" fill="#6A7A68" />
                  <polygon points="48,20 54,20 58,26 48,26" fill="#D4DECE" />
                  {/* Wheels */}
                  <circle cx="16" cy="33" r="5" fill="#2E332E" />
                  <circle cx="16" cy="33" r="2.5" fill="#8C938A" />
                  <circle cx="34" cy="33" r="5" fill="#2E332E" />
                  <circle cx="34" cy="33" r="2.5" fill="#8C938A" />
                  <circle cx="53" cy="33" r="5" fill="#2E332E" />
                  <circle cx="53" cy="33" r="2.5" fill="#8C938A" />
                </g>

                {/* Destination Location Pins */}
                {/* Pin 1: North Hub */}
                <g transform="translate(355, 115)">
                  <ellipse cx="7" cy="20" rx="7" ry="3" fill="#000000" fillOpacity="0.15" />
                  <path d="M7 0 C 3.1 0 0 3.1 0 7 C 0 12.2 7 20 7 20 C 7 20 14 12.2 14 7 C 14 3.1 10.9 0 7 0 Z" fill="#526B50" />
                  <circle cx="7" cy="7" r="3" fill="#FFFFFF" />
                </g>

                {/* Pin 2: East Retail Cluster */}
                <g transform="translate(405, 185)">
                  <ellipse cx="7" cy="20" rx="7" ry="3" fill="#000000" fillOpacity="0.15" />
                  <path d="M7 0 C 3.1 0 0 3.1 0 7 C 0 12.2 7 20 7 20 C 7 20 14 12.2 14 7 C 14 3.1 10.9 0 7 0 Z" fill="#526B50" />
                  <circle cx="7" cy="7" r="3" fill="#FFFFFF" />
                </g>

                {/* Pin 3: South Supermarket */}
                <g transform="translate(425, 235)">
                  <ellipse cx="7" cy="20" rx="7" ry="3" fill="#000000" fillOpacity="0.15" />
                  <path d="M7 0 C 3.1 0 0 3.1 0 7 C 0 12.2 7 20 7 20 C 7 20 14 12.2 14 7 C 14 3.1 10.9 0 7 0 Z" fill="#526B50" />
                  <circle cx="7" cy="7" r="3" fill="#FFFFFF" />
                </g>

                {/* Pin 4: Central Distributor */}
                <g transform="translate(315, 105)">
                  <ellipse cx="6" cy="18" rx="6" ry="2.5" fill="#000000" fillOpacity="0.12" />
                  <path d="M6 0 C 2.7 0 0 2.7 0 6 C 0 10.5 6 18 6 18 C 6 18 12 10.5 12 6 C 12 2.7 9.3 0 6 0 Z" fill="#758A73" />
                  <circle cx="6" cy="6" r="2.5" fill="#FFFFFF" />
                </g>
              </svg>

              {/* Floating "Optimized Distribution" Card */}
              <div className="absolute top-4 right-4 sm:top-6 sm:right-6 bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 shadow-2xl border border-[#E5E6E0] w-[190px] sm:w-[210px] transform hover:scale-105 transition-transform duration-300">
                <div className="text-[14px] font-bold text-[#191B19] mb-3 flex items-center justify-between">
                  <span>Optimized Distribution</span>
                  <span className="w-2 h-2 rounded-full bg-[#526B50] animate-ping" />
                </div>
                
                <div className="space-y-2.5 text-[13px] font-medium">
                  <div className="flex items-center gap-2.5 text-[#191B19]">
                    <div className="w-5 h-5 rounded-full bg-[#EBF1EA] text-[#526B50] flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <span>Cost <span className="text-[#526B50] font-semibold">↓ 18%</span></span>
                  </div>

                  <div className="flex items-center gap-2.5 text-[#191B19]">
                    <div className="w-5 h-5 rounded-full bg-[#EBF1EA] text-[#526B50] flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <span>Stockouts <span className="text-[#526B50] font-semibold">↓ 54%</span></span>
                  </div>

                  <div className="flex items-center gap-2.5 text-[#191B19]">
                    <div className="w-5 h-5 rounded-full bg-[#EBF1EA] text-[#526B50] flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <span>Wastage <span className="text-[#526B50] font-semibold">↓ 41%</span></span>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#F0F0EB] text-[11px] text-[#70736E] flex items-center justify-between">
                  <span>OR-Tools MILP</span>
                  <span className="text-[#526B50] font-mono font-medium">Active</span>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Feature Strip (3 Columns matching design reference) */}
        <div id="features" className="pt-10 border-t border-[#E5E6E0] grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          
          {/* Feature 1: Demand Forecasting */}
          <div className="flex items-start gap-4 p-2 rounded-xl transition-all hover:bg-white/50">
            <div className="w-12 h-12 rounded-xl bg-white border border-[#E5E6E0] flex items-center justify-center text-[#526B50] shadow-xs shrink-0">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#191B19] mb-1">Demand Forecasting</h3>
              <p className="text-sm text-[#70736E] leading-relaxed">
                Predict product demand accurately across regions using chronological seasonal models and sales velocity.
              </p>
            </div>
          </div>

          {/* Feature 2: Inventory Optimization */}
          <div className="flex items-start gap-4 p-2 rounded-xl transition-all hover:bg-white/50">
            <div className="w-12 h-12 rounded-xl bg-white border border-[#E5E6E0] flex items-center justify-center text-[#526B50] shadow-xs shrink-0">
              <Box className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#191B19] mb-1">Inventory Optimization</h3>
              <p className="text-sm text-[#70736E] leading-relaxed">
                Allocate stock efficiently, protect service levels, and reduce excess inventory using FEFO batch policies.
              </p>
            </div>
          </div>

          {/* Feature 3: Distribution Recommendations */}
          <div className="flex items-start gap-4 p-2 rounded-xl transition-all hover:bg-white/50">
            <div className="w-12 h-12 rounded-xl bg-white border border-[#E5E6E0] flex items-center justify-center text-[#526B50] shadow-xs shrink-0">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#191B19] mb-1">Distribution Recommendations</h3>
              <p className="text-sm text-[#70736E] leading-relaxed">
                Get the right product, quantity, and source warehouse for every location under strict route and vehicle constraints.
              </p>
            </div>
          </div>

        </div>

        {/* Operational Problem Statement Deep Dive */}
        <div id="solutions" className="mt-20 p-8 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-[#F0F0EB]">
            <div>
              <div className="text-xs font-bold tracking-wider uppercase text-[#526B50] mb-1">
                Triwizathon 2026 Problem Statement 2
              </div>
              <h2 className="text-2xl font-bold text-[#191B19]">
                Constrained FMCG Distribution Decision Engine
              </h2>
            </div>
            <button
              onClick={onStartDemo}
              className="bg-[#526B50] hover:bg-[#41553F] text-white font-medium text-sm px-5 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-sm cursor-pointer"
            >
              <span>Launch Optimizer Console</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-6">
            <div className="p-4 rounded-xl bg-[#F7F7F4] border border-[#E5E6E0]">
              <div className="text-xs font-semibold text-[#70736E] uppercase mb-1">1. Master Data Ingestion</div>
              <div className="text-sm font-medium text-[#191B19]">Warehouses, retail destinations, batch expiries, route tariffs.</div>
            </div>
            <div className="p-4 rounded-xl bg-[#F7F7F4] border border-[#E5E6E0]">
              <div className="text-xs font-semibold text-[#70736E] uppercase mb-1">2. Demand Forecasting</div>
              <div className="text-sm font-medium text-[#191B19]">Historical moving averages and time-series demand estimation.</div>
            </div>
            <div className="p-4 rounded-xl bg-[#F7F7F4] border border-[#E5E6E0]">
              <div className="text-xs font-semibold text-[#70736E] uppercase mb-1">3. Mathematical Optimization</div>
              <div className="text-sm font-medium text-[#191B19]">OR-Tools solver minimizes cost & penalties subject to stock & routes.</div>
            </div>
            <div className="p-4 rounded-xl bg-[#F7F7F4] border border-[#E5E6E0]">
              <div className="text-xs font-semibold text-[#70736E] uppercase mb-1">4. Baseline Comparison</div>
              <div className="text-sm font-medium text-[#191B19]">Quantifiable side-by-side audit of fulfillment, cost, and waste.</div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5E6E0] bg-[#F7F7F4] py-8 text-xs text-[#70736E]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#191B19]">SupplySync</span>
            <span>— FMCG Distribution Intelligence Engine</span>
          </div>
          <div>Triwizathon 2026 • Problem Statement 2 Competition Entry</div>
        </div>
      </footer>
    </div>
  );
};
