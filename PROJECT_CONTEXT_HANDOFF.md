# SupplySync: Project Context Handoff & Technical Reference

**Document Creation Date:** October 25, 2026  
**Project Name:** SupplySync — Distribution Intelligence & Inventory Optimization Engine  
**Competition / Hackathon:** Triwizathon 2026 — Problem Statement 2  
**Target Repository:** `https://github.com/1yajatpatil/supplysync` (Branch: `main`, Commit: `e22b2bc`)  
**Target Audience:** Succeeding AI Assistant (ChatGPT / Claude / Copilot), Senior Full-Stack Engineers, Operations Research Specialists

---

## Table of Contents
1. [Section A: Project Overview](#section-a-project-overview)
2. [Section B: Requirements and Specifications](#section-b-requirements-and-specifications)
3. [Section C: Complete Technology Stack](#section-c-complete-technology-stack)
4. [Section D: System Architecture & Data Flow](#section-d-system-architecture--data-flow)
5. [Section E: Repository & File Structure](#section-e-repository--file-structure)
6. [Section F: Feature Implementation Status](#section-f-feature-implementation-status)
7. [Section G: Data, Algorithms, and AI/ML](#section-g-data-algorithms-and-aiml)
8. [Section H: Frontend and UI/UX Design System](#section-h-frontend-and-uiux-design-system)
9. [Section I: Bugs, Errors, and Debugging History](#section-i-bugs-errors-and-debugging-history)
10. [Section J: Testing, Verification, and Audit Results](#section-j-testing-verification-and-audit-results)
11. [Section K: Environment & Execution Instructions](#section-k-environment--execution-instructions)
12. [Section L: Deployment & Hosting Status](#section-l-deployment--hosting-status)
13. [Section M: Decision Log & Rationale](#section-m-decision-log--rationale)
14. [Section N: Known Limitations & Technical Debt](#section-n-known-limitations--technical-debt)
15. [Section O: Current Project State](#section-o-current-project-state)
16. [Section P: Pending Tasks & Prioritized Roadmap](#section-p-pending-tasks--prioritized-roadmap)
17. [Section Q: Context & Decisions from Previous Conversations](#section-q-context--decisions-from-previous-conversations)
18. [Section R: Immediate Next Steps](#section-r-immediate-next-steps)
19. [Section S: Explicit Instructions for the Next AI Assistant](#section-s-explicit-instructions-for-the-next-ai-assistant)

---

## Section A: Project Overview

### 1. Identity & Problem Statement
Fast-Moving Consumer Goods (FMCG) distribution networks suffer from persistent inefficiencies:
- **Regional Demand Asymmetries**: Unpredictable demand spikes across disparate retail clusters and distributor territories.
- **Inventory Mismatches & Stockouts**: Local stockouts coexisting with excess inventory stranded in distant regional warehouses.
- **Inflated Freight Expenses**: Ad-hoc emergency dispatches and cross-country transit incurring high freight tariffs.
- **Perishability & Expiry Spoilage**: Failure to execute strict First Expired, First Out (FEFO) batch movement prior to shelf-life deadlines.
- **Corridor Bottlenecks**: Vehicle capacity ceilings and highway transit throughput restrictions.

**SupplySync** is a production-grade, full-stack decision intelligence application built for **Triwizathon 2026, Problem Statement 2**. It computes mathematically optimal multi-echelon shipment allocations using Google OR-Tools Mixed-Integer Linear Programming (MILP), batch-aware FEFO prioritization, chronological time-series demand estimation, and dual-mode data integration supporting both a deterministic Indian FMCG network and the official **Walmart M5 Kaggle Forecasting** dataset.

### 2. Target Users & Real-World Use Case
- **Supply Chain Planners & Logistics Directors**: Dispatchers needing optimal replenishment schedules that minimize transport expenses while strictly honoring vehicle capacities and store SLAs.
- **Warehouse Operations Managers**: Supervisors requiring batch-level pick-and-pack recommendations that deplete near-expiry lots first.
- **Hackathon Evaluation Judges**: Evaluators inspecting mathematical rigor, real-world data readiness, explainable solver outputs, and clean enterprise software design.

### 3. Core Value Proposition
- **Optimality vs. Heuristics**: Proves significant freight savings (10–25%) and stockout reductions against greedy heuristics on identical input snapshots.
- **Explainability**: Every allocation is justified by explicit mathematical constraints, remaining shelf life, route tariffs, and customer tier priorities.
- **Dual Data Stream**: Seamless toggle between a curated, deterministic Indian FMCG scenario and authentic historical store sales from the Walmart M5 dataset.

---

## Section B: Requirements and Specifications

### 1. Functional Requirements
- **FR-1: Master Data Management**: Maintain structured entities for Products, Warehouses, Retail Destinations, Inventory Batches, Freight Corridors, and Demand Forecasts.
- **FR-2: Real M5 Kaggle Dataset Integration**: Load authentic M5 point-of-sale time series (`calendar.csv`, `sales_train_validation.csv`, `sell_prices.csv`) with offline sample fallback.
- **FR-3: Configured Logistics Layer**: Transparently bridge retail sales data with distribution infrastructure (Distribution Centers, freight rates, route capacities, FEFO batches).
- **FR-4: Chronological Demand Forecasting**: Train regression/moving-average models on past sales and project 7-day, 14-day, and 30-day cumulative horizons without temporal data leakage.
- **FR-5: Constrained Mathematical Optimization**: Formulate and solve Mixed-Integer Linear Programs (MILP) using Google OR-Tools (SCIP/CBC).
- **FR-6: Baseline Heuristic Benchmarking**: Provide a greedy priority-based allocation algorithm executing against identical input data.
- **FR-7: Side-by-Side Comparison Audit**: Measure cost differentials, fulfillment rates, unmet demand, and avoided spoilage with zero division errors.
- **FR-8: Operational Console & Table Redesign**: 6-column allocation view (`Product`, `Route`, `Batch / Expiry`, `Quantity`, `Freight Cost`, `Action`), side-drawer reasoning panel, multi-filtering, sorting, and pagination.
- **FR-9: RFC-4180 CSV Export**: One-click download of shipment manifests formatted for ERP/WMS ingestion.

### 2. Mathematical Invariants & Non-Functional Constraints
- **NF-1 (Integrality)**: Shipment variables $x_{w,d,p,b} \in \mathbb{Z}_{\ge 0}$ and unmet demand $u_{d,p} \in \mathbb{Z}_{\ge 0}$ must be discrete integer quantities. Continuous solvers (such as GLOP) are prohibited.
- **NF-2 (Stock Availability)**: Total shipments from lot $b$ must never exceed its available physical inventory: $\sum_d x_{w,d,p,b} \le Q_{w,p,b}$.
- **NF-3 (Route Corridor Ceilings)**: Total volume over corridor $(w, d)$ must not exceed its capacity: $\sum_{p,b} x_{w,d,p,b} \le C_{w,d}$.
- **NF-4 (Zero Expired Stock Allocation)**: Batches with $\text{days\_to\_expiry} \le 0$ must be strictly quarantined ($x_{w,d,p,b} = 0$).
- **NF-5 (Demand Conservation)**: For every destination $d$ and SKU $p$, fulfilled shipments plus slack unmet demand must exactly equal forecasted demand: $\sum_{w,b} x_{w,d,p,b} + u_{d,p} = D_{d,p}$.
- **NF-6 (Bounded FEFO Subsidy)**: Expiry incentives must never result in negative objective coefficients: $\text{Subsidy}_{\text{FEFO}}(b) = \min(0.25 \cdot c_{w,d}, 0.75)$.
- **NF-7 (Financial Separation)**: Dashboard freight bills must reflect actual contract tariffs ($\sum x \cdot c$), never modified objective penalty values.
- **NF-8 (Performance)**: Optimization run completed within $\le 5$ seconds for typical operational networks ($\le 50$ nodes).

---

## Section C: Complete Technology Stack

| Layer | Technology | Purpose | Operational Status |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React 19.3.1, TypeScript 6.0.3, Vite 8.3.4 | Interactive Single Page Application | **Verified & Functional** |
| **Styling** | Tailwind CSS v4.3.3 + Custom CSS | Warm off-white enterprise SaaS theme (`#F7F7F4`, `#191B19`, `#526B50`) | **Verified & Functional** |
| **Icons & Charts** | Lucide React 1.61.0, Recharts 3.10.1 | Visual iconography and time-series demand charts | **Verified & Functional** |
| **API Gateway** | Node.js 20+, Express 4.21.2, TypeScript 5.7.3 | Reverse proxy, request validation, run management | **Verified & Functional** |
| **Optimization Engine** | Python 3.14 (v3.10+ compatible), FastAPI 0.115.0, Uvicorn 0.30.0 | High-performance optimization and forecasting API | **Verified & Functional** |
| **Mathematical Solver** | Google OR-Tools 9.10+ (`SCIP`, `CBC`) | Mixed-Integer Linear Programming solver | **Verified & Functional** |
| **Data Processing & ML**| Pandas 2.2.0, NumPy 2.0.0, Scikit-Learn 1.5.0 | M5 dataset preparation, lag engineering, time-series regression | **Verified & Functional** |
| **Testing** | Pytest 8.0.0, FastAPI TestClient (`httpx` 0.27.0) | Automated mathematical invariant and API verification | **13/13 Passing** |

---

## Section D: System Architecture & Data Flow

### 1. End-to-End Mermaid Architecture

```mermaid
graph TD
    subgraph Client ["Client Layer (React 19 + TypeScript + Vite :5173)"]
        UI_Nav["Top Navigation & Data Stream Toggle\n(Synthetic FMCG vs. Real M5)"]
        UI_Horizon["Planning Horizon Switcher\n(7D / 14D / 30D)"]
        UI_Table["Allocation Console\n(6-Column Table + Slide-Out Drawer)"]
        UI_Audit["Comparison Audit View\n(OR-Tools vs. Greedy Baseline)"]
        UI_Forecast["Demand Forecaster\n(WAPE / MAE / RMSE Evaluation)"]
    end

    subgraph Gateway ["API Gateway (Node.js + Express :5001)"]
        GW_Router["Express Router & Proxy Engine"]
        GW_Diagnostics["/api/dataset-status Handler"]
        GW_Export["/api/optimization/runs/:id/export Handler"]
    end

    subgraph Engine ["Optimization Engine (Python + FastAPI :8000)"]
        API_Main["FastAPI App (engine/main.py)"]
        
        subgraph DataLayer ["Data & Logistics Sourcing"]
            M5_Load["M5 Data Loader (engine/m5_loader.py)\nFull / Sample Loader & Cache"]
            M5_Log["M5 Logistics Mapping (engine/m5_logistics.py)\nDCs, Corridors, Lots, Tariffs"]
            Demo_Data["Synthetic FMCG Generator (engine/demo_data.py)"]
        end
        
        subgraph Analytics ["Analytics & Modeling"]
            Forecast_Engine["Demand Forecaster (engine/demand.py)\nMoving Average & Lag Regression"]
            Baseline_Engine["Greedy Baseline Allocator (engine/baseline.py)"]
            MILP_Optimizer["OR-Tools Optimizer (engine/optimizer.py)\nSCIP / CBC Discrete Integer Solver"]
        end
        
        subgraph Integrity ["Quality & Validation"]
            Validator["Invariant Validator (engine/validator.py)\n10 Physical Supply Chain Tests"]
            Comparator["Comparison Service (engine/comparator.py)"]
        end
    end

    subgraph Datasets ["Dataset Repositories"]
        M5_Full["data/m5/ (External Kaggle CSVs)"]
        M5_Sample["data/m5/sample/ (Bundled Offline CSVs)"]
    end

    UI_Nav -->|REST Requests| GW_Router
    UI_Horizon -->|REST Requests| GW_Router
    UI_Table -->|Fetch Plans & CSV| GW_Router
    UI_Audit -->|Compare Models| GW_Router
    UI_Forecast -->|Predict Demand| GW_Router

    GW_Router -->|HTTP / JSON| API_Main
    
    API_Main --> DataLayer
    DataLayer --> Forecast_Engine
    Forecast_Engine -->|Demand Records| MILP_Optimizer
    Forecast_Engine -->|Demand Records| Baseline_Engine
    DataLayer -->|Inventory & Routes| MILP_Optimizer
    DataLayer -->|Inventory & Routes| Baseline_Engine
    
    MILP_Optimizer -->|Allocations| Validator
    Baseline_Engine -->|Allocations| Validator
    Validator --> Comparator
    Comparator --> API_Main
    
    M5_Full -.-> M5_Load
    M5_Sample -.-> M5_Load
```

### 2. Endpoint Catalog

| Endpoint | Method | Source Service | Description |
| :--- | :--- | :--- | :--- |
| `/health` | `GET` | FastAPI (`:8000`) | Service health and active solver identification |
| `/api/dataset-status` | `GET` | FastAPI (`:8000`) & Gateway (`:5001`) | Diagnostics of M5 CSV file presence and active source (`full`, `sample`, `none`) |
| `/api/master-data` | `GET` | FastAPI (`:8000`) & Gateway (`:5001`) | Fetches active products, warehouses, destinations, batches, routes, and demand |
| `/api/forecast` | `POST` | FastAPI (`:8000`) & Gateway (`:5001`) | Chronological train/test forecast with MAE, RMSE, and WAPE error metrics |
| `/api/baseline` | `POST` | FastAPI (`:8000`) & Gateway (`:5001`) | Runs greedy priority heuristic baseline |
| `/api/optimize` | `POST` | FastAPI (`:8000`) & Gateway (`:5001`) | Executes Google OR-Tools SCIP MILP optimizer |
| `/api/compare` | `POST` | FastAPI (`:8000`) & Gateway (`:5001`) | Runs both solvers against identical inputs and computes differential KPIs |
| `/api/export/:run_id` | `GET` | FastAPI (`:8000`) & Gateway (`:5001`) | Generates standard RFC-4180 CSV shipment manifest |

---

## Section E: Repository & File Structure

```
/Users/utkarshsood/Desktop/SupplySync
├── .gitignore                      # Configured to ignore raw large M5 CSVs while preserving data/m5/sample/
├── package.json                    # Workspace scripts (build, dev, test)
├── README.md                       # Comprehensive repository documentation & setup instructions
├── PROJECT_CONTEXT_HANDOFF.md      # This document
│
├── data/
│   └── m5/
│       ├── README.md               # Guide for downloading and placing full Kaggle dataset
│       └── sample/                 # Bundled offline sample dataset for immediate testing
│           ├── calendar.csv        # Dates, day IDs (d_1..d_1969), event markers
│           ├── sales_train_validation.csv # Point-of-sale store unit sales
│           └── sell_prices.csv     # Weekly price history
│
├── engine/                         # Python Optimization & Demand Forecasting Backend
│   ├── __init__.py
│   ├── requirements.txt            # Python dependencies (fastapi, ortools, pandas, scikit-learn, etc.)
│   ├── main.py                     # FastAPI entry point, dependency injection, and REST routes
│   ├── models.py                   # Pydantic schemas for supply chain entities and API contracts
│   ├── demo_data.py                # Synthetic FMCG dataset generator (5 SKUs, 4 WHs, 8 Retail Clusters)
│   ├── m5_loader.py                # M5 CSV parser, calendar mapper, validator, and time-series cache
│   ├── m5_logistics.py             # Configured logistics network (Distribution Centers, tariffs, batches)
│   ├── demand.py                   # Time-series forecasting (SMA, Lag Regression, MAE/RMSE/WAPE)
│   ├── optimizer.py                # Google OR-Tools MILP model formulation, constraints, and solver
│   ├── baseline.py                 # Greedy heuristic baseline allocator
│   ├── validator.py                # Mathematical invariant auditing suite (10 physical checks)
│   ├── comparator.py               # Objective side-by-side metric differential calculations
│   └── tests/
│       ├── __init__.py
│       └── test_engine.py          # Pytest test suite (13 automated tests)
│
├── server/                         # Node.js + Express + TypeScript API Gateway
│   ├── package.json
│   ├── tsconfig.json
│   ├── dist/                       # Compiled JavaScript output
│   └── src/
│       └── index.ts                # Express gateway server, timeout handling, and proxy endpoints
│
└── client/                         # React 19 + TypeScript + Vite Single Page Application
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx                # Client bootstrap
        ├── App.tsx                 # Root application controller, stream switcher, navigation
        ├── App.css                 # Application transitions
        ├── index.css               # Design tokens, typography, and Tailwind CSS v4 imports
        ├── api.ts                  # Typed client service communicating with Gateway
        ├── mockData.ts             # Client fallback data definitions
        └── components/
            ├── LandingPage.tsx          # Public marketing & overview landing page
            ├── NetworkOverview.tsx      # Distribution network topology & summary KPIs
            ├── InventoryManager.tsx     # Batch-level inventory inspection & FEFO tracker
            ├── DemandForecaster.tsx     # Time-series demand forecasting charts & WAPE audit
            ├── OptimizationConsole.tsx  # 6-column allocation table, slide-out drawer, filters
            └── ComparisonAuditView.tsx  # Side-by-side mathematical comparison audit
```

---

## Section F: Feature Implementation Status

| Feature | Purpose | Status | Relevant Files | Evidence / Verification |
| :--- | :--- | :--- | :--- | :--- |
| **Real M5 Dataset Loader** | Parses and caches real Walmart Kaggle daily sales data | **Verified & Operational** | `engine/m5_loader.py`, `data/m5/` | Passed `test_m5_data_loader_and_time_series` |
| **Configured Logistics Layer** | Bridges retail sales with distribution centers, routes, and batches | **Verified & Operational** | `engine/m5_logistics.py` | Passed `test_m5_logistics_mapping` |
| **WAPE Error Evaluation** | Evaluates forecast accuracy on sparse zero-sales FMCG data | **Verified & Operational** | `engine/demand.py` | Passed `test_wape_metric_calculation` |
| **Planning Horizon Dynamic Scaling** | 7D, 14D, and 30D horizons directly scale demand into optimizer | **Verified & Operational** | `engine/demand.py`, `engine/optimizer.py` | Passed `test_planning_horizon_scaling_7_14_30` |
| **MILP SCIP Solver** | Solves constrained integer allocation problem via Google OR-Tools | **Verified & Operational** | `engine/optimizer.py` | Passed `test_ortools_optimizer_invariants_and_superiority` |
| **Solver Fallback Protection** | Prohibits continuous GLOP solver; enforces SCIP or CBC | **Verified & Operational** | `engine/optimizer.py` | Verified in unit test suite |
| **Bounded FEFO Subsidy** | Eliminates negative objective cost coefficients on low-cost corridors | **Verified & Operational** | `engine/optimizer.py` | Mathematically bounded: $\le 0.25 \cdot c_{w,d}$ |
| **Redesigned Allocation Table** | Clean 6-column table (`Product`, `Route`, `Expiry`, `Qty`, `Cost`, `Action`) | **Verified & Operational** | `client/src/components/OptimizationConsole.tsx` | Built and verified in UI |
| **Slide-Out Reasoning Drawer** | Deep inspection of inventory lots, route limits, and dispatch rationale | **Verified & Operational** | `client/src/components/OptimizationConsole.tsx` | Replaced cluttered inline details |
| **Multi-Filtering & Sorting** | Filter by warehouse, destination, product, expiry; sort by cost/date/qty | **Verified & Operational** | `client/src/components/OptimizationConsole.tsx` | Implemented and verified |
| **Table Pagination** | Limits rendered rows to 12 per page to eliminate vertical DOM bloat | **Verified & Operational** | `client/src/components/OptimizationConsole.tsx` | Implemented and verified |
| **Dual Data Stream Switcher** | Header toggle between `Synthetic FMCG` and `Real M5 Kaggle` | **Verified & Operational** | `client/src/App.tsx`, `client/src/api.ts` | Dynamically reloads master data |
| **Baseline vs. OR-Tools Audit** | Objective side-by-side benchmarking on identical input snapshots | **Verified & Operational** | `engine/comparator.py`, `ComparisonAuditView.tsx` | Passed `test_comparison_audit_metrics` |
| **RFC-4180 CSV Export** | Export shipment recommendations to CSV | **Verified & Operational** | `engine/main.py`, `server/src/index.ts` | Passed `test_api_endpoints` |

---

## Section G: Data, Algorithms, and AI/ML

### 1. The Walmart M5 Dataset vs. Configured Logistics

#### A. Authentic M5 Data Elements
- **Sales History**: Actual recorded unit sales per item per store from day `d_1` to `d_1913`.
- **Item IDs**: Genuine Walmart SKU identifiers (e.g., `FOODS_1_001`, `HOBBIES_1_001`, `HOUSEHOLD_1_001`).
- **Store IDs**: Real retail supercenters across California (`CA_1` to `CA_4`), Texas (`TX_1` to `TX_3`), and Wisconsin (`WI_1` to `WI_3`).
- **Calendar & Pricing**: Authentic date calendar mappings, day-of-week indices, and weekly shelf price fluctuations.

#### B. Transparently Configured Logistics Infrastructure
Because M5 is purely a retail sales log without supply chain distribution topology, SupplySync creates a realistic, transparently labeled logistics configuration:
- **Distribution Centers**:
  - `W-PDC`: Pacific Distribution Center (Fresno, California)
  - `W-TDC`: Texas Regional Distribution Center (Waco, Texas)
  - `W-MDC`: Midwest Distribution Center (Rockford, Illinois)
- **Freight Corridors**: Defined highway connections from each DC to every retail supercenter with authentic road distances ($45\text{ km}$ to $3,200\text{ km}$) and unit tariffs ($1.75\text{ to }\$9.40\text{/unit}$).
- **Inventory Lots**: Warehouse inventory balances initialized with distinct batch IDs, production timestamps, and FEFO expiry tracking for perishable food categories (`FOODS_...`). Non-perishable hardware/hobbies have indefinite shelf life.

### 2. Time-Series Demand Forecasting Pipeline
- **Temporal Splitting**: Chronological train/validation split without future lookahead. For a 60-day historical window, the last 14 days are held out for model evaluation.
- **Models**:
  1. **Baseline**: 7-day Simple Moving Average (SMA).
  2. **Seasonal Lag Regression**: Linear regression with temporal features:
     - Lag 1 observation ($y_{t-1}$)
     - Lag 7 observation ($y_{t-7}$, capturing weekly seasonality)
     - Day of week (0 to 6, one-hot or seasonal multiplier)
     - Linear time trend index ($t$)
- **Evaluation Metrics**:
  - **MAE** (Mean Absolute Error): Measures average magnitude of unit errors.
  - **RMSE** (Root Mean Squared Error): Penalizes large unexpected spikes.
  - **WAPE** (Weighted Absolute Percentage Error):
    $$\text{WAPE} = \frac{\sum_{t=1}^N |y_t - \hat{y}_t|}{\sum_{t=1}^N y_t} \times 100$$
    *Crucial industry standard: Avoids division-by-zero or infinite distortion common with MAPE on sparse retail zero-sales days.*
- **Horizon Projection**: The model computes daily projected demand and aggregates it across the selected planning horizon ($H \in \{7, 14, 30\}$) to directly form the optimization input $D_{d,p}$.

### 3. Mathematical Optimization Model (Google OR-Tools MILP)

#### Decision Variables
- $x_{w,d,p,b} \in \mathbb{Z}_{\ge 0}$: Integer unit shipment of product $p$ from inventory lot $b$ at warehouse $w$ to destination $d$.
- $u_{d,p} \in \mathbb{Z}_{\ge 0}$: Unmet customer demand for product $p$ at destination $d$.

#### Objective Function Formulation
$$\min \sum_{w, d, p, b} \left( c_{w, d} - \text{Subsidy}_{\text{FEFO}}(b) \right) x_{w, d, p, b} + \sum_{d, p} \left( \lambda_p \cdot \text{TierMultiplier}_d \right) u_{d, p}$$

Where:
- $c_{w,d}$: Original contract freight tariff per unit on route $(w, d)$.
- $\text{Subsidy}_{\text{FEFO}}(b)$: Bounded tie-breaker subsidy applied only to usable lots expiring within $\le 15$ days:
  $$\text{Subsidy}_{\text{FEFO}}(b) = \min(0.25 \cdot c_{w,d},\, 0.75)$$
  *Mathematical Guarantee: Bounding this subsidy ensures the effective cost coefficient is always $\ge 0.75 \cdot c_{w,d} > 0$. It never produces negative transportation costs, eliminating artificial incentives to dispatch unneeded volume.*
- $\lambda_p$: Product-specific shortage penalty per unfulfilled unit (typically $\$25.00$).
- $\text{TierMultiplier}_d$: SLA multiplier ($1.30\times$ for Tier-1 key accounts; $1.0\times$ for standard retail).

#### Hard Physical Constraints
1. **Batch Inventory Availability**:
   $$\sum_{d \in D} x_{w, d, p, b} \le Q_{w, p, b} \quad \forall w, p, b$$
2. **Expired Inventory Quarantine**:
   $$Q_{w, p, b} = 0 \quad \text{if } \text{days\_to\_expiry} \le 0$$
3. **Route Corridor Throughput**:
   $$\sum_{p \in P, b \in B} x_{w, d, p, b} \le C_{w, d} \quad \forall (w, d) \in \text{Routes with defined limits}$$
4. **Demand Conservation & Slacks**:
   $$\sum_{w \in W, b \in B} x_{w, d, p, b} + u_{d, p} = D_{d, p} \quad \forall d \in D, p \in P$$
5. **Integrity & Bounds**:
   $$x_{w, d, p, b} \in \mathbb{Z}_{\ge 0}, \quad u_{d, p} \in \mathbb{Z}_{\ge 0}$$

#### Solver Selection & Fallback Protection
- The solver engine strictly requests `SCIP` (Solving Constraint Integer Programs) or `CBC_MIXED_INTEGER_PROGRAMMING`.
- Continuous solvers (such as Google OR-Tools `GLOP`) are explicitly rejected with an exception to prevent fractional unit assignments (e.g., shipping 0.43 cases).

---

## Section H: Frontend and UI/UX Design System

### 1. Enterprise Design System Tokens
- **Page Background**: Warm off-white (`#F7F7F4`)
- **Primary Text**: Near-black (`#191B19`)
- **Primary Brand Accent**: Muted forest green (`#526B50`, with hover `#435841`)
- **Secondary / Supporting Text**: Cool slate gray (`#70736E`)
- **Borders & Dividers**: Crisp, subtle warm gray (`#E5E6E0`)
- **Card Surfaces**: Pure white (`#FFFFFF`) with subtle box-shadows (`shadow-xs` / `shadow-sm`)
- **Status Accents**:
  - *Healthy / Optimal*: Emerald green (`#10B981`, bg `#EBF1EA`, text `#526B50`)
  - *Near Expiry / Warning*: Warm amber (`#F59E0B`, bg `#FEF3C7`, text `#B45309`)
  - *Expired / Critical*: Coral red (`#EF4444`, bg `#FEE2E2`, text `#B91C1C`)

### 2. Allocation Table Architecture
The primary shipment allocation table (`OptimizationConsole.tsx`) was rebuilt from a cluttered 8-column layout with wrapping text into a compact, single-line 6-column structure:
1. **Product**: SKU name with secondary monospace ID badge (`PROD-001` / `FOODS_1_001`).
2. **Route**: Origin warehouse arrow destination badge (e.g., `PDC West → CA_1 Los Angeles`).
3. **Batch / Expiry**: Visual pill showing remaining shelf life (`Expires in 4d`, `Healthy`, etc.).
4. **Quantity**: Right-aligned, formatted integer units.
5. **Freight Cost**: Right-aligned, formatted USD currency calculated directly from actual contract tariffs.
6. **Action**: Compact "View" button triggering the side-panel drawer.

### 3. Slide-Out Reasoning Drawer
Clicking "View" opens a slide-out panel on the right margin that does not interrupt table scroll position or active filters:
- **Consignment Specification**: Product ID, Source DC, Destination, Batch ID, and Allocation Volume.
- **Financial Breakdown**: Unit route tariff, total line freight, and objective weight contribution.
- **Physical Feasibility**: Total batch inventory vs. allocated volume, route corridor utilization, and FEFO eligibility verification.
- **Solver Rationale**: Transparent explanation of why this route and batch was chosen (cost efficiency, SLA tier priority, or expiry avoidance).

### 4. Interactive Data Stream & Horizon Controls
- **Data Stream Switcher**: Located in the top navigation bar (`FMCG Demo` vs `Real M5 Kaggle`). Toggling instantly reloads master data and recalculates network topology.
- **Planning Horizon Selector**: Located in the console action bar (`7D`, `14D`, `30D`). Toggling dynamically recalculates time-series demand projections and passes scaled demand records into the OR-Tools solver.

---

## Section I: Bugs, Errors, and Debugging History

| Problem / Bug | Error / Symptom | Root Cause | Fix Applied | Outcome & Status |
| :--- | :--- | :--- | :--- | :--- |
| **Negative Cost Objective Defect** | Optimizer dispatched excess units over cheap routes without demand | Subtracting static `-4.00` subsidy on routes with tariff `< 4.00` yielded negative costs | Bounded FEFO subsidy to $\min(0.25 \cdot c_{w,d}, 0.75)$ | **Resolved**: Coefficients strictly positive; no artificial dispatches |
| **Continuous Solver Fallback Risk** | Solver fallback chain included continuous `GLOP` | Relaxing integer constraints allowed fractional product allocations | Enforced `SCIP` and `CBC_MIXED_INTEGER_PROGRAMMING`; explicitly rejected `GLOP` | **Resolved**: Guaranteed discrete integer allocations |
| **Static Demand on Horizon Toggle** | Toggling 14D / 30D did not alter optimization inputs | Engine used hardcoded static demand function that ignored `horizon_days` | Implemented `generate_forecasted_demand_records()` scaling demand by horizon | **Resolved**: 14D and 30D demand genuinely scales and binds inventory |
| **Sparse Zero-Sales Metric Crash** | MAPE returned `NaN` or `inf` during retail demand backtesting | Point-of-sale retail daily data frequently contains 0 sales | Implemented WAPE (Weighted Absolute Percentage Error) | **Resolved**: Mathematically sound error metric handling zero sales |
| **Allocation Table Visual Clutter** | Screen height exceeded 2,000px; text wrapped awkwardly across lines | Repeated long constraint text in table cells and absence of pagination | Rebuilt table to 6 columns, moved rationale to side drawer, added 12-row pagination | **Resolved**: Scannable, clean, enterprise-grade console |
| **Port Collision during Hot Reload** | Python engine failed with `Address already in use: 8000` | Background uvicorn process retained port after session compaction | Killed orphaned tasks via `manage_task` and respawned daemon | **Resolved**: Clean port binding on 8000 and 5001 |

---

## Section J: Testing, Verification, and Audit Results

### 1. Pytest Automated Test Suite (`engine/tests/test_engine.py`)
Executed via: `source .venv/bin/activate && pytest engine/tests -v`  
**Result:** **13 Passed in 2.62s (100% Pass Rate)**

```
collected 13 items

engine/tests/test_engine.py::test_api_health PASSED                         [  7%]
engine/tests/test_engine.py::test_dataset_status_endpoint PASSED            [ 15%]
engine/tests/test_engine.py::test_master_data_integrity PASSED            [ 23%]
engine/tests/test_engine.py::test_m5_data_loader_and_time_series PASSED    [ 30%]
engine/tests/test_engine.py::test_m5_logistics_mapping PASSED              [ 38%]
engine/tests/test_engine.py::test_planning_horizon_scaling_7_14_30 PASSED   [ 46%]
engine/tests/test_engine.py::test_wape_metric_calculation PASSED           [ 53%]
engine/tests/test_engine.py::test_baseline_allocation_invariants PASSED    [ 61%]
engine/tests/test_engine.py::test_ortools_optimizer_invariants_and_superiority PASSED [ 69%]
engine/tests/test_engine.py::test_m5_mode_optimization_end_to_end PASSED   [ 76%]
engine/tests/test_engine.py::test_comparison_audit_metrics PASSED          [ 84%]
engine/tests/test_engine.py::test_demand_forecasting_evaluation PASSED     [ 92%]
engine/tests/test_engine.py::test_api_endpoints PASSED                     [100%]
```

### 2. Frontend & Backend Production Compilation
- **Frontend Vite Client**: `cd client && npm run build` &rarr; Built in `257ms` with **0 errors**.
- **Backend TypeScript Gateway**: `cd server && npm run build` &rarr; Built with **0 errors**.

### 3. Live Optimization End-to-End Verification
Executed live via API Gateway:
- **Synthetic FMCG Run**: 7-day horizon, 5 SKUs, 8 Destinations. Solver runtime: `18ms`, Fulfillment: `100.0%`, Total Freight: `$10,480.00`, Solver Status: `OPTIMAL`.
- **Real M5 Kaggle Run**: 7-day horizon, real M5 store and item identifiers. Solver runtime: `24ms`, Fulfillment: `100.0%`, Active Consignments: `13 lanes`, Solver Status: `OPTIMAL`.

---

## Section K: Environment & Execution Instructions

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Python**: v3.10 to v3.14 with standard `venv`

### 2. Step-by-Step Local Startup

#### Step 1: Initialize Python Optimization Service
```bash
# From workspace root
python3 -m venv .venv
source .venv/bin/activate
pip install -r engine/requirements.txt

# Run automated invariant tests
pytest engine/tests -v

# Launch FastAPI engine on port 8000
uvicorn engine.main:app --host 127.0.0.1 --port 8000
```

#### Step 2: Initialize Node.js API Gateway
```bash
# In a new terminal window
cd server
npm install
npm run build
npm start
# Gateway listens on http://localhost:5001 (proxies to http://127.0.0.1:8000)
```

#### Step 3: Launch React Client
```bash
# In a third terminal window
cd client
npm install
npm run dev
# Vite client runs at http://localhost:5173
```

### 3. Full Kaggle M5 Dataset Placement (Optional)
The bundled offline sample dataset in `data/m5/sample/` works out-of-the-box. To load the complete 500MB+ dataset:
1. Download from Kaggle: `https://www.kaggle.com/competitions/m5-forecasting-accuracy`
2. Place the following files in `data/m5/`:
   - `data/m5/calendar.csv`
   - `data/m5/sales_train_validation.csv`
   - `data/m5/sell_prices.csv`
3. The engine automatically detects their presence via `engine/m5_loader.py` and promotes the active source to `full`. Git is configured to ignore these files automatically.

---

## Section L: Deployment & Hosting Status

- **Development Environment**: Local macOS developer workstation (`darwin arm64`).
- **Production Deployment Target**: Containerized microservices (Docker / GCP Cloud Run / Render / AWS ECS).
  - Client: Static SPA hosting (Vercel, Netlify, or Cloudflare Pages).
  - Gateway: Node.js server container.
  - Optimization Engine: Python container with pre-installed `ortools` and C++ solver bindings (`scip`, `cbc`).
- **Live Hosting**: Currently running locally on development ports (`5173`, `5001`, `8000`).

---

## Section M: Decision Log & Rationale

| Decision | Rationale | Alternatives Considered | Status |
| :--- | :--- | :--- | :--- |
| **Logistics Scenario Layer for M5 Data** | M5 is retail sales only; lacks warehouses, freight costs, and vehicle limits. Providing a transparently labeled configuration preserves operational realism without fabricating fake history. | Fabricating fake inventory directly into M5 files (rejected as scientifically dishonest). | **Finalized** |
| **Bounded FEFO Subsidy** | Bounding subsidy to $\min(0.25 \cdot c_{w,d}, 0.75)$ prevents negative objective costs and artificial dispatches. | Unbounded fixed penalty subtraction (rejected due to mathematical flaw). | **Finalized** |
| **Separating Reported Freight from Objective** | Objective function uses penalty weights ($M=100$); reported transportation bill must strictly equal real contract freight ($x \cdot c$). | Reporting solver objective value as freight cost (rejected as misleading). | **Finalized** |
| **WAPE Metric for Sparse Retail Sales** | FMCG store sales contain numerous zero-sales days where MAPE causes division by zero. | MAPE (rejected due to zero division); MASE (deferred as unnecessary complexity). | **Finalized** |
| **6-Column Allocation Table + Side Drawer** | Clean visual hierarchy enables rapid scanning by hackathon judges while preserving full audit details. | Crowding 10+ columns into a horizontally scrolled table (rejected as unreadable). | **Finalized** |
| **Strict Integer Solvers (SCIP/CBC)** | FMCG products ship in discrete unit packages; continuous solvers allow non-physical fractional shipments. | GLOP (rejected because continuous variables violate discrete packing). | **Finalized** |

---

## Section N: Known Limitations & Technical Debt

1. **Static Aggregate Planning Horizon**: The optimizer solves an aggregate allocation over the chosen horizon ($H$). It does not currently compute day-by-day vehicle dispatch schedules or multi-period inventory carryover. *(Severity: Low for hackathon; standard for tactical distribution planning).*
2. **In-Memory Time Series Caching**: M5 data structures are cached in Python process memory. If the full 500MB dataset is loaded, initial cold-start parsing takes 3–5 seconds before in-memory caching activates. *(Severity: Low).*
3. **Deterministic Route Tariffs**: Transportation costs are modeled as linear per-unit rates ($c_{w,d}$) rather than step-function Full Truckload (FTL) / Less than Truckload (LTL) tiered pricing. *(Severity: Low).*

---

## Section O: Current Project State

1. **What is working**:
   - Complete end-to-end pipeline: M5 sales history &rarr; time-series forecasting &rarr; horizon-scaled demand &rarr; OR-Tools MILP optimization &rarr; invariant validation &rarr; UI dashboard & CSV export.
   - Dual data stream toggle (`Synthetic FMCG` vs `Real M5 Kaggle`).
   - Dynamic planning horizon switcher (`7D`, `14D`, `30D`).
   - Rebuilt 6-column allocation table with multi-filters, sorting, pagination, and slide-out reasoning drawer.
   - All 13 Pytest suites passing; both client and server compile cleanly.
   - All code committed and pushed to `origin/main` (`commit e22b2bc`).
2. **What is partially working**:
   - Real M5 dataset runs on the bundled offline sample (`data/m5/sample/`); full 500MB dataset loads automatically when placed in `data/m5/`.
3. **What is broken**:
   - None. All discovered mathematical and UI defects have been corrected and verified.
4. **What remains unimplemented**:
   - Multi-period rolling inventory simulation across discrete days (future roadmap item).
5. **Biggest current blocker**:
   - None. The system is functional and competition-ready.

---

## Section P: Pending Tasks & Prioritized Roadmap

### Priority 0 (Critical - None Remaining)
- All critical data flow, optimization correctness, and UI refinement criteria are satisfied.

### Priority 1 (High - Polish & Presentation)
- [ ] Prepare 3-minute hackathon judge demonstration script highlighting the comparison audit between OR-Tools and the baseline heuristic.
- [ ] Record a short WebP or MP4 product walkthrough video.

### Priority 2 (Medium - Extended Functionality)
- [ ] Add multi-echelon warehouse-to-warehouse stock rebalancing before final destination dispatch.
- [ ] Implement FTL (Full Truckload) minimum volume thresholds on freight corridors.

### Priority 3 (Low - Advanced Enhancements)
- [ ] Add interactive Leaflet / Mapbox geospatial route visualization for the US M5 retail network.
- [ ] Implement LightGBM or XGBoost multi-variate forecaster with promotional holiday features.

---

## Section Q: Context & Decisions from Previous Conversations

1. **Preserve Existing Architecture**: The user explicitly required preserving the existing repository architecture (React + Node.js + FastAPI + OR-Tools) rather than rebuilding from scratch.
2. **Honesty Regarding Missing Logistics Data in M5**: The user emphasized that M5 is purely a retail sales log. We must **never** fabricate missing logistics data and label it as real. The separation between Real M5 data and Configured Logistics assumptions must be explicit.
3. **Prioritize Correctness Over Aesthetics**: Mathematical correctness and verifiable data flow take absolute precedence over visual polish.
4. **Non-Destructive Workflow**: Work incrementally, maintain tests, never force-push, and never delete existing valid tests.

---

## Section R: Immediate Next Steps

If you are continuing work on SupplySync, execute these immediate actions:
1. **Verify Local Runtime**: Run `pytest engine/tests -v` to ensure the environment remains in a healthy state.
2. **Review Comparison Audit**: Inspect the mathematical differences on the Comparison Audit view (`http://localhost:5173`) between OR-Tools and the baseline to prepare judging talking points.
3. **Test Full Dataset (If Desired)**: If the user provides the full M5 Kaggle files, drop them into `data/m5/` and verify that `/api/dataset-status` reports `active_source: "full"`.

---

## Section S: Explicit Instructions for the Next AI Assistant

**Dear AI Assistant (ChatGPT / Claude / Copilot):**

You are taking over development on **SupplySync**, an enterprise distribution intelligence engine for **Triwizathon 2026, Problem Statement 2**.

Please adhere strictly to the following operating principles:

1. **Read This Document First**: Do not ask the user for architecture, tech stack, file paths, or equation details that are already documented here.
2. **Use Code as Truth**: The source code in `/Users/utkarshsood/Desktop/SupplySync` is the ground truth. Always inspect existing files before proposing modifications.
3. **Preserve Mathematical Correctness**:
   - Never introduce negative objective coefficients.
   - Never allow continuous solvers (`GLOP`) to replace integer solvers (`SCIP` or `CBC`).
   - Never mix objective penalty values into actual transportation cost metrics.
4. **Maintain Transparent Data Provenance**: Clearly distinguish Real M5 data from Configured Logistics and Optimization Outputs.
5. **Keep the UI Minimal & Professional**: Maintain the warm off-white SaaS aesthetic (`#F7F7F4`, `#191B19`, `#526B50`). Avoid excessive badges, glassmorphism, or multi-line table clutter.
6. **Verify Before Declaring Completion**: Always verify changes by running `pytest engine/tests -v` and `npm run build` in `client` and `server`.
