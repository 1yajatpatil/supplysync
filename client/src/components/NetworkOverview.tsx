import React from 'react';
import { Warehouse as WarehouseIcon, Store, Truck, MapPin, ArrowRight } from 'lucide-react';
import { Warehouse, Destination, Route, Product } from '../api';

interface NetworkOverviewProps {
  warehouses: Warehouse[];
  destinations: Destination[];
  routes: Route[];
  products: Product[];
  onNavigateToOptimizer: () => void;
}

export const NetworkOverview: React.FC<NetworkOverviewProps> = ({
  warehouses,
  destinations,
  routes,
  products,
  onNavigateToOptimizer
}) => {
  return (
    <div className="space-y-6">
      {/* Top summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs">
          <div className="flex items-center justify-between text-[#70736E] text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Regional DCs</span>
            <WarehouseIcon className="w-4 h-4 text-[#526B50]" />
          </div>
          <div className="text-2xl font-bold text-[#191B19]">{warehouses.length} Hubs</div>
          <div className="text-xs text-[#70736E] mt-1">Western, Northern, Southern & Eastern DCs</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs">
          <div className="flex items-center justify-between text-[#70736E] text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Retail Clusters</span>
            <Store className="w-4 h-4 text-[#526B50]" />
          </div>
          <div className="text-2xl font-bold text-[#191B19]">{destinations.length} Hubs</div>
          <div className="text-xs text-[#70736E] mt-1">Tier-1 & Tier-2 distribution endpoints</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs">
          <div className="flex items-center justify-between text-[#70736E] text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Active Freight Lanes</span>
            <Truck className="w-4 h-4 text-[#526B50]" />
          </div>
          <div className="text-2xl font-bold text-[#191B19]">{routes.length} Corridors</div>
          <div className="text-xs text-[#70736E] mt-1">Inter-depot tariffs: $1.80 – $13.50/unit</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs">
          <div className="flex items-center justify-between text-[#70736E] text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Monitored SKUs</span>
            <span className="w-2 h-2 rounded-full bg-[#526B50]" />
          </div>
          <div className="text-2xl font-bold text-[#191B19]">{products.length} Products</div>
          <div className="text-xs text-[#70736E] mt-1">Dairy, Staples, Snacks, Oils & Personal Care</div>
        </div>
      </div>

      {/* Network Distribution Diagram / Schematic */}
      <div className="p-6 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-[#191B19]">Multi-Echelon FMCG Distribution Topology</h3>
            <p className="text-xs text-[#70736E]">
              Regional warehouses supply customer destinations across defined transportation corridors with variable freight tariffs and route capacities.
            </p>
          </div>
          <button
            onClick={onNavigateToOptimizer}
            className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-[#526B50] hover:bg-[#41553F] px-4 py-2 rounded-xl transition-all shadow-xs cursor-pointer self-start sm:self-auto"
          >
            <span>Solve Distribution Model</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Warehouses Column */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#70736E] uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-[#F0F0EB]">
              <WarehouseIcon className="w-3.5 h-3.5 text-[#526B50]" />
              <span>Source Warehouses (Supply Points)</span>
            </div>
            {warehouses.map((wh) => (
              <div key={wh.id} className="p-4 rounded-xl bg-[#F7F7F4] border border-[#E5E6E0] hover:border-[#D0D2C8] transition-all">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-[#191B19]">{wh.name}</span>
                  <span className="font-mono text-xs text-[#526B50] bg-[#EBF1EA] px-2 py-0.5 rounded border border-[#D3DFD2]">
                    {wh.id}
                  </span>
                </div>
                <div className="mt-2 text-xs text-[#70736E] flex items-center justify-between">
                  <span>Location: {wh.city}, {wh.state}</span>
                  <span>Capacity: {wh.storage_capacity_units.toLocaleString()} units</span>
                </div>
              </div>
            ))}
          </div>

          {/* Destinations Column */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#70736E] uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-[#F0F0EB]">
              <Store className="w-3.5 h-3.5 text-[#526B50]" />
              <span>Retail & Distributor Endpoints (Demand Points)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
              {destinations.map((d) => (
                <div key={d.id} className="p-3.5 rounded-xl bg-[#F7F7F4] border border-[#E5E6E0] hover:border-[#D0D2C8] transition-all">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#191B19] truncate">{d.name}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      d.tier === 'Tier-1' ? 'bg-[#EBF1EA] text-[#526B50]' : 'bg-[#F2F2EE] text-[#70736E]'
                    }`}>
                      {d.tier}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-[#70736E] flex items-center justify-between">
                    <span>{d.city}, {d.state}</span>
                    <span>SLA: {Math.round(d.service_level_target * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
