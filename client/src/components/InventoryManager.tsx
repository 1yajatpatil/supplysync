import React, { useState, useMemo } from 'react';
import { Box, AlertCircle, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';
import { InventoryBatch, Product, Warehouse } from '../api';

interface InventoryManagerProps {
  batches: InventoryBatch[];
  products: Product[];
  warehouses: Warehouse[];
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  batches,
  products,
  warehouses
}) => {
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const prodMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const whMap = useMemo(() => new Map(warehouses.map(w => [w.id, w])), [warehouses]);

  // Filtered batch records
  const filteredBatches = useMemo(() => {
    return batches.filter(b => {
      if (selectedWarehouse !== 'all' && b.warehouse_id !== selectedWarehouse) return false;
      if (selectedProduct !== 'all' && b.product_id !== selectedProduct) return false;
      if (selectedStatus !== 'all' && b.status !== selectedStatus) return false;
      return true;
    });
  }, [batches, selectedWarehouse, selectedProduct, selectedStatus]);

  // Aggregate stats
  const totalUnits = useMemo(() => batches.reduce((sum, b) => sum + (b.is_expired ? 0 : b.quantity), 0), [batches]);
  const nearExpiryUnits = useMemo(() => batches.filter(b => b.status === 'near_expiry').reduce((sum, b) => sum + b.quantity, 0), [batches]);
  const expiredUnits = useMemo(() => batches.filter(b => b.is_expired).reduce((sum, b) => sum + b.quantity, 0), [batches]);

  return (
    <div className="space-y-6">
      {/* Expiry & Inventory Alerts Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-[#70736E] uppercase mb-1">
            <span>Usable Network Stock</span>
            <Box className="w-4 h-4 text-[#526B50]" />
          </div>
          <div className="text-2xl font-bold text-[#191B19]">{totalUnits.toLocaleString()} units</div>
          <div className="text-xs text-[#526B50] mt-1 font-medium">Active and eligible for distribution</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-[#70736E] uppercase mb-1">
            <span>Near-Expiry (FEFO Alert)</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700">{nearExpiryUnits.toLocaleString()} units</div>
          <div className="text-xs text-amber-600 mt-1 font-medium">Expires within 15 days; requires FEFO dispatch</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-[#70736E] uppercase mb-1">
            <span>Expired Deadstock</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-rose-700">{expiredUnits.toLocaleString()} units</div>
          <div className="text-xs text-rose-600 mt-1 font-medium">Quarantined; strictly prohibited from dispatch</div>
        </div>
      </div>

      {/* Expiry Risk Warning Box */}
      {expiredUnits > 0 && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-900 leading-relaxed">
            <span className="font-bold">Invariant 4 Enforcement: </span>
            A quarantined batch (<code className="font-mono bg-rose-100 px-1 py-0.5 rounded">BATCH-001-DEL-EXPIRED</code>, 450 cartons of Milk) is past its expiration date. The optimizer guarantees 0 units of this batch will be distributed.
          </div>
        </div>
      )}

      {/* Batch Table Container */}
      <div className="p-6 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#F0F0EB]">
          <div>
            <h3 className="text-lg font-bold text-[#191B19]">Retail Batch Inventory Ledger (M5 Network)</h3>
            <p className="text-xs text-[#70736E]">Inspect physical batch quantities, manufacturing dates, and shelf-life horizons.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Warehouse Filter */}
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="bg-[#F7F7F4] border border-[#E5E6E0] rounded-xl px-3 py-2 text-[#191B19] focus:outline-hidden focus:border-[#526B50]"
            >
              <option value="all">All Warehouses</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.city} ({w.id})</option>
              ))}
            </select>

            {/* Product Filter */}
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="bg-[#F7F7F4] border border-[#E5E6E0] rounded-xl px-3 py-2 text-[#191B19] focus:outline-hidden focus:border-[#526B50]"
            >
              <option value="all">All Products</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-[#F7F7F4] border border-[#E5E6E0] rounded-xl px-3 py-2 text-[#191B19] focus:outline-hidden focus:border-[#526B50]"
            >
              <option value="all">All Statuses</option>
              <option value="usable">Usable</option>
              <option value="near_expiry">Near Expiry</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto pt-4">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E5E6E0] text-[#70736E] uppercase font-bold tracking-wider">
                <th className="pb-3 px-3">Batch ID</th>
                <th className="pb-3 px-3">Product</th>
                <th className="pb-3 px-3">Warehouse</th>
                <th className="pb-3 px-3 text-right">Available Units</th>
                <th className="pb-3 px-3">Mfg Date</th>
                <th className="pb-3 px-3">Expiry Date</th>
                <th className="pb-3 px-3">Days Left</th>
                <th className="pb-3 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0EB]">
              {filteredBatches.map(b => {
                const prod = prodMap.get(b.product_id);
                const wh = whMap.get(b.warehouse_id);

                return (
                  <tr key={b.batch_id} className="hover:bg-[#F7F7F4] transition-colors">
                    <td className="py-3 px-3 font-mono font-medium text-[#191B19]">{b.batch_id}</td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-[#191B19]">{prod?.name || b.product_id}</div>
                      <div className="text-[11px] text-[#70736E]">{prod?.category}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-[#191B19] font-medium">{wh?.city || b.warehouse_id}</div>
                      <div className="text-[11px] text-[#70736E] font-mono">{b.warehouse_id}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-[#191B19]">
                      {b.quantity.toLocaleString()} {prod?.uom || 'units'}
                    </td>
                    <td className="py-3 px-3 text-[#70736E]">{b.manufacturing_date}</td>
                    <td className="py-3 px-3 text-[#70736E]">{b.expiry_date}</td>
                    <td className="py-3 px-3">
                      <span className={`font-semibold ${
                        b.days_to_expiry <= 0 ? 'text-rose-600' : (b.days_to_expiry <= 15 ? 'text-amber-600' : 'text-[#526B50]')
                      }`}>
                        {b.days_to_expiry <= 0 ? 'Expired' : `${b.days_to_expiry} days`}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {b.status === 'expired' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[11px] font-semibold">
                          <AlertCircle className="w-3 h-3" />
                          Quarantined
                        </span>
                      ) : b.status === 'near_expiry' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold">
                          <Clock className="w-3 h-3" />
                          Near Expiry
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EBF1EA] text-[#526B50] text-[11px] font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          Usable
                        </span>
                      )}
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
