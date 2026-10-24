import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Sparkles, CheckCircle2, Sliders, Calendar } from 'lucide-react';
import { Product, Destination, DemandRecord, fetchForecast, ForecastResult } from '../api';

interface DemandForecasterProps {
  products: Product[];
  destinations: Destination[];
  demandRecords: DemandRecord[];
}

export const DemandForecaster: React.FC<DemandForecasterProps> = ({
  products,
  destinations,
  demandRecords
}) => {
  const [selectedProduct, setSelectedProduct] = useState<string>(products[0]?.id || 'PROD-001');
  const [selectedDestination, setSelectedDestination] = useState<string>(destinations[0]?.id || 'DEST-PUNE');
  const [horizonDays, setHorizonDays] = useState<number>(7);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function loadForecast() {
      setLoading(true);
      try {
        const res = await fetchForecast(selectedProduct, selectedDestination, horizonDays);
        if (isMounted) setForecast(res);
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadForecast();
    return () => { isMounted = false; };
  }, [selectedProduct, selectedDestination, horizonDays]);

  const activeProduct = products.find(p => p.id === selectedProduct);
  const activeDest = destinations.find(d => d.id === selectedDestination);

  // Filter demand records for active product
  const productDemands = demandRecords.filter(d => d.product_id === selectedProduct);

  return (
    <div className="space-y-6">
      {/* Configuration bar */}
      <div className="p-5 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#70736E] uppercase mb-1">Product</label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="bg-[#F7F7F4] border border-[#E5E6E0] rounded-xl px-3 py-2 text-xs font-medium text-[#191B19] focus:outline-hidden focus:border-[#526B50]"
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#70736E] uppercase mb-1">Destination</label>
            <select
              value={selectedDestination}
              onChange={(e) => setSelectedDestination(e.target.value)}
              className="bg-[#F7F7F4] border border-[#E5E6E0] rounded-xl px-3 py-2 text-xs font-medium text-[#191B19] focus:outline-hidden focus:border-[#526B50]"
            >
              {destinations.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#70736E] uppercase mb-1">Planning Horizon</label>
            <div className="flex items-center gap-1 bg-[#F7F7F4] border border-[#E5E6E0] p-1 rounded-xl text-xs font-semibold">
              {[7, 14, 30].map(h => (
                <button
                  key={h}
                  onClick={() => setHorizonDays(h)}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    horizonDays === h ? 'bg-white text-[#191B19] shadow-xs' : 'text-[#70736E] hover:text-[#191B19]'
                  }`}
                >
                  {h} Days
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#526B50] font-semibold">
          <Sparkles className="w-4 h-4" />
          <span>Chronological Time-Series Validation Active</span>
        </div>
      </div>

      {/* Model Backtesting Comparison Cards */}
      {forecast && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Baseline Moving Average Card */}
          <div className="p-6 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-[#70736E] uppercase tracking-wider">Baseline Strategy</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-[#F2F2EE] text-[#70736E] font-medium">
                7-Day Moving Average
              </span>
            </div>
            <h4 className="text-xl font-bold text-[#191B19] mb-1">Chronological Moving Average</h4>
            <p className="text-xs text-[#70736E] mb-4">Simple historical rolling average across prior 7 consumption days.</p>

            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#F0F0EB]">
              <div className="p-3 rounded-xl bg-[#F7F7F4]">
                <div className="text-[11px] text-[#70736E]">MAE (Mean Error)</div>
                <div className="text-base font-bold text-[#191B19] mt-0.5">{forecast.evaluation_metrics.baseline_sma.mae} units</div>
              </div>
              <div className="p-3 rounded-xl bg-[#F7F7F4]">
                <div className="text-[11px] text-[#70736E]">RMSE (Variance)</div>
                <div className="text-base font-bold text-[#191B19] mt-0.5">{forecast.evaluation_metrics.baseline_sma.rmse} units</div>
              </div>
              <div className="p-3 rounded-xl bg-[#F7F7F4]">
                <div className="text-[11px] text-[#70736E]">MAPE (Percentage)</div>
                <div className="text-base font-bold text-[#191B19] mt-0.5">{forecast.evaluation_metrics.baseline_sma.mape_pct}%</div>
              </div>
            </div>
          </div>

          {/* Machine Learning Model Card */}
          <div className="p-6 rounded-2xl bg-white border-2 border-[#526B50] shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-[#526B50] text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
              Recommended Model
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-[#526B50] uppercase tracking-wider">Advanced ML Engine</span>
            </div>
            <h4 className="text-xl font-bold text-[#191B19] mb-1">Seasonal Time-Series Regression</h4>
            <p className="text-xs text-[#70736E] mb-4">Incorporates day-of-week retail seasonality, weekend demand lifts, and trend lags.</p>

            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#F0F0EB]">
              <div className="p-3 rounded-xl bg-[#EBF1EA]">
                <div className="text-[11px] text-[#526B50] font-medium">MAE (Mean Error)</div>
                <div className="text-base font-bold text-[#526B50] mt-0.5">{forecast.evaluation_metrics.ml_regression.mae} units</div>
              </div>
              <div className="p-3 rounded-xl bg-[#EBF1EA]">
                <div className="text-[11px] text-[#526B50] font-medium">RMSE (Variance)</div>
                <div className="text-base font-bold text-[#526B50] mt-0.5">{forecast.evaluation_metrics.ml_regression.rmse} units</div>
              </div>
              <div className="p-3 rounded-xl bg-[#EBF1EA]">
                <div className="text-[11px] text-[#526B50] font-medium">MAPE (Percentage)</div>
                <div className="text-base font-bold text-[#526B50] mt-0.5">{forecast.evaluation_metrics.ml_regression.mape_pct}%</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Demand Distribution Table Across Destination Network */}
      <div className="p-6 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs">
        <h4 className="text-lg font-bold text-[#191B19] mb-1">
          Regional Demand Distribution for {activeProduct?.name}
        </h4>
        <p className="text-xs text-[#70736E] mb-4">
          Forecasted consumption requirements across all retail and distributor clusters over the {horizonDays}-day planning horizon.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E5E6E0] text-[#70736E] uppercase font-bold tracking-wider">
                <th className="pb-3 px-3">Destination</th>
                <th className="pb-3 px-3">Tier</th>
                <th className="pb-3 px-3">Target Service Level</th>
                <th className="pb-3 px-3 text-right">Daily Run Rate</th>
                <th className="pb-3 px-3 text-right">Horizon Demand</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0EB]">
              {productDemands.map(dr => {
                const dst = destinations.find(d => d.id === dr.destination_id);
                return (
                  <tr key={dr.destination_id} className="hover:bg-[#F7F7F4] transition-colors">
                    <td className="py-3 px-3">
                      <span className="font-semibold text-[#191B19]">{dst?.name || dr.destination_id}</span>
                      <span className="ml-2 font-mono text-[11px] text-[#70736E]">{dr.destination_id}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        dst?.tier === 'Tier-1' ? 'bg-[#EBF1EA] text-[#526B50]' : 'bg-[#F2F2EE] text-[#70736E]'
                      }`}>
                        {dst?.tier || 'Tier-1'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-[#191B19]">
                      {Math.round((dst?.service_level_target || 0.95) * 100)}% SLA
                    </td>
                    <td className="py-3 px-3 text-right text-[#70736E]">
                      {dr.historical_avg_daily.toFixed(1)} / day
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-[#191B19]">
                      {dr.forecasted_demand.toLocaleString()} {activeProduct?.uom || 'units'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
