import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Sparkles, 
  CheckCircle2, 
  Sliders, 
  Calendar,
  Database,
  Info,
  Clock
} from 'lucide-react';
import { Product, Destination, DemandRecord, fetchForecast, ForecastResult } from '../api';

interface DemandForecasterProps {
  products: Product[];
  destinations: Destination[];
  demandRecords: DemandRecord[];
  dataSource?: 'synthetic' | 'm5';
  onDataSourceChange?: (source: 'synthetic' | 'm5') => void;
}

export const DemandForecaster: React.FC<DemandForecasterProps> = ({
  products,
  destinations,
  demandRecords,
  dataSource = 'synthetic',
  onDataSourceChange
}) => {
  const [selectedProduct, setSelectedProduct] = useState<string>(products[0]?.id || '');
  const [selectedDestination, setSelectedDestination] = useState<string>(destinations[0]?.id || '');
  const [horizonDays, setHorizonDays] = useState<number>(7);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Sync selection when products/destinations change
  useEffect(() => {
    if (products.length > 0 && (!selectedProduct || !products.some(p => p.id === selectedProduct))) {
      setSelectedProduct(products[0].id);
    }
  }, [products]);

  useEffect(() => {
    if (destinations.length > 0 && (!selectedDestination || !destinations.some(d => d.id === selectedDestination))) {
      setSelectedDestination(destinations[0].id);
    }
  }, [destinations]);

  useEffect(() => {
    let isMounted = true;
    async function loadForecast() {
      if (!selectedProduct || !selectedDestination) return;
      setLoading(true);
      try {
        const res = await fetchForecast(selectedProduct, selectedDestination, horizonDays, dataSource);
        if (isMounted) setForecast(res);
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadForecast();
    return () => { isMounted = false; };
  }, [selectedProduct, selectedDestination, horizonDays, dataSource]);

  const activeProduct = products.find(p => p.id === selectedProduct);
  const activeDest = destinations.find(d => d.id === selectedDestination);

  // Filter demand records for active product
  const productDemands = demandRecords.filter(d => d.product_id === selectedProduct);

  return (
    <div className="space-y-5">
      {/* Configuration toolbar */}
      <div className="p-4 sm:p-5 rounded-xl bg-white border border-[#E5E6E0] shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Data Source Selector */}
            {onDataSourceChange && (
              <div>
                <label className="block text-[10px] font-bold text-[#70736E] uppercase tracking-wider mb-1">
                  Data Stream
                </label>
                <div className="flex items-center gap-1 bg-[#F7F7F4] border border-[#E5E6E0] p-1 rounded-lg text-xs font-medium">
                  <button
                    onClick={() => onDataSourceChange('synthetic')}
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
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      dataSource === 'm5'
                        ? 'bg-white text-[#526B50] shadow-xs font-semibold'
                        : 'text-[#70736E] hover:text-[#191B19]'
                    }`}
                  >
                    Real M5 Kaggle
                  </button>
                </div>
              </div>
            )}

            {/* Product Selector */}
            <div>
              <label className="block text-[10px] font-bold text-[#70736E] uppercase tracking-wider mb-1">
                Product / Item
              </label>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="bg-[#F7F7F4] border border-[#E5E6E0] rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#191B19] focus:outline-hidden focus:border-[#526B50] cursor-pointer"
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name.slice(0, 35)} ({p.id})</option>
                ))}
              </select>
            </div>

            {/* Destination Selector */}
            <div>
              <label className="block text-[10px] font-bold text-[#70736E] uppercase tracking-wider mb-1">
                Destination / Store
              </label>
              <select
                value={selectedDestination}
                onChange={(e) => setSelectedDestination(e.target.value)}
                className="bg-[#F7F7F4] border border-[#E5E6E0] rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#191B19] focus:outline-hidden focus:border-[#526B50] cursor-pointer"
              >
                {destinations.map(d => (
                  <option key={d.id} value={d.id}>{d.name.slice(0, 30)} ({d.id})</option>
                ))}
              </select>
            </div>

            {/* Horizon Selector */}
            <div>
              <label className="block text-[10px] font-bold text-[#70736E] uppercase tracking-wider mb-1">
                Forecast Horizon
              </label>
              <div className="flex items-center gap-1 bg-[#F7F7F4] border border-[#E5E6E0] p-1 rounded-lg text-xs font-medium">
                {[7, 14, 30].map(h => (
                  <button
                    key={h}
                    onClick={() => setHorizonDays(h)}
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
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#526B50] font-medium bg-[#EBF1EA]/60 border border-[#D3DFD2] px-3 py-1.5 rounded-lg self-start lg:self-auto">
            <Sparkles className="w-3.5 h-3.5 text-[#526B50]" />
            <span>Chronological Holdout Backtesting • Zero Lookahead</span>
          </div>
        </div>
      </div>

      {/* Model Backtesting Comparison Cards */}
      {forecast && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Baseline Moving Average Card */}
          <div className="p-4 sm:p-5 rounded-xl bg-white border border-[#E5E6E0] shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-[#70736E] uppercase tracking-wider">
                Benchmark Baseline
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F2F2EE] text-[#70736E] font-medium">
                7-Day Moving Average
              </span>
            </div>
            <h4 className="text-base font-bold text-[#191B19]">Chronological Rolling Average</h4>
            <p className="text-xs text-[#70736E] mt-0.5 mb-3">
              Historical moving average across preceding consumption days prior to each test observation.
            </p>

            <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-[#F0F0EB]">
              <div className="p-2.5 rounded-lg bg-[#F7F7F4] border border-[#E5E6E0]">
                <div className="text-[10px] font-semibold text-[#70736E] uppercase">MAE</div>
                <div className="text-sm font-bold text-[#191B19] mt-0.5">{forecast.evaluation_metrics.baseline_sma.mae} units</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#F7F7F4] border border-[#E5E6E0]">
                <div className="text-[10px] font-semibold text-[#70736E] uppercase">RMSE</div>
                <div className="text-sm font-bold text-[#191B19] mt-0.5">{forecast.evaluation_metrics.baseline_sma.rmse} units</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#F7F7F4] border border-[#E5E6E0]">
                <div className="text-[10px] font-semibold text-[#70736E] uppercase">WAPE Error</div>
                <div className="text-sm font-bold text-[#191B19] mt-0.5">{forecast.evaluation_metrics.baseline_sma.wape_pct}%</div>
              </div>
            </div>
          </div>

          {/* Machine Learning Model Card */}
          <div className="p-4 sm:p-5 rounded-xl bg-white border-2 border-[#526B50] shadow-xs relative">
            <div className="absolute top-0 right-0 bg-[#526B50] text-white text-[9px] font-bold px-2.5 py-0.5 rounded-bl-lg uppercase tracking-wider">
              Selected Model
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-[#526B50] uppercase tracking-wider">
                Machine Learning Predictor
              </span>
            </div>
            <h4 className="text-base font-bold text-[#191B19]">Seasonal Time-Series Regression</h4>
            <p className="text-xs text-[#70736E] mt-0.5 mb-3">
              Learns autoregressive lag features (lag-1, lag-7), weekly retail seasonality, and linear drift.
            </p>

            <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-[#F0F0EB]">
              <div className="p-2.5 rounded-lg bg-[#EBF1EA] border border-[#D3DFD2]">
                <div className="text-[10px] font-semibold text-[#526B50] uppercase">MAE</div>
                <div className="text-sm font-bold text-[#41553F] mt-0.5">{forecast.evaluation_metrics.ml_regression.mae} units</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#EBF1EA] border border-[#D3DFD2]">
                <div className="text-[10px] font-semibold text-[#526B50] uppercase">RMSE</div>
                <div className="text-sm font-bold text-[#41553F] mt-0.5">{forecast.evaluation_metrics.ml_regression.rmse} units</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#EBF1EA] border border-[#D3DFD2]">
                <div className="text-[10px] font-semibold text-[#526B50] uppercase">WAPE Error</div>
                <div className="text-sm font-bold text-[#41553F] mt-0.5">{forecast.evaluation_metrics.ml_regression.wape_pct}%</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Demand Distribution Table Across Destination Network */}
      <div className="rounded-xl bg-white border border-[#E5E6E0] shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#F0F0EB] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-base font-bold text-[#191B19]">
              Regional Demand Distribution: {activeProduct?.name}
            </h4>
            <p className="text-xs text-[#70736E] mt-0.5">
              Projected consumption requirements across destinations over the {horizonDays}-day planning horizon ({dataSource === 'm5' ? 'Real M5 Data' : 'Synthetic FMCG'}).
            </p>
          </div>
          <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#F7F7F4] text-[#70736E] border border-[#E5E6E0] font-medium self-start sm:self-auto">
            Total Network Demand: {productDemands.reduce((sum, d) => sum + d.forecasted_demand, 0).toLocaleString()} units
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#FAFBF9] border-b border-[#E5E6E0] text-[11px] font-semibold text-[#70736E] uppercase tracking-wider">
                <th className="py-2.5 px-3.5">Destination</th>
                <th className="py-2.5 px-3">Service Tier</th>
                <th className="py-2.5 px-3">SLA Target</th>
                <th className="py-2.5 px-3 text-right">Daily Run Rate</th>
                <th className="py-2.5 px-3.5 text-right">{horizonDays}D Horizon Demand</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0EB]">
              {productDemands.map(dr => {
                const dst = destinations.find(d => d.id === dr.destination_id);
                return (
                  <tr key={dr.destination_id} className="hover:bg-[#F9F9F7] transition-colors">
                    <td className="py-2.5 px-3.5 font-medium text-[#191B19]">
                      <div>{dst?.name || dr.destination_id}</div>
                      <div className="font-mono text-[10px] text-[#70736E]">{dr.destination_id}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        dst?.tier === 'Tier-1' 
                          ? 'bg-[#EBF1EA] text-[#526B50] border-[#D3DFD2]' 
                          : 'bg-[#F2F2EE] text-[#70736E] border-[#E5E6E0]'
                      }`}>
                        {dst?.tier || 'Tier-1'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-[#191B19]">
                      {Math.round((dst?.service_level_target || 0.95) * 100)}% SLA
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#70736E] tabular-nums">
                      {dr.historical_avg_daily.toFixed(1)} / day
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-bold text-[#191B19] tabular-nums">
                      {dr.forecasted_demand.toLocaleString()} units
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
