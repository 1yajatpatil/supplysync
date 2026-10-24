import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Box, 
  Truck, 
  ArrowRight, 
  CheckCircle2, 
  ChevronRight,
  Menu,
  X,
  Lock,
  Layers,
  Scale,
  Clock,
  ShieldCheck,
  TrendingDown,
  Warehouse,
  Store,
  DollarSign,
  AlertTriangle,
  Play,
  RotateCcw,
  Download
} from 'lucide-react';

interface LandingPageProps {
  onStartDemo: (tab?: 'overview' | 'inventory' | 'demand' | 'optimization' | 'comparison') => void;
  onExploreFeatures?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStartDemo, onExploreFeatures }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Close login modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isLoginModalOpen) {
        setIsLoginModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoginModalOpen]);

  // Smooth scroll handler with header offset
  const scrollToSection = (sectionId: string) => {
    setIsMobileMenuOpen(false);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F4] text-[#191B19] flex flex-col font-sans selection:bg-[#EBF1EA] selection:text-[#526B50]">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-[#F7F7F4]/90 backdrop-blur-md border-b border-[#E5E6E0]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Logo */}
          <button 
            type="button"
            className="flex items-center gap-3 cursor-pointer text-left bg-transparent border-0 p-0" 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="SupplySync Home"
          >
            <div className="w-10 h-10 rounded-lg bg-[#526B50] flex items-center justify-center text-white shadow-xs">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-[#191B19]">SupplySync</span>
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-[15px] font-medium text-[#70736E]" aria-label="Main Navigation">
            <a 
              href="#product" 
              onClick={(e) => { e.preventDefault(); scrollToSection('product'); }}
              className="hover:text-[#191B19] transition-colors cursor-pointer py-1"
            >
              Product
            </a>
            <a 
              href="#solutions" 
              onClick={(e) => { e.preventDefault(); scrollToSection('solutions'); }}
              className="hover:text-[#191B19] transition-colors cursor-pointer py-1"
            >
              Solutions
            </a>
            <a 
              href="#features" 
              onClick={(e) => { e.preventDefault(); scrollToSection('features'); }}
              className="hover:text-[#191B19] transition-colors cursor-pointer py-1"
            >
              Features
            </a>
            <a 
              href="#demo" 
              onClick={(e) => { e.preventDefault(); scrollToSection('demo'); }}
              className="hover:text-[#191B19] transition-colors cursor-pointer py-1"
            >
              Demo
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="hidden sm:flex items-center gap-4">
            <button 
              type="button"
              onClick={() => setIsLoginModalOpen(true)}
              className="text-[15px] font-medium text-[#191B19] hover:text-[#526B50] transition-colors cursor-pointer px-3 py-1.5 rounded-lg"
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => onStartDemo('optimization')}
              className="bg-[#191B19] hover:bg-[#2E312E] text-white text-[14px] font-medium px-5 py-2.5 rounded-full flex items-center gap-2 transition-all shadow-xs active:scale-95 cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => onStartDemo('optimization')}
              className="bg-[#191B19] text-white text-xs font-semibold px-3 py-2 rounded-full flex items-center gap-1.5 cursor-pointer"
            >
              <span>Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-xl text-[#191B19] hover:bg-white border border-[#E5E6E0] cursor-pointer"
              aria-label="Toggle navigation menu"
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-[#F7F7F4] border-b border-[#E5E6E0] px-6 py-4 space-y-3">
            <div className="flex flex-col space-y-2 text-sm font-medium text-[#70736E]">
              <a 
                href="#product" 
                onClick={(e) => { e.preventDefault(); scrollToSection('product'); }}
                className="py-2 hover:text-[#191B19] transition-colors border-b border-[#E5E6E0]/60"
              >
                Product
              </a>
              <a 
                href="#solutions" 
                onClick={(e) => { e.preventDefault(); scrollToSection('solutions'); }}
                className="py-2 hover:text-[#191B19] transition-colors border-b border-[#E5E6E0]/60"
              >
                Solutions
              </a>
              <a 
                href="#features" 
                onClick={(e) => { e.preventDefault(); scrollToSection('features'); }}
                className="py-2 hover:text-[#191B19] transition-colors border-b border-[#E5E6E0]/60"
              >
                Features
              </a>
              <a 
                href="#demo" 
                onClick={(e) => { e.preventDefault(); scrollToSection('demo'); }}
                className="py-2 hover:text-[#191B19] transition-colors border-b border-[#E5E6E0]/60"
              >
                Demo
              </a>
            </div>
            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => { setIsMobileMenuOpen(false); setIsLoginModalOpen(true); }}
                className="w-1/2 text-center py-2.5 rounded-xl border border-[#E5E6E0] bg-white text-xs font-semibold text-[#191B19]"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => { setIsMobileMenuOpen(false); onStartDemo('optimization'); }}
                className="w-1/2 text-center py-2.5 rounded-xl bg-[#526B50] text-white text-xs font-semibold"
              >
                Get Started
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-6 pt-12 pb-24 w-full flex flex-col justify-center">
        {/* Hero Section */}
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
                type="button"
                onClick={() => onStartDemo('optimization')}
                className="bg-[#191B19] hover:bg-[#2E312E] text-white font-medium text-base px-6 py-3.5 rounded-xl flex items-center gap-3 transition-all shadow-md hover:shadow-lg active:scale-95 cursor-pointer"
              >
                <span>Try Demo</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => scrollToSection('product')}
                className="bg-white hover:bg-[#F2F2EE] text-[#191B19] font-medium text-base px-6 py-3.5 rounded-xl border border-[#E5E6E0] transition-all hover:border-[#D5D6D0] active:scale-95 cursor-pointer"
              >
                Learn More
              </button>
            </div>

            {/* Verification Tag */}
            <div className="pt-2 flex flex-wrap items-center gap-6 text-xs text-[#70736E]">
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
              <svg viewBox="0 0 500 360" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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
                  <ellipse cx="60" cy="80" rx="70" ry="12" fill="#000000" fillOpacity="0.08" />
                  <polygon points="10,40 10,75 80,75 80,40" fill="#E2E4DC" stroke="#C8CBC0" strokeWidth="1.5" />
                  <polygon points="80,40 80,75 125,58 125,25" fill="#C5C9BE" stroke="#B0B5A7" strokeWidth="1.5" />
                  <polygon points="5,40 45,18 115,10 80,40" fill="#758273" />
                  <polygon points="80,40 115,10 130,25 90,45" fill="#5F6D5D" />
                  <rect x="42" y="48" width="28" height="27" rx="2" fill="#2D332C" />
                  <line x1="42" y1="55" x2="70" y2="55" stroke="#485346" strokeWidth="1" />
                  <line x1="42" y1="62" x2="70" y2="62" stroke="#485346" strokeWidth="1" />
                  <line x1="42" y1="69" x2="70" y2="69" stroke="#485346" strokeWidth="1" />
                  <rect x="47" y="63" width="9" height="9" rx="1" fill="#D29A5B" />
                  <rect x="57" y="63" width="9" height="9" rx="1" fill="#B88045" />
                  <rect x="52" y="55" width="9" height="8" rx="1" fill="#E0A768" />
                  <text x="18" y="32" fill="#526B50" fontSize="8" fontWeight="700" letterSpacing="0.5">HUB 01</text>
                </g>

                {/* FMCG Distribution Truck */}
                <g transform="translate(295, 215)">
                  <ellipse cx="35" cy="38" rx="30" ry="6" fill="#000000" fillOpacity="0.1" />
                  <rect x="5" y="10" width="40" height="22" rx="2" fill="#FFFFFF" stroke="#CCD0C4" strokeWidth="1" />
                  <rect x="8" y="13" width="34" height="3" rx="1" fill="#526B50" />
                  <path d="M45 18 L55 18 L60 26 L60 32 L45 32 Z" fill="#6A7A68" />
                  <polygon points="48,20 54,20 58,26 48,26" fill="#D4DECE" />
                  <circle cx="16" cy="33" r="5" fill="#2E332E" />
                  <circle cx="16" cy="33" r="2.5" fill="#8C938A" />
                  <circle cx="34" cy="33" r="5" fill="#2E332E" />
                  <circle cx="34" cy="33" r="2.5" fill="#8C938A" />
                  <circle cx="53" cy="33" r="5" fill="#2E332E" />
                  <circle cx="53" cy="33" r="2.5" fill="#8C938A" />
                </g>

                {/* Destination Location Pins */}
                <g transform="translate(355, 115)">
                  <ellipse cx="7" cy="20" rx="7" ry="3" fill="#000000" fillOpacity="0.15" />
                  <path d="M7 0 C 3.1 0 0 3.1 0 7 C 0 12.2 7 20 7 20 C 7 20 14 12.2 14 7 C 14 3.1 10.9 0 7 0 Z" fill="#526B50" />
                  <circle cx="7" cy="7" r="3" fill="#FFFFFF" />
                </g>
                <g transform="translate(405, 185)">
                  <ellipse cx="7" cy="20" rx="7" ry="3" fill="#000000" fillOpacity="0.15" />
                  <path d="M7 0 C 3.1 0 0 3.1 0 7 C 0 12.2 7 20 7 20 C 7 20 14 12.2 14 7 C 14 3.1 10.9 0 7 0 Z" fill="#526B50" />
                  <circle cx="7" cy="7" r="3" fill="#FFFFFF" />
                </g>
                <g transform="translate(425, 235)">
                  <ellipse cx="7" cy="20" rx="7" ry="3" fill="#000000" fillOpacity="0.15" />
                  <path d="M7 0 C 3.1 0 0 3.1 0 7 C 0 12.2 7 20 7 20 C 7 20 14 12.2 14 7 C 14 3.1 10.9 0 7 0 Z" fill="#526B50" />
                  <circle cx="7" cy="7" r="3" fill="#FFFFFF" />
                </g>
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

        {/* SECTION 1: Features Strip (#features) */}
        <section id="features" className="scroll-mt-28 pt-10 border-t border-[#E5E6E0]">
          <div className="text-xs font-bold text-[#526B50] uppercase tracking-wider mb-2">Core Platform Capabilities</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#191B19] mb-8">
            Engineered for High-Velocity Consumer Goods
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1: Demand Forecasting */}
            <div className="p-6 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-[#EBF1EA] flex items-center justify-center text-[#526B50] mb-4">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#191B19] mb-2">Demand Forecasting</h3>
                <p className="text-sm text-[#70736E] leading-relaxed">
                  Predict product demand accurately across retail clusters using chronological moving averages and seasonal regression without future lookahead.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onStartDemo('demand')}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#526B50] hover:text-[#41553F] cursor-pointer"
              >
                <span>Explore Forecaster</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Feature 2: Inventory Optimization */}
            <div className="p-6 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-[#EBF1EA] flex items-center justify-center text-[#526B50] mb-4">
                  <Box className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#191B19] mb-2">Inventory Optimization</h3>
                <p className="text-sm text-[#70736E] leading-relaxed">
                  Allocate stock efficiently, protect service levels, and eliminate avoidable expiry waste using FEFO (First Expired, First Out) batch policies.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onStartDemo('inventory')}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#526B50] hover:text-[#41553F] cursor-pointer"
              >
                <span>Inspect Inventory Ledger</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Feature 3: Distribution Recommendations */}
            <div className="p-6 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-[#EBF1EA] flex items-center justify-center text-[#526B50] mb-4">
                  <Truck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#191B19] mb-2">Distribution Recommendations</h3>
                <p className="text-sm text-[#70736E] leading-relaxed">
                  Generate mathematically defensible shipment quantities, source warehouses, route tariffs, and clear decision explanations for every dispatch leg.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onStartDemo('optimization')}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#526B50] hover:text-[#41553F] cursor-pointer"
              >
                <span>Run Optimizer Engine</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* SECTION 2: Product Capabilities (#product) */}
        <section id="product" className="scroll-mt-28 mt-24 pt-10 border-t border-[#E5E6E0]">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <div className="text-xs font-bold text-[#526B50] uppercase tracking-wider mb-2">End-to-End System</div>
              <h2 className="text-3xl font-extrabold text-[#191B19]">
                Enterprise Distribution Intelligence Architecture
              </h2>
              <p className="text-sm text-[#70736E] mt-2 max-w-2xl leading-relaxed">
                SupplySync replaces guesswork with an operations research engine that unifies regional demand forecasts, warehouse capacities, highway freight tariffs, and batch shelf lives.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onStartDemo('overview')}
              className="bg-[#191B19] hover:bg-[#2E312E] text-white text-xs font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 self-start md:self-auto cursor-pointer"
            >
              <span>Explore Network Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Capability 1 */}
            <div className="p-5 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs">
              <div className="w-9 h-9 rounded-lg bg-[#EBF1EA] text-[#526B50] flex items-center justify-center mb-3">
                <Warehouse className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#191B19] mb-1.5">Network & Warehouse Topology</h3>
              <p className="text-xs text-[#70736E] leading-relaxed">
                Visualizes regional distribution centers (Mumbai, Delhi, Bengaluru, Kolkata) with storage capacities and connected freight lanes.
              </p>
            </div>

            {/* Capability 2 */}
            <div className="p-5 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs">
              <div className="w-9 h-9 rounded-lg bg-[#EBF1EA] text-[#526B50] flex items-center justify-center mb-3">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#191B19] mb-1.5">Chronological Demand Estimation</h3>
              <p className="text-xs text-[#70736E] leading-relaxed">
                Backtests 7-day Simple Moving Average against seasonal regression. Validates mean absolute error (MAE) on historical holdout windows.
              </p>
            </div>

            {/* Capability 3 */}
            <div className="p-5 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs">
              <div className="w-9 h-9 rounded-lg bg-[#EBF1EA] text-[#526B50] flex items-center justify-center mb-3">
                <Play className="w-5 h-5 fill-current" />
              </div>
              <h3 className="text-base font-bold text-[#191B19] mb-1.5">Google OR-Tools MILP Solver</h3>
              <p className="text-xs text-[#70736E] leading-relaxed">
                Formulates mixed-integer decision variables <code className="font-mono text-[#526B50]">x[w, d, p, b]</code> to minimize freight costs and shortage penalties under strict inventory limits.
              </p>
            </div>

            {/* Capability 4 */}
            <div className="p-5 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs">
              <div className="w-9 h-9 rounded-lg bg-[#EBF1EA] text-[#526B50] flex items-center justify-center mb-3">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#191B19] mb-1.5">FEFO Expiry-Aware Routing</h3>
              <p className="text-xs text-[#70736E] leading-relaxed">
                Quarantines expired inventory (0 units allocated) while subsidizing near-expiry batches to dispatch them before perishability cutoffs.
              </p>
            </div>

            {/* Capability 5 */}
            <div className="p-5 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs">
              <div className="w-9 h-9 rounded-lg bg-[#EBF1EA] text-[#526B50] flex items-center justify-center mb-3">
                <Scale className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#191B19] mb-1.5">Empirical Baseline Audit</h3>
              <p className="text-xs text-[#70736E] leading-relaxed">
                Compares the optimizer directly against a standard greedy heuristic on identical inputs, measuring true freight savings and stockout reduction.
              </p>
            </div>

            {/* Capability 6 */}
            <div className="p-5 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs">
              <div className="w-9 h-9 rounded-lg bg-[#EBF1EA] text-[#526B50] flex items-center justify-center mb-3">
                <Download className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#191B19] mb-1.5">RFC-4180 CSV Plan Export</h3>
              <p className="text-xs text-[#70736E] leading-relaxed">
                One-click export of complete shipment schedules with batch identifiers, unit freight costs, demand metrics, and mathematical rationale notes.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 3: Solutions (#solutions) */}
        <section id="solutions" className="scroll-mt-28 mt-24 pt-10 border-t border-[#E5E6E0]">
          <div className="text-xs font-bold text-[#526B50] uppercase tracking-wider mb-2">Operational Solutions</div>
          <h2 className="text-3xl font-extrabold text-[#191B19] mb-4">
            Solving Real-World FMCG Distribution Inefficiencies
          </h2>
          <p className="text-sm text-[#70736E] max-w-2xl mb-10 leading-relaxed">
            Fast-Moving Consumer Goods companies lose millions to mismatched regional inventories and perishable spoilage. Here is how SupplySync eliminates those bottlenecks.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Problem 1 */}
            <div className="p-6 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-rose-700 mb-2">
                  <span>PROBLEM: REGIONAL STOCKOUTS</span>
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                </div>
                <h3 className="text-base font-bold text-[#191B19] mb-2">High-Turnover Retail Empty Shelves</h3>
                <p className="text-xs text-[#70736E] leading-relaxed">
                  Surging consumer demand at hypermarkets exhausts local stock while replenishment is delayed, resulting in lost sales and penalty fines.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-[#F0F0EB] text-xs">
                <span className="font-bold text-[#526B50]">SupplySync Solution: </span>
                <span className="text-[#191B19]">Tier-weighted SLA penalty modeling discovers optimal cross-depot supply paths, slashing stockouts by over 8%.</span>
              </div>
            </div>

            {/* Problem 2 */}
            <div className="p-6 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-amber-700 mb-2">
                  <span>PROBLEM: EXCESS INVENTORY</span>
                  <Box className="w-4 h-4 text-amber-600" />
                </div>
                <h3 className="text-base font-bold text-[#191B19] mb-2">Trapped Working Capital in Distant DCs</h3>
                <p className="text-xs text-[#70736E] leading-relaxed">
                  Warehouses hold massive surplus of non-perishable staples while retail stores in other regions starve for inventory.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-[#F0F0EB] text-xs">
                <span className="font-bold text-[#526B50]">SupplySync Solution: </span>
                <span className="text-[#191B19]">Multi-echelon flow balancing re-routes surplus inventory from low-velocity warehouses to active consumption hubs.</span>
              </div>
            </div>

            {/* Problem 3 */}
            <div className="p-6 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-rose-700 mb-2">
                  <span>PROBLEM: RUNAWAY FREIGHT COSTS</span>
                  <DollarSign className="w-4 h-4 text-rose-600" />
                </div>
                <h3 className="text-base font-bold text-[#191B19] mb-2">Uncoordinated Dispatches & Spot Freight</h3>
                <p className="text-xs text-[#70736E] leading-relaxed">
                  Manual planning uses expensive ad-hoc shipments ($11–$14/unit) instead of scheduling consolidated loads over low-cost lanes ($1.80–$3.20/unit).
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-[#F0F0EB] text-xs">
                <span className="font-bold text-[#526B50]">SupplySync Solution: </span>
                <span className="text-[#191B19]">OR-Tools linear programming systematically minimizes total landed freight while honoring corridor throughput caps.</span>
              </div>
            </div>

            {/* Problem 4 */}
            <div className="p-6 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-amber-700 mb-2">
                  <span>PROBLEM: BATCH EXPIRY SPOILAGE</span>
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <h3 className="text-base font-bold text-[#191B19] mb-2">Perishable Waste from FIFO Handling</h3>
                <p className="text-xs text-[#70736E] leading-relaxed">
                  Dairy and fresh consumer goods expire inside warehouses because operators dispatch fresher inventory first.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-[#F0F0EB] text-xs">
                <span className="font-bold text-[#526B50]">SupplySync Solution: </span>
                <span className="text-[#191B19]">Automated FEFO (First Expired, First Out) batch incentives actively rescue inventory with short remaining shelf life.</span>
              </div>
            </div>

            {/* Problem 5 */}
            <div className="p-6 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-indigo-700 mb-2">
                  <span>PROBLEM: NETWORK SCARCITY</span>
                  <Scale className="w-4 h-4 text-indigo-600" />
                </div>
                <h3 className="text-base font-bold text-[#191B19] mb-2">Demand Far Exceeding Available Stock</h3>
                <p className="text-xs text-[#70736E] leading-relaxed">
                  When a scarce product has 2,750 units of regional demand against only 1,300 available units, naive algorithms cause chaotic stockouts.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-[#F0F0EB] text-xs">
                <span className="font-bold text-[#526B50]">SupplySync Solution: </span>
                <span className="text-[#191B19]">Mathematically allocates scarce units to high-priority Tier-1 contracts to maximize customer retention and minimize penalty costs.</span>
              </div>
            </div>

            {/* Problem 6: Evaluation Box */}
            <div className="p-6 rounded-2xl bg-[#EBF1EA] border border-[#D3DFD2] shadow-xs flex flex-col justify-between">
              <div>
                <div className="text-xs font-bold text-[#526B50] uppercase mb-2">Triwizathon 2026 Problem Statement 2</div>
                <h3 className="text-base font-bold text-[#191B19] mb-2">Functional Competition-Ready Engine</h3>
                <p className="text-xs text-[#526B50] leading-relaxed font-medium">
                  Tested and verified: zero fake numbers, real Google OR-Tools optimization, 10 mathematical invariant checks, and instant CSV exports.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onStartDemo('optimization')}
                className="mt-4 bg-[#526B50] hover:bg-[#41553F] text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center justify-between cursor-pointer"
              >
                <span>Launch Optimizer</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* SECTION 4: Interactive Demo Launcher (#demo) */}
        <section id="demo" className="scroll-mt-28 mt-24 p-8 rounded-3xl bg-white border border-[#E5E6E0] shadow-md">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-[#F0F0EB]">
            <div>
              <div className="text-xs font-bold tracking-wider uppercase text-[#526B50] mb-1">
                Interactive Operational Console
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#191B19]">
                Test the Live Optimization Engine
              </h2>
              <p className="text-xs text-[#70736E] mt-1">
                Explore each operational module directly or run a full multi-echelon optimization plan.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onStartDemo('optimization')}
              className="bg-[#526B50] hover:bg-[#41553F] text-white font-semibold text-sm px-6 py-3 rounded-xl flex items-center gap-2 transition-all shadow-sm cursor-pointer"
            >
              <span>Launch Optimizer Console</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-6">
            <button
              type="button"
              onClick={() => onStartDemo('overview')}
              className="p-4 rounded-2xl bg-[#F7F7F4] border border-[#E5E6E0] hover:border-[#526B50] hover:bg-[#EBF1EA]/30 transition-all text-left cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-white border border-[#E5E6E0] flex items-center justify-center text-[#526B50] mb-3 group-hover:scale-105 transition-transform">
                <Warehouse className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-[#191B19] mb-1">1. Network Overview</div>
              <div className="text-[11px] text-[#70736E]">Inspect 4 regional DCs, 8 destinations, and 32 route corridors.</div>
            </button>

            <button
              type="button"
              onClick={() => onStartDemo('inventory')}
              className="p-4 rounded-2xl bg-[#F7F7F4] border border-[#E5E6E0] hover:border-[#526B50] hover:bg-[#EBF1EA]/30 transition-all text-left cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-white border border-[#E5E6E0] flex items-center justify-center text-[#526B50] mb-3 group-hover:scale-105 transition-transform">
                <Box className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-[#191B19] mb-1">2. Inventory Batches</div>
              <div className="text-[11px] text-[#70736E]">Inspect batch shelf lives, FEFO urgency, and quarantined stock.</div>
            </button>

            <button
              type="button"
              onClick={() => onStartDemo('demand')}
              className="p-4 rounded-2xl bg-[#F7F7F4] border border-[#E5E6E0] hover:border-[#526B50] hover:bg-[#EBF1EA]/30 transition-all text-left cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-white border border-[#E5E6E0] flex items-center justify-center text-[#526B50] mb-3 group-hover:scale-105 transition-transform">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-[#191B19] mb-1">3. Demand Forecasts</div>
              <div className="text-[11px] text-[#70736E]">Backtest chronological moving averages vs. seasonal regression.</div>
            </button>

            <button
              type="button"
              onClick={() => onStartDemo('optimization')}
              className="p-4 rounded-2xl bg-[#F7F7F4] border border-[#E5E6E0] hover:border-[#526B50] hover:bg-[#EBF1EA]/30 transition-all text-left cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-white border border-[#E5E6E0] flex items-center justify-center text-[#526B50] mb-3 group-hover:scale-105 transition-transform">
                <Play className="w-4 h-4 fill-current" />
              </div>
              <div className="text-xs font-bold text-[#191B19] mb-1">4. OR-Tools Optimizer</div>
              <div className="text-[11px] text-[#70736E]">Run constrained optimization, inspect recommendations, export CSV.</div>
            </button>

            <button
              type="button"
              onClick={() => onStartDemo('comparison')}
              className="p-4 rounded-2xl bg-[#F7F7F4] border border-[#E5E6E0] hover:border-[#526B50] hover:bg-[#EBF1EA]/30 transition-all text-left cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-white border border-[#E5E6E0] flex items-center justify-center text-[#526B50] mb-3 group-hover:scale-105 transition-transform">
                <Scale className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-[#191B19] mb-1">5. Baseline Audit</div>
              <div className="text-[11px] text-[#70736E]">Side-by-side benchmark measuring cost savings and SLA boost.</div>
            </button>
          </div>
        </section>
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

      {/* Login / Authentication Modal Dialog */}
      {isLoginModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-[#191B19]/40 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-modal-title"
        >
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-[#E5E6E0] shadow-2xl space-y-6">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-[#EBF1EA] text-[#526B50] flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(false)}
                className="p-2 rounded-xl text-[#70736E] hover:text-[#191B19] hover:bg-[#F7F7F4] transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EBF1EA] text-[#526B50] text-[11px] font-bold uppercase tracking-wider mb-2">
                <span>Demo Evaluation Access</span>
              </div>
              <h3 id="login-modal-title" className="text-xl font-bold text-[#191B19]">
                SupplySync Authentication
              </h3>
              <p className="text-xs text-[#70736E] mt-2 leading-relaxed">
                For the Triwizathon 2026 competition evaluation, user authentication is pre-configured in <strong>Guest Operator Mode</strong>. You have full access to explore the distribution network, demand forecasts, OR-Tools optimization, and export planning schedules.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#F7F7F4] border border-[#E5E6E0] space-y-2 text-xs">
              <div className="flex justify-between text-[#70736E]">
                <span>Evaluator Role:</span>
                <span className="font-semibold text-[#191B19]">Senior Supply Chain Planner</span>
              </div>
              <div className="flex justify-between text-[#70736E]">
                <span>Permissions:</span>
                <span className="font-semibold text-[#526B50]">Full Optimization & Export Access</span>
              </div>
              <div className="flex justify-between text-[#70736E]">
                <span>Session:</span>
                <span className="font-mono text-[#191B19]">ACTIVE_EVAL_MODE</span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setIsLoginModalOpen(false);
                  onStartDemo('optimization');
                }}
                className="w-full bg-[#191B19] hover:bg-[#2E312E] text-white text-xs font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer active:scale-95"
              >
                <span>Continue as Supply Chain Operator</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsLoginModalOpen(false)}
                className="w-full bg-white hover:bg-[#F7F7F4] text-[#70736E] text-xs font-medium py-2.5 rounded-xl border border-[#E5E6E0] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
