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
  RotateCcw
} from 'lucide-react';
import { ComparisonAudit, runComparisonAudit } from '../api';

export const ComparisonAuditView: React.FC = () => {
  const [audit, setAudit] = useState<ComparisonAudit | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchAuditData = async () => {
    setLoading(true);
    try {
      const res = await runComparisonAudit(7);
      setAudit(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, []);

  if (loading && !audit) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-[#E5E6E0] shadow-xs">
        <div className="w-8 h-8 border-3 border-[#526B50] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm font-semibold text-[#191B19]">Computing Baseline vs. OR-Tools Optimization Audit...</p>
        <p className="text-xs text-[#70736E] mt-1">Executing identical starting demand snapshots across both engines.</p>
      </div>
    );
  }

  if (!audit) return null;

  const b = audit.baseline_metrics;
  const o = audit.optimized_metrics;

  return (
    <div className="space-y-6">
      {/* Top Verdict Banner */}
      <div className="p-6 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-[#F0F0EB] mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#526B50]" />
            <h3 className="text-lg font-bold text-[#191B19]">Empirical Performance Audit</h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#EBF1EA] text-[#526B50] font-semibold">
              Triwizathon PS2 Benchmark
            </span>
          </div>

          <button
            onClick={fetchAuditData}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#70736E] hover:text-[#191B19] px-3 py-1.5 rounded-xl border border-[#E5E6E0] bg-[#F7F7F4] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Re-Audit Models</span>
          </button>
        </div>

        <p className="text-sm font-medium text-[#191B19] leading-relaxed bg-[#F7F7F4] p-4 rounded-xl border border-[#E5E6E0]">
          {audit.summary_verdict}
        </p>
      </div>

      {/* Comparison Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Transportation Cost */}
        <div className="p-5 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-[#70736E] uppercase mb-1">
            <span>Freight Cost</span>
            <DollarSign className="w-4 h-4 text-[#526B50]" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-[#191B19]">
              ${o.total_transport_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`text-xs font-bold ${audit.cost_reduction_pct >= 0 ? 'text-[#526B50]' : 'text-amber-700'}`}>
              {audit.cost_reduction_pct >= 0 ? `↓ ${audit.cost_reduction_pct}%` : `↑ ${Math.abs(audit.cost_reduction_pct)}%`}
            </span>
          </div>
          <div className="mt-3 text-xs text-[#70736E] space-y-1 pt-3 border-t border-[#F0F0EB]">
            <div className="flex justify-between">
              <span>Baseline Heuristic:</span>
              <span className="font-semibold text-[#191B19]">${b.total_transport_cost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-medium text-[#526B50]">
              <span>Cost Savings:</span>
              <span>${audit.cost_savings_amount.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Demand Fulfillment */}
        <div className="p-5 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-[#70736E] uppercase mb-1">
            <span>Fulfillment Rate</span>
            <CheckCircle2 className="w-4 h-4 text-[#526B50]" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-[#191B19]">
              {o.fulfillment_rate_pct}%
            </span>
            <span className="text-xs font-bold text-[#526B50]">
              +{audit.fulfillment_improvement_pct}%
            </span>
          </div>
          <div className="mt-3 text-xs text-[#70736E] space-y-1 pt-3 border-t border-[#F0F0EB]">
            <div className="flex justify-between">
              <span>Baseline Heuristic:</span>
              <span className="font-semibold text-[#191B19]">{b.fulfillment_rate_pct}%</span>
            </div>
            <div className="flex justify-between font-medium text-[#526B50]">
              <span>Units Delivered:</span>
              <span>{o.total_fulfilled_units.toLocaleString()} / {o.total_demand_units.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Stockout Reduction */}
        <div className="p-5 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-[#70736E] uppercase mb-1">
            <span>Unmet Demand / Stockouts</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-[#191B19]">
              {o.total_unmet_units.toLocaleString()} units
            </span>
            <span className="text-xs font-bold text-[#526B50]">
              ↓ {audit.stockout_reduction_pct}%
            </span>
          </div>
          <div className="mt-3 text-xs text-[#70736E] space-y-1 pt-3 border-t border-[#F0F0EB]">
            <div className="flex justify-between">
              <span>Baseline Shortages:</span>
              <span className="font-semibold text-rose-600">{b.total_unmet_units.toLocaleString()} units</span>
            </div>
            <div className="flex justify-between font-medium text-[#526B50]">
              <span>Shortage Volume Avoided:</span>
              <span>-{(b.total_unmet_units - o.total_unmet_units).toLocaleString()} units</span>
            </div>
          </div>
        </div>

        {/* Metric 4: Avoided Expiry Spoilage (FEFO) */}
        <div className="p-5 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-[#70736E] uppercase mb-1">
            <span>Avoided Expiry Spoilage</span>
            <Clock className="w-4 h-4 text-[#526B50]" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-[#526B50]">
              {o.expiring_stock_utilized_units.toLocaleString()} units
            </span>
            <span className="text-xs font-bold text-[#526B50]">
              FEFO Active
            </span>
          </div>
          <div className="mt-3 text-xs text-[#70736E] space-y-1 pt-3 border-t border-[#F0F0EB]">
            <div className="flex justify-between">
              <span>Baseline Spoilage Risk:</span>
              <span className="font-semibold text-amber-700">{b.potential_waste_unallocated_units.toLocaleString()} units</span>
            </div>
            <div className="flex justify-between font-medium text-[#526B50]">
              <span>Optimizer Risk Remaining:</span>
              <span>{o.potential_waste_unallocated_units.toLocaleString()} units</span>
            </div>
          </div>
        </div>
      </div>

      {/* Side-by-Side Detailed Breakdown Table */}
      <div className="p-6 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs">
        <h4 className="text-lg font-bold text-[#191B19] mb-1">Side-by-Side Strategy Audit Table</h4>
        <p className="text-xs text-[#70736E] mb-4">
          Both algorithms evaluated against identical starting inventories, customer demand schedules, and route capacity constraints.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E5E6E0] text-[#70736E] uppercase font-bold tracking-wider">
                <th className="pb-3 px-4">Evaluation Dimension</th>
                <th className="pb-3 px-4">Baseline Strategy (Greedy Local Tariff)</th>
                <th className="pb-3 px-4">SupplySync (Google OR-Tools MILP)</th>
                <th className="pb-3 px-4 text-right">Optimization Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0EB]">
              <tr className="hover:bg-[#F7F7F4]">
                <td className="py-3.5 px-4 font-semibold text-[#191B19]">Total Landed Freight Cost</td>
                <td className="py-3.5 px-4 text-[#70736E] font-mono">${b.total_transport_cost.toLocaleString()}</td>
                <td className="py-3.5 px-4 font-bold text-[#191B19] font-mono">${o.total_transport_cost.toLocaleString()}</td>
                <td className="py-3.5 px-4 text-right font-bold text-[#526B50]">
                  -${audit.cost_savings_amount.toLocaleString()} ({audit.cost_reduction_pct}%)
                </td>
              </tr>
              <tr className="hover:bg-[#F7F7F4]">
                <td className="py-3.5 px-4 font-semibold text-[#191B19]">Customer Demand Fulfillment</td>
                <td className="py-3.5 px-4 text-[#70736E]">{b.fulfillment_rate_pct}% ({b.total_fulfilled_units.toLocaleString()} units)</td>
                <td className="py-3.5 px-4 font-bold text-[#191B19]">{o.fulfillment_rate_pct}% ({o.total_fulfilled_units.toLocaleString()} units)</td>
                <td className="py-3.5 px-4 text-right font-bold text-[#526B50]">
                  +{audit.fulfillment_improvement_pct}%
                </td>
              </tr>
              <tr className="hover:bg-[#F7F7F4]">
                <td className="py-3.5 px-4 font-semibold text-[#191B19]">Stockout Volume (Unmet Demand)</td>
                <td className="py-3.5 px-4 text-rose-600 font-semibold">{b.total_unmet_units.toLocaleString()} units</td>
                <td className="py-3.5 px-4 font-bold text-[#191B19]">{o.total_unmet_units.toLocaleString()} units</td>
                <td className="py-3.5 px-4 text-right font-bold text-[#526B50]">
                  -{audit.stockout_reduction_pct}%
                </td>
              </tr>
              <tr className="hover:bg-[#F7F7F4]">
                <td className="py-3.5 px-4 font-semibold text-[#191B19]">Destinations Suffering Shortages</td>
                <td className="py-3.5 px-4 text-[#70736E]">{b.destinations_with_shortages} destinations</td>
                <td className="py-3.5 px-4 font-bold text-[#191B19]">{o.destinations_with_shortages} destinations</td>
                <td className="py-3.5 px-4 text-right font-bold text-[#526B50]">
                  -{b.destinations_with_shortages - o.destinations_with_shortages} locations
                </td>
              </tr>
              <tr className="hover:bg-[#F7F7F4]">
                <td className="py-3.5 px-4 font-semibold text-[#191B19]">Near-Expiry Stock Rescued (FEFO)</td>
                <td className="py-3.5 px-4 text-[#70736E]">{b.expiring_stock_utilized_units.toLocaleString()} units</td>
                <td className="py-3.5 px-4 font-bold text-[#526B50]">{o.expiring_stock_utilized_units.toLocaleString()} units</td>
                <td className="py-3.5 px-4 text-right font-bold text-[#526B50]">
                  +{audit.waste_reduction_units.toLocaleString()} units protected
                </td>
              </tr>
              <tr className="hover:bg-[#F7F7F4]">
                <td className="py-3.5 px-4 font-semibold text-[#191B19]">Computation Solver Runtime</td>
                <td className="py-3.5 px-4 font-mono text-[#70736E]">{b.solver_runtime_ms} ms (Heuristic)</td>
                <td className="py-3.5 px-4 font-mono text-[#191B19]">{o.solver_runtime_ms} ms (OR-Tools SCIP)</td>
                <td className="py-3.5 px-4 text-right font-mono text-[#526B50]">Optimal In Real-Time</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
