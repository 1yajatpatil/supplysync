import React, { useState, useEffect } from 'react';
import { LandingPage } from './components/LandingPage';
import { PlanningWizard } from './components/PlanningWizard';
import { NetworkOverview } from './components/NetworkOverview';
import { InventoryManager } from './components/InventoryManager';
import { DemandForecaster } from './components/DemandForecaster';
import { OptimizationConsole } from './components/OptimizationConsole';
import { ComparisonAuditView } from './components/ComparisonAuditView';
import { AuthModal } from './components/AuthModal';
import { UserProfileMenu } from './components/UserProfileMenu';
import { useAuth } from './context/AuthContext';
import { 
  Box, 
  ArrowLeft,
  Plus
} from 'lucide-react';
import { 
  fetchMasterData, 
  fetchDatasetStatus,
  Product, 
  Warehouse as WarehouseType, 
  Destination, 
  InventoryBatch, 
  Route, 
  DemandRecord,
  DatasetStatus
} from './api';

export function App() {
  const { requireAuth } = useAuth();
  const [currentView, setCurrentView] = useState<'landing' | 'wizard' | 'app'>('landing');
  const [activeTab, setActiveTab] = useState<'overview' | 'inventory' | 'demand' | 'optimization' | 'comparison'>('overview');

  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [demand, setDemand] = useState<DemandRecord[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [datasetStatus, setDatasetStatus] = useState<DatasetStatus | null>(null);

  useEffect(() => {
    async function loadStatus() {
      try {
        const status = await fetchDatasetStatus();
        setDatasetStatus(status);
      } catch (err: any) {
        console.warn('Dataset status retrieval error:', err);
      }
    }
    loadStatus();
  }, []);

  useEffect(() => {
    async function loadData() {
      setLoadingData(true);
      setErrorMessage(null);
      try {
        const data = await fetchMasterData('m5', 7);
        setProducts(data.products || []);
        setWarehouses(data.warehouses || []);
        setDestinations(data.destinations || []);
        setBatches(data.batches || []);
        setRoutes(data.routes || []);
        setDemand(data.demand || []);
      } catch (e: any) {
        console.error("Failed to load Real M5 master data", e);
        setErrorMessage(e.message || "Failed to connect to backend engine for Real M5 data.");
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, []);

  if (currentView === 'landing') {
    return (
      <>
        <LandingPage 
          onGetStarted={() => {
            requireAuth(() => {
              setCurrentView('wizard');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            });
          }}
          onStartDemo={(tab) => {
            requireAuth(() => {
              if (tab) setActiveTab(tab);
              setCurrentView('app');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            });
          }}
          onExploreFeatures={() => {
            const el = document.getElementById('features');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
        />
        <AuthModal />
      </>
    );
  }

  if (currentView === 'wizard') {
    return (
      <>
        <PlanningWizard
          onCancel={() => {
            setCurrentView('landing');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onOpenAdvancedDashboard={(_plan) => {
            setActiveTab('optimization');
            setCurrentView('app');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          m5Data={{
            products,
            warehouses,
            destinations,
            batches,
            routes,
            demand
          }}
        />
        <AuthModal />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F4] text-[#191B19] flex flex-col font-sans">
      <AuthModal />
      {/* Top Application Header */}
      <header className="sticky top-0 z-40 bg-[#F7F7F4]/95 backdrop-blur-md border-b border-[#E5E6E0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentView('landing')}
              className="flex items-center gap-1.5 text-xs font-medium text-[#70736E] hover:text-[#191B19] transition-colors px-2.5 py-1 rounded-lg border border-[#E5E6E0] bg-white cursor-pointer hover:border-[#D0D2C8] shrink-0"
              title="Return to public landing page"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </button>

            <button
              onClick={() => {
                requireAuth(() => setCurrentView('wizard'));
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#526B50] hover:text-[#41553F] transition-colors px-2.5 py-1 rounded-lg border border-[#D3DFD2] bg-[#EBF1EA] cursor-pointer shrink-0"
              title="Start a new planning run or upload custom data"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Planning Run</span>
            </button>

            <div className="h-4 w-px bg-[#E5E6E0] hidden sm:block" />

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-[#526B50] flex items-center justify-center text-white shadow-xs shrink-0">
                <Box className="w-4 h-4" />
              </div>
              <span className="font-bold tracking-tight text-base text-[#191B19]">SupplySync</span>
              <span className="hidden md:inline-block text-[10px] px-2 py-0.5 rounded-full bg-[#EBF1EA] text-[#526B50] font-semibold border border-[#D3DFD2]">
                Triwizathon 2026 • PS2
              </span>
            </div>
          </div>

          {/* Tab Navigation Switcher */}
          <div className="hidden lg:flex items-center gap-1 bg-[#EBECE6] p-1 rounded-lg text-xs font-medium border border-[#E5E6E0]">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                activeTab === 'overview' ? 'bg-white text-[#191B19] shadow-xs font-semibold' : 'text-[#70736E] hover:text-[#191B19]'
              }`}
            >
              Network Overview
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                activeTab === 'inventory' ? 'bg-white text-[#191B19] shadow-xs font-semibold' : 'text-[#70736E] hover:text-[#191B19]'
              }`}
            >
              Inventory Batches
            </button>
            <button
              onClick={() => setActiveTab('demand')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                activeTab === 'demand' ? 'bg-white text-[#191B19] shadow-xs font-semibold' : 'text-[#70736E] hover:text-[#191B19]'
              }`}
            >
              Demand Forecasts
            </button>
            <button
              onClick={() => setActiveTab('optimization')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                activeTab === 'optimization' ? 'bg-white text-[#191B19] shadow-xs font-semibold' : 'text-[#70736E] hover:text-[#191B19]'
              }`}
            >
              Distribution Engine
            </button>
            <button
              onClick={() => setActiveTab('comparison')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                activeTab === 'comparison' ? 'bg-white text-[#191B19] shadow-xs font-semibold' : 'text-[#70736E] hover:text-[#191B19]'
              }`}
            >
              Baseline Audit
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Real M5 Kaggle Dataset Badge */}
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-800 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              <span>REAL M5 KAGGLE DATA</span>
            </div>

            {datasetStatus && (
              <span className="hidden xl:inline-flex items-center gap-1 text-[11px] text-[#70736E] bg-white border border-[#E5E6E0] px-2 py-0.5 rounded-full" title="Walmart historical retail sales dataset">
                <span>{datasetStatus.active_source === 'sample' ? 'Walmart Historical Sample (90D)' : 'Walmart Full Dataset'}</span>
              </span>
            )}

            {/* Solver Status Pill */}
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-[#526B50] font-semibold bg-white border border-[#E5E6E0] px-2.5 py-1 rounded-full shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#526B50] animate-pulse" />
              <span>OR-Tools MILP Online</span>
            </span>

            {/* Authenticated User Menu */}
            <UserProfileMenu />
          </div>
        </div>
        {loadingData && (
          <div className="h-0.5 w-full bg-[#EBF1EA] overflow-hidden">
            <div className="h-full bg-[#526B50] animate-pulse w-full" />
          </div>
        )}
      </header>

      {/* Mobile Tab Navigation */}
      <div className="lg:hidden bg-white border-b border-[#E5E6E0] px-4 py-1.5 flex items-center gap-1.5 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1 rounded-md shrink-0 transition-colors ${activeTab === 'overview' ? 'bg-[#526B50] text-white font-semibold' : 'text-[#70736E] bg-[#F7F7F4] border border-[#E5E6E0]'}`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-3 py-1 rounded-md shrink-0 transition-colors ${activeTab === 'inventory' ? 'bg-[#526B50] text-white font-semibold' : 'text-[#70736E] bg-[#F7F7F4] border border-[#E5E6E0]'}`}
        >
          Inventory
        </button>
        <button
          onClick={() => setActiveTab('demand')}
          className={`px-3 py-1 rounded-md shrink-0 transition-colors ${activeTab === 'demand' ? 'bg-[#526B50] text-white font-semibold' : 'text-[#70736E] bg-[#F7F7F4] border border-[#E5E6E0]'}`}
        >
          Demand
        </button>
        <button
          onClick={() => setActiveTab('optimization')}
          className={`px-3 py-1 rounded-md shrink-0 transition-colors ${activeTab === 'optimization' ? 'bg-[#526B50] text-white font-semibold' : 'text-[#70736E] bg-[#F7F7F4] border border-[#E5E6E0]'}`}
        >
          Distribution
        </button>
        <button
          onClick={() => setActiveTab('comparison')}
          className={`px-3 py-1 rounded-md shrink-0 transition-colors ${activeTab === 'comparison' ? 'bg-[#526B50] text-white font-semibold' : 'text-[#70736E] bg-[#F7F7F4] border border-[#E5E6E0]'}`}
        >
          Audit
        </button>
      </div>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full">
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center justify-between">
            <div>
              <p className="font-semibold">Backend Connection Issue</p>
              <p className="text-xs text-red-700 mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

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
            dataSource="m5"
          />
        )}

        {activeTab === 'optimization' && (
          <OptimizationConsole
            products={products}
            warehouses={warehouses}
            destinations={destinations}
            dataSource="m5"
            onNavigateToComparison={() => setActiveTab('comparison')}
          />
        )}

        {activeTab === 'comparison' && (
          <ComparisonAuditView 
            dataSource="m5"
          />
        )}
      </main>
    </div>
  );
}

export default App;
