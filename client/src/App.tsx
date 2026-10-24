import React, { useState, useEffect } from 'react';
import { LandingPage } from './components/LandingPage';
import { NetworkOverview } from './components/NetworkOverview';
import { InventoryManager } from './components/InventoryManager';
import { DemandForecaster } from './components/DemandForecaster';
import { OptimizationConsole } from './components/OptimizationConsole';
import { ComparisonAuditView } from './components/ComparisonAuditView';
import { 
  Box, 
  ArrowLeft, 
  Play, 
  Warehouse, 
  Store, 
  Truck, 
  BarChart3, 
  Scale, 
  Layers,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { 
  fetchMasterData, 
  Product, 
  Warehouse as WarehouseType, 
  Destination, 
  InventoryBatch, 
  Route, 
  DemandRecord 
} from './api';

export function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'app'>('landing');
  const [activeTab, setActiveTab] = useState<'overview' | 'inventory' | 'demand' | 'optimization' | 'comparison'>('overview');

  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [demand, setDemand] = useState<DemandRecord[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  useEffect(() => {
    async function loadData() {
      setLoadingData(true);
      try {
        const data = await fetchMasterData();
        setProducts(data.products);
        setWarehouses(data.warehouses);
        setDestinations(data.destinations);
        setBatches(data.batches);
        setRoutes(data.routes);
        setDemand(data.demand);
      } catch (e) {
        console.error("Failed to load master data", e);
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, []);

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
              className="flex items-center gap-1.5 text-xs font-semibold text-[#70736E] hover:text-[#191B19] transition-colors px-3 py-1.5 rounded-xl border border-[#E5E6E0] bg-white cursor-pointer hover:border-[#D0D2C8]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </button>

            <div className="h-4 w-px bg-[#E5E6E0]" />

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#526B50] flex items-center justify-center text-white shadow-xs">
                <Box className="w-4 h-4" />
              </div>
              <span className="font-bold tracking-tight text-lg">SupplySync</span>
              <span className="hidden sm:inline-block text-[11px] px-2 py-0.5 rounded-full bg-[#EBF1EA] text-[#526B50] font-semibold border border-[#D3DFD2]">
                Triwizathon 2026 PS2
              </span>
            </div>
          </div>

          {/* Tab Navigation Switcher */}
          <div className="hidden lg:flex items-center gap-1 bg-[#EBECE6] p-1 rounded-xl text-xs font-medium">
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
            <span className="inline-flex items-center gap-1.5 text-xs text-[#526B50] font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#526B50] animate-pulse" />
              <span>OR-Tools MIP Online</span>
            </span>
          </div>
        </div>
      </header>

      {/* Mobile Tab Navigation */}
      <div className="lg:hidden bg-white border-b border-[#E5E6E0] px-4 py-2 flex items-center gap-2 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1.5 rounded-lg shrink-0 ${activeTab === 'overview' ? 'bg-[#526B50] text-white font-bold' : 'text-[#70736E]'}`}
        >
          Network Overview
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-3 py-1.5 rounded-lg shrink-0 ${activeTab === 'inventory' ? 'bg-[#526B50] text-white font-bold' : 'text-[#70736E]'}`}
        >
          Inventory Batches
        </button>
        <button
          onClick={() => setActiveTab('demand')}
          className={`px-3 py-1.5 rounded-lg shrink-0 ${activeTab === 'demand' ? 'bg-[#526B50] text-white font-bold' : 'text-[#70736E]'}`}
        >
          Demand Forecasts
        </button>
        <button
          onClick={() => setActiveTab('optimization')}
          className={`px-3 py-1.5 rounded-lg shrink-0 ${activeTab === 'optimization' ? 'bg-[#526B50] text-white font-bold' : 'text-[#70736E]'}`}
        >
          Distribution Engine
        </button>
        <button
          onClick={() => setActiveTab('comparison')}
          className={`px-3 py-1.5 rounded-lg shrink-0 ${activeTab === 'comparison' ? 'bg-[#526B50] text-white font-bold' : 'text-[#70736E]'}`}
        >
          Baseline Audit
        </button>
      </div>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full">
        {activeTab === 'overview' && (
          <NetworkOverview
            warehouses={warehouses}
            destinations={destinations}
            routes={routes}
            products={products}
            onNavigateToOptimizer={() => setActiveTab('optimization')}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryManager
            batches={batches}
            products={products}
            warehouses={warehouses}
          />
        )}

        {activeTab === 'demand' && (
          <DemandForecaster
            products={products}
            destinations={destinations}
            demandRecords={demand}
          />
        )}

        {activeTab === 'optimization' && (
          <OptimizationConsole
            products={products}
            warehouses={warehouses}
            destinations={destinations}
            onNavigateToComparison={() => setActiveTab('comparison')}
          />
        )}

        {activeTab === 'comparison' && (
          <ComparisonAuditView />
        )}
      </main>
    </div>
  );
}

export default App;
