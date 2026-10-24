# SupplySync

> **AI-Powered FMCG Distribution Intelligence & Constrained Inventory Optimization Engine**  
> *Triwizathon 2026 — Problem Statement 2 Competition Entry*

---

## 1. Overview & Problem Statement

Fast-Moving Consumer Goods (FMCG) distribution networks face critical supply chain inefficiencies caused by:
- **Regional Demand Asymmetries**: Unpredictable consumer demand surges across regional retail clusters.
- **Inventory Mismatches**: Local stockouts coexisting with excess inventory held in distant regional distribution centers.
- **Sub-optimal Freight Expenses**: Unnecessary long-haul transport tariffs and ad-hoc emergency replenishment.
- **Perishability & Expiry Spoilage**: Failure to execute strict FEFO (First Expired, First Out) batch movement before shelf-life cutoffs.
- **Corridor Bottlenecks**: Vehicle load constraints and highway transit limits.

**SupplySync** is a competition-ready, full-stack decision intelligence engine that computes mathematically optimal multi-echelon shipment allocations using Google OR-Tools Mixed-Integer Linear Programming (MILP), batch-aware FEFO prioritization, chronological time-series demand estimation, and dual-mode data integration supporting both a deterministic Indian FMCG network and the official **Walmart M5 Kaggle Forecasting** dataset.

---

## 2. Architecture & Data Flow

```
[ Frontend: React 18 + Vite + Tailwind CSS v4 + Lucide Icons ]
                            │
                       (REST HTTP)
                            ▼
        [ API Gateway: Node.js + Express + TypeScript ]
                            │
               (Validated API Contracts)
                            ▼
   [ Optimization Engine: Python + FastAPI + Google OR-Tools ]
          │                                         │
          ▼                                         ▼
[ Synthetic FMCG Generator ]           [ Real M5 Kaggle Loader ]
```

- **Frontend Client (`client/`)**: Premium enterprise SaaS interface (`#F7F7F4`, `#191B19`, `#526B50`, subtle borders, clean typography).
  - **Dynamic Data Stream Switcher**: Seamlessly toggle between **Synthetic FMCG Demo** and **Real M5 Kaggle Dataset**.
  - **Planning Horizon Controller**: 7D, 14D, and 30D horizons that dynamically drive time-series forecasts and optimization inputs.
  - **Rebuilt 6-Column Allocation Table**: Compact, readable structure (`Product` | `Route` | `Batch / Expiry` | `Quantity` | `Freight Cost` | `Action`).
  - **Side-Panel Reasoning Drawer**: Slide-out audit panel disclosing full batch inventory, remaining shelf life, unit tariffs, and satisfied mathematical constraints.
  - **Standardized 5-Card KPI Strip**: Fulfillment Rate, Transportation Cost, Unmet Demand, Active Consignments, Solver Runtime.
- **API Gateway (`server/`)**: Express & TypeScript proxy managing master data, route requests, dataset diagnostics, run persistence, and error responses.
- **Optimization & Forecasting Engine (`engine/`)**: High-performance Python service implementing:
  - Google OR-Tools `SCIP` & `CBC` Mixed-Integer Linear Programming (MILP) solvers.
  - Greedy demand-priority baseline heuristic for empirical benchmarking.
  - Real M5 Kaggle Dataset integration (`data/m5/` with bundled `data/m5/sample/`).
  - Chronological time-series forecasting (7-day SMA vs. seasonal regression evaluated on MAE, RMSE, and WAPE).
  - Invariant validator enforcing 10 mathematical and physical supply chain invariants.

---

## 3. Real M5 Forecasting Dataset Integration

