import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Database,
  Upload,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Download,
  Check,
  Layers,
  ChevronDown,
  ChevronUp,
  Building2,
  Store,
  Package,
  Truck,
  TrendingUp,
  SlidersHorizontal,
  Play
} from 'lucide-react';
import {
  Product,
  Warehouse,
  Destination,
  InventoryBatch,
  Route,
  DemandRecord,
  OptimizationPlan,
  ComparisonAudit,
  validateDataset,
  DatasetValidationResponse,
  runOptimizedPlan,
  runComparisonAudit
} from '../api';
import {
  CSV_TEMPLATES,
  downloadCsvTemplate,
  getSampleCustomDataset
} from '../utils/csvTemplates';
import { parseCsvText } from '../utils/csvParser';
import {
  validateSingleCsvFile,
  validateCrossFileIntegrity,
  FileUploadStatus
} from '../utils/csvValidator';

export type WizardStep = 'source' | 'data' | 'validate' | 'configure' | 'optimize' | 'results';

export interface UploadedFileInfo<T> {
  name: string;
  size: number;
  count: number;
  data: T[];
  status: FileUploadStatus;
  errors: string[];
  warnings: string[];
  isSampleData?: boolean;
}

interface PlanningWizardProps {
  onCancel: () => void;
  onOpenAdvancedDashboard: (plan?: OptimizationPlan) => void;
  initialSource?: 'm5' | 'uploaded';
  m5Data: {
    products: Product[];
    warehouses: Warehouse[];
    destinations: Destination[];
    batches: InventoryBatch[];
    routes: Route[];
    demand: DemandRecord[];
  };
}

