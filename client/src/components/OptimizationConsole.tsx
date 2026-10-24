import React, { useState, useEffect, useMemo } from 'react';
import { 
  Play, 
  RotateCcw, 
  Download, 
  Clock, 
  Sparkles,
  ArrowRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  ShieldCheck,
  Package,
  Eye,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Database,
  Info
} from 'lucide-react';
import { 
  OptimizationPlan, 
  ShipmentRecommendation,
  runBaselinePlan, 
  runOptimizedPlan, 
  Product, 
  Warehouse, 
  Destination 
} from '../api';

interface OptimizationConsoleProps {
  products: Product[];
  warehouses: Warehouse[];
  destinations: Destination[];
  dataSource?: 'synthetic' | 'm5';
  onDataSourceChange?: (source: 'synthetic' | 'm5') => void;
  onPlanGenerated?: (plan: OptimizationPlan) => void;
  onNavigateToComparison?: () => void;
}

export const OptimizationConsole: React.FC<OptimizationConsoleProps> = ({
  products,
  warehouses,
  destinations,
  dataSource = 'synthetic',
  onDataSourceChange,
  onPlanGenerated,
  onNavigateToComparison
}) => {
  const [horizonDays, setHorizonDays] = useState<number>(7);
  const [currentPlan, setCurrentPlan] = useState<OptimizationPlan | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeStrategy, setActiveStrategy] = useState<'baseline' | 'optimized_ortools'>('optimized_ortools');
  
  // Table filters & sorting
  const [filterWh, setFilterWh] = useState<string>('all');
  const [filterDest, setFilterDest] = useState<string>('all');
  const [filterProd, setFilterProd] = useState<string>('all');
  const [filterExpiry, setFilterExpiry] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'default' | 'earliest_expiry' | 'highest_cost' | 'largest_qty'>('default');
  
  // Side Panel Drawer
  const [selectedRecommendation, setSelectedRecommendation] = useState<ShipmentRecommendation | null>(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const rowsPerPage = 12;

  // Execution feedback
  const [executionStatus, setExecutionStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleRunOptimizer = async (targetHorizon = horizonDays, targetSource = dataSource) => {
    setLoading(true);
    setExecutionStatus(null);
    try {
      const plan = await runOptimizedPlan(targetHorizon, targetSource);
      setCurrentPlan(plan);
      setActiveStrategy('optimized_ortools');
      setCurrentPage(1);
      if (onPlanGenerated) onPlanGenerated(plan);
      setExecutionStatus({
        type: 'success',
        message: `OR-Tools MIP completed in ${plan.metrics.solver_runtime_ms}ms with ${plan.metrics.fulfillment_rate_pct}% fulfillment on ${targetSource === 'm5' ? 'Real M5' : 'Synthetic FMCG'} data (${targetHorizon}D horizon).`
      });
    } catch (err: unknown) {
      console.error(err);
      setExecutionStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Optimization engine failed to execute. Check local service connection.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRunBaseline = async () => {
    setLoading(true);
    setExecutionStatus(null);
    try {
      const plan = await runBaselinePlan(horizonDays, dataSource);
      setCurrentPlan(plan);
      setActiveStrategy('baseline');
      setCurrentPage(1);
      if (onPlanGenerated) onPlanGenerated(plan);
      setExecutionStatus({
        type: 'success',
        message: `Greedy heuristic baseline computed in ${plan.metrics.solver_runtime_ms}ms with ${plan.metrics.fulfillment_rate_pct}% fulfillment on ${dataSource === 'm5' ? 'Real M5' : 'Synthetic FMCG'} data (${horizonDays}D horizon).`
      });
    } catch (err: unknown) {
      console.error(err);
      setExecutionStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Baseline computation failed. Check service connection.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Re-run optimizer when data source changes
  useEffect(() => {
    handleRunOptimizer(horizonDays, dataSource);
  }, [dataSource]);

  // Handle Horizon change
  const handleHorizonChange = (h: number) => {
    setHorizonDays(h);
    handleRunOptimizer(h, dataSource);
  };

  // Filtered & Sorted Recommendations
  const processedRecs = useMemo(() => {
    let recs = (currentPlan?.recommendations || []).filter(r => {
      if (filterWh !== 'all' && r.source_warehouse_id !== filterWh) return false;
      if (filterDest !== 'all' && r.destination_id !== filterDest) return false;
      if (filterProd !== 'all' && r.product_id !== filterProd) return false;
      if (filterExpiry === 'near_expiry' && !(r.batch_days_to_expiry > 0 && r.batch_days_to_expiry <= 15)) return false;
      if (filterExpiry === 'healthy' && r.batch_days_to_expiry <= 15) return false;
      return true;
    });

    if (sortBy === 'earliest_expiry') {
      recs = [...recs].sort((a, b) => a.batch_days_to_expiry - b.batch_days_to_expiry);
    } else if (sortBy === 'highest_cost') {
      recs = [...recs].sort((a, b) => b.total_transport_cost - a.total_transport_cost);
    } else if (sortBy === 'largest_qty') {
      recs = [...recs].sort((a, b) => b.allocated_quantity - a.allocated_quantity);
    }

    return recs;
  }, [currentPlan, filterWh, filterDest, filterProd, filterExpiry, sortBy]);

  const totalPages = Math.max(1, Math.ceil(processedRecs.length / rowsPerPage));
  const paginatedRecs = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return processedRecs.slice(start, start + rowsPerPage);
  }, [processedRecs, currentPage]);

  const hasActiveFilters = filterWh !== 'all' || filterDest !== 'all' || filterProd !== 'all' || filterExpiry !== 'all' || sortBy !== 'default';

  const resetFilters = () => {
    setFilterWh('all');
    setFilterDest('all');
    setFilterProd('all');
    setFilterExpiry('all');
    setSortBy('default');
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    if (!currentPlan) return;
    const targetRecs = processedRecs.length > 0 ? processedRecs : currentPlan.recommendations;
    const rows = [
      ["Run ID", "Strategy", "Data Source", "Horizon Days", "Recommendation ID", "Product ID", "Product Name", "Source WH ID", "Source WH Name", "Destination ID", "Destination Name", "Batch ID", "Batch Days to Expiry", "Allocated Qty", "Unit Cost ($)", "Total Cost ($)", "Destination Demand", "Rationale", "Constraints Honored"]
    ];

    targetRecs.forEach(r => {
      rows.push([
        currentPlan.run_id,
        currentPlan.strategy,
        dataSource,
        currentPlan.planning_horizon_days.toString(),
        r.recommendation_id,
        r.product_id,
        `"${r.product_name}"`,
        r.source_warehouse_id,
        `"${r.source_warehouse_name}"`,
        r.destination_id,
        `"${r.destination_name}"`,
        r.batch_id,
        r.batch_days_to_expiry.toString(),
        r.allocated_quantity.toString(),
        r.unit_transport_cost.toFixed(2),
        r.total_transport_cost.toFixed(2),
        r.destination_demand.toString(),
        `"${r.rationale.replace(/"/g, '""')}"`,
        `"${r.constraints_honored.join('; ')}"`
      ]);
    });

    const csvContent = rows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `supplysync_${dataSource}_${currentPlan.strategy}_${currentPlan.run_id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculated shortage aggregates
  const shortageStats = useMemo(() => {
    if (!currentPlan || !currentPlan.shortages) {
      return { count: 0, unmetUnits: 0, highCount: 0 };
    }
    const count = currentPlan.shortages.length;
    const unmetUnits = currentPlan.shortages.reduce((sum, s) => sum + s.unmet_quantity, 0);
    const highCount = currentPlan.shortages.filter(s => s.criticality === 'High').length;
    return { count, unmetUnits, highCount };
  }, [currentPlan]);

  return (
    <div className="space-y-5 relative">
      {/* 1. DISTRIBUTION PLANNING TOOLBAR WITH DATA SOURCE & HORIZON CONTROLS */}
      <div className="p-4 sm:p-5 rounded-xl bg-white border border-[#E5E6E0] shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#70736E]">
                Distribution Planning
              </span>
              <span className="w-1 h-1 rounded-full bg-[#E5E6E0]" />
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#526B50] bg-[#EBF1EA] px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3" />
                <span>OR-Tools SCIP MILP Solver</span>
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-[#191B19] tracking-tight">
              Distribution Optimization
            </h2>
            <p className="text-xs text-[#70736E] mt-0.5 max-w-2xl leading-relaxed">
              Allocates inventory across multi-echelon network nodes subject to demand forecasts, route capacity, freight tariffs, and FEFO expiry constraints.
            </p>
          </div>

          {/* Controls toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Data Source Switcher */}
            {onDataSourceChange && (
              <div className="flex items-center gap-1 bg-[#F7F7F4] border border-[#E5E6E0] p-1 rounded-lg text-xs font-medium">
                <span className="text-[10px] uppercase font-bold text-[#70736E] px-2 hidden sm:inline flex items-center gap-1">
                  <Database className="w-3 h-3 text-[#526B50]" />
                  <span>Data:</span>
                </span>
                <button
                  onClick={() => onDataSourceChange('synthetic')}
                  disabled={loading}
                  className={`px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                    dataSource === 'synthetic'
                      ? 'bg-white text-[#191B19] shadow-xs font-semibold'
                      : 'text-[#70736E] hover:text-[#191B19]'
                  }`}
                  title="Deterministic FMCG Indian multi-echelon network"
                >
                  Synthetic FMCG
                </button>
                <button
                  onClick={() => onDataSourceChange('m5')}
                  disabled={loading}
                  className={`px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                    dataSource === 'm5'
                      ? 'bg-white text-[#526B50] shadow-xs font-semibold'
                      : 'text-[#70736E] hover:text-[#191B19]'
                  }`}
                  title="Official Walmart M5 competition dataset"
                >
                  Real M5 Kaggle
                </button>
              </div>
            )}

            {/* Horizon selector */}
            <div className="flex items-center gap-1 bg-[#F7F7F4] border border-[#E5E6E0] p-1 rounded-lg text-xs font-medium">
              <span className="text-[10px] uppercase font-bold text-[#70736E] px-2 hidden sm:inline">
                Horizon
              </span>
              {[7, 14, 30].map(h => (
                <button
                  key={h}
                  onClick={() => handleHorizonChange(h)}
                  disabled={loading}
                  className={`px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                    horizonDays === h 
                      ? 'bg-white text-[#191B19] shadow-xs font-semibold' 
                      : 'text-[#70736E] hover:text-[#191B19]'
                  }`}
                  title={`Optimize allocations for ${h}-day forecast window`}
                >
                  {h}D
                </button>
              ))}
            </div>

            {/* Run Baseline */}
            <button
              onClick={handleRunBaseline}
              disabled={loading}
              className={`h-9 px-3.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeStrategy === 'baseline'
                  ? 'bg-[#F2F4F1] border-[#526B50] text-[#191B19]'
                  : 'bg-white border-[#E5E6E0] text-[#70736E] hover:text-[#191B19] hover:border-[#D0D2C8]'
              } disabled:opacity-50`}
              title="Execute greedy demand-priority baseline"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Run Baseline</span>
            </button>

            {/* Run Optimizer */}
            <button
              onClick={() => handleRunOptimizer(horizonDays, dataSource)}
              disabled={loading}
              className="h-9 px-4 rounded-lg bg-[#526B50] hover:bg-[#41553F] text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-xs cursor-pointer active:scale-98 disabled:opacity-50 shrink-0"
              title="Solve Mixed-Integer Linear Program using Google OR-Tools"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Optimizing...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run OR-Tools Optimizer</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status notification banner if available */}
        {executionStatus && (
          <div className={`mt-3 px-3 py-2 rounded-lg text-xs flex items-center justify-between border ${
            executionStatus.type === 'success' 
              ? 'bg-[#EBF1EA]/60 border-[#D3DFD2] text-[#41553F]' 
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <div className="flex items-center gap-2">
              {executionStatus.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-[#526B50] shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{executionStatus.message}</span>
            </div>
            <button 
              onClick={() => setExecutionStatus(null)}
              className="text-[#70736E] hover:text-[#191B19] cursor-pointer ml-2"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 2. STANDARDIZED 5-CARD KPI METRIC SUMMARY STRIP */}
      {currentPlan && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* 1. Demand Fulfillment Rate */}
          <div className="p-3.5 rounded-xl bg-white border border-[#E5E6E0] shadow-2xs flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-semibold text-[#70736E] uppercase tracking-wider">
                Fulfillment Rate
              </div>
              <div className="text-xl sm:text-2xl font-bold text-[#191B19] mt-1 tracking-tight">
                {currentPlan.metrics.fulfillment_rate_pct}%
              </div>
            </div>
            <div className="text-[11px] text-[#526B50] mt-1 flex items-center gap-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#526B50]" />
              <span>
                {currentPlan.metrics.total_fulfilled_units.toLocaleString()} / {currentPlan.metrics.total_demand_units.toLocaleString()} units
              </span>
            </div>
          </div>

          {/* 2. Total Freight Cost */}
          <div className="p-3.5 rounded-xl bg-white border border-[#E5E6E0] shadow-2xs flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-semibold text-[#70736E] uppercase tracking-wider">
                Transportation Cost
              </div>
              <div className="text-xl sm:text-2xl font-bold text-[#191B19] mt-1 tracking-tight">
                ${currentPlan.metrics.total_transport_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="text-[11px] text-[#70736E] mt-1">
              Avg ${currentPlan.metrics.avg_unit_transport_cost.toFixed(2)} / unit delivered
            </div>
          </div>

          {/* 3. Unmet Demand */}
          <div className="p-3.5 rounded-xl bg-white border border-[#E5E6E0] shadow-2xs flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-semibold text-[#70736E] uppercase tracking-wider">
                Unmet Demand
              </div>
              <div className="text-xl sm:text-2xl font-bold text-[#191B19] mt-1 tracking-tight">
                {currentPlan.metrics.total_unmet_units.toLocaleString()} units
              </div>
            </div>
            <div className="text-[11px] mt-1">
              {currentPlan.metrics.destinations_with_shortages > 0 ? (
                <span className="inline-flex items-center gap-1 text-amber-800 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {currentPlan.metrics.destinations_with_shortages} destination shortage{currentPlan.metrics.destinations_with_shortages === 1 ? '' : 's'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[#526B50] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#526B50]" />
                  Zero destination shortages
                </span>
              )}
            </div>
          </div>

          {/* 4. Active Allocations */}
          <div className="p-3.5 rounded-xl bg-white border border-[#E5E6E0] shadow-2xs flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-semibold text-[#70736E] uppercase tracking-wider">
                Active Allocations
              </div>
              <div className="text-xl sm:text-2xl font-bold text-[#191B19] mt-1 tracking-tight">
                {currentPlan.metrics.active_shipment_lanes} Lanes
              </div>
            </div>
            <div className="text-[11px] text-[#70736E] mt-1">
              {currentPlan.recommendations.length} consignments dispatched
            </div>
          </div>

          {/* 5. Solver Runtime & Status */}
          <div className="p-3.5 rounded-xl bg-white border border-[#E5E6E0] shadow-2xs flex flex-col justify-between col-span-2 sm:col-span-1">
            <div>
              <div className="text-[11px] font-semibold text-[#70736E] uppercase tracking-wider">
                Solver Runtime
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-[#191B19] mt-1 tracking-tight">
                {currentPlan.metrics.solver_runtime_ms} ms
              </div>
            </div>
            <div className="text-[11px] font-medium text-[#526B50] mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#526B50]" />
              <span>{currentPlan.metrics.solver_status || 'OPTIMAL'}</span>
              <span className="text-[#70736E] font-normal">
                ({activeStrategy === 'optimized_ortools' ? 'OR-Tools' : 'Baseline'})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. REBUILT SHIPMENT ALLOCATIONS TABLE (SECTION 7.1) */}
      <div className="rounded-xl bg-white border border-[#E5E6E0] shadow-xs overflow-hidden">
        {/* Table Toolbar & Multi-Filters */}
        <div className="p-4 sm:p-5 border-b border-[#F0F0EB] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-bold text-[#191B19]">
                Recommended Shipment Allocations
              </h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                activeStrategy === 'optimized_ortools' 
                  ? 'bg-[#EBF1EA] text-[#526B50] border-[#D3DFD2]' 
                  : 'bg-[#F2F2EE] text-[#70736E] border-[#E5E6E0]'
              }`}>
                {activeStrategy === 'optimized_ortools' ? 'OR-Tools Optimal' : 'Baseline Heuristic'}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F7F7F4] text-[#70736E] font-medium border border-[#E5E6E0]">
                {dataSource === 'm5' ? 'Real M5' : 'Synthetic FMCG'} • {horizonDays}D
              </span>
            </div>
            <p className="text-xs text-[#70736E] mt-0.5">
              Showing {processedRecs.length} of {currentPlan?.recommendations.length || 0} allocation legs based on current network constraints.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Warehouse */}
            <div className="flex items-center gap-1 bg-[#F7F7F4] border border-[#E5E6E0] rounded-lg px-2 py-1 text-xs text-[#70736E]">
              <Filter className="w-3 h-3 text-[#70736E]" />
              <select
                value={filterWh}
                aria-label="Filter by Source Warehouse"
                onChange={(e) => { setFilterWh(e.target.value); setCurrentPage(1); }}
                className="bg-transparent text-xs text-[#191B19] focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Warehouses</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.city} ({w.name.slice(0, 20)})</option>
                ))}
              </select>
            </div>

            {/* Filter Destination */}
            <div className="flex items-center gap-1 bg-[#F7F7F4] border border-[#E5E6E0] rounded-lg px-2 py-1 text-xs text-[#70736E]">
              <select
                value={filterDest}
                aria-label="Filter by Destination"
                onChange={(e) => { setFilterDest(e.target.value); setCurrentPage(1); }}
                className="bg-transparent text-xs text-[#191B19] focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Destinations</option>
                {destinations.map(d => (
                  <option key={d.id} value={d.id}>{d.name.slice(0, 24)} ({d.id})</option>
                ))}
              </select>
            </div>

            {/* Filter Expiry Status */}
            <div className="flex items-center gap-1 bg-[#F7F7F4] border border-[#E5E6E0] rounded-lg px-2 py-1 text-xs text-[#70736E]">
              <select
                value={filterExpiry}
                aria-label="Filter by Expiry Status"
                onChange={(e) => { setFilterExpiry(e.target.value); setCurrentPage(1); }}
                className="bg-transparent text-xs text-[#191B19] focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Shelf Life</option>
                <option value="near_expiry">Near Expiry (≤15d)</option>
                <option value="healthy">Healthy Shelf Life</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1 bg-[#F7F7F4] border border-[#E5E6E0] rounded-lg px-2 py-1 text-xs text-[#70736E]">
              <SlidersHorizontal className="w-3 h-3 text-[#70736E]" />
              <select
                value={sortBy}
                aria-label="Sort allocations"
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs text-[#191B19] focus:outline-hidden cursor-pointer"
              >
                <option value="default">Default Sort</option>
                <option value="earliest_expiry">Earliest Expiry</option>
                <option value="highest_cost">Highest Freight Bill</option>
                <option value="largest_qty">Largest Quantity</option>
              </select>
            </div>

            {/* Reset Filters button */}
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-xs text-[#70736E] hover:text-[#191B19] px-2 py-1 rounded-md hover:bg-[#F2F2EE] transition-colors cursor-pointer flex items-center gap-1"
                title="Reset all filters and sorting"
              >
                <X className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}

            {/* Export CSV button */}
            <button
              onClick={handleExportCSV}
              disabled={!currentPlan || currentPlan.recommendations.length === 0}
              className="bg-[#191B19] hover:bg-[#2E312E] text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-98 disabled:opacity-50 ml-auto lg:ml-0"
              title="Download allocation plan as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Primary Table (6 Columns: Product | Route | Batch / Expiry | Quantity | Freight Cost | Action) */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#FAFBF9] border-b border-[#E5E6E0] text-[11px] font-semibold text-[#70736E] uppercase tracking-wider">
                <th className="py-2.5 px-3.5">Product</th>
                <th className="py-2.5 px-3">Route (Origin → Destination)</th>
                <th className="py-2.5 px-3">Batch / Expiry</th>
                <th className="py-2.5 px-3 text-right">Quantity</th>
                <th className="py-2.5 px-3 text-right">Freight Cost</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0EB]">
              {paginatedRecs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[#70736E]">
                    <Package className="w-6 h-6 mx-auto mb-2 text-[#A5A8A0]" />
                    <p className="text-xs font-semibold text-[#191B19]">No allocations match the selected filters.</p>
                    {hasActiveFilters && (
                      <button
                        onClick={resetFilters}
                        className="mt-2 text-xs text-[#526B50] font-medium hover:underline cursor-pointer"
                      >
                        Reset filters and sorting
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedRecs.map(rec => {
                  const isNearExpiry = rec.batch_days_to_expiry > 0 && rec.batch_days_to_expiry <= 15;
                  const isSelected = selectedRecommendation?.recommendation_id === rec.recommendation_id;

                  return (
                    <tr 
                      key={rec.recommendation_id} 
                      className={`hover:bg-[#F9F9F7] transition-colors ${isSelected ? 'bg-[#EBF1EA]/40' : ''}`}
                    >
                      {/* 1. Product */}
                      <td className="py-2.5 px-3.5 align-middle">
                        <div className="font-semibold text-[#191B19] leading-snug">{rec.product_name}</div>
                        <div className="font-mono text-[10px] text-[#70736E]">{rec.product_id}</div>
                      </td>

                      {/* 2. Route (Origin -> Destination) */}
                      <td className="py-2.5 px-3 align-middle">
                        <div className="font-medium text-[#191B19] flex items-center gap-1.5 leading-snug">
                          <span>{rec.source_warehouse_name.split(' ')[0]}</span>
                          <span className="text-[#A5A8A0]">→</span>
                          <span>{rec.destination_name.split(' ')[0]}</span>
                        </div>
                        <div className="font-mono text-[10px] text-[#70736E]">
                          {rec.source_warehouse_id} → {rec.destination_id}
                        </div>
                      </td>

                      {/* 3. Batch / Expiry */}
                      <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                        <div className="font-mono font-medium text-[#191B19] text-[11px]">{rec.batch_id}</div>
                        <div className="mt-0.5">
                          {isNearExpiry ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                              <Clock className="w-2.5 h-2.5 text-amber-700" />
                              <span>Expires in {rec.batch_days_to_expiry}d</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-[#70736E]">
                              <Clock className="w-2.5 h-2.5 text-[#A5A8A0]" />
                              <span>Healthy ({rec.batch_days_to_expiry}d)</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 4. Quantity */}
                      <td className="py-2.5 px-3 text-right align-middle whitespace-nowrap">
                        <div className="font-bold text-xs text-[#191B19]">
                          {rec.allocated_quantity.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-[#70736E]">units</div>
                      </td>

                      {/* 5. Freight Cost */}
                      <td className="py-2.5 px-3 text-right align-middle whitespace-nowrap">
                        <div className="font-bold text-xs text-[#191B19]">
                          ${rec.total_transport_cost.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-[#70736E]">
                          ${rec.unit_transport_cost.toFixed(2)}/u
                        </div>
                      </td>

                      {/* 6. Action (View Details Drawer) */}
                      <td className="py-2.5 px-3 text-center align-middle whitespace-nowrap">
                        <button
                          onClick={() => setSelectedRecommendation(rec)}
                          className="text-xs font-semibold px-2.5 py-1 rounded-md border border-[#E5E6E0] bg-white hover:bg-[#F2F4F1] hover:border-[#526B50] text-[#526B50] transition-colors cursor-pointer inline-flex items-center gap-1"
                          title="Open optimization reasoning drawer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-[#F0F0EB] bg-[#FAFBF9] flex items-center justify-between text-xs text-[#70736E]">
            <div>
              Page {currentPage} of {totalPages} ({processedRecs.length} total allocations)
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded border border-[#E5E6E0] bg-white hover:bg-[#F7F7F4] disabled:opacity-40 cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft className="w-3 h-3" />
                <span>Prev</span>
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded border border-[#E5E6E0] bg-white hover:bg-[#F7F7F4] disabled:opacity-40 cursor-pointer flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. REDESIGNED SHORTAGE & STOCKOUT ANALYSIS PANEL */}
      {currentPlan && currentPlan.shortages.length > 0 && (
        <div className="rounded-xl bg-white border border-[#E5E6E0] shadow-xs overflow-hidden">
          {/* Header & Metrics Strip */}
          <div className="p-4 sm:p-5 border-b border-[#F0F0EB]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#191B19] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Shortage & Stockout Analysis</span>
                </h3>
                <p className="text-xs text-[#70736E] mt-0.5">
                  Operational exceptions where network stock levels or corridor capacity limits constrained 100% order fulfillment.
                </p>
              </div>

              {onNavigateToComparison && (
                <button
                  onClick={onNavigateToComparison}
                  className="text-xs font-semibold text-[#526B50] hover:text-[#41553F] cursor-pointer flex items-center gap-1 self-start sm:self-auto hover:underline"
                >
                  <span>Compare vs Baseline Shortages</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick shortage metrics summary pills */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3 pt-3 border-t border-[#F0F0EB]">
              <div className="px-3 py-1.5 rounded-lg bg-[#F7F7F4] border border-[#E5E6E0] text-xs flex items-center justify-between">
                <span className="text-[#70736E]">Affected SKU-Destination Pairs</span>
                <span className="font-bold text-[#191B19]">{shortageStats.count}</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-[#F7F7F4] border border-[#E5E6E0] text-xs flex items-center justify-between">
                <span className="text-[#70736E]">Total Unmet Demand</span>
                <span className="font-bold text-[#191B19]">{shortageStats.unmetUnits.toLocaleString()} units</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-[#F7F7F4] border border-[#E5E6E0] text-xs flex items-center justify-between">
                <span className="text-[#70736E]">High Priority Shortages</span>
                <span className={`font-bold ${shortageStats.highCount > 0 ? 'text-rose-700' : 'text-[#526B50]'}`}>
                  {shortageStats.highCount}
                </span>
              </div>
            </div>
          </div>

          {/* Shortage Compact Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAFBF9] border-b border-[#E5E6E0] text-[11px] font-semibold text-[#70736E] uppercase tracking-wider">
                  <th className="py-2.5 px-3.5">Destination</th>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3 text-right">Demand</th>
                  <th className="py-2.5 px-3 text-right">Fulfilled</th>
                  <th className="py-2.5 px-3 text-right">Unmet Units</th>
                  <th className="py-2.5 px-3 text-right">Shortage Rate</th>
                  <th className="py-2.5 px-3.5">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0EB]">
                {currentPlan.shortages.map((s, idx) => {
                  const isHigh = s.criticality === 'High';
                  const isMed = s.criticality === 'Medium';

                  return (
                    <tr key={idx} className="hover:bg-[#F9F9F7] transition-colors">
                      <td className="py-2.5 px-3.5 font-medium text-[#191B19]">
                        <div>{s.destination_name}</div>
                        <div className="font-mono text-[10px] text-[#70736E]">{s.destination_id}</div>
                      </td>
                      <td className="py-2.5 px-3 text-[#191B19]">
                        <div>{s.product_name}</div>
                        <div className="font-mono text-[10px] text-[#70736E]">{s.product_id}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-[#70736E] tabular-nums">
                        {s.demand.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-[#526B50] tabular-nums">
                        {s.fulfilled.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-[#191B19] tabular-nums">
                        {s.unmet_quantity.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        <span className={`font-semibold ${isHigh ? 'text-rose-700' : isMed ? 'text-amber-800' : 'text-[#70736E]'}`}>
                          {s.shortage_percentage}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          isHigh 
                            ? 'bg-rose-50 text-rose-700 border-rose-200' 
                            : isMed 
                            ? 'bg-amber-50 text-amber-800 border-amber-200' 
                            : 'bg-[#F2F2EE] text-[#70736E] border-[#E5E6E0]'
                        }`}>
                          {s.criticality} Priority
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. RIGHT-SIDE EXPLANATION DRAWER (SECTION 7.2) */}
      {selectedRecommendation && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/25 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedRecommendation(null)}
          />

          {/* Drawer content panel */}
          <div className="relative w-full max-w-md bg-white border-l border-[#E5E6E0] shadow-2xl z-10 flex flex-col h-full overflow-y-auto">
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-[#E5E6E0] flex items-center justify-between bg-[#F7F7F4]/60 sticky top-0 z-20 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#526B50]" />
                <h3 className="font-bold text-sm text-[#191B19] uppercase tracking-wider">
                  Allocation Decision Audit
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecommendation(null)}
                className="p-1 rounded-lg text-[#70736E] hover:text-[#191B19] hover:bg-white border border-transparent hover:border-[#E5E6E0] transition-colors cursor-pointer"
                title="Close drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5 text-xs">
              {/* Product & Route Identity */}
              <div className="p-3.5 rounded-xl bg-[#F7F7F4] border border-[#E5E6E0] space-y-2">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#70736E]">Assigned Consignment</span>
                  <div className="text-sm font-bold text-[#191B19] mt-0.5">{selectedRecommendation.product_name}</div>
                  <div className="font-mono text-[10px] text-[#70736E]">SKU: {selectedRecommendation.product_id} • Leg: {selectedRecommendation.recommendation_id}</div>
                </div>

                <div className="pt-2 border-t border-[#E5E6E0]/80 grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#70736E]">Origin Hub</span>
                    <div className="font-semibold text-[#191B19] text-[11px] mt-0.5">{selectedRecommendation.source_warehouse_name}</div>
                    <div className="font-mono text-[10px] text-[#70736E]">{selectedRecommendation.source_warehouse_id}</div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#70736E]">Destination</span>
                    <div className="font-semibold text-[#191B19] text-[11px] mt-0.5">{selectedRecommendation.destination_name}</div>
                    <div className="font-mono text-[10px] text-[#70736E]">{selectedRecommendation.destination_id}</div>
                  </div>
                </div>
              </div>

              {/* Financials & Volume */}
              <div>
                <span className="text-[10px] uppercase font-bold text-[#70736E] block mb-1.5">Shipment Volume & Financials</span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-lg border border-[#E5E6E0] bg-white">
                    <span className="text-[10px] text-[#70736E]">Allocated Qty</span>
                    <div className="text-sm font-bold text-[#191B19] mt-0.5">{selectedRecommendation.allocated_quantity.toLocaleString()}</div>
                    <span className="text-[10px] text-[#70736E]">units</span>
                  </div>
                  <div className="p-2.5 rounded-lg border border-[#E5E6E0] bg-white">
                    <span className="text-[10px] text-[#70736E]">Unit Tariff</span>
                    <div className="text-sm font-bold text-[#191B19] mt-0.5">${selectedRecommendation.unit_transport_cost.toFixed(2)}</div>
                    <span className="text-[10px] text-[#70736E]">/ unit delivered</span>
                  </div>
                  <div className="p-2.5 rounded-lg border border-[#E5E6E0] bg-white">
                    <span className="text-[10px] text-[#70736E]">Total Freight</span>
                    <div className="text-sm font-bold text-[#191B19] mt-0.5">${selectedRecommendation.total_transport_cost.toFixed(2)}</div>
                    <span className="text-[10px] text-[#526B50] font-medium">Billed cost</span>
                  </div>
                </div>
              </div>

              {/* Batch & Expiry Analysis */}
              <div>
                <span className="text-[10px] uppercase font-bold text-[#70736E] block mb-1.5">Inventory Lot & Shelf Life</span>
                <div className="p-3.5 rounded-xl border border-[#E5E6E0] bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-[#70736E]">Batch / Lot Number</span>
                      <div className="font-mono font-bold text-[#191B19]">{selectedRecommendation.batch_id}</div>
                    </div>
                    <div>
                      {selectedRecommendation.batch_days_to_expiry > 0 && selectedRecommendation.batch_days_to_expiry <= 15 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          Near Expiry (FEFO Candidate)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F2F2EE] text-[#70736E] border border-[#E5E6E0]">
                          Healthy Shelf Life
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#F0F0EB] flex items-center justify-between text-xs">
                    <span className="text-[#70736E]">Remaining Shelf Life:</span>
                    <span className="font-semibold text-[#191B19] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#526B50]" />
                      <span>{selectedRecommendation.batch_days_to_expiry} days from planning anchor</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#70736E]">FEFO Priority Subsidy Applied:</span>
                    <span className="font-semibold text-[#526B50]">
                      {selectedRecommendation.batch_days_to_expiry <= 15 ? 'Yes (Bounded Tie-Breaker)' : 'No (Standard Tariff)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Mathematical Rationale & Constraints */}
              <div>
                <span className="text-[10px] uppercase font-bold text-[#70736E] block mb-1.5">Optimization Rationale & Invariant Checklist</span>
                <div className="p-3.5 rounded-xl border border-[#E5E6E0] bg-[#FAFBF9] space-y-2.5">
                  <div className="text-xs text-[#191B19] leading-relaxed bg-white p-2.5 rounded-lg border border-[#E5E6E0]">
                    {selectedRecommendation.rationale}
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#70736E] block mb-1">Satisfied Constraints:</span>
                    <div className="space-y-1">
                      {selectedRecommendation.constraints_honored.map((c, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[11px] text-[#41553F]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#526B50] shrink-0" />
                          <span>{c}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-[#E5E6E0] bg-[#F7F7F4] mt-auto">
              <button
                onClick={() => setSelectedRecommendation(null)}
                className="w-full py-2 bg-white hover:bg-[#F2F4F1] border border-[#E5E6E0] rounded-lg text-xs font-semibold text-[#191B19] transition-colors cursor-pointer"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
