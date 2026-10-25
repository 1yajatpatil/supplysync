import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { ComparisonAudit, runComparisonAudit } from '../api';

interface ComparisonAuditViewProps {
  dataSource?: 'm5';
}

export const ComparisonAuditView: React.FC<ComparisonAuditViewProps> = ({
  dataSource: _dataSource = 'm5'
}) => {
  const [horizonDays, setHorizonDays] = useState<number>(7);
  const [audit, setAudit] = useState<ComparisonAudit | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAuditData = async (h = horizonDays) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await runComparisonAudit(h, 'm5');
      setAudit(res);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || 'Failed to load Real M5 comparison audit.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData(horizonDays);
  }, [horizonDays]);

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
              Real M5 Data • Identical Starting Snapshots
            </span>
          </div>
          <h3 className="text-lg font-bold text-[#191B19]">Empirical Performance Audit</h3>
          <p className="text-xs text-[#70736E] mt-0.5">
            Side-by-side comparison of Greedy Demand-Priority Baseline vs. Google OR-Tools Constrained MILP Optimizer on Real M5 Retail Sales.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Real M5 Kaggle Indicator */}
          <div className="flex items-center gap-1.5 bg-[#F7F7F4] border border-[#E5E6E0] px-2.5 py-1 rounded-lg text-xs font-semibold text-[#526B50]">
            <span>Real M5 Kaggle Data</span>
          </div>

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
            onClick={() => fetchAuditData(horizonDays)}
            disabled={loading}
            className="h-9 px-3.5 rounded-lg border border-[#E5E6E0] bg-white hover:bg-[#F7F7F4] text-xs font-semibold text-[#191B19] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Re-Audit</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
          <strong>Audit Error:</strong> {errorMsg}
        </div>
      )}

      {loading && !audit ? (
        <div className="p-12 text-center bg-white rounded-xl border border-[#E5E6E0] shadow-xs">
          <div className="w-8 h-8 border-2 border-[#526B50] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#191B19]">Computing Baseline vs. OR-Tools Audit...</p>
          <p className="text-xs text-[#70736E] mt-1">Executing identical starting demand snapshots across both engines.</p>
        </div>
      ) : audit && b && o ? (
        <>
          {/* Top Verdict Banner */}
          <div className="p-4 sm:p-5 rounded-xl bg-white border border-[#E5E6E0] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#526B50]" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#191B19]">
                  Empirical Evaluation Verdict
                </h4>
              </div>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                audit.outcome_status === 'equal'
                  ? 'bg-[#F2F2EE] text-[#70736E] border border-[#E5E6E0]'
                  : audit.outcome_status === 'optimizer_superior'
                  ? 'bg-[#EBF1EA] text-[#526B50] border border-[#D3DFD2]'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {audit.outcome_status === 'equal'
                  ? 'EQUAL PERFORMANCE (PARITY)'
                  : audit.outcome_status === 'optimizer_superior'
                  ? 'OR-TOOLS SUPERIOR'
                  : 'SERVICE LEVEL TRADEOFF'}
              </span>
            </div>
            <p className="text-sm text-[#191B19] leading-relaxed bg-[#F7F7F4] p-3 rounded-lg border border-[#E5E6E0]">
              {audit.summary_verdict}
            </p>
          </div>

          {/* Cost Accounting & Economic Reconciliation Table */}
          <div className="p-4 sm:p-5 rounded-xl bg-white border border-[#E5E6E0] shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#191B19]">
                Objective Cost Accounting & Savings Reconciliation
              </h4>
              <span className="text-[11px] text-[#70736E]">
                Total Economic Cost = Freight Cost + Shortage Penalties
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAFBF9] border-b border-[#E5E6E0] text-[11px] font-semibold text-[#70736E] uppercase">
                    <th className="py-2.5 px-3">Cost Component</th>
                    <th className="py-2.5 px-3 text-right">Greedy Baseline</th>
                    <th className="py-2.5 px-3 text-right">OR-Tools MILP</th>
                    <th className="py-2.5 px-3 text-right">Variance / Savings ($)</th>
                    <th className="py-2.5 px-3 text-right">Variance (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F0EB]">
                  <tr>
                    <td className="py-2.5 px-3 font-medium text-[#191B19]">
                      Freight / Transport Cost
                      <span className="block text-[10px] text-[#70736E]">Direct line-haul transit tariffs</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#191B19]">
                      ${b.total_transport_cost.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#191B19]">
                      ${o.total_transport_cost.toFixed(2)}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono font-semibold ${audit.cost_savings_amount > 0 ? 'text-[#526B50]' : audit.cost_savings_amount < 0 ? 'text-amber-700' : 'text-[#70736E]'}`}>
                      {audit.cost_savings_amount > 0 ? `+$${audit.cost_savings_amount.toFixed(2)}` : audit.cost_savings_amount < 0 ? `-$${Math.abs(audit.cost_savings_amount).toFixed(2)}` : '$0.00'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#70736E]">
                      {audit.cost_reduction_pct > 0 ? `+${audit.cost_reduction_pct}%` : `${audit.cost_reduction_pct}%`}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-medium text-[#191B19]">
                      Estimated Shortage Penalty
                      <span className="block text-[10px] text-[#70736E]">*Configured assumption ($25-$32.50/unit)</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#191B19]">
                      ${(b.estimated_shortage_cost || 0).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#191B19]">
                      ${(o.estimated_shortage_cost || 0).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-[#526B50]">
                      {((b.estimated_shortage_cost || 0) - (o.estimated_shortage_cost || 0)) > 0
                        ? `+$${((b.estimated_shortage_cost || 0) - (o.estimated_shortage_cost || 0)).toFixed(2)}`
                        : '$0.00'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#70736E]">
                      {audit.stockout_reduction_pct > 0 ? `+${audit.stockout_reduction_pct}%` : '0.00%'}
                    </td>
                  </tr>
                  <tr className="bg-[#FAFBF9]/80 font-bold">
                    <td className="py-2.5 px-3 text-[#191B19]">
                      Total Evaluated Economic Cost
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#191B19]">
                      ${(b.total_evaluated_cost ?? (b.total_transport_cost + (b.estimated_shortage_cost || 0))).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#526B50]">
                      ${(o.total_evaluated_cost ?? (o.total_transport_cost + (o.estimated_shortage_cost || 0))).toFixed(2)}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono text-sm ${
                      (audit.total_evaluated_savings || 0) > 0
                        ? 'text-[#526B50]'
                        : (audit.total_evaluated_savings || 0) < 0
                        ? 'text-red-700'
                        : 'text-[#191B19]'
                    }`}>
                      {(audit.total_evaluated_savings || 0) > 0
                        ? `+$${(audit.total_evaluated_savings || 0).toFixed(2)}`
                        : (audit.total_evaluated_savings || 0) < 0
                        ? `-$${Math.abs(audit.total_evaluated_savings || 0).toFixed(2)}`
                        : '$0.00'}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono text-sm ${
                      (audit.total_evaluated_savings_pct || 0) > 0
                        ? 'text-[#526B50]'
                        : (audit.total_evaluated_savings_pct || 0) < 0
                        ? 'text-red-700'
                        : 'text-[#191B19]'
                    }`}>
                      {(audit.total_evaluated_savings_pct || 0) > 0
                        ? `+${audit.total_evaluated_savings_pct}%`
                        : `${(audit.total_evaluated_savings_pct || 0)}%`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-[#70736E] mt-3 leading-relaxed">
              *Note: Freight costs reflect configured route tariffs. Shortage penalties are configured commercial assumptions. Negative savings indicate where the optimizer incurred higher freight to satisfy additional customer demand or honor FEFO constraints.
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
                  <span className="text-[#70736E]">Total Economic Cost:</span>
                  <span className="font-bold text-[#191B19]">
                    ${(b.total_evaluated_cost ?? (b.total_transport_cost + (b.estimated_shortage_cost || 0))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
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
                  <span className="text-[#41553F]">Total Economic Cost:</span>
                  <span className="font-bold text-[#526B50]">
                    ${(o.total_evaluated_cost ?? (o.total_transport_cost + (o.estimated_shortage_cost || 0))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {audit.total_evaluated_savings_pct !== undefined && audit.total_evaluated_savings_pct !== null && audit.total_evaluated_savings_pct > 0 && (
                      <span className="ml-1 text-[11px] font-semibold text-[#526B50]">
                        (-{audit.total_evaluated_savings_pct}% total savings)
                      </span>
                    )}
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
