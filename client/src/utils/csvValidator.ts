/**
 * SupplySync Client-Side CSV Validation Engine
 * Enforces schema integrity, data types, required fields, and cross-file referential integrity
 * before sending data to the backend optimization microservice.
 */

import { CSV_TEMPLATES, SchemaFieldDef } from './csvTemplates';
import { Product, Warehouse, Destination, InventoryBatch, Route, DemandRecord } from '../api';

export type FileUploadStatus = 'not_uploaded' | 'uploaded' | 'validating' | 'valid' | 'invalid' | 'replaced';

export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  rowCount: number;
  parsedData: any[];
}

export interface CrossFileValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a single uploaded file against its defined canonical schema.
 */
export function validateSingleCsvFile(
  fileType: 'products' | 'warehouses' | 'destinations' | 'batches' | 'routes' | 'demand',
  headers: string[],
  rows: Record<string, string>[]
): FileValidationResult {
  const template = CSV_TEMPLATES[fileType];
  if (!template) {
    return { valid: false, errors: [`Unknown file type '${fileType}'`], warnings: [], rowCount: 0, parsedData: [] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const normalizedHeaders = headers.map(h => h.trim().toLowerCase());

  // 1. Check required columns in header
  const headerMap: Record<string, string> = {}; // canonical field -> uploaded header column
  for (const field of template.fields) {
    const directMatch = normalizedHeaders.find(h => h === field.name.toLowerCase());
    if (directMatch) {
      headerMap[field.name] = directMatch;
    } else if (field.aliases) {
      const aliasMatch = normalizedHeaders.find(h => field.aliases!.map(a => a.toLowerCase()).includes(h));
      if (aliasMatch) {
        headerMap[field.name] = aliasMatch;
      }
    }

    if (field.required && !headerMap[field.name]) {
      const aliasHint = field.aliases ? ` (or accepted alias: ${field.aliases.join(', ')})` : '';
      errors.push(`${template.title}: Missing required column '${field.name}'${aliasHint}.`);
    }
  }

  // If critical required columns are missing from the header, stop and report
  if (errors.length > 0) {
    return { valid: false, errors, warnings, rowCount: rows.length, parsedData: [] };
  }

  if (rows.length === 0) {
    errors.push(`${template.title}: The uploaded CSV file has headers but contains zero data rows.`);
    return { valid: false, errors, warnings, rowCount: 0, parsedData: [] };
  }

  // 2. Validate row-by-row
  const seenIds = new Set<string>();
  const parsedData: any[] = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rowNum = idx + 2; // Row 1 is header

    // Check primary ID
    let primaryId = '';
    if (fileType === 'products' || fileType === 'warehouses' || fileType === 'destinations') {
      const idCol = headerMap['id'] || 'id';
      primaryId = (row[idCol] || '').trim();
      if (!primaryId) {
        errors.push(`${template.title}, row ${rowNum}: Required column 'id' is empty.`);
      } else if (seenIds.has(primaryId)) {
        errors.push(`${template.title}, row ${rowNum}: Duplicate identifier '${primaryId}' detected.`);
      } else {
        seenIds.add(primaryId);
      }
    } else if (fileType === 'batches') {
      const batchCol = headerMap['batch_id'] || 'batch_id';
      primaryId = (row[batchCol] || '').trim();
      if (!primaryId) {
        errors.push(`${template.title}, row ${rowNum}: Required column 'batch_id' is empty.`);
      } else if (seenIds.has(primaryId)) {
        errors.push(`${template.title}, row ${rowNum}: Duplicate batch identifier '${primaryId}' detected.`);
      } else {
        seenIds.add(primaryId);
      }
    }

    // Type-specific field validations
    if (fileType === 'products') {
      const name = (row[headerMap['name'] || 'name'] || '').trim();
      if (!name) {
        errors.push(`Products, row ${rowNum}: Required column 'name' is empty.`);
      }

      const weightStr = row[headerMap['unit_weight_kg'] || 'unit_weight_kg'];
      let unitWeight = 1.0;
      if (weightStr !== undefined && weightStr !== '') {
        unitWeight = parseFloat(weightStr);
        if (isNaN(unitWeight) || unitWeight < 0) {
          errors.push(`Products, row ${rowNum}: 'unit_weight_kg' must be a non-negative number, got '${weightStr}'.`);
        }
      }

      const shelfLifeStr = row[headerMap['shelf_life_days'] || 'shelf_life_days'];
      let shelfLife = 90;
      if (shelfLifeStr !== undefined && shelfLifeStr !== '') {
        shelfLife = parseInt(shelfLifeStr, 10);
        if (isNaN(shelfLife) || shelfLife <= 0) {
          errors.push(`Products, row ${rowNum}: 'shelf_life_days' must be a positive integer, got '${shelfLifeStr}'.`);
        }
      }

      parsedData.push({
        id: primaryId || `PROD-${idx + 1}`,
        name: name || `Product ${idx + 1}`,
        category: (row[headerMap['category'] || 'category'] || 'General').trim(),
        uom: (row[headerMap['uom'] || 'uom'] || 'units').trim(),
        unit_weight_kg: isNaN(unitWeight) ? 1.0 : unitWeight,
        shelf_life_days: isNaN(shelfLife) ? 90 : shelfLife,
        holding_cost_per_day: parseFloat(row[headerMap['holding_cost_per_day'] || 'holding_cost_per_day'] || '0.05') || 0.05,
        shortage_penalty_per_unit: parseFloat(row[headerMap['shortage_penalty_per_unit'] || 'shortage_penalty_per_unit'] || '20.0') || 20.0,
        min_shelf_life_required_days: parseInt(row[headerMap['min_shelf_life_required_days'] || 'min_shelf_life_required_days'] || '7', 10) || 7
      } as Product);
    } else if (fileType === 'warehouses') {
      const name = (row[headerMap['name'] || 'name'] || '').trim();
      if (!name) {
        errors.push(`Warehouses, row ${rowNum}: Required column 'name' is empty.`);
      }

      const capStr = row[headerMap['storage_capacity_units'] || 'storage_capacity_units'];
      let capacity = 50000;
      if (capStr !== undefined && capStr !== '') {
        capacity = parseInt(capStr, 10);
        if (isNaN(capacity) || capacity < 0) {
          errors.push(`Warehouses, row ${rowNum}: 'storage_capacity_units' must be a non-negative integer, got '${capStr}'.`);
        }
      }

      parsedData.push({
        id: primaryId || `WH-${idx + 1}`,
        name: name || `Warehouse ${idx + 1}`,
        city: (row[headerMap['city'] || 'city'] || 'City').trim(),
        state: (row[headerMap['state'] || 'state'] || 'ST').trim(),
        latitude: parseFloat(row[headerMap['latitude'] || 'latitude'] || '0.0') || 0.0,
        longitude: parseFloat(row[headerMap['longitude'] || 'longitude'] || '0.0') || 0.0,
        storage_capacity_units: isNaN(capacity) ? 50000 : capacity
      } as Warehouse);
    } else if (fileType === 'destinations') {
      const name = (row[headerMap['name'] || 'name'] || '').trim();
      if (!name) {
        errors.push(`Destinations, row ${rowNum}: Required column 'name' is empty.`);
      }

      const slaStr = row[headerMap['service_level_target'] || 'service_level_target'];
      let sla = 0.95;
      if (slaStr !== undefined && slaStr !== '') {
        sla = parseFloat(slaStr);
        if (isNaN(sla) || sla < 0 || sla > 1.0) {
          warnings.push(`Destinations, row ${rowNum}: 'service_level_target' (${slaStr}) should be between 0.00 and 1.00.`);
        }
      }

      parsedData.push({
        id: primaryId || `DEST-${idx + 1}`,
        name: name || `Destination ${idx + 1}`,
        city: (row[headerMap['city'] || 'city'] || 'City').trim(),
        state: (row[headerMap['state'] || 'state'] || 'ST').trim(),
        latitude: parseFloat(row[headerMap['latitude'] || 'latitude'] || '0.0') || 0.0,
        longitude: parseFloat(row[headerMap['longitude'] || 'longitude'] || '0.0') || 0.0,
        tier: (row[headerMap['tier'] || 'tier'] || 'Tier-1').trim(),
        service_level_target: isNaN(sla) ? 0.95 : sla
      } as Destination);
    } else if (fileType === 'batches') {
      const prodId = (row[headerMap['product_id'] || 'product_id'] || '').trim();
      if (!prodId) {
        errors.push(`Inventory Lots, row ${rowNum}: Required column 'product_id' is empty.`);
      }

      const whId = (row[headerMap['warehouse_id'] || 'warehouse_id'] || '').trim();
      if (!whId) {
        errors.push(`Inventory Lots, row ${rowNum}: Required column 'warehouse_id' is empty.`);
      }

      const qtyStr = row[headerMap['quantity'] || 'quantity'];
      let quantity = 0;
      if (qtyStr === undefined || qtyStr === '') {
        errors.push(`Inventory Lots, row ${rowNum}: Required column 'quantity' is empty.`);
      } else {
        quantity = parseInt(qtyStr, 10);
        if (isNaN(quantity) || quantity < 0) {
          errors.push(`Inventory Lots, row ${rowNum}: 'quantity' must be a non-negative integer, got '${qtyStr}'.`);
        }
      }

      const daysStr = row[headerMap['days_to_expiry'] || 'days_to_expiry'];
      let daysToExpiry = 60;
      if (daysStr === undefined || daysStr === '') {
        errors.push(`Inventory Lots, row ${rowNum}: Required column 'days_to_expiry' is empty.`);
      } else {
        daysToExpiry = parseInt(daysStr, 10);
        if (isNaN(daysToExpiry)) {
          errors.push(`Inventory Lots, row ${rowNum}: 'days_to_expiry' must be an integer, got '${daysStr}'.`);
        } else if (daysToExpiry <= 0) {
          warnings.push(`Inventory Lots, row ${rowNum}: Batch '${primaryId}' is already expired (${daysToExpiry}d) and will be excluded by FEFO.`);
        }
      }

      parsedData.push({
        batch_id: primaryId || `BATCH-${idx + 1}`,
        product_id: prodId,
        warehouse_id: whId,
        quantity: isNaN(quantity) ? 0 : quantity,
        manufacturing_date: (row[headerMap['manufacturing_date'] || 'manufacturing_date'] || new Date().toISOString().split('T')[0]).trim(),
        expiry_date: (row[headerMap['expiry_date'] || 'expiry_date'] || new Date(Date.now() + (daysToExpiry || 60) * 86400000).toISOString().split('T')[0]).trim(),
        days_to_expiry: isNaN(daysToExpiry) ? 60 : daysToExpiry,
        is_expired: daysToExpiry <= 0,
        status: daysToExpiry <= 15 ? 'near_expiry' : 'usable'
      } as InventoryBatch);
    } else if (fileType === 'routes') {
      const swid = (row[headerMap['source_warehouse_id'] || 'source_warehouse_id'] || '').trim();
      if (!swid) {
        errors.push(`Freight Routes, row ${rowNum}: Required column 'source_warehouse_id' is empty.`);
      }

      const did = (row[headerMap['destination_id'] || 'destination_id'] || '').trim();
      if (!did) {
        errors.push(`Freight Routes, row ${rowNum}: Required column 'destination_id' is empty.`);
      }

      const costStr = row[headerMap['unit_cost'] || 'unit_cost'];
      let unitCost = 1.0;
      if (costStr === undefined || costStr === '') {
        errors.push(`Freight Routes, row ${rowNum}: Required column 'unit_cost' is empty.`);
      } else {
        unitCost = parseFloat(costStr);
        if (isNaN(unitCost) || unitCost <= 0) {
          errors.push(`Freight Routes, row ${rowNum}: 'unit_cost' must be a strictly positive number ($/unit), got '${costStr}'.`);
        }
      }

      const routeKey = `${swid}->${did}`;
      if (seenIds.has(routeKey)) {
        warnings.push(`Freight Routes, row ${rowNum}: Duplicate corridor between warehouse '${swid}' and destination '${did}'.`);
      } else {
        seenIds.add(routeKey);
      }

      parsedData.push({
        source_warehouse_id: swid,
        destination_id: did,
        unit_cost: isNaN(unitCost) ? 1.0 : unitCost,
        distance_km: parseFloat(row[headerMap['distance_km'] || 'distance_km'] || '100.0') || 100.0,
        transit_time_days: parseInt(row[headerMap['transit_time_days'] || 'transit_time_days'] || '1', 10) || 1,
        max_capacity_units: row[headerMap['max_capacity_units'] || 'max_capacity_units'] ? parseInt(row[headerMap['max_capacity_units'] || 'max_capacity_units'], 10) : undefined,
        max_capacity_kg: row[headerMap['max_capacity_kg'] || 'max_capacity_kg'] ? parseFloat(row[headerMap['max_capacity_kg'] || 'max_capacity_kg']) : undefined
      } as Route);
    } else if (fileType === 'demand') {
      const did = (row[headerMap['destination_id'] || 'destination_id'] || '').trim();
      if (!did) {
        errors.push(`Demand Forecasts, row ${rowNum}: Required column 'destination_id' is empty.`);
      }

      const pid = (row[headerMap['product_id'] || 'product_id'] || '').trim();
      if (!pid) {
        errors.push(`Demand Forecasts, row ${rowNum}: Required column 'product_id' is empty.`);
      }

      const demStr = row[headerMap['forecasted_demand'] || 'forecasted_demand'];
      let demand = 0;
      if (demStr === undefined || demStr === '') {
        errors.push(`Demand Forecasts, row ${rowNum}: Required column 'forecasted_demand' is empty.`);
      } else {
        demand = parseInt(demStr, 10);
        if (isNaN(demand) || demand < 0) {
          errors.push(`Demand Forecasts, row ${rowNum}: 'forecasted_demand' must be a non-negative integer, got '${demStr}'.`);
        }
      }

      const demandKey = `${did}-${pid}`;
      if (seenIds.has(demandKey)) {
        warnings.push(`Demand Forecasts, row ${rowNum}: Multiple demand forecasts for destination '${did}' and product '${pid}'.`);
      } else {
        seenIds.add(demandKey);
      }

      parsedData.push({
        destination_id: did,
        product_id: pid,
        forecasted_demand: isNaN(demand) ? 0 : demand,
        historical_avg_daily: parseFloat(row[headerMap['historical_avg_daily'] || 'historical_avg_daily'] || (demand / 7).toFixed(1)) || (demand / 7),
        confidence_interval_pct: parseFloat(row[headerMap['confidence_interval_pct'] || 'confidence_interval_pct'] || '0.90') || 0.90
      } as DemandRecord);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    rowCount: rows.length,
    parsedData
  };
}

/**
 * Validates cross-file referential integrity among all uploaded files.
 */
export function validateCrossFileIntegrity(datasets: {
  products?: Product[];
  warehouses?: Warehouse[];
  destinations?: Destination[];
  batches?: InventoryBatch[];
  routes?: Route[];
  demand?: DemandRecord[];
}): CrossFileValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const prodIds = new Set((datasets.products || []).map(p => p.id));
  const whIds = new Set((datasets.warehouses || []).map(w => w.id));
  const destIds = new Set((datasets.destinations || []).map(d => d.id));

  // 1. Batches referential integrity
  if (datasets.batches && datasets.batches.length > 0) {
    datasets.batches.forEach((b, i) => {
      const rowNum = i + 2;
      if (datasets.products && datasets.products.length > 0 && !prodIds.has(b.product_id)) {
        errors.push(`Inventory Lots, row ${rowNum}: product_id '${b.product_id}' does not exist in Products.csv.`);
      }
      if (datasets.warehouses && datasets.warehouses.length > 0 && !whIds.has(b.warehouse_id)) {
        errors.push(`Inventory Lots, row ${rowNum}: warehouse_id '${b.warehouse_id}' does not exist in Warehouses.csv.`);
      }
    });
  }

  // 2. Routes referential integrity
  if (datasets.routes && datasets.routes.length > 0) {
    datasets.routes.forEach((r, i) => {
      const rowNum = i + 2;
      if (datasets.warehouses && datasets.warehouses.length > 0 && !whIds.has(r.source_warehouse_id)) {
        errors.push(`Freight Routes, row ${rowNum}: source_warehouse_id '${r.source_warehouse_id}' does not exist in Warehouses.csv.`);
      }
      if (datasets.destinations && datasets.destinations.length > 0 && !destIds.has(r.destination_id)) {
        errors.push(`Freight Routes, row ${rowNum}: destination_id '${r.destination_id}' does not exist in Destinations.csv.`);
      }
    });
  }

  // 3. Demand referential integrity
  if (datasets.demand && datasets.demand.length > 0) {
    datasets.demand.forEach((d, i) => {
      const rowNum = i + 2;
      if (datasets.products && datasets.products.length > 0 && !prodIds.has(d.product_id)) {
        errors.push(`Demand Forecasts, row ${rowNum}: product_id '${d.product_id}' does not exist in Products.csv.`);
      }
      if (datasets.destinations && datasets.destinations.length > 0 && !destIds.has(d.destination_id)) {
        errors.push(`Demand Forecasts, row ${rowNum}: destination_id '${d.destination_id}' does not exist in Destinations.csv.`);
      }
    });
  }

  // 4. Corridor connectivity: Every destination with demand must have at least one route connected
  if (datasets.demand && datasets.routes && datasets.destinations) {
    const routeDestinations = new Set(datasets.routes.map(r => r.destination_id));
    const demandedDestinations = new Set(datasets.demand.map(d => d.destination_id));

    demandedDestinations.forEach(did => {
      if (!routeDestinations.has(did)) {
        errors.push(`Network Topology: Destination '${did}' has customer demand, but NO freight route connects to it from any warehouse.`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
