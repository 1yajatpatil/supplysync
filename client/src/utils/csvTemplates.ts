/**
 * SupplySync Canonical CSV Schemas, Downloadable Templates, & Example Datasets
 * Single source of truth for company supply-chain CSV ingestion.
 * Used by PlanningWizard, schema tables, template downloads, and client validation.
 */

export interface SchemaFieldDef {
  name: string;
  required: boolean;
  type: 'string' | 'integer' | 'float' | 'date';
  description: string;
  units?: string;
  example: string;
  aliases?: string[];
}

export interface CsvTemplateDef {
  fileKey: 'products' | 'warehouses' | 'destinations' | 'batches' | 'routes' | 'demand';
  filename: string;
  title: string;
  description: string;
  businessPurpose: string;
  fields: SchemaFieldDef[];
  sampleRows: string[][];
}

export const CSV_TEMPLATES: Record<string, CsvTemplateDef> = {
  products: {
    fileKey: 'products',
    filename: 'products_template.csv',
    title: 'Products / SKUs',
    description: 'Commercial product catalogue with shelf life and cost parameters',
    businessPurpose: 'Defines the distinct goods distributed across the network, their physical weights for truck capacity limits, and shelf-life attributes for FEFO tracking.',
    fields: [
      {
        name: 'id',
        required: true,
        type: 'string',
        description: 'Unique product SKU identifier (e.g. PROD-DAIRY-01)',
        example: 'PROD-DAIRY-01',
        aliases: ['product_id']
      },
      {
        name: 'name',
        required: true,
        type: 'string',
        description: 'Commercial description or trade name',
        example: 'Fresh Whole Milk 1L'
      },
      {
        name: 'category',
        required: false,
        type: 'string',
        description: 'Product category (Dairy, Beverages, Packaged Foods, etc.)',
        example: 'Dairy'
      },
      {
        name: 'uom',
        required: false,
        type: 'string',
        description: 'Unit of measurement (units, cases, kg)',
        units: 'units',
        example: 'units'
      },
      {
        name: 'unit_weight_kg',
        required: false,
        type: 'float',
        description: 'Physical weight per unit in kg (enforced against corridor weight limits)',
        units: 'kg',
        example: '1.03'
      },
      {
        name: 'shelf_life_days',
        required: false,
        type: 'integer',
        description: 'Total shelf life in days from manufacturing',
        units: 'days',
        example: '14'
      },
      {
        name: 'holding_cost_per_day',
        required: false,
        type: 'float',
        description: 'Daily warehouse inventory holding cost per unit',
        units: '$/unit/day',
        example: '0.08'
      },
      {
        name: 'shortage_penalty_per_unit',
        required: false,
        type: 'float',
        description: 'Commercial penalty coefficient for unfulfilled customer demand',
        units: '$/unit',
        example: '18.0'
      },
      {
        name: 'min_shelf_life_required_days',
        required: false,
        type: 'integer',
        description: 'Minimum shelf-life remaining required upon arrival at destination',
        units: 'days',
        example: '7'
      }
    ],
    sampleRows: [
      ['PROD-DAIRY-01', 'Fresh Whole Milk 1L', 'Dairy', 'units', '1.03', '14', '0.08', '18.0', '7'],
      ['PROD-DAIRY-02', 'Greek Yogurt 500g', 'Dairy', 'units', '0.52', '21', '0.06', '16.5', '7'],
      ['PROD-BEV-01', 'Orange Juice 1L', 'Beverages', 'units', '1.05', '45', '0.04', '12.0', '10'],
      ['PROD-SNACK-01', 'Oatmeal Biscuits 200g', 'Packaged Food', 'units', '0.22', '180', '0.02', '10.0', '30']
    ]
  },

  warehouses: {
    fileKey: 'warehouses',
    filename: 'warehouses_template.csv',
    title: 'Warehouses / DCs',
    description: 'Regional distribution centers (supply origins) with physical storage limits',
    businessPurpose: 'Identifies the origin facilities holding stock and provides location and storage capacity bounds for multi-echelon network balance.',
    fields: [
      {
        name: 'id',
        required: true,
        type: 'string',
        description: 'Unique warehouse or regional DC identifier (e.g. WH-CENTRAL)',
        example: 'WH-CENTRAL',
        aliases: ['warehouse_id']
      },
      {
        name: 'name',
        required: true,
        type: 'string',
        description: 'Distribution center facility name',
        example: 'Central Logistics Hub'
      },
      {
        name: 'city',
        required: false,
        type: 'string',
        description: 'City or municipal location',
        example: 'Chicago'
      },
      {
        name: 'state',
        required: false,
        type: 'string',
        description: 'State or province code',
        example: 'IL'
      },
      {
        name: 'latitude',
        required: false,
        type: 'float',
        description: 'Geographic latitude coordinate',
        example: '41.8781'
      },
      {
        name: 'longitude',
        required: false,
        type: 'float',
        description: 'Geographic longitude coordinate',
        example: '-87.6298'
      },
      {
        name: 'storage_capacity_units',
        required: false,
        type: 'integer',
        description: 'Maximum physical storage capacity in units',
        units: 'units',
        example: '50000',
        aliases: ['capacity', 'max_capacity']
      }
    ],
    sampleRows: [
      ['WH-CENTRAL', 'Central Logistics Hub', 'Chicago', 'IL', '41.8781', '-87.6298', '50000'],
      ['WH-EAST', 'Eastern Distribution Center', 'Philadelphia', 'PA', '39.9526', '-75.1652', '40000'],
      ['WH-SOUTH', 'Southern Crossdock', 'Atlanta', 'GA', '33.7490', '-84.3880', '35000']
    ]
  },

  destinations: {
    fileKey: 'destinations',
    filename: 'destinations_template.csv',
    title: 'Destinations / Stores',
    description: 'Retail stores, supermarkets, or regional distributor demand points',
    businessPurpose: 'Identifies all delivery receiving points and customer service level tiers. Tier-1 destinations carry higher priority shortage penalty weighting.',
    fields: [
      {
        name: 'id',
        required: true,
        type: 'string',
        description: 'Unique customer store or destination identifier (e.g. DEST-STORE-01)',
        example: 'DEST-STORE-01',
        aliases: ['destination_id']
      },
      {
        name: 'name',
        required: true,
        type: 'string',
        description: 'Retail store or customer name',
        example: 'Metro Supermarket Downtown'
      },
      {
        name: 'city',
        required: false,
        type: 'string',
        description: 'City or district location',
        example: 'New York'
      },
      {
        name: 'state',
        required: false,
        type: 'string',
        description: 'State or province code',
        example: 'NY'
      },
      {
        name: 'latitude',
        required: false,
        type: 'float',
        description: 'Geographic latitude coordinate',
        example: '40.7128'
      },
      {
        name: 'longitude',
        required: false,
        type: 'float',
        description: 'Geographic longitude coordinate',
        example: '-74.0060'
      },
      {
        name: 'tier',
        required: false,
        type: 'string',
        description: 'Service tier: Tier-1 (1.30x shortage penalty multiplier) or Tier-2',
        example: 'Tier-1',
        aliases: ['priority_tier']
      },
      {
        name: 'service_level_target',
        required: false,
        type: 'float',
        description: 'Target SLA fulfillment rate ratio (0.00 to 1.00)',
        example: '0.98'
      }
    ],
    sampleRows: [
      ['DEST-STORE-01', 'Metro Supermarket Downtown', 'New York', 'NY', '40.7128', '-74.0060', 'Tier-1', '0.98'],
      ['DEST-STORE-02', 'Suburban Hypermarket', 'Columbus', 'OH', '39.9612', '-82.9988', 'Tier-1', '0.95'],
      ['DEST-STORE-03', 'City Express Retail', 'Charlotte', 'NC', '35.2271', '-80.8431', 'Tier-2', '0.92'],
      ['DEST-STORE-04', 'Lakeside Market', 'Milwaukee', 'WI', '43.0389', '-87.9065', 'Tier-2', '0.90']
    ]
  },

  batches: {
    fileKey: 'batches',
    filename: 'inventory_batches_template.csv',
    title: 'Inventory Lots / Batches',
    description: 'Available physical inventory lots with production and expiration timestamps',
    businessPurpose: 'Represents discrete inventory lots held at warehouses. The Two-Phase FEFO optimizer prioritizes picking near-expiry lots to prevent spoilage.',
    fields: [
      {
        name: 'batch_id',
        required: true,
        type: 'string',
        description: 'Unique inventory consignment lot identifier (e.g. BATCH-M-001)',
        example: 'BATCH-M-001',
        aliases: ['id']
      },
      {
        name: 'product_id',
        required: true,
        type: 'string',
        description: 'Product SKU ID contained in this lot (must match Products.csv)',
        example: 'PROD-DAIRY-01'
      },
      {
        name: 'warehouse_id',
        required: true,
        type: 'string',
        description: 'Warehouse ID currently holding this lot (must match Warehouses.csv)',
        example: 'WH-CENTRAL'
      },
      {
        name: 'quantity',
        required: true,
        type: 'integer',
        description: 'Usable physical inventory units available in this lot',
        units: 'units',
        example: '450',
        aliases: ['available_quantity', 'stock']
      },
      {
        name: 'manufacturing_date',
        required: false,
        type: 'date',
        description: 'Batch production date in YYYY-MM-DD format',
        example: '2026-10-18'
      },
      {
        name: 'expiry_date',
        required: false,
        type: 'date',
        description: 'Batch expiration date in YYYY-MM-DD format',
        example: '2026-11-01'
      },
      {
        name: 'days_to_expiry',
        required: true,
        type: 'integer',
        description: 'Days until expiration from planning date (must be > 0 for usable stock)',
        units: 'days',
        example: '7',
        aliases: ['days_until_expiry', 'shelf_life_days']
      }
    ],
    sampleRows: [
      ['BATCH-M-001', 'PROD-DAIRY-01', 'WH-CENTRAL', '450', '2026-10-18', '2026-11-01', '7'],
      ['BATCH-M-002', 'PROD-DAIRY-01', 'WH-EAST', '380', '2026-10-22', '2026-11-05', '11'],
      ['BATCH-Y-001', 'PROD-DAIRY-02', 'WH-CENTRAL', '320', '2026-10-15', '2026-11-05', '11'],
      ['BATCH-Y-002', 'PROD-DAIRY-02', 'WH-SOUTH', '290', '2026-10-20', '2026-11-10', '16'],
      ['BATCH-J-001', 'PROD-BEV-01', 'WH-EAST', '500', '2026-10-01', '2026-11-15', '21'],
      ['BATCH-J-002', 'PROD-BEV-01', 'WH-SOUTH', '420', '2026-10-10', '2026-11-24', '30'],
      ['BATCH-S-001', 'PROD-SNACK-01', 'WH-CENTRAL', '800', '2026-09-01', '2027-03-01', '127']
    ]
  },

  routes: {
    fileKey: 'routes',
    filename: 'routes_template.csv',
    title: 'Freight Corridors',
    description: 'Warehouse-to-destination transportation lanes, tariffs, and capacities',
    businessPurpose: 'Defines feasible origin-to-destination transportation corridors, unit shipping tariffs, transit durations, and carrier unit/weight limits.',
    fields: [
      {
        name: 'source_warehouse_id',
        required: true,
        type: 'string',
        description: 'Origin warehouse ID (must match Warehouses.csv)',
        example: 'WH-CENTRAL',
        aliases: ['warehouse_id', 'origin_id']
      },
      {
        name: 'destination_id',
        required: true,
        type: 'string',
        description: 'Destination store ID (must match Destinations.csv)',
        example: 'DEST-STORE-01',
        aliases: ['dest_id', 'store_id']
      },
      {
        name: 'unit_cost',
        required: true,
        type: 'float',
        description: 'Freight transportation cost per unit shipped (must be > $0.00)',
        units: '$/unit',
        example: '3.20',
        aliases: ['transport_cost_per_unit', 'cost_per_unit', 'tariff']
      },
      {
        name: 'distance_km',
        required: false,
        type: 'float',
        description: 'Driving distance along corridor in kilometers',
        units: 'km',
        example: '1280.0'
      },
      {
        name: 'transit_time_days',
        required: false,
        type: 'integer',
        description: 'Transit duration in days (used in arrival shelf-life checks)',
        units: 'days',
        example: '2'
      },
      {
        name: 'max_capacity_units',
        required: false,
        type: 'integer',
        description: 'Maximum vehicle unit throughput limit on corridor',
        units: 'units',
        example: '800',
        aliases: ['capacity_units']
      },
      {
        name: 'max_capacity_kg',
        required: false,
        type: 'float',
        description: 'Maximum gross vehicle weight limit in kilograms on corridor',
        units: 'kg',
        example: '1500.0'
      }
    ],
    sampleRows: [
      ['WH-CENTRAL', 'DEST-STORE-01', '3.20', '1280.0', '2', '800', '1500.0'],
      ['WH-CENTRAL', 'DEST-STORE-02', '1.45', '510.0', '1', '1200', '2000.0'],
      ['WH-CENTRAL', 'DEST-STORE-04', '1.10', '150.0', '1', '1500', '2500.0'],
      ['WH-EAST', 'DEST-STORE-01', '1.25', '160.0', '1', '1400', '2200.0'],
      ['WH-EAST', 'DEST-STORE-02', '2.10', '720.0', '1', '900', '1600.0'],
      ['WH-EAST', 'DEST-STORE-03', '2.50', '850.0', '2', '750', '1400.0'],
      ['WH-SOUTH', 'DEST-STORE-02', '2.80', '910.0', '2', '600', '1200.0'],
      ['WH-SOUTH', 'DEST-STORE-03', '1.30', '390.0', '1', '1100', '1800.0'],
      ['WH-SOUTH', 'DEST-STORE-04', '3.40', '1350.0', '2', '500', '1000.0']
    ]
  },

  demand: {
    fileKey: 'demand',
    filename: 'demand_forecasts_template.csv',
    title: 'Demand Forecasts',
    description: 'Forecasted customer demand per store destination and product',
    businessPurpose: 'Specifies the target demand quantities that the distribution network must fulfill across the planning horizon.',
    fields: [
      {
        name: 'destination_id',
        required: true,
        type: 'string',
        description: 'Destination store ID (must match Destinations.csv)',
        example: 'DEST-STORE-01',
        aliases: ['dest_id', 'store_id']
      },
      {
        name: 'product_id',
        required: true,
        type: 'string',
        description: 'Product SKU ID demanded (must match Products.csv)',
        example: 'PROD-DAIRY-01'
      },
      {
        name: 'forecasted_demand',
        required: true,
        type: 'integer',
        description: 'Estimated customer demand units for the planning horizon',
        units: 'units',
        example: '220',
        aliases: ['quantity', 'demand']
      },
      {
        name: 'historical_avg_daily',
        required: false,
        type: 'float',
        description: 'Historical baseline daily consumption (used in variance reporting)',
        units: 'units/day',
        example: '31.4'
      },
      {
        name: 'confidence_interval_pct',
        required: false,
        type: 'float',
        description: 'Forecast statistical confidence percentage (0.00 to 1.00)',
        example: '0.92'
      }
    ],
    sampleRows: [
      ['DEST-STORE-01', 'PROD-DAIRY-01', '220', '31.4', '0.92'],
      ['DEST-STORE-01', 'PROD-DAIRY-02', '150', '21.4', '0.90'],
      ['DEST-STORE-01', 'PROD-BEV-01', '180', '25.7', '0.91'],
      ['DEST-STORE-02', 'PROD-DAIRY-01', '280', '40.0', '0.94'],
      ['DEST-STORE-02', 'PROD-DAIRY-02', '210', '30.0', '0.93'],
      ['DEST-STORE-02', 'PROD-BEV-01', '240', '34.2', '0.95'],
      ['DEST-STORE-02', 'PROD-SNACK-01', '350', '50.0', '0.96'],
      ['DEST-STORE-03', 'PROD-DAIRY-01', '190', '27.1', '0.91'],
      ['DEST-STORE-03', 'PROD-BEV-01', '260', '37.1', '0.93'],
      ['DEST-STORE-04', 'PROD-DAIRY-02', '170', '24.2', '0.90'],
      ['DEST-STORE-04', 'PROD-SNACK-01', '250', '35.7', '0.92']
    ]
  }
};

