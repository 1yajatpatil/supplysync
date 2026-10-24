import React, { useState, useEffect } from 'react';
import { 
  TrendingDown, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  DollarSign, 
  Scale, 
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Database,
  BarChart2
} from 'lucide-react';
import { ComparisonAudit, runComparisonAudit } from '../api';

interface ComparisonAuditViewProps {
  dataSource?: 'synthetic' | 'm5';
  onDataSourceChange?: (source: 'synthetic' | 'm5') => void;
}

export const ComparisonAuditView: React.FC<ComparisonAuditViewProps> = ({
  dataSource = 'synthetic',
  onDataSourceChange
}) => {
  const [horizonDays, setHorizonDays] = useState<number>(7);
  const [audit, setAudit] = useState<ComparisonAudit | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchAuditData = async (h = horizonDays, ds = dataSource) => {
    setLoading(true);
    try {
      const res = await runComparisonAudit(h, ds);
      setAudit(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData(horizonDays, dataSource);
  }, [horizonDays, dataSource]);

  const b = audit?.baseline_metrics;
  const o = audit?.optimized_metrics;

  return (
    <div className="space-y-5">
      {/* Configuration bar */}
      <div className="p-4 sm:p-5 rounded-xl bg-white border border-[#E5E6E0] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#70736E]">Performance Audit</span>
            <span className="w-1 h-1 rounded-full bg-[#E5E6E0]" />
            <span className="text-[10px] font-semibold text-[#526B50] bg-[#EBF1EA] px-2 py-0.5 rounded-full">
              Identical Starting Snapshots
            </span>
          </div>
          <h3 className="text-lg font-bold text-[#191B19]">Empirical Performance Audit</h3>
          <p className="text-xs text-[#70736E] mt-0.5">
            Side-by-side comparison of Greedy Demand-Priority Baseline vs. Google OR-Tools Constrained MILP Optimizer.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Data Source Selector */}
          {onDataSourceChange && (
            <div className="flex items-center gap-1 bg-[#F7F7F4] border border-[#E5E6E0] p-1 rounded-lg text-xs font-medium">
              <button
                onClick={() => onDataSourceChange('synthetic')}
                disabled={loading}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  dataSource === 'synthetic'
                    ? 'bg-white text-[#191B19] shadow-xs font-semibold'
                    : 'text-[#70736E] hover:text-[#191B19]'
                }`}
              >
                Synthetic FMCG
              </button>
              <button
                onClick={() => onDataSourceChange('m5')}
                disabled={loading}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  dataSource === 'm5'
                    ? 'bg-white text-[#526B50] shadow-xs font-semibold'
                    : 'text-[#70736E] hover:text-[#191B19]'
                }`}
              >
                Real M5 Kaggle
              </button>
            </div>
          )}

          {/* Horizon Selector */}
          <div className="flex items-center gap-1 bg-[#F7F7F4] border border-[#E5E6E0] p-1 rounded-lg text-xs font-medium">
            {[7, 14, 30].map(h => (
              <button
                key={h}
                onClick={() => setHorizonDays(h)}
                disabled={loading}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  horizonDays === h
                    ? 'bg-white text-[#191B19] shadow-xs font-semibold'
                    : 'text-[#70736E] hover:text-[#191B19]'
                }`}
              >
                {h}D
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchAuditData(horizonDays, dataSource)}
            disabled={loading}
            className="h-9 px-3.5 rounded-lg border border-[#E5E6E0] bg-white hover:bg-[#F7F7F4] text-xs font-semibold text-[#191B19] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Re-Audit</span>
          </button>
        </div>
      </div>

      {loading && !audit ? (
        <div className="p-12 text-center bg-white rounded-xl border border-[#E5E6E0] shadow-xs">
          <div className="w-8 h-8 border-2 border-[#526B50] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#191B19]">Computing Baseline vs. OR-Tools Audit...</p>
          <p className="text-xs text-[#70736E] mt-1">Executing identical starting demand snapshots across both engines.</p>
        </div>
      ) : audit && b && o ? (
        <>
          {/* Top Verdict Banner */}
          <div className="p-4 sm:p-5 rounded-xl bg-white border border-[#E5E6E0] shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-[#526B50]" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#191B19]">
                Empirical Evaluation Verdict
              </h4>
            </div>
            <p className="text-sm text-[#191B19] leading-relaxed bg-[#F7F7F4] p-3 rounded-lg border border-[#E5E6E0]">
              {audit.summary_verdict}
            </p>
          </div>

          {/* Side-by-side KPI Comparison Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Baseline Strategy Card */}
            <div className="p-4 sm:p-5 rounded-xl bg-white border border-[#E5E6E0] shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#F0F0EB] mb-4">
                <div>
                  <span className="text-[10px] font-bold text-[#70736E] uppercase tracking-wider block">
                    Benchmark Heuristic
                  </span>
                  <h4 className="text-base font-bold text-[#191B19]">Greedy Demand-Priority Baseline</h4>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F2F2EE] text-[#70736E] font-medium border border-[#E5E6E0]">
                  Heuristic Rule
                </span>
              </div>

              <p className="text-xs text-[#70736E] mb-4">
                Satisfies retail demand tier-by-tier by greedily selecting the lowest direct unit freight tariff, without global network coordination or FEFO batch reordering.
              </p>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#F7F7F4] border border-[#E5E6E0]">
                  <span className="text-[#70736E]">Fulfillment Rate:</span>
                  <span className="font-bold text-[#191B19]">{b.fulfillment_rate_pct}% ({b.total_fulfilled_units.toLocaleString()} / {b.total_demand_units.toLocaleString()} units)</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#F7F7F4] border border-[#E5E6E0]">
                  <span className="text-[#70736E]">Total Freight Cost:</span>
                  <span className="font-bold text-[#191B19]">${b.total_transport_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#F7F7F4] border border-[#E5E6E0]">
                  <span className="text-[#70736E]">Unmet Demand:</span>
                  <span className="font-bold text-amber-800">{b.total_unmet_units.toLocaleString()} units ({b.destinations_with_shortages} destination shortages)</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#F7F7F4] border border-[#E5E6E0]">
                  <span className="text-[#70736E]">Near-Expiry Stock Utilized:</span>
                  <span className="font-medium text-[#191B19]">{b.expiring_stock_utilized_units.toLocaleString()} units</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#F7F7F4] border border-[#E5E6E0]">
                  <span className="text-[#70736E]">Runtime:</span>
                  <span className="font-mono text-[#191B19]">{b.solver_runtime_ms} ms</span>
                </div>
              </div>
            </div>

            {/* OR-Tools Optimized Strategy Card */}
            <div className="p-4 sm:p-5 rounded-xl bg-white border-2 border-[#526B50] shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#F0F0EB] mb-4">
                <div>
                  <span className="text-[10px] font-bold text-[#526B50] uppercase tracking-wider block">
                    Mathematical Global Solution
                  </span>
                  <h4 className="text-base font-bold text-[#191B19]">OR-Tools Mixed-Integer Programming</h4>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EBF1EA] text-[#526B50] font-semibold border border-[#D3DFD2]">
                  SCIP Optimal
                </span>
              </div>

              <p className="text-xs text-[#70736E] mb-4">
                Simultaneously solves discrete allocation across all warehouses, destination SLAs, corridor capacity limits, and batch-level FEFO shelf life constraints.
              </p>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#EBF1EA]/60 border border-[#D3DFD2]">
                  <span className="text-[#41553F]">Fulfillment Rate:</span>
                  <span className="font-bold text-[#526B50]">
                    {o.fulfillment_rate_pct}% 
                    <span className="ml-1 text-[11px] font-semibold">
                      ({audit.fulfillment_improvement_pct >= 0 ? `+${audit.fulfillment_improvement_pct}%` : `${audit.fulfillment_improvement_pct}%`})
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#EBF1EA]/60 border border-[#D3DFD2]">
                  <span className="text-[#41553F]">Total Freight Cost:</span>
                  <span className="font-bold text-[#191B19]">
                    ${o.total_transport_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <span className="ml-1 text-[11px] font-semibold text-[#526B50]">
                      ({audit.cost_reduction_pct >= 0 ? `-${audit.cost_reduction_pct}% cost` : `+${Math.abs(audit.cost_reduction_pct)}%`})
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#EBF1EA]/60 border border-[#D3DFD2]">
                  <span className="text-[#41553F]">Unmet Demand:</span>
                  <span className="font-bold text-[#191B19]">
                    {o.total_unmet_units.toLocaleString()} units
                    {audit.stockout_reduction_pct > 0 && (
                      <span className="ml-1 text-[11px] text-[#526B50]">(-{audit.stockout_reduction_pct}% stockouts)</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#EBF1EA]/60 border border-[#D3DFD2]">
                  <span className="text-[#41553F]">Near-Expiry Stock Utilized:</span>
                  <span className="font-bold text-[#526B50]">{o.expiring_stock_utilized_units.toLocaleString()} units (FEFO Priority)</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#EBF1EA]/60 border border-[#D3DFD2]">
                  <span className="text-[#41553F]">Runtime:</span>
                  <span className="font-mono text-[#191B19]">{o.solver_runtime_ms} ms</span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
