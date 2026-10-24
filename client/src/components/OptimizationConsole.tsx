import React, { useState } from 'react';
import { 
  Play, 
  RotateCcw, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Truck, 
  Sliders, 
  Layers, 
  Filter, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { 
  OptimizationPlan, 
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
  onPlanGenerated?: (plan: OptimizationPlan) => void;
  onNavigateToComparison?: () => void;
}

export const OptimizationConsole: React.FC<OptimizationConsoleProps> = ({
  products,
  warehouses,
  destinations,
  onPlanGenerated,
  onNavigateToComparison
}) => {
  const [horizonDays, setHorizonDays] = useState<number>(7);
  const [currentPlan, setCurrentPlan] = useState<OptimizationPlan | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeStrategy, setActiveStrategy] = useState<'baseline' | 'optimized_ortools'>('optimized_ortools');
  
  // Table filters
  const [filterWh, setFilterWh] = useState<string>('all');
  const [filterDest, setFilterDest] = useState<string>('all');
  const [filterProd, setFilterProd] = useState<string>('all');

  const handleRunOptimizer = async () => {
    setLoading(true);
    try {
      const plan = await runOptimizedPlan(horizonDays);
      setCurrentPlan(plan);
      setActiveStrategy('optimized_ortools');
      if (onPlanGenerated) onPlanGenerated(plan);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunBaseline = async () => {
    setLoading(true);
    try {
      const plan = await runBaselinePlan(horizonDays);
      setCurrentPlan(plan);
      setActiveStrategy('baseline');
      if (onPlanGenerated) onPlanGenerated(plan);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Trigger initial run on mount if none
  React.useEffect(() => {
    handleRunOptimizer();
  }, []);

  const filteredRecs = (currentPlan?.recommendations || []).filter(r => {
    if (filterWh !== 'all' && r.source_warehouse_id !== filterWh) return false;
    if (filterDest !== 'all' && r.destination_id !== filterDest) return false;
    if (filterProd !== 'all' && r.product_id !== filterProd) return false;
    return true;
  });

  const handleExportCSV = () => {
    if (!currentPlan) return;
    const rows = [
      ["Run ID", "Strategy", "Recommendation ID", "Product ID", "Product Name", "Source WH ID", "Source WH Name", "Destination ID", "Destination Name", "Batch ID", "Batch Days to Expiry", "Allocated Qty", "Unit Cost", "Total Cost", "Destination Demand", "Rationale", "Constraints Met"]
    ];

    currentPlan.recommendations.forEach(r => {
      rows.push([
        currentPlan.run_id,
        currentPlan.strategy,
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
    link.setAttribute("download", `supplysync_plan_${currentPlan.run_id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Control panel banner */}
      <div className="p-6 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EBF1EA] text-[#526B50] text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Mathematical Decision Engine</span>
          </div>
          <h3 className="text-xl font-bold text-[#191B19]">
            Constrained FMCG Distribution Planning
          </h3>
          <p className="text-xs text-[#70736E] mt-0.5 max-w-xl">
            Solves multi-echelon warehouse-to-retail allocations balancing route transport tariffs, destination SLAs, vehicle corridor throughputs, and batch FEFO expiry priorities.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Horizon toggle */}
          <div className="flex items-center gap-1 bg-[#F7F7F4] border border-[#E5E6E0] p-1 rounded-xl text-xs font-semibold">
            {[7, 14, 30].map(h => (
              <button
                key={h}
                onClick={() => setHorizonDays(h)}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  horizonDays === h ? 'bg-white text-[#191B19] shadow-xs' : 'text-[#70736E] hover:text-[#191B19]'
                }`}
              >
                {h}D
              </button>
            ))}
          </div>

          <button
            onClick={handleRunBaseline}
            disabled={loading}
            className={`text-xs font-semibold px-4 py-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-2 ${
              activeStrategy === 'baseline' 
                ? 'bg-[#F2F2EE] border-[#70736E] text-[#191B19]' 
                : 'bg-white border-[#E5E6E0] text-[#70736E] hover:text-[#191B19]'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Run Baseline</span>
          </button>

          <button
            onClick={handleRunOptimizer}
            disabled={loading}
            className="bg-[#526B50] hover:bg-[#41553F] text-white text-xs font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{loading ? 'Optimizing with OR-Tools...' : 'Run OR-Tools Optimizer'}</span>
          </button>
        </div>
      </div>

      {/* Real-time calculated KPI strip */}
      {currentPlan && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-4 rounded-xl bg-white border border-[#E5E6E0] shadow-xs">
            <div className="text-[11px] font-semibold text-[#70736E] uppercase">Fulfillment Rate</div>
            <div className="text-2xl font-bold text-[#191B19] mt-1">
              {currentPlan.metrics.fulfillment_rate_pct}%
            </div>
            <div className="text-[11px] text-[#526B50] mt-0.5">
              {currentPlan.metrics.total_fulfilled_units.toLocaleString()} / {currentPlan.metrics.total_demand_units.toLocaleString()} units
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#E5E6E0] shadow-xs">
            <div className="text-[11px] font-semibold text-[#70736E] uppercase">Total Freight Cost</div>
            <div className="text-2xl font-bold text-[#191B19] mt-1">
              ${currentPlan.metrics.total_transport_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-[#70736E] mt-0.5">
              Avg ${currentPlan.metrics.avg_unit_transport_cost.toFixed(2)} / unit delivered
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#E5E6E0] shadow-xs">
            <div className="text-[11px] font-semibold text-[#70736E] uppercase">Avoided Expiry Spoilage</div>
            <div className="text-2xl font-bold text-[#526B50] mt-1">
              {currentPlan.metrics.expiring_stock_utilized_units.toLocaleString()} units
            </div>
            <div className="text-[11px] text-[#526B50] mt-0.5">
              FEFO prioritized before shelf-life cutoff
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#E5E6E0] shadow-xs">
            <div className="text-[11px] font-semibold text-[#70736E] uppercase">Active Shipments</div>
            <div className="text-2xl font-bold text-[#191B19] mt-1">
              {currentPlan.metrics.active_shipment_lanes} Lanes
            </div>
            <div className="text-[11px] text-[#70736E] mt-0.5">
              {currentPlan.metrics.destinations_with_shortages} destination shortages
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#E5E6E0] shadow-xs">
            <div className="text-[11px] font-semibold text-[#70736E] uppercase">Solver Runtime</div>
            <div className="text-2xl font-bold font-mono text-[#191B19] mt-1">
              {currentPlan.metrics.solver_runtime_ms} ms
            </div>
            <div className="text-[11px] text-[#526B50] mt-0.5 font-mono">
              Status: {currentPlan.metrics.solver_status}
            </div>
          </div>
        </div>
      )}

      {/* Recommendations Ledger */}
      <div className="p-6 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs">
        {/* Table Header with Filters & CSV Export */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#F0F0EB]">
          <div>
            <div className="flex items-center gap-3">
              <h4 className="text-lg font-bold text-[#191B19]">Recommended Shipment Allocations</h4>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                activeStrategy === 'optimized_ortools' ? 'bg-[#EBF1EA] text-[#526B50]' : 'bg-[#F2F2EE] text-[#70736E]'
              }`}>
                {activeStrategy === 'optimized_ortools' ? 'OR-Tools Optimal' : 'Baseline Heuristic'}
              </span>
            </div>
            <p className="text-xs text-[#70736E] mt-0.5">
              Showing {filteredRecs.length} of {currentPlan?.recommendations.length || 0} recommended distribution legs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Warehouse */}
            <select
              value={filterWh}
              onChange={(e) => setFilterWh(e.target.value)}
              className="bg-[#F7F7F4] border border-[#E5E6E0] rounded-xl px-2.5 py-1.5 text-xs text-[#191B19] focus:outline-hidden focus:border-[#526B50]"
            >
              <option value="all">All Warehouses</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.city}</option>
              ))}
            </select>

            {/* Filter Destination */}
            <select
              value={filterDest}
              onChange={(e) => setFilterDest(e.target.value)}
              className="bg-[#F7F7F4] border border-[#E5E6E0] rounded-xl px-2.5 py-1.5 text-xs text-[#191B19] focus:outline-hidden focus:border-[#526B50]"
            >
              <option value="all">All Destinations</option>
              {destinations.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            {/* Export CSV button */}
            <button
              onClick={handleExportCSV}
              className="bg-[#191B19] hover:bg-[#2E312E] text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Recommendations Table */}
        <div className="overflow-x-auto pt-4">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E5E6E0] text-[#70736E] uppercase font-bold tracking-wider">
                <th className="pb-3 px-3">Product</th>
                <th className="pb-3 px-3">Source Warehouse</th>
                <th className="pb-3 px-3">Destination</th>
                <th className="pb-3 px-3">Batch & Expiry</th>
                <th className="pb-3 px-3 text-right">Quantity</th>
                <th className="pb-3 px-3 text-right">Freight Cost</th>
                <th className="pb-3 px-3">Mathematical Rationale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0EB]">
              {filteredRecs.map(rec => (
                <tr key={rec.recommendation_id} className="hover:bg-[#F7F7F4] transition-colors">
                  <td className="py-3.5 px-3">
                    <div className="font-bold text-[#191B19]">{rec.product_name}</div>
                    <div className="font-mono text-[10px] text-[#70736E]">{rec.product_id}</div>
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="font-medium text-[#191B19]">{rec.source_warehouse_name}</div>
                    <div className="font-mono text-[10px] text-[#70736E]">{rec.source_warehouse_id}</div>
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="font-medium text-[#191B19]">{rec.destination_name}</div>
                    <div className="font-mono text-[10px] text-[#70736E]">{rec.destination_id}</div>
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="font-mono font-medium text-[#191B19]">{rec.batch_id}</div>
                    <div className="flex items-center gap-1 text-[11px] mt-0.5">
                      <Clock className="w-3 h-3 text-[#526B50]" />
                      <span className={rec.batch_days_to_expiry <= 15 ? 'text-amber-700 font-semibold' : 'text-[#70736E]'}>
                        {rec.batch_days_to_expiry} days left
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-right font-bold text-sm text-[#191B19]">
                    {rec.allocated_quantity.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <div className="font-bold text-[#191B19]">${rec.total_transport_cost.toFixed(2)}</div>
                    <div className="text-[10px] text-[#70736E]">${rec.unit_transport_cost.toFixed(2)}/unit</div>
                  </td>
                  <td className="py-3.5 px-3 max-w-xs">
                    <div className="text-[11px] text-[#191B19] leading-tight mb-1">{rec.rationale}</div>
                    <div className="flex flex-wrap gap-1">
                      {rec.constraints_honored.slice(0, 2).map((c, i) => (
                        <span key={i} className="text-[9px] bg-[#EBF1EA] text-[#526B50] px-1.5 py-0.5 rounded">
                          {c}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shortage Analysis Table */}
      {currentPlan && currentPlan.shortages.length > 0 && (
        <div className="p-6 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-lg font-bold text-[#191B19] flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <span>Shortage & Stockout Analysis ({currentPlan.shortages.length} Shortages Flagged)</span>
              </h4>
              <p className="text-xs text-[#70736E]">
                Locations where physical stock or route bottleneck limits prevented 100% fulfillment.
              </p>
            </div>
            {onNavigateToComparison && (
              <button
                onClick={onNavigateToComparison}
                className="text-xs font-semibold text-[#526B50] hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>Compare vs Baseline Shortages</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E5E6E0] text-[#70736E] uppercase font-bold tracking-wider">
                  <th className="pb-3 px-3">Destination</th>
                  <th className="pb-3 px-3">Product</th>
                  <th className="pb-3 px-3 text-right">Demand</th>
                  <th className="pb-3 px-3 text-right">Fulfilled</th>
                  <th className="pb-3 px-3 text-right">Unmet Units</th>
                  <th className="pb-3 px-3 text-right">Shortage Rate</th>
                  <th className="pb-3 px-3">Criticality</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0EB]">
                {currentPlan.shortages.map((s, idx) => (
                  <tr key={idx} className="hover:bg-[#F7F7F4] transition-colors">
                    <td className="py-3 px-3 font-semibold text-[#191B19]">{s.destination_name}</td>
                    <td className="py-3 px-3 text-[#191B19]">{s.product_name}</td>
                    <td className="py-3 px-3 text-right font-medium text-[#70736E]">{s.demand.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right font-medium text-[#526B50]">{s.fulfilled.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right font-bold text-rose-600">{s.unmet_quantity.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right font-semibold text-rose-600">{s.shortage_percentage}%</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.criticality === 'High' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {s.criticality} Priority
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