SupplySync natively supports the official [Walmart M5 Forecasting Competition](https://www.kaggle.com/competitions/m5-forecasting-accuracy) dataset:

### Supported Files (`data/m5/`)
- `calendar.csv`: Real calendar mappings from `d_1` to `d_1969`, day-of-week, and event indicators.
- `sales_train_validation.csv`: Daily unit sales per SKU per store.
- `sell_prices.csv`: Weekly price history.
- `data/m5/sample/`: Bundled offline development subset (California & Texas stores, genuine food, hobby, and household items) enabling immediate local verification without downloading 500MB+ files.

### Honest Logistics Separation
Because M5 is a retail sales dataset without upstream distribution infrastructure, SupplySync provides a transparent, clearly labeled logistics scenario:
- **Real M5 Data**: Item IDs (`FOODS_1_001`, `HOBBIES_...`), Store IDs (`CA_1`, `TX_1`...), daily sales history, and calendar metadata.
- **Configured Logistics**: Regional Distribution Centers (Pacific DC, Texas DC, Midwest DC), verified route distances, unit tariffs, corridor capacities, and customer SLA tiers.
- **Simulated Expiry**: Perishable food items (`FOODS_...`) include FEFO expiry lot tracking; non-perishables (`HOBBIES_...`, `HOUSEHOLD_...`) have indefinite shelf life.

---

## 4. Mathematical Optimization Formulation

### Decision Variables
- $x_{w, d, p, b} \in \mathbb{Z}_{\ge 0}$: Integer units of product $p$ from inventory batch $b$ shipped from source warehouse $w$ to destination $d$.
- $u_{d, p} \in \mathbb{Z}_{\ge 0}$: Unmet customer demand for product $p$ at destination $d$.

### Objective Function
$$\min \sum_{w, d, p, b} \left( c_{w, d} - \text{Subsidy}_{\text{FEFO}}(b) \right) x_{w, d, p, b} + \sum_{d, p} \left( \lambda_p \cdot \text{TierMultiplier}_d \right) u_{d, p}$$

Where:
- $c_{w, d}$: Original unit freight tariff on route $(w, d)$.
- $\text{Subsidy}_{\text{FEFO}}(b)$: Bounded tie-breaker subsidy for near-expiry batches ($\le 15$ days remaining):
  $$\text{Subsidy}_{\text{FEFO}}(b) = \min(0.25 \cdot c_{w, d}, 0.75)$$
  *Crucial mathematical safeguard: Bounding the subsidy guarantees the effective coefficient remains strictly positive ($\ge 0.75 \cdot c_{w, d} > 0$), preventing artificial negative-cost incentives.*
- $\lambda_p$: Product shortage penalty per unmet unit.
- $\text{TierMultiplier}_d$: SLA weight (1.30 for Tier-1 retail clusters, 1.0 for standard wholesale).

### Core Physical Constraints
1. **Batch Inventory Availability**:
   $$\sum_{d \in D} x_{w, d, p, b} \le Q_{w, p, b} \quad \forall w, p, b$$
2. **Expired Stock Quarantine**:
   $$Q_{w, p, b} = 0 \quad \text{if } \text{days\_to\_expiry} \le 0$$
3. **Route Corridor Throughput Limits**:
   $$\sum_{p \in P, b \in B} x_{w, d, p, b} \le C_{w, d} \quad \forall (w, d) \in \text{Routes with defined limits}$$
4. **Demand Conservation & Slacks**:
   $$\sum_{w \in W, b \in B} x_{w, d, p, b} + u_{d, p} = D_{d, p} \quad \forall d \in D, p \in P$$
5. **Integrity & Non-negativity**:
   $$x_{w, d, p, b} \in \mathbb{Z}_{\ge 0}, \quad u_{d, p} \in \mathbb{Z}_{\ge 0}$$

---

## 5. Local Setup & Startup Instructions

### Prerequisites
- Node.js (v18+) & npm (v9+)
- Python (v3.10+) with `venv`

### 1. Set up Python Optimization Engine
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r engine/requirements.txt
pytest engine/tests -v
```

### 2. Set up Node.js API Gateway
```bash
cd server
npm install
npm run build
```

### 3. Set up Frontend Client
```bash
cd client
npm install
npm run build
```

### 4. Running the Complete System Locally
Run each service in a separate terminal:

**Terminal 1 — Python Optimization Engine**:
```bash
source .venv/bin/activate
uvicorn engine.main:app --host 127.0.0.1 --port 8000
```

**Terminal 2 — Node.js API Gateway**:
```bash
cd server
npm start
```

**Terminal 3 — React Client**:
```bash
cd client
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 6. Automated Test Suite

Run the automated Pytest suite verifying all 10 physical invariants, M5 Kaggle data loading, WAPE error metrics, horizon scaling, and API contracts:
```bash
source .venv/bin/activate
pytest engine/tests -v
```

All 13 automated tests validate:
- `test_api_health`: Engine health and solver readiness.
- `test_dataset_status_endpoint`: M5 dataset diagnostics and file integrity.
- `test_master_data_integrity`: Demo dataset structure and operational challenges.
- `test_m5_data_loader_and_time_series`: Loading M5 calendar and unpivoting sales history.
- `test_m5_logistics_mapping`: Preservation of M5 store and product identifiers.
- `test_planning_horizon_scaling_7_14_30`: Genuine scaling of demand across 7D, 14D, and 30D horizons.
- `test_wape_metric_calculation`: Robust error metric calculation with sparse zero-sales FMCG data.
- `test_baseline_allocation_invariants`: Heuristic baseline invariant validation.
- `test_ortools_optimizer_invariants_and_superiority`: SCIP MILP optimality and superiority.
- `test_m5_mode_optimization_end_to_end`: Complete pipeline verification from M5 sales history to OR-Tools allocation plan.
- `test_comparison_audit_metrics`: Objective side-by-side performance indicators.
- `test_demand_forecasting_evaluation`: Chronological train/test backtesting with zero lookahead.
- `test_api_endpoints`: End-to-end FastAPI routes, master data filtering, and RFC-4180 CSV export.