export const PlanningWizard: React.FC<PlanningWizardProps> = ({
  onCancel,
  onOpenAdvancedDashboard,
  initialSource = 'uploaded',
  m5Data
}) => {
  // Step state
  const [currentStep, setCurrentStep] = useState<WizardStep>('source');
  const [selectedSource, setSelectedSource] = useState<'m5' | 'uploaded'>(initialSource);

  // Horizon configuration
  const [horizonDays, setHorizonDays] = useState<number>(7);

  // Uploaded dataset state with detailed metadata
  const [uploadedFiles, setUploadedFiles] = useState<{
    products?: UploadedFileInfo<Product>;
    warehouses?: UploadedFileInfo<Warehouse>;
    destinations?: UploadedFileInfo<Destination>;
    batches?: UploadedFileInfo<InventoryBatch>;
    routes?: UploadedFileInfo<Route>;
    demand?: UploadedFileInfo<DemandRecord>;
  }>({});

  // Schema expansion accordion state per card
  const [expandedSchemas, setExpandedSchemas] = useState<Record<string, boolean>>({});

  // Active dataset for optimization
  const activeDataset = useMemo(() => {
    if (selectedSource === 'm5') {
      return {
        products: m5Data.products,
        warehouses: m5Data.warehouses,
        destinations: m5Data.destinations,
        batches: m5Data.batches,
        routes: m5Data.routes,
        demand: m5Data.demand
      };
    }
    return {
      products: uploadedFiles.products?.data || [],
      warehouses: uploadedFiles.warehouses?.data || [],
      destinations: uploadedFiles.destinations?.data || [],
      batches: uploadedFiles.batches?.data || [],
      routes: uploadedFiles.routes?.data || [],
      demand: uploadedFiles.demand?.data || []
    };
  }, [selectedSource, m5Data, uploadedFiles]);

  // Client-side cross-file validation
  const crossFileResult = useMemo(() => {
    if (selectedSource !== 'uploaded') {
      return { valid: true, errors: [], warnings: [] };
    }
    return validateCrossFileIntegrity({
      products: uploadedFiles.products?.data,
      warehouses: uploadedFiles.warehouses?.data,
      destinations: uploadedFiles.destinations?.data,
      batches: uploadedFiles.batches?.data,
      routes: uploadedFiles.routes?.data,
      demand: uploadedFiles.demand?.data
    });
  }, [selectedSource, uploadedFiles]);

  // Check if all 6 custom files are uploaded and valid
  const isAllCustomFilesReady = useMemo(() => {
    if (selectedSource === 'm5') return true;
    const fileKeys = ['products', 'warehouses', 'destinations', 'batches', 'routes', 'demand'] as const;
    const allUploaded = fileKeys.every(k => Boolean(uploadedFiles[k]) && uploadedFiles[k]!.data.length > 0);
    const noFileErrors = fileKeys.every(k => !uploadedFiles[k] || uploadedFiles[k]!.errors.length === 0);
    return allUploaded && noFileErrors && crossFileResult.errors.length === 0;
  }, [selectedSource, uploadedFiles, crossFileResult]);

  // Validation state
  const [validating, setValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<DatasetValidationResponse | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Optimization execution state
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [optimizationProgress, setOptimizationProgress] = useState<string>('Initializing');
  const [activePlan, setActivePlan] = useState<OptimizationPlan | null>(null);
  const [comparisonAudit, setComparisonAudit] = useState<ComparisonAudit | null>(null);
  const [optimizationError, setOptimizationError] = useState<string | null>(null);

  // Table filter state in results
  const [filterWh, setFilterWh] = useState<string>('all');
  const [filterDest, setFilterDest] = useState<string>('all');
  const [filterExpiry, setFilterExpiry] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const rowsPerPage = 10;

  // Toggle schema table expansion
  const toggleSchemaExpand = (key: string) => {
    setExpandedSchemas(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Run validation whenever entering 'validate' step
  const executeValidation = useCallback(async () => {
    setValidating(true);
    setValidationError(null);
    try {
      const res = await validateDataset({
        products: activeDataset.products,
        warehouses: activeDataset.warehouses,
        destinations: activeDataset.destinations,
        batches: activeDataset.batches,
        routes: activeDataset.routes,
        demand_records: activeDataset.demand
      });
      setValidationResult(res);
    } catch (err: any) {
      console.error('Validation error:', err);
      setValidationError(err.message || 'Dataset validation service unavailable');
    } finally {
      setValidating(false);
    }
  }, [activeDataset]);

  useEffect(() => {
    if (currentStep === 'validate') {
      executeValidation();
    }
  }, [currentStep, executeValidation]);

  // Handle single file upload and validation
  const handleFileUpload = (
    type: 'products' | 'warehouses' | 'destinations' | 'batches' | 'routes' | 'demand',
    file: File
  ) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert(`Invalid file extension: '${file.name}'. Only supported .csv files are accepted.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const { headers, rows } = parseCsvText(text);

        const validation = validateSingleCsvFile(type, headers, rows);

        setUploadedFiles(prev => ({
          ...prev,
          [type]: {
            name: file.name,
            size: file.size,
            count: validation.rowCount,
            data: validation.parsedData,
            status: validation.valid ? (prev[type] ? 'replaced' : 'valid') : 'invalid',
            errors: validation.errors,
            warnings: validation.warnings,
            isSampleData: false
          }
        }));
      } catch (err: any) {
        alert(`Failed to parse CSV file: ${err?.message || 'Invalid CSV syntax'}`);
      }
    };
    reader.readAsText(file);
  };

  // Pre-load example custom FMCG dataset
  const handleLoadSampleCustomData = () => {
    const sample = getSampleCustomDataset();
    setUploadedFiles({
      products: {
        name: 'sample_beverages_dairy_products.csv',
        size: 1024,
        count: sample.products.length,
        data: sample.products as Product[],
        status: 'valid',
        errors: [],
        warnings: [],
        isSampleData: true
      },
      warehouses: {
        name: 'sample_distribution_centers.csv',
        size: 850,
        count: sample.warehouses.length,
        data: sample.warehouses as Warehouse[],
        status: 'valid',
        errors: [],
        warnings: [],
        isSampleData: true
      },
      destinations: {
        name: 'sample_retail_destinations.csv',
        size: 920,
        count: sample.destinations.length,
        data: sample.destinations as Destination[],
        status: 'valid',
        errors: [],
        warnings: [],
        isSampleData: true
      },
      batches: {
        name: 'sample_inventory_batches_fefo.csv',
        size: 1450,
        count: sample.batches.length,
        data: sample.batches as InventoryBatch[],
        status: 'valid',
        errors: [],
        warnings: [],
        isSampleData: true
      },
      routes: {
        name: 'sample_freight_routes.csv',
        size: 1200,
        count: sample.routes.length,
        data: sample.routes as Route[],
        status: 'valid',
        errors: [],
        warnings: [],
        isSampleData: true
      },
      demand: {
        name: 'sample_forecasted_demand.csv',
        size: 1380,
        count: sample.demand.length,
        data: sample.demand as DemandRecord[],
        status: 'valid',
        errors: [],
        warnings: [],
        isSampleData: true
      }
    });
  };

  // Clear single uploaded file
  const handleClearFile = (type: 'products' | 'warehouses' | 'destinations' | 'batches' | 'routes' | 'demand') => {
    setUploadedFiles(prev => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
  };

  // Run real optimization
  const handleExecuteOptimization = async () => {
    setIsOptimizing(true);
    setOptimizationError(null);
    setOptimizationProgress('Formulating Mathematical Constraints...');

    try {
      setTimeout(() => setOptimizationProgress('Solving Google OR-Tools SCIP MILP...'), 250);

      const customBundle = selectedSource === 'uploaded' ? {
        products: activeDataset.products,
        warehouses: activeDataset.warehouses,
        destinations: activeDataset.destinations,
        batches: activeDataset.batches,
        routes: activeDataset.routes,
        demand: activeDataset.demand
      } : undefined;

      // 1. Solve optimal plan
      const plan = await runOptimizedPlan(horizonDays, selectedSource, customBundle);
      setActivePlan(plan);

      // 2. Fetch baseline audit comparison
      setOptimizationProgress('Evaluating Baseline Parity Audit...');
      try {
        const audit = await runComparisonAudit(horizonDays, selectedSource, customBundle);
        setComparisonAudit(audit);
      } catch (cmpErr) {
        console.warn('Comparison audit failed, showing direct plan', cmpErr);
      }

      setCurrentStep('results');
    } catch (err: any) {
      console.error('Optimization run failed:', err);
      setOptimizationError(err.message || 'Mixed-Integer Linear Program failed to solve.');
    } finally {
      setIsOptimizing(false);
    }
  };

  // Filter recommendations in results
  const filteredRecommendations = useMemo(() => {
    if (!activePlan) return [];
    return activePlan.recommendations.filter(r => {
      if (filterWh !== 'all' && r.source_warehouse_id !== filterWh) return false;
      if (filterDest !== 'all' && r.destination_id !== filterDest) return false;
      if (filterExpiry === 'near_expiry' && r.batch_days_to_expiry > 15) return false;
      if (filterExpiry === 'healthy' && r.batch_days_to_expiry <= 15) return false;
      return true;
    });
  }, [activePlan, filterWh, filterDest, filterExpiry]);

  const totalPages = Math.max(1, Math.ceil(filteredRecommendations.length / rowsPerPage));
  const paginatedRecs = filteredRecommendations.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  // Network throughput metrics
  const warehouseThroughput = useMemo(() => {
    if (!activePlan) return [];
    const counts: Record<string, { name: string; units: number; consignments: number; cost: number }> = {};
    for (const rec of activePlan.recommendations) {
      if (!counts[rec.source_warehouse_id]) {
        counts[rec.source_warehouse_id] = { name: rec.source_warehouse_name, units: 0, consignments: 0, cost: 0 };
      }
      counts[rec.source_warehouse_id].units += rec.allocated_quantity;
      counts[rec.source_warehouse_id].consignments += 1;
      counts[rec.source_warehouse_id].cost += rec.total_transport_cost;
    }
    return Object.entries(counts).map(([id, data]) => ({ id, ...data }));
  }, [activePlan]);

  const destinationThroughput = useMemo(() => {
    if (!activePlan) return [];
    const counts: Record<string, { name: string; fulfilled: number; demand: number; consignments: number }> = {};
    for (const rec of activePlan.recommendations) {
      if (!counts[rec.destination_id]) {
        counts[rec.destination_id] = { name: rec.destination_name, fulfilled: 0, demand: rec.destination_demand, consignments: 0 };
      }
      counts[rec.destination_id].fulfilled += rec.allocated_quantity;
      counts[rec.destination_id].consignments += 1;
    }
    return Object.entries(counts).map(([id, data]) => ({ id, ...data }));
  }, [activePlan]);

  // Step definition for header stepper
  const stepsList = [
    { id: 'source', label: 'Data Source' },
    { id: 'data', label: 'Load Data' },
    { id: 'validate', label: 'Validation' },
    { id: 'configure', label: 'Configure' },
    { id: 'optimize', label: 'Optimize' },
    { id: 'results', label: 'Results' }
  ];

  const currentStepIndex = stepsList.findIndex(s => s.id === currentStep);

  const handleExportCSV = () => {
    if (!activePlan) return;
    const targetRecs = filteredRecommendations.length > 0 ? filteredRecommendations : activePlan.recommendations;
    const rows = [
      ["Run ID", "Strategy", "Data Source", "Horizon Days", "Recommendation ID", "Product ID", "Product Name", "Source WH ID", "Source WH Name", "Destination ID", "Destination Name", "Batch ID", "Batch Days to Expiry", "Allocated Qty", "Unit Cost ($)", "Total Cost ($)", "Destination Demand", "Rationale"],
      ...targetRecs.map(r => [
        activePlan.run_id,
        activePlan.strategy,
        activePlan.data_source || selectedSource,
        activePlan.planning_horizon_days.toString(),
        r.recommendation_id,
        r.product_id,
        `"${r.product_name.replace(/"/g, '""')}"`,
        r.source_warehouse_id,
        `"${r.source_warehouse_name.replace(/"/g, '""')}"`,
        r.destination_id,
        `"${r.destination_name.replace(/"/g, '""')}"`,
        r.batch_id,
        r.batch_days_to_expiry.toString(),
        r.allocated_quantity.toString(),
        r.unit_transport_cost.toFixed(2),
        r.total_transport_cost.toFixed(2),
        r.destination_demand.toString(),
        `"${r.rationale.replace(/"/g, '""')}"`
      ])
    ];
    const csvContent = rows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `supplysync_distribution_${activePlan.run_id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const fileConfigList: Array<{
    type: 'products' | 'warehouses' | 'destinations' | 'batches' | 'routes' | 'demand';
    icon: React.ReactNode;
    title: string;
    subtitle: string;
  }> = [
    { type: 'products', icon: <Package className="w-4 h-4 text-[#526B50]" />, title: 'Products / SKUs', subtitle: 'Commercial catalogue, weights & shelf life' },
    { type: 'warehouses', icon: <Building2 className="w-4 h-4 text-[#526B50]" />, title: 'Warehouses / DCs', subtitle: 'Storage hubs, locations & capacities' },
    { type: 'destinations', icon: <Store className="w-4 h-4 text-[#526B50]" />, title: 'Destinations / Stores', subtitle: 'Retail stores, clusters & SLA tiers' },
    { type: 'batches', icon: <Layers className="w-4 h-4 text-[#526B50]" />, title: 'Inventory Batches', subtitle: 'Physical stock lots & expiration dates' },
    { type: 'routes', icon: <Truck className="w-4 h-4 text-[#526B50]" />, title: 'Freight Corridors', subtitle: 'Lanes, unit tariffs & truck capacities' },
    { type: 'demand', icon: <TrendingUp className="w-4 h-4 text-[#526B50]" />, title: 'Demand Forecasts', subtitle: 'Store-level customer demand quantities' }
  ];

  return (
    <div className="min-h-screen bg-[#F7F7F4] text-[#191B19] flex flex-col font-sans">
      {/* Top Wizard Navigation Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E5E6E0] shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="p-2 rounded-xl text-[#70736E] hover:text-[#191B19] hover:bg-[#F7F7F4] transition-colors border border-[#E5E6E0] cursor-pointer"
              title="Cancel and return to home"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#526B50] uppercase tracking-wider">
                  Planning Workflow
                </span>
                <span className="w-1 h-1 rounded-full bg-[#E5E6E0]" />
                <span className="text-xs text-[#70736E]">
                  Step {currentStepIndex + 1} of {stepsList.length}
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-bold text-[#191B19]">
                {stepsList[currentStepIndex].label}
              </h1>
            </div>
          </div>

          {/* Stepper Dots (Desktop) */}
          <div className="hidden md:flex items-center gap-2">
            {stepsList.map((step, idx) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center transition-all ${
                    idx < currentStepIndex
                      ? 'bg-[#EBF1EA] text-[#526B50] border border-[#D3DFD2]'
                      : idx === currentStepIndex
                      ? 'bg-[#191B19] text-white shadow-xs'
                      : 'bg-[#F7F7F4] text-[#A5A8A0] border border-[#E5E6E0]'
                  }`}
                >
                  {idx < currentStepIndex ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                </div>
                {idx < stepsList.length - 1 && (
                  <div
                    className={`w-8 h-0.5 mx-1 transition-colors ${
                      idx < currentStepIndex ? 'bg-[#526B50]' : 'bg-[#E5E6E0]'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Exit / Save controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 rounded-lg border border-[#E5E6E0] bg-white text-xs font-medium text-[#70736E] hover:text-[#191B19] cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </header>

      {/* Main Wizard Content Area */}
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-8 w-full flex flex-col justify-between">
        
        {/* ================= STEP 1: CHOOSE DATA SOURCE ================= */}
        {currentStep === 'source' && (
          <div className="space-y-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EBF1EA] text-[#526B50] text-xs font-semibold mb-2">
                <Database className="w-3.5 h-3.5" />
                <span>Step 1: Data Source Selection</span>
              </div>
              <h2 className="text-2xl font-bold text-[#191B19]">Configure Your Distribution Network</h2>
              <p className="text-sm text-[#70736E] mt-1 max-w-2xl leading-relaxed">
                Upload your company&apos;s supply-chain data to generate optimized inventory allocation recommendations. Alternatively, explore SupplySync using our sample datasets.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              {/* PRIMARY CARD: Upload Your Company Data (Visually Prominent) */}
              <div
                onClick={() => setSelectedSource('uploaded')}
                className={`p-6 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative ${
                  selectedSource === 'uploaded'
                    ? 'bg-white border-[#526B50] shadow-md ring-2 ring-[#526B50]/30'
                    : 'bg-white border-[#CCD0C4] hover:border-[#526B50] shadow-xs'
                }`}
              >
                <div className="absolute top-4 right-4">
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#EBF1EA] text-[#526B50] border border-[#D3DFD2]">
                    Primary Option
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl bg-[#EBF1EA] text-[#526B50] flex items-center justify-center shrink-0">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[#191B19]">Upload Your Company Data</h3>
                      <p className="text-xs text-[#526B50] font-semibold">General-Purpose Distribution Planning</p>
                    </div>
                  </div>

                  <p className="text-xs text-[#70736E] leading-relaxed">
                    Import your products, warehouses, destinations, inventory lots, freight routes, and demand forecasts using our supported CSV templates.
                  </p>

                  <div className="mt-4 p-3.5 rounded-xl bg-[#F7F7F4] border border-[#E5E6E0] space-y-2 text-xs">
                    <div className="font-semibold text-[#191B19] mb-1 text-[11px] uppercase tracking-wider">
                      Supported Capabilities:
                    </div>
                    <div className="flex items-center gap-2 text-[#70736E]">
                      <Check className="w-3.5 h-3.5 text-[#526B50] shrink-0" />
                      <span>Six structured CSV templates</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#70736E]">
                      <Check className="w-3.5 h-3.5 text-[#526B50] shrink-0" />
                      <span>Downloadable schemas with example rows</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#70736E]">
                      <Check className="w-3.5 h-3.5 text-[#526B50] shrink-0" />
                      <span>Data validation before optimization</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#70736E]">
                      <Check className="w-3.5 h-3.5 text-[#526B50] shrink-0" />
                      <span>Company-specific distribution planning</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#F0F0EB] flex items-center justify-between">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSource('uploaded');
                      setCurrentStep('data');
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#526B50] hover:bg-[#41553F] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Upload Company Data</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* SECONDARY CARD: Explore with Sample Data */}
              <div
                onClick={() => setSelectedSource('m5')}
                className={`p-6 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                  selectedSource === 'm5'
                    ? 'bg-white border-[#526B50] shadow-md ring-2 ring-[#526B50]/30'
                    : 'bg-white border-[#E5E6E0] hover:border-[#CCD0C4] shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-[#F0F1EB] text-[#70736E] flex items-center justify-center">
                      <Database className="w-5 h-5 text-[#526B50]" />
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#F2F4F1] text-[#70736E] border border-[#E5E6E0]">
                      Demonstration Sample
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-[#191B19]">Explore with Sample Data</h3>
                  <p className="text-xs text-[#70736E] mt-1.5 leading-relaxed">
                    Explore the optimization engine using a bundled Walmart M5 historical sales sample with clearly identified logistics assumptions.
                  </p>

                  <div className="mt-4 p-3.5 rounded-xl bg-[#F7F7F4] border border-[#E5E6E0] space-y-1.5 text-xs">
                    <div className="flex justify-between text-[#70736E]">
                      <span>Sample Scope:</span>
                      <span className="font-semibold text-[#191B19]">5 products, 4 store destinations</span>
                    </div>
                    <div className="flex justify-between text-[#70736E]">
                      <span>Logistics Infrastructure:</span>
                      <span className="font-semibold text-[#191B19]">3 regional DCs, 17 lots (3,430 units)</span>
                    </div>
                    <div className="flex justify-between text-[#70736E]">
                      <span>Observed Data:</span>
                      <span className="font-semibold text-[#526B50]">Historical daily sales & selling prices</span>
                    </div>
                    <div className="flex justify-between text-[#70736E]">
                      <span>Logistics Assumptions:</span>
                      <span className="font-semibold text-amber-700">Tariffs, capacities, batch expiry dates</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#F0F0EB] flex items-center justify-between">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSource('m5');
                      setCurrentStep('data');
                    }}
                    className="w-full py-2.5 px-4 rounded-xl border border-[#CCD0C4] bg-[#F7F7F4] hover:bg-[#EBECE6] text-[#191B19] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Try Sample Demo</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 2: LOAD OR UPLOAD DATA ================= */}
        {currentStep === 'data' && (
          <div className="space-y-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EBF1EA] text-[#526B50] text-xs font-semibold mb-2">
                <Layers className="w-3.5 h-3.5" />
                <span>Step 2: {selectedSource === 'm5' ? 'Verify Sample Data' : 'Upload Company CSV Files'}</span>
              </div>
              <h2 className="text-2xl font-bold text-[#191B19]">
                {selectedSource === 'm5' ? 'Walmart M5 Demonstration Sample' : 'Upload Multi-Echelon Company CSV Files'}
              </h2>
              <p className="text-sm text-[#70736E] mt-1 max-w-2xl leading-relaxed">
                {selectedSource === 'm5'
                  ? 'Review the verified Walmart M5 retail sales sample. Observed sales and selling prices are combined with configured logistics infrastructure.'
                  : 'Provide your company\'s network data using our 6 structured CSV schemas. Inspect the required columns and units for each file, download templates, or test the flow with a simulated FMCG network.'}
              </p>
            </div>

            {/* If Option A: M5 Sample Overview */}
            {selectedSource === 'm5' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="p-3.5 rounded-xl bg-white border border-[#E5E6E0] shadow-2xs">
                    <div className="text-[11px] text-[#70736E] font-medium">Products</div>
                    <div className="text-xl font-bold text-[#191B19] mt-1">{m5Data.products.length}</div>
                    <div className="text-[10px] text-[#526B50] mt-0.5">{m5Data.products.length} selected M5 items</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white border border-[#E5E6E0] shadow-2xs">
                    <div className="text-[11px] text-[#70736E] font-medium">Warehouses</div>
                    <div className="text-xl font-bold text-[#191B19] mt-1">{m5Data.warehouses.length}</div>
                    <div className="text-[10px] text-[#70736E] mt-0.5">Regional DCs</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white border border-[#E5E6E0] shadow-2xs">
                    <div className="text-[11px] text-[#70736E] font-medium">Destinations</div>
                    <div className="text-xl font-bold text-[#191B19] mt-1">{m5Data.destinations.length}</div>
                    <div className="text-[10px] text-[#70736E] mt-0.5">CA &amp; TX Stores</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white border border-[#E5E6E0] shadow-2xs">
                    <div className="text-[11px] text-[#70736E] font-medium">Inventory Lots</div>
                    <div className="text-xl font-bold text-[#191B19] mt-1">{m5Data.batches.length}</div>
                    <div className="text-[10px] text-[#526B50] mt-0.5">FEFO Batches</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white border border-[#E5E6E0] shadow-2xs">
                    <div className="text-[11px] text-[#70736E] font-medium">Routes</div>
                    <div className="text-xl font-bold text-[#191B19] mt-1">{m5Data.routes.length}</div>
                    <div className="text-[10px] text-[#70736E] mt-0.5">Active Corridors</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white border border-[#E5E6E0] shadow-2xs">
                    <div className="text-[11px] text-[#70736E] font-medium">Demand Records</div>
                    <div className="text-xl font-bold text-[#191B19] mt-1">{m5Data.demand.length}</div>
                    <div className="text-[10px] text-[#70736E] mt-0.5">7D Forecast Window</div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#EBF1EA]/50 border border-[#D3DFD2] text-xs text-[#41553F] space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#526B50]" />
                    <span>Real M5 Demonstration Sample Ready</span>
                  </div>
                  <p>
                    Historical sales from Walmart store sales series in California are loaded into the optimization engine. Continue to data validation to confirm all invariants before solving.
                  </p>
                </div>
              </div>
            )}

            {/* If Option B: Upload Controls */}
            {selectedSource === 'uploaded' && (
              <div className="space-y-6">
                {/* 1-Click Example Dataset Helper */}
                <div className="p-4 rounded-2xl bg-white border border-[#CCD0C4] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-[#191B19]">Load Example FMCG Dataset</h4>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
                        Simulated Operational Data
                      </span>
                    </div>
                    <p className="text-xs text-[#70736E]">
                      Load a ready-to-run example FMCG distribution network (Beverages & Dairy) to evaluate the planning workflow without preparing CSV files.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLoadSampleCustomData}
                    className="px-4 py-2 rounded-xl bg-[#526B50] hover:bg-[#41553F] text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Load Example FMCG Dataset</span>
                  </button>
                </div>

                {/* 6 Upload Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {fileConfigList.map(({ type, icon, title, subtitle }) => {
                    const template = CSV_TEMPLATES[type];
                    const fileInfo = uploadedFiles[type];
                    const isExpanded = Boolean(expandedSchemas[type]);
                    const isUploaded = Boolean(fileInfo && fileInfo.count > 0);
                    const hasErrors = Boolean(fileInfo && fileInfo.errors.length > 0);

                    return (
                      <div
                        key={type}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                          hasErrors
                            ? 'bg-rose-50/40 border-rose-300'
                            : isUploaded
                            ? 'bg-white border-[#526B50] shadow-2xs ring-1 ring-[#526B50]/20'
                            : 'bg-white border-[#E5E6E0]'
                        }`}
                      >
                        <div className="space-y-3">
                          {/* Card Header & Status Badge */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-[#EBF1EA] flex items-center justify-center shrink-0">
                                {icon}
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-[#191B19]">{title}</h4>
                                <p className="text-[10px] text-[#70736E]">{subtitle}</p>
                              </div>
                            </div>

                            {/* Status badge */}
                            <div>
                              {hasErrors ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                                  <AlertCircle className="w-3 h-3" />
                                  <span>{fileInfo?.errors.length} Errors</span>
                                </span>
                              ) : isUploaded ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#526B50] bg-[#EBF1EA] px-2 py-0.5 rounded-full border border-[#D3DFD2]">
                                  <Check className="w-3 h-3" />
                                  <span>{fileInfo?.count} records</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                  Required
                                </span>
                              )}
                            </div>
                          </div>

                          {/* File Description */}
                          <p className="text-[11px] text-[#70736E] leading-relaxed">
                            {template?.description}
                          </p>

                          {/* Upload details if present */}
                          {isUploaded && (
                            <div className="p-2 rounded-lg bg-[#F7F7F4] border border-[#E5E6E0] text-[11px] space-y-0.5">
                              <div className="flex justify-between text-[#191B19] font-medium truncate">
                                <span className="truncate">{fileInfo?.name}</span>
                                <span className="text-[#70736E] ml-2 shrink-0">{((fileInfo?.size || 0) / 1024).toFixed(1)} KB</span>
                              </div>
                              {fileInfo?.isSampleData && (
                                <div className="text-[10px] text-sky-700 font-medium">
                                  Simulated FMCG Example Data
                                </div>
                              )}
                            </div>
                          )}

                          {/* Actionable Error Messages if any */}
                          {hasErrors && (
                            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] space-y-1">
                              <div className="font-semibold flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                                <span>Validation Issues:</span>
                              </div>
                              <ul className="list-disc list-inside space-y-0.5 max-h-24 overflow-y-auto">
                                {fileInfo?.errors.slice(0, 3).map((err, i) => (
                                  <li key={i}>{err}</li>
                                ))}
                                {(fileInfo?.errors.length || 0) > 3 && (
                                  <li className="text-[10px] font-semibold text-rose-900">
                                    + {(fileInfo?.errors.length || 0) - 3} more errors
                                  </li>
                                )}
                              </ul>
                            </div>
                          )}

                          {/* Expandable Schema Table Section */}
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => toggleSchemaExpand(type)}
                              className="text-[11px] font-semibold text-[#526B50] hover:text-[#41553F] flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <span>{isExpanded ? 'Hide Required Schema' : 'View Required Schema'}</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>

                            {isExpanded && (
                              <div className="mt-2.5 border border-[#E5E6E0] rounded-lg overflow-hidden bg-white text-[10px]">
                                <table className="w-full text-left border-collapse">
                                  <thead className="bg-[#FAFBF9] border-b border-[#E5E6E0] text-[#70736E]">
                                    <tr>
                                      <th className="py-1.5 px-2 font-semibold">Column</th>
                                      <th className="py-1.5 px-1.5 font-semibold">Required</th>
                                      <th className="py-1.5 px-1.5 font-semibold">Type</th>
                                      <th className="py-1.5 px-2 font-semibold">Meaning / Example</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#F0F0EB]">
                                    {template?.fields.map(f => (
                                      <tr key={f.name} className="hover:bg-[#F7F7F4]">
                                        <td className="py-1 px-2 font-mono font-medium text-[#191B19]">{f.name}</td>
                                        <td className="py-1 px-1.5">
                                          {f.required ? (
                                            <span className="text-amber-700 font-bold">Yes</span>
                                          ) : (
                                            <span className="text-[#A5A8A0]">Opt</span>
                                          )}
                                        </td>
                                        <td className="py-1 px-1.5 text-[#70736E]">{f.type}</td>
                                        <td className="py-1 px-2 text-[#70736E]">
                                          {f.description} {f.units && `(${f.units})`}{' '}
                                          <span className="font-mono text-[#191B19] bg-[#F2F4F1] px-1 py-0.5 rounded">e.g. {f.example}</span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Card Footer Controls: Template Downloads & Upload Browse */}
                        <div className="mt-4 pt-3 border-t border-[#F0F0EB] flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => downloadCsvTemplate(type, false)}
                              className="text-[10px] font-medium text-[#70736E] hover:text-[#191B19] flex items-center gap-1 cursor-pointer"
                              title="Download blank template with header columns only"
                            >
                              <Download className="w-3 h-3" />
                              <span>Blank</span>
                            </button>
                            <span className="text-[#CCD0C4]">|</span>
                            <button
                              type="button"
                              onClick={() => downloadCsvTemplate(type, true)}
                              className="text-[10px] font-semibold text-[#526B50] hover:text-[#41553F] flex items-center gap-1 cursor-pointer"
                              title="Download template with realistic example data rows"
                            >
                              <Download className="w-3 h-3" />
                              <span>Sample</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {isUploaded && (
                              <button
                                type="button"
                                onClick={() => handleClearFile(type)}
                                className="text-[10px] text-[#70736E] hover:text-rose-600 px-1 cursor-pointer"
                                title="Remove uploaded file"
                              >
                                Clear
                              </button>
                            )}
                            <label className="px-2.5 py-1 rounded-md bg-[#191B19] hover:bg-[#2E312E] text-white text-[11px] font-semibold cursor-pointer flex items-center gap-1 transition-colors">
                              <Upload className="w-3 h-3" />
                              <span>{isUploaded ? 'Replace' : 'Upload CSV'}</span>
                              <input
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    handleFileUpload(type, e.target.files[0]);
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Cross-File Validation Feedback Alert */}
                {crossFileResult.errors.length > 0 && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5 text-rose-900">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Cross-File Referential Integrity Issues ({crossFileResult.errors.length}):</span>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                      {crossFileResult.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {crossFileResult.errors.length > 5 && (
                        <li className="font-semibold text-rose-900">
                          + {crossFileResult.errors.length - 5} additional reference errors
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Compact Planning Network Snapshot */}
                {isAllCustomFilesReady && (
                  <div className="p-4 rounded-2xl bg-white border border-[#526B50]/30 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#526B50]" />
                        <h4 className="text-xs font-bold text-[#191B19]">Custom Planning Network Snapshot</h4>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EBF1EA] text-[#526B50]">
                        All 6 Files Verified
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                      <div className="p-2.5 rounded-xl bg-[#F7F7F4] border border-[#E5E6E0]">
                        <span className="text-[#70736E] text-[10px]">Products</span>
                        <div className="font-bold text-[#191B19] text-base mt-0.5">
                          {activeDataset.products.length} SKUs
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#F7F7F4] border border-[#E5E6E0]">
                        <span className="text-[#70736E] text-[10px]">Warehouses</span>
                        <div className="font-bold text-[#191B19] text-base mt-0.5">
                          {activeDataset.warehouses.length} DCs
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#F7F7F4] border border-[#E5E6E0]">
                        <span className="text-[#70736E] text-[10px]">Destinations</span>
                        <div className="font-bold text-[#191B19] text-base mt-0.5">
                          {activeDataset.destinations.length} Stores
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#F7F7F4] border border-[#E5E6E0]">
                        <span className="text-[#70736E] text-[10px]">Inventory Lots</span>
                        <div className="font-bold text-[#526B50] text-base mt-0.5">
                          {activeDataset.batches.reduce((sum, b) => sum + (b.quantity || 0), 0).toLocaleString()} units
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#F7F7F4] border border-[#E5E6E0]">
                        <span className="text-[#70736E] text-[10px]">Freight Routes</span>
                        <div className="font-bold text-[#191B19] text-base mt-0.5">
                          {activeDataset.routes.length} Lanes
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#F7F7F4] border border-[#E5E6E0]">
                        <span className="text-[#70736E] text-[10px]">Forecast Demand</span>
                        <div className="font-bold text-[#191B19] text-base mt-0.5">
                          {activeDataset.demand.reduce((sum, d) => sum + (d.forecasted_demand || 0), 0).toLocaleString()} units
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= STEP 3: VALIDATE DATA ================= */}
        {currentStep === 'validate' && (
          <div className="space-y-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EBF1EA] text-[#526B50] text-xs font-semibold mb-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Step 3: Invariant &amp; Contract Validation</span>
              </div>
              <h2 className="text-2xl font-bold text-[#191B19]">Data Quality &amp; Physical Invariant Check</h2>
              <p className="text-sm text-[#70736E] mt-1 max-w-2xl leading-relaxed">
                The optimization engine tests entity IDs, foreign keys, non-negative quantities, positive freight tariffs, and FEFO expiry eligibility.
              </p>
            </div>

            {validating ? (
              <div className="py-16 text-center">
                <div className="w-8 h-8 border-2 border-[#526B50] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm font-semibold text-[#191B19]">Auditing dataset contracts against engine invariants...</p>
                <p className="text-xs text-[#70736E] mt-1">Verifying referential integrity and non-negativity.</p>
              </div>
            ) : validationError ? (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs space-y-2">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span>Validation Service Error</span>
                </div>
                <p>{validationError}</p>
                <button
                  onClick={executeValidation}
                  className="mt-2 px-3 py-1 bg-white border border-red-300 rounded text-xs font-semibold text-red-900 cursor-pointer"
                >
                  Retry Validation
                </button>
              </div>
            ) : validationResult ? (
              <div className="space-y-5">
                {/* Overall Verdict Banner */}
                <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                  validationResult.valid
                    ? 'bg-[#EBF1EA]/60 border-[#D3DFD2] text-[#41553F]'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  {validationResult.valid ? (
                    <CheckCircle2 className="w-5 h-5 text-[#526B50] shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h3 className="text-sm font-bold">
                      {validationResult.valid
                        ? 'All Physical Invariants Passed: Dataset Ready for Optimization'
                        : 'Dataset Has Blocking Validation Errors'}
                    </h3>
                    <p className="text-xs mt-0.5">
                      {validationResult.valid
                        ? `Validated ${validationResult.summary.total_inventory_units.toLocaleString()} inventory units across ${validationResult.summary.products_count} products and ${validationResult.summary.warehouses_count} warehouses.`
                        : 'The optimization solver cannot proceed safely until blocking errors are resolved.'}
                    </p>
                  </div>
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-white border border-[#E5E6E0] shadow-2xs">
                    <div className="text-[11px] text-[#70736E]">Total Inventory</div>
                    <div className="text-lg font-bold text-[#191B19] mt-0.5">
                      {validationResult.summary.total_inventory_units.toLocaleString()} units
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white border border-[#E5E6E0] shadow-2xs">
                    <div className="text-[11px] text-[#70736E]">Forecasted Demand</div>
                    <div className="text-lg font-bold text-[#191B19] mt-0.5">
                      {validationResult.summary.total_forecasted_demand.toLocaleString()} units
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white border border-[#E5E6E0] shadow-2xs">
                    <div className="text-[11px] text-[#70736E]">Active Routes</div>
                    <div className="text-lg font-bold text-[#191B19] mt-0.5">
                      {validationResult.summary.routes_count} lanes
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white border border-[#E5E6E0] shadow-2xs">
                    <div className="text-[11px] text-[#70736E]">FEFO Usable Lots</div>
                    <div className="text-lg font-bold text-[#526B50] mt-0.5">
                      {validationResult.summary.batches_count - validationResult.summary.expired_batches_count} batches
                    </div>
                  </div>
                </div>

                {/* Blocking Errors List */}
                {validationResult.errors.length > 0 && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-2">
                    <div className="text-xs font-bold flex items-center gap-1.5 text-rose-900">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      <span>{validationResult.errors.length} Blocking Error(s):</span>
                    </div>
                    <ul className="text-xs list-disc list-inside space-y-1">
                      {validationResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Warnings List */}
                {validationResult.warnings.length > 0 && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 space-y-2">
                    <div className="text-xs font-bold flex items-center gap-1.5 text-amber-900">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>{validationResult.warnings.length} Advisory Warning(s):</span>
                    </div>
                    <ul className="text-xs list-disc list-inside space-y-1">
                      {validationResult.warnings.map((warn, i) => (
                        <li key={i}>{warn}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* ================= STEP 4: CONFIGURE PLANNING ================= */}
        {currentStep === 'configure' && (
          <div className="space-y-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EBF1EA] text-[#526B50] text-xs font-semibold mb-2">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Step 4: Objective &amp; Horizon Configuration</span>
              </div>
              <h2 className="text-2xl font-bold text-[#191B19]">Planning Parameters &amp; Priorities</h2>
              <p className="text-sm text-[#70736E] mt-1 max-w-2xl leading-relaxed">
                Configure the optimization planning horizon and review the trade-off weights between freight tariffs and customer service tiers.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs space-y-3">
                <span className="text-xs font-bold text-[#70736E] uppercase tracking-wider">Planning Horizon</span>
                <div className="space-y-2">
                  {[7, 14, 30].map(days => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setHorizonDays(days)}
                      className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-between border transition-all cursor-pointer ${
                        horizonDays === days
                          ? 'bg-[#191B19] text-white border-[#191B19] shadow-xs'
                          : 'bg-[#F7F7F4] text-[#70736E] border-[#E5E6E0] hover:border-[#CCD0C4]'
                      }`}
                    >
                      <span>{days} Days {days === 7 && '(Default)'}</span>
                      {horizonDays === days && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-[#70736E]">
                  Controls the forward-looking demand fulfillment window.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs space-y-3">
                <span className="text-xs font-bold text-[#70736E] uppercase tracking-wider">Objective Weights</span>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center p-2 rounded-lg bg-[#F7F7F4] border border-[#E5E6E0]">
                    <span className="text-[#70736E]">Freight Tariffs:</span>
                    <span className="font-mono font-bold text-[#191B19]">1.0x (Direct Tariffs)</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-lg bg-[#F7F7F4] border border-[#E5E6E0]">
                    <span className="text-[#70736E]">Tier-1 SLA Penalty:</span>
                    <span className="font-mono font-bold text-[#526B50]">1.30x Multiplier</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-lg bg-[#F7F7F4] border border-[#E5E6E0]">
                    <span className="text-[#70736E]">Tier-2 SLA Penalty:</span>
                    <span className="font-mono font-bold text-[#191B19]">1.00x Base Penalty</span>
                  </div>
                </div>
                <p className="text-[11px] text-[#70736E]">
                  Tier-1 customers are prioritized during inventory scarcity.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs space-y-3">
                <span className="text-xs font-bold text-[#70736E] uppercase tracking-wider">Shelf-Life Priority</span>
                <div className="p-3 rounded-xl bg-[#EBF1EA]/60 border border-[#D3DFD2] text-xs text-[#41553F] space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#526B50]" />
                    <span>Two-Phase Lexicographic MILP</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Phase 1 finds the global minimum economic cost. Phase 2 prioritizes FEFO batches while holding economic cost within 0.01%.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 5: RUN OPTIMIZATION ================= */}
        {currentStep === 'optimize' && (
          <div className="space-y-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EBF1EA] text-[#526B50] text-xs font-semibold mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Step 5: Mathematical Engine Execution</span>
              </div>
              <h2 className="text-2xl font-bold text-[#191B19]">Solve Multi-Echelon Mixed-Integer Program</h2>
              <p className="text-sm text-[#70736E] mt-1 max-w-2xl leading-relaxed">
                Google OR-Tools SCIP solver co-optimizes physical route capacities, vehicle weight caps, and batch FEFO allocation.
              </p>
            </div>

            {isOptimizing ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-[#E5E6E0] shadow-xs space-y-4">
                <div className="w-12 h-12 border-3 border-[#526B50] border-t-transparent rounded-full animate-spin mx-auto" />
                <div>
                  <h3 className="text-base font-bold text-[#191B19]">{optimizationProgress}</h3>
                  <p className="text-xs text-[#70736E] mt-1">
                    Formulating decision variables and solving branch-and-cut linear relaxation...
                  </p>
                </div>
              </div>
            ) : optimizationError ? (
              <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-3">
                <div className="font-bold text-sm flex items-center gap-2 text-rose-900">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span>Optimization Engine Infeasibility or Failure</span>
                </div>
                <p>{optimizationError}</p>
                <button
                  onClick={handleExecuteOptimization}
                  className="px-4 py-2 rounded-xl bg-rose-900 text-white font-semibold text-xs cursor-pointer hover:bg-rose-950"
                >
                  Retry Solver
                </button>
              </div>
            ) : (
              <div className="p-8 text-center bg-white rounded-2xl border border-[#E5E6E0] shadow-xs space-y-5">
                <div className="w-12 h-12 rounded-2xl bg-[#EBF1EA] text-[#526B50] flex items-center justify-center mx-auto">
                  <Play className="w-6 h-6 ml-0.5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#191B19]">Ready to Solve Optimal Distribution</h3>
                  <p className="text-xs text-[#70736E] mt-1 max-w-md mx-auto">
                    Click below to trigger the Google OR-Tools SCIP solver over the {selectedSource === 'm5' ? 'Walmart M5 sample' : 'custom company'} dataset ({activeDataset.products.length} products, {activeDataset.warehouses.length} warehouses, {activeDataset.destinations.length} destinations).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExecuteOptimization}
                  className="px-6 py-3 rounded-xl bg-[#526B50] hover:bg-[#41553F] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 mx-auto cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Execute Two-Phase OR-Tools Optimization</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= STEP 6: RESULTS & AUDIT ================= */}
        {currentStep === 'results' && activePlan && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EBF1EA] text-[#526B50] text-xs font-semibold mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Step 6: Optimization Recommendations &amp; Audit</span>
                </div>
                <h2 className="text-2xl font-bold text-[#191B19]">Distribution Plan Generated</h2>
                <p className="text-xs text-[#70736E] mt-0.5">
                  Run ID: <span className="font-mono text-[#191B19]">{activePlan.run_id}</span> | Strategy:{' '}
                  <span className="font-semibold text-[#526B50]">{activePlan.strategy}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-3.5 py-2 rounded-xl border border-[#E5E6E0] bg-white hover:bg-[#F7F7F4] text-[#191B19] text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#526B50]" />
                  <span>Export Dispatch Plan (CSV)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAdvancedDashboard(activePlan)}
                  className="px-3.5 py-2 rounded-xl bg-[#191B19] hover:bg-[#2E312E] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <span>Open Advanced Console</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-xl bg-white border border-[#E5E6E0] shadow-2xs">
                <span className="text-[11px] text-[#70736E] font-medium">Total Freight Cost</span>
                <div className="text-xl font-bold text-[#191B19] mt-1">
                  ${activePlan.metrics.total_transport_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-[#70736E] mt-0.5">
                  Avg: ${(activePlan.metrics.avg_unit_transport_cost || 0).toFixed(2)}/unit
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#E5E6E0] shadow-2xs">
                <span className="text-[11px] text-[#70736E] font-medium">Fulfillment Rate</span>
                <div className="text-xl font-bold text-[#526B50] mt-1">
                  {activePlan.metrics.fulfillment_rate_pct.toFixed(1)}%
                </div>
                <div className="text-[10px] text-[#526B50] mt-0.5">
                  {activePlan.metrics.total_fulfilled_units.toLocaleString()} / {activePlan.metrics.total_demand_units.toLocaleString()} units
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#E5E6E0] shadow-2xs">
                <span className="text-[11px] text-[#70736E] font-medium">Unmet Demand Shortage</span>
                <div className="text-xl font-bold text-[#191B19] mt-1">
                  {activePlan.metrics.total_unmet_units.toLocaleString()} units
                </div>
                <div className="text-[10px] text-amber-700 mt-0.5">
                  {activePlan.metrics.destinations_with_shortages} destination(s) affected
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#E5E6E0] shadow-2xs">
                <span className="text-[11px] text-[#70736E] font-medium">Near-Expiry Utilized</span>
                <div className="text-xl font-bold text-[#526B50] mt-1">
                  {activePlan.metrics.expiring_stock_utilized_units.toLocaleString()} units
                </div>
                <div className="text-[10px] text-[#526B50] mt-0.5">
                  FEFO Spoilage Protection
                </div>
              </div>
            </div>

            {/* Baseline vs Optimizer Comparative Audit Card */}
            {comparisonAudit && (
              <div className="p-5 rounded-2xl bg-white border border-[#E5E6E0] shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#191B19] uppercase tracking-wider">
                    Baseline Heuristic vs. OR-Tools MILP Audit
                  </span>
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    comparisonAudit.outcome_status === 'equal'
                      ? 'bg-[#EBF1EA] text-[#526B50]'
                      : 'bg-[#526B50] text-white'
                  }`}>
                    {comparisonAudit.outcome_status === 'equal' ? 'Neutral Parity Verdict' : 'Optimizer Superior'}
                  </span>
                </div>

                <p className="text-xs text-[#70736E] leading-relaxed">
                  {comparisonAudit.summary_verdict}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
                  <div className="p-2.5 rounded-lg bg-[#F7F7F4] border border-[#E5E6E0]">
                    <span className="text-[#70736E] text-[10px]">Net Economic Savings</span>
                    <div className="font-bold text-[#191B19] mt-0.5">
                      ${(comparisonAudit.total_evaluated_savings || comparisonAudit.cost_savings_amount || 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#F7F7F4] border border-[#E5E6E0]">
                    <span className="text-[#70736E] text-[10px]">Cost Reduction %</span>
                    <div className="font-bold text-[#526B50] mt-0.5">
                      {(comparisonAudit.total_evaluated_savings_pct || comparisonAudit.cost_reduction_pct || 0).toFixed(2)}%
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#F7F7F4] border border-[#E5E6E0]">
                    <span className="text-[#70736E] text-[10px]">Stockout Reduction</span>
                    <div className="font-bold text-[#191B19] mt-0.5">
                      {comparisonAudit.stockout_reduction_pct.toFixed(1)}%
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#F7F7F4] border border-[#E5E6E0]">
                    <span className="text-[#70736E] text-[10px]">Solver Runtime</span>
                    <div className="font-mono text-[#70736E] mt-0.5">
                      {activePlan.metrics.solver_runtime_ms.toFixed(1)} ms
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Consignment Dispatch Table */}
            <div className="rounded-2xl border border-[#E5E6E0] bg-white shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-[#F0F0EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-[#191B19]">Recommended Consignment Dispatches</h3>
                  <p className="text-xs text-[#70736E]">
                    Showing {paginatedRecs.length} of {filteredRecommendations.length} dispatch allocations
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={filterWh}
                    onChange={(e) => setFilterWh(e.target.value)}
                    className="text-xs border border-[#E5E6E0] rounded-lg px-2.5 py-1.5 bg-[#FAFBF9] text-[#191B19] cursor-pointer"
                  >
                    <option value="all">All Warehouses</option>
                    {warehouseThroughput.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>

                  <select
                    value={filterDest}
                    onChange={(e) => setFilterDest(e.target.value)}
                    className="text-xs border border-[#E5E6E0] rounded-lg px-2.5 py-1.5 bg-[#FAFBF9] text-[#191B19] cursor-pointer"
                  >
                    <option value="all">All Destinations</option>
                    {destinationThroughput.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>

                  <select
                    value={filterExpiry}
                    onChange={(e) => setFilterExpiry(e.target.value)}
                    className="text-xs border border-[#E5E6E0] rounded-lg px-2.5 py-1.5 bg-[#FAFBF9] text-[#191B19] cursor-pointer"
                  >
                    <option value="all">All Batches</option>
                    <option value="near_expiry">Near-Expiry (&le; 15d)</option>
                    <option value="healthy">Healthy Stock (&gt; 15d)</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#FAFBF9] border-b border-[#E5E6E0] text-[#70736E]">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Origin DC</th>
                      <th className="py-2.5 px-3 font-semibold">Destination</th>
                      <th className="py-2.5 px-3 font-semibold">Product SKU</th>
                      <th className="py-2.5 px-3 font-semibold">Batch ID &amp; Expiry</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Quantity</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Freight Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0EB]">
                    {paginatedRecs.map((rec) => (
                      <tr key={rec.recommendation_id} className="hover:bg-[#F7F7F4] transition-colors">
                        <td className="py-2.5 px-3 font-medium text-[#191B19]">
                          {rec.source_warehouse_name}
                        </td>
                        <td className="py-2.5 px-3 text-[#191B19]">
                          {rec.destination_name}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-[#191B19]">{rec.product_name}</span>
                          <span className="text-[10px] text-[#70736E] block font-mono">{rec.product_id}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-[#70736E]">{rec.batch_id}</span>
                          <span className={`text-[10px] font-bold block ${
                            rec.batch_days_to_expiry <= 15 ? 'text-amber-700' : 'text-[#526B50]'
                          }`}>
                            {rec.batch_days_to_expiry} days left
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-[#526B50]">
                          {rec.allocated_quantity.toLocaleString()} units
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-[#191B19]">
                          ${rec.total_transport_cost.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="p-3 border-t border-[#F0F0EB] bg-[#FAFBF9] flex items-center justify-between text-xs text-[#70736E]">
                  <div>
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className="px-2.5 py-1 rounded-lg border border-[#E5E6E0] bg-white hover:bg-[#F7F7F4] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-xs"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className="px-2.5 py-1 rounded-lg border border-[#E5E6E0] bg-white hover:bg-[#F7F7F4] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-xs"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Wizard Footer Stepper Controls */}
        <div className="mt-8 pt-4 border-t border-[#E5E6E0] flex items-center justify-between">
          <div>
            {currentStepIndex > 0 && currentStep !== 'results' && (
              <button
                type="button"
                onClick={() => {
                  const prevIndex = currentStepIndex - 1;
                  setCurrentStep(stepsList[prevIndex].id as WizardStep);
                }}
                className="px-4 py-2 rounded-xl border border-[#E5E6E0] bg-white text-xs font-semibold text-[#191B19] hover:bg-[#F7F7F4] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}
            {currentStep === 'results' && (
              <button
                type="button"
                onClick={() => {
                  setCurrentStep('source');
                  setActivePlan(null);
                  setComparisonAudit(null);
                }}
                className="px-4 py-2 rounded-xl border border-[#E5E6E0] bg-white text-xs font-semibold text-[#191B19] hover:bg-[#F7F7F4] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Start New Planning Run</span>
              </button>
            )}
          </div>

          <div>
            {currentStep === 'source' && (
              <button
                type="button"
                onClick={() => setCurrentStep('data')}
                className="px-5 py-2.5 rounded-xl bg-[#191B19] hover:bg-[#2E312E] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Continue to Data Loading</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {currentStep === 'data' && (
              <button
                type="button"
                disabled={selectedSource === 'uploaded' && !isAllCustomFilesReady}
                onClick={() => setCurrentStep('validate')}
                className="px-5 py-2.5 rounded-xl bg-[#191B19] hover:bg-[#2E312E] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title={selectedSource === 'uploaded' && !isAllCustomFilesReady ? 'Upload all 6 valid CSV files to proceed' : 'Continue to Validation'}
              >
                <span>Continue to Validation</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {currentStep === 'validate' && (
              <button
                type="button"
                disabled={!validationResult?.valid}
                onClick={() => setCurrentStep('configure')}
                className="px-5 py-2.5 rounded-xl bg-[#191B19] hover:bg-[#2E312E] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Proceed to Configuration</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {currentStep === 'configure' && (
              <button
                type="button"
                onClick={() => setCurrentStep('optimize')}
                className="px-5 py-2.5 rounded-xl bg-[#526B50] hover:bg-[#41553F] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Proceed to Solver</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