// Aliases for backward compatibility
CSV_TEMPLATES['inventory_batches'] = CSV_TEMPLATES['batches'];

/**
 * Downloads a CSV template:
 * - If withSampleRows is true, includes 2-4 realistic example rows.
 * - If withSampleRows is false, downloads an empty template containing headers only.
 */
export function downloadCsvTemplate(type: string, withSampleRows: boolean = true): void {
  const normalizedKey = type === 'inventory_batches' ? 'batches' : type;
  const def = CSV_TEMPLATES[normalizedKey];
  if (!def) return;

  const headerRow = def.fields.map(f => f.name).join(',');
  const lines = [headerRow];

  if (withSampleRows) {
    for (const row of def.sampleRows) {
      lines.push(row.join(','));
    }
  }

  const csvContent = lines.join('\n');
  const filename = withSampleRows ? def.filename : def.filename.replace('_template.csv', '_empty_template.csv');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Pre-packaged valid custom FMCG dataset for 1-click evaluation
 * Returns typed objects matching frontend Product, Warehouse, etc.
 */
export function getSampleCustomDataset() {
  const products = CSV_TEMPLATES.products.sampleRows.map(r => ({
    id: r[0],
    name: r[1],
    category: r[2],
    uom: r[3],
    unit_weight_kg: parseFloat(r[4]),
    shelf_life_days: parseInt(r[5], 10),
    holding_cost_per_day: parseFloat(r[6]),
    shortage_penalty_per_unit: parseFloat(r[7]),
    min_shelf_life_required_days: parseInt(r[8], 10) || 7
  }));

  const warehouses = CSV_TEMPLATES.warehouses.sampleRows.map(r => ({
    id: r[0],
    name: r[1],
    city: r[2],
    state: r[3],
    latitude: parseFloat(r[4]),
    longitude: parseFloat(r[5]),
    storage_capacity_units: parseInt(r[6], 10)
  }));

  const destinations = CSV_TEMPLATES.destinations.sampleRows.map(r => ({
    id: r[0],
    name: r[1],
    city: r[2],
    state: r[3],
    latitude: parseFloat(r[4]),
    longitude: parseFloat(r[5]),
    tier: r[6],
    service_level_target: parseFloat(r[7])
  }));

  const batches = CSV_TEMPLATES.batches.sampleRows.map(r => ({
    batch_id: r[0],
    product_id: r[1],
    warehouse_id: r[2],
    quantity: parseInt(r[3], 10),
    manufacturing_date: r[4],
    expiry_date: r[5],
    days_to_expiry: parseInt(r[6], 10),
    is_expired: parseInt(r[6], 10) <= 0,
    status: parseInt(r[6], 10) <= 15 ? 'near_expiry' : 'usable'
  }));

  const routes = CSV_TEMPLATES.routes.sampleRows.map(r => ({
    source_warehouse_id: r[0],
    destination_id: r[1],
    unit_cost: parseFloat(r[2]),
    distance_km: parseFloat(r[3]),
    transit_time_days: parseInt(r[4], 10),
    max_capacity_units: r[5] ? parseInt(r[5], 10) : undefined,
    max_capacity_kg: r[6] ? parseFloat(r[6]) : undefined
  }));

  const demand = CSV_TEMPLATES.demand.sampleRows.map(r => ({
    destination_id: r[0],
    product_id: r[1],
    forecasted_demand: parseInt(r[2], 10),
    historical_avg_daily: parseFloat(r[3]),
    confidence_interval_pct: parseFloat(r[4])
  }));

  return { products, warehouses, destinations, batches, routes, demand };
}
