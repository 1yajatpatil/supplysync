# SupplySync: Complete Technical Architecture Documentation
**Autonomous Distribution Intelligence & Multi-Echelon Inventory Optimization Engine**  
*Triwizathon 2026 | Problem Statement 2: AI-Powered Distribution Intelligence & Inventory Optimization*  
*Repository Root:* `/Users/utkarshsood/Desktop/SupplySync`  
*Target Release:* Final Release & Hackathon Demonstration Freeze  

---

## Document Overview & Executive Navigator

This document serves as the single authoritative, end-to-end technical reference for **SupplySync**. It details the business drivers, mathematical formulations, software architecture, data pipelines, security controls, and operational workflows implemented across the system. Every technical assertion, API route, data structure, and mathematical formulation in this document is grounded in verified source code and reproducible test evidence within the active repository.

---

## Table of Contents

1. [Section 1 — Executive Summary](#section-1--executive-summary)
2. [Section 2 — Real-World Business Problem](#section-2--real-world-business-problem)
3. [Section 3 — Complete Technology Stack](#section-3--complete-technology-stack)
4. [Section 4 — Complete System Architecture](#section-4--complete-system-architecture)
5. [Section 5 — Repository Structure and File-by-File Explanation](#section-5--repository-structure-and-file-by-file-explanation)
6. [Section 6 — End-to-End Request Lifecycle](#section-6--end-to-end-request-lifecycle)
7. [Section 7 — The Six-Step Planning Workflow](#section-7--the-six-step-planning-workflow)
8. [Section 8 — Dataset and Data Engineering](#section-8--dataset-and-data-engineering)
9. [Section 9 — Data Model and Relationships](#section-9--data-model-and-relationships)
10. [Section 10 — Validation Engine](#section-10--validation-engine)
11. [Section 11 — Optimization Engine and Mathematical Logic](#section-11--optimization-engine-and-mathematical-logic)
12. [Section 12 — Baseline and Comparison Logic](#section-12--baseline-and-comparison-logic)
13. [Section 13 — Worked Real-Life Example](#section-13--worked-real-life-example)
14. [Section 14 — Metrics and Their Interpretation](#section-14--metrics-and-their-interpretation)
15. [Section 15 — API Reference](#section-15--api-reference)
16. [Section 16 — Authentication and Security Architecture](#section-16--authentication-and-security-architecture)
17. [Section 17 — Frontend Architecture and State Management](#section-17--frontend-architecture-and-state-management)
18. [Section 18 — Testing Strategy and Evidence](#section-18--testing-strategy-and-evidence)
19. [Section 19 — Performance, Benchmarks, and Stress Testing](#section-19--performance-benchmarks-and-stress-testing)
20. [Section 20 — Running the Application Locally](#section-20--running-the-application-locally)
21. [Section 21 — Practical Demo Guide for Hackathon Judges](#section-21--practical-demo-guide-for-hackathon-judges)
22. [Section 22 — Limitations and Future Roadmap](#section-22--limitations-and-future-roadmap)
23. [Section 23 — Glossary](#section-23--glossary)
24. [Section 24 — Final Project Status and Handoff](#section-24--final-project-status-and-handoff)
25. [Source of Truth and Verification Notes](#source-of-truth-and-verification-notes)

---

## Section 1 — Executive Summary

### 1.1 What SupplySync Is
**SupplySync** is an enterprise-grade distribution intelligence and inventory optimization platform designed for Fast-Moving Consumer Goods (FMCG) and retail supply networks. It bridges the gap between raw point-of-sale time-series demand forecasting and discrete, multi-echelon freight allocation. Rather than presenting passive business intelligence charts, SupplySync formulates distribution as a **Constrained Mixed-Integer Linear Program (MILP)** solved via **Google OR-Tools (SCIP engine)**. It produces actionable, consignment-level dispatch instructions that honor warehouse stock, batch-level expiration dates (First Expired, First Out - FEFO), corridor freight capacities (units and kilograms), and retailer customer service level agreements (SLAs).

### 1.2 Hackathon Problem Addressed
SupplySync directly addresses **Triwizathon 2026 Problem Statement 2: AI-Powered Distribution Intelligence & Inventory Optimization Engine**. The problem demands an end-to-end operational decision platform that ingests real-world demand data (specifically the Kaggle Walmart M5 competition dataset), validates supply-chain consistency, optimizes replenishment across competing distribution centers and retail stores, prevents perishable spoilage, and proves measurable economic value against traditional greedy heuristics.

### 1.3 The Commercial Business Problem Solved
FMCG supply chains operate on razor-thin operating margins (often 2% to 5%). Planners face conflicting pressures:
* **Stockouts vs. Carrying Costs:** Running out of stock at high-tier retail stores triggers severe financial penalties and lost consumer trust. Overstocking strains working capital and induces spoilage.
* **Freight Tariffs vs. Spoilage:** Shipping from the closest warehouse minimizes trucking freight in the short term, but may leave older perishable batches rotting in a secondary regional distribution center.
* **Corridor Capacities:** Dedicated logistics carriers enforce daily unit and gross vehicle weight (GVW) limits that single-depot planners cannot jointly balance across dozens of retail destinations.

### 1.4 Target Users in an Enterprise
1. **Central Supply Chain Planners:** Set planning horizons (7D, 14D, 30D), evaluate regional stock imbalances, and generate multi-depot replenishment schedules.
2. **Logistics & Freight Managers:** Validate corridor volume utilization and carrier weight compliance before dispatching trucks.
3. **Inventory & Warehouse Operations Supervisors:** Review lot-level FEFO pull lists to ensure oldest usable stock is loaded first.
4. **Operations Research / Supply Chain Analysts:** Execute audit comparisons between legacy heuristic planning and mathematical optimization to quantify net cost savings.

### 1.5 What Decisions SupplySync Helps Users Make
* **Which exact batch** of a product in which specific warehouse should be picked.
* **Which transportation corridor** should carry the shipment to satisfy target retail demand.
* **How many units** must be dispatched to fulfill demand without exceeding truck weight or corridor caps.
* **When to prioritize shortage penalties over freight tariffs** when network-wide inventory is constrained.
* **Whether the current greedy heuristic allocation matches the global mathematical optimum**, eliminating intuition-based guesswork.

### 1.6 Key Differentiators from Basic Inventory Dashboards
* **Mathematical Optimization vs. Passive Charting:** Standard dashboards show what was sold or what is currently in stock. SupplySync solves an optimization problem that decides *where inventory should go next*.
* **Two-Phase Lexicographic Optimization:** First establishes the absolute global minimum economic cost (freight + stockout penalties), and then solves a second optimization phase to maximize shelf-life conservation (FEFO) without increasing costs by even one cent.
* **Dual Physical Network Constraints:** Enforces both unit counts and physical kilogram weight limits across transportation corridors.
* **Honest Comparative Audit:** Evaluates the mathematical optimizer against a defensible greedy nearest-depot heuristic using identical input data, formulas, and pricing. If the network is unconstrained and the heuristic achieves global optimality, SupplySync explicitly reports equal performance rather than fabricating false savings.
* **Full Production Security Architecture:** Incorporates genuine session-based authentication, SHA-256 token hashing in SQLite, HttpOnly/SameSite cookies, and CSRF origin verification.

### 1.7 Current Implementation Status
* **Core Engine:** Mixed-Integer Linear Programming optimizer implemented in Python using Google OR-Tools (SCIP).
* **Baseline Strategy:** Deterministic demand-priority nearest-depot heuristic implemented in Python.
* **Comparison Engine:** Side-by-side metric auditor calculating net freight variance, shortage reductions, and economic cost differences.
* **Data Pipelines:** Specialized Walmart M5 competition dataset loader (`sales_train_validation.csv`, `calendar.csv`, `sell_prices.csv`) with indexed binary lookups, alongside a custom CSV upload parser with strict schema validation.
* **Forecasting Module:** 7-day Simple Moving Average (SMA) and Time-Series Linear Regression with lag-1, lag-7, day-of-week seasonality, and chronological backtesting.
* **Web Architecture:** Express.js TypeScript API Gateway and React 18 / Tailwind CSS client featuring a guided Six-Step Planning Wizard and an interactive deep-dive analytics console.
* **Authentication:** Multi-user authentication with bcrypt password hashing, cryptographically random session tokens, and SQLite run ownership isolation.

### 1.8 Current Prototype Maturity and Limitations
* **Maturity:** Production-ready algorithmic logic, hardened security gateway, complete test coverage (66 pytest engine tests, 34 node integration tests, zero build errors), verified on Mac and Linux.
* **Limitations:** The bundled dataset is an indexed sample of the multi-gigabyte M5 Kaggle dataset; real-time GPS tracking and live ERP connectors (SAP/Oracle) are conceptual future extensions; multi-stop vehicle routing (VRP) is simplified into direct origin-destination corridor bounds.

### 1.9 30-Second Judge Pitch
> *"SupplySync is an AI and operations research distribution intelligence platform for FMCG retail supply chains. Instead of passive BI dashboards or greedy heuristics that cause stockouts and perishable spoilage, SupplySync uses Google OR-Tools to solve a two-phase Mixed-Integer Linear Program over real Walmart M5 retail sales data. It co-optimizes freight tariffs, truck weight limits, and batch-level FEFO expiration schedules across multi-warehouse networks. In stress testing across 50 adversarial network topologies, SupplySync delivered a 7.23% net economic cost reduction and eliminated over 1,700 stockout units. When simple networks permit heuristic optimality, our auditor honestly reports parity—proving zero hallucination and mathematical defensibility."*

---

## Section 2 — Real-World Business Problem

### 2.1 The FMCG Distribution Scenario
Consider a consumer packaged goods (CPG) enterprise supplying essential foods and household supplies across California and Texas. The distribution network consists of:
* **3 Regional Distribution Centers (DCs):**
  * `WH-M5-PACIFIC` located in Mira Loma, CA (150,000 unit capacity).
  * `WH-M5-TEXAS` located in Fort Worth, TX (160,000 unit capacity).
  * `WH-M5-MIDWEST` located in Joliet, IL (140,000 unit capacity).
* **4 Retail Supercenters:**
  * `CA_1` (Long Beach, CA) and `CA_2` (Baldwin Park, CA).
  * `TX_1` (Houston, TX) and `TX_2` (Dallas North, TX).
* **5 Critical Product SKUs:**
  * Perishable Dairy & Produce (`FOODS_1_001`, `FOODS_1_002`) with 14-day shelf life.
  * Refrigerated Groceries (`FOODS_2_001`) with 30-day shelf life.
  * Packaged Hobbies & Household items (`HOBBIES_1_001`, `HOUSEHOLD_1_001`) with 365-day shelf life.
* **17 Inventory Lots:** Stored across the DCs with differing production timestamps and days until expiration.
* **12 Transportation Corridors:** Connecting every DC to every retail supercenter with fixed unit tariffs, distances, transit times, and vehicle weight capacities.

```
       +------------------------------------+
       |      Regional DCs (Warehouses)     |
       |  [WH-PACIFIC]  [WH-TEXAS] [WH-MID] |
       +-----------------+------------------+
                         |
      Corridors (Tariffs, Transit, Weight Caps)
                         |
       +-----------------v------------------+
       |     Retail Stores (Destinations)   |
       |    [CA_1]    [CA_2]   [TX_1]  [TX_2]|
       +------------------------------------+
```

### 2.2 Competing Commercial & Operational Objectives
In real FMCG distribution, objectives directly conflict:

1. **Demand Fulfillment vs. Freight Minimization:**
   * Fulfilling 100% of store demand requires expediting shipments from distant warehouses if local stock is depleted.
   * Shipping `FOODS_1_001` from Mira Loma, CA to Long Beach, CA costs **$1.75/unit** (1 day transit). Shipping the same item from Joliet, IL to Long Beach costs **$9.40/unit** (4 days transit).
2. **Local Greed vs. Network Optimality (The Tariff Trap):**
   * A greedy logistics planner supplies Store `CA_1` entirely from the local Pacific DC because $1.75 is the cheapest available lane.
   * However, doing so consumes all local inventory, leaving Store `CA_2` (also in California) stranded with zero local stock. Store `CA_2` is then forced to order from Texas at $7.10/unit or suffer a massive stockout penalty.
   * A global optimizer routes inventory holistically to minimize the sum of all freight and shortage costs across the entire network.
3. **First Expired, First Out (FEFO) vs. Freight Tariffs:**
   * A batch of fresh produce at the Pacific DC expires in 6 days (`M5-LOT-0002-FEFO`). A newer batch expires in 80 days.
   * If the near-expiry batch is not shipped and sold within 6 days, it spoils entirely, incurring a 100% inventory write-off ($1.98 unit cost lost).
   * Shipping the near-expiry batch requires allocating it to a store with immediate 1-day transit (`CA_1` or `CA_2`), rather than sending it on a 3-day transit corridor to Texas where it would arrive with insufficient shelf life.
4. **Route Capacity and Truck Gross Vehicle Weight (GVW):**
   * Dedicated carrier contracts limit shipments on the Mira Loma $\rightarrow$ Long Beach corridor to 3,000 units and 4,500 kg daily.
   * Even if the Pacific DC has 10,000 units in stock, shipments exceeding 3,000 units violate carrier capacity and require secondary, more expensive routes.
5. **Customer SLA and Tiered Shortage Penalties:**
   * Retail stores are categorized into service tiers. Tier-1 supercenters (`CA_1`, `TX_1`) generate higher footfall and carry strict supplier chargebacks for unfilled purchase orders (modeled with a **1.30x penalty multiplier**).
   * If total inventory is scarce, the model must strategically prioritize Tier-1 stores over Tier-2 stores.

### 2.3 Consequences of Suboptimal Decisions
* **Financial Waste:** Uncoordinated dispatching increases freight expenditure by 5% to 15% through unnecessary inter-regional transfers.
* **Inventory Spoilage:** Failure to enforce batch-level FEFO causes perishable food items to expire on warehouse racks while newer batches are shipped.
* **Retail Chargebacks (OTIF Penalties):** Major retailers enforce "On-Time, In-Full" (OTIF) delivery standards. Failure to fulfill orders incurs chargeback penalties of up to 3% of order value.
* **Working Capital Lockup:** Over-ordering stock to buffer against poor distribution ties up millions in working capital.

---

## Section 3 — Complete Technology Stack

The SupplySync repository employs a decoupled, multi-service architecture designed for algorithmic performance, operational security, and clear separation of concerns.

```
+-----------------------------------------------------------------------------------+
|                                  USER / BROWSER                                   |
+-----------------------------------------------------------------------------------+
                                          |
                         HTTP / Port 5173 | (Vite Dev Server)
                                          v
+-----------------------------------------------------------------------------------+
|                        REACT 18 FRONTEND (SPA & WIZARD)                           |
|  - React 18, TypeScript, Tailwind CSS, Lucide React, Vite 8.3                      |
|  - State: AuthContext, PlanningWizard, NetworkOverview, ComparisonAuditView       |
+-----------------------------------------------------------------------------------+
                                          |
                         HTTP / Port 5001 | (Express API Gateway, SameSite Cookies)
                                          v
+-----------------------------------------------------------------------------------+
|                       NODE.JS / EXPRESS API GATEWAY                               |
|  - Express 4.19, TypeScript, node:sqlite, bcryptjs, cookie-parser, cors            |
|  - Responsibilities: Session Auth, Token Hashing, Run Ownership, Reverse Proxy    |
+-----------------------------------------------------------------------------------+
                                          |
                         HTTP / Port 8000 | (Internal Microservice Requests)
                                          v
+-----------------------------------------------------------------------------------+
|                     PYTHON FASTAPI OPTIMIZATION ENGINE                            |
|  - Python 3.14, FastAPI 0.110, Uvicorn, Google OR-Tools 9.9 (SCIP MILP)          |
|  - Modules: M5DataLoader, M5Logistics, InvariantValidator, BaselineHeuristic,    |
|             LexicographicOptimizer (Phase 1 & 2), PlanComparator                  |
+-----------------------------------------------------------------------------------+
```

### Detailed Component Inventory

| Component / Library | Version / Source | Responsibility in SupplySync | Why It Was Chosen | Key Files Using It | Failure Mode / Fallback |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **React** | `18.3.1` | Declarative UI rendering, reactive component lifecycle, wizard navigation. | Industry standard for complex stateful single-page enterprise applications. | `client/src/App.tsx`<br>`client/src/components/PlanningWizard.tsx` | App fails to render; blank screen in browser. |
| **TypeScript** | `5.5.3` (client)<br>`5.3.3` (server) | Static type safety across client interfaces and backend routing. | Eliminates runtime undefined property errors across complex supply chain data structures. | `client/src/api.ts`<br>`server/src/index.ts`<br>`server/src/auth.ts` | TypeScript compiler (`tsc`) blocks build on type mismatch. |
| **Vite** | `8.3.5` | Development bundler, HMR server, production asset compilation. | Sub-second cold starts, fast Hot Module Replacement, optimized rollup builds. | `client/vite.config.ts`<br>`client/package.json` | Local dev server fails to serve frontend assets. |
| **Tailwind CSS** | `3.4.1` | Utility-first responsive design, modern enterprise color palette. | Enables consistent design tokens without CSS bloat or runtime style injection overhead. | `client/src/index.css`<br>`client/tailwind.config.js` | UI renders unstyled HTML elements. |
| **Node.js / Express** | `Express 4.19.2`<br>`Node v20+` | API Gateway, authentication middleware, request validation, run persistence. | Lightweight, high-throughput asynchronous I/O ideal for API routing and gateway duties. | `server/src/index.ts`<br>`server/src/auth.ts` | Client requests fail with `502 Bad Gateway` or network error. |
| **node:sqlite** | Native Node.js | Synchronous, embedded relational persistence for users, sessions, and runs. | Zero external database dependencies; file-backed and thread-safe within Node.js. | `server/src/db.ts` | Auth and run history fail; runtime database exception. |
| **bcryptjs** | `2.4.3` | Cryptographic password hashing (10 salt rounds). | Work-factored password security preventing rainbow table attacks. | `server/src/auth.ts` | Registration and login fail. |
| **Python** | `3.14.0rc1` (or 3.10+) | Runtime environment for data engineering, forecasting, and optimization. | Native ecosystem for Operations Research (OR-Tools) and scientific data processing. | `engine/*.py`<br>`.venv/` | Optimization engine fails to execute. |
| **FastAPI** | `0.110.0` | Asynchronous high-performance REST API exposing the optimization engine. | Automatic Pydantic schema validation, OpenAPI documentation, high async throughput. | `engine/main.py`<br>`engine/models.py` | Gateway receives connection refused; optimization calls fail. |
| **Google OR-Tools** | `9.9.3963` | Mixed-Integer Linear Programming (MILP) solver wrapper (SCIP backend). | World-class open-source mathematical solver capable of discrete integer allocation. | `engine/optimizer.py`<br>`engine/benchmarks.py` | Model cannot solve; raises `RuntimeError` or fallback to heuristic. |
| **Pandas & NumPy** | `Pandas 2.2`<br>`NumPy 1.26` | Dataset slicing, binary indexing, calendar week temporal joins. | High-performance vectorized tabular processing for historical time-series data. | `engine/m5_loader.py`<br>`engine/demand.py` | M5 dataset cannot load; fails with `ImportError`. |
| **Scikit-Learn** | `1.4.1` | Time-series regression forecasting, MAE/RMSE/WAPE evaluation. | Standard machine learning algorithms for demand projection with temporal lags. | `engine/demand.py` | System falls back to Simple Moving Average (SMA). |
| **Node Test Runner** | Native `node --test` | Integration, security, and lifecycle test suites. | Built into Node.js; executes fast automated integration tests without heavy test dependencies. | `scripts/test_auth_security.mjs`<br>`scripts/test_user_journey.mjs` | Test failures block release freeze. |
| **Pytest** | `8.0.0` | Mathematical unit testing and invariant verification. | Industry-standard Python test framework with granular failure reporting. | `engine/tests/test_*.py` | Test suite catches broken mathematical invariants. |

---

## Section 4 — Complete System Architecture

### 4.1 System Architecture Diagram

```mermaid
graph TB
    subgraph ClientLayer ["Frontend Client Layer (Port 5173)"]
        Browser["Web Browser (User)"]
        ReactApp["React 18 SPA (Vite)"]
        AuthCtx["AuthContext (User & Session State)"]
        Wizard["PlanningWizard (6-Step Guided Flow)"]
        Dashboard["Advanced Console & Audit View"]
        ApiClient["api.ts (Axios / Fetch Client)"]
        
        Browser --> ReactApp
        ReactApp --> AuthCtx
        ReactApp --> Wizard
        ReactApp --> Dashboard
        Wizard --> ApiClient
        Dashboard --> ApiClient
    end

    subgraph GatewayLayer ["Gateway & Security Layer (Port 5001)"]
        Express["Express.js Gateway (index.ts)"]
        CorsCsrf["CORS & CSRF Origin Validator"]
        AuthMiddleware["requireAuth Session Guard"]
        AuthModule["auth.ts (bcrypt & SHA-256 Hashing)"]
        SQLiteDB[(SQLite Database: supplysync.db)]
        
        ApiClient -- "HTTP / Credentials (Cookie: supplysync_session)" --> CorsCsrf
        CorsCsrf --> Express
        Express --> AuthMiddleware
        AuthMiddleware --> AuthModule
        AuthModule --> SQLiteDB
    end

    subgraph EngineLayer ["Optimization Engine Layer (Port 8000)"]
        FastAPI["FastAPI Engine (main.py)"]
        PydanticModels["Pydantic Models (models.py)"]
        M5Loader["M5 Data Loader (m5_loader.py)"]
        M5Logistics["Logistics Scenario Mapper (m5_logistics.py)"]
        Validator["Pre-Solve & Invariant Validator (validator.py)"]
        Forecaster["Demand Forecaster (demand.py)"]
        BaselineHeuristic["Greedy Baseline Allocator (baseline.py)"]
        OrToolsOptimizer["OR-Tools Two-Phase MILP (optimizer.py)"]
        Comparator["Comparative Auditor (comparator.py)"]
        
        Express -- "Internal HTTP Proxy" --> FastAPI
        FastAPI --> PydanticModels
        FastAPI --> M5Loader
        FastAPI --> M5Logistics
        FastAPI --> Forecaster
        FastAPI --> Validator
        FastAPI --> BaselineHeuristic
        FastAPI --> OrToolsOptimizer
        FastAPI --> Comparator
    end

    subgraph DataStorage ["Data & Asset Layer"]
        M5Files["Walmart M5 CSVs (data/m5/sample/)"]
        M5Loader --> M5Files
    end
```

### 4.2 Architectural Rationale: Decoupled Services vs. Monolith
1. **Language Affinity:** Mixed-Integer Linear Programming and scientific data processing require Python’s mature C-extensions (OR-Tools, NumPy, Scikit-Learn). Modern interactive user interfaces require React, TypeScript, and Vite.
2. **Process Isolation:** Solving an NP-hard combinatorial MILP consumes dedicated CPU threads. Isolating the solver in FastAPI ensures that mathematical computations never block the Node.js event loop or freeze the user interface.
3. **Defense-in-Depth Security:** The Express Gateway manages user authentication, cookie verification, rate limiting, and database access. The Python engine runs as an internal compute service, shielded from public internet access.
4. **Independent Scaling:** In enterprise deployment, compute-heavy Python optimization workers can scale horizontally across GPU/CPU clusters (via Kubernetes) while the lightweight Express Gateway balances incoming client sessions.

### 4.3 Development vs. Production Deployment Architecture

| Aspect | Local Development Architecture | Production Deployment Target |
| :--- | :--- | :--- |
| **Frontend** | Vite Dev Server on `http://localhost:5173` with HMR. | Static production bundle (`dist/`) served via NGINX or Cloudflare CDN. |
| **API Gateway** | Node.js Express on `http://localhost:5001`. Native `node:sqlite` file. | Containerized Node.js cluster (PM2 / Docker) behind NGINX Reverse Proxy with SSL termination. |
| **Optimization Engine** | FastAPI on `http://127.0.0.1:8000` via Uvicorn development server. | Containerized FastAPI on Gunicorn/Uvicorn workers scaled horizontally. |
| **Database** | Local SQLite file (`supplysync.db`). | Managed PostgreSQL with connection pooling. |
| **Cookies / CORS** | `SameSite: 'lax'`, `Secure: false` (on localhost). Configured origin `http://localhost:5173`. | `SameSite: 'strict'`, `Secure: true`, HTTPS strict transport security (HSTS), domain-restricted cookies. |
| **Demo Access** | Dedicated `POST /api/auth/demo-login` active in development mode. | Disabled in production; users authenticate strictly via production identity providers (SSO/SAML/OAuth2). |

---

## Section 5 — Repository Structure and File-by-File Explanation

```
SupplySync/
├── client/                               # React 18 Frontend SPA
│   ├── src/
│   │   ├── components/                   # UI Modules & Wizard Views
│   │   │   ├── AuthModal.tsx             # Login / Registration Modal
│   │   │   ├── ComparisonAuditView.tsx   # Side-by-Side Baseline vs Optimizer Audit
│   │   │   ├── DemandForecaster.tsx      # Time-Series Demand Charting
│   │   │   ├── InventoryManager.tsx      # Batch Inventory & Shelf-Life View
│   │   │   ├── LandingPage.tsx           # Marketing Hero & Workflow Overview
│   │   │   ├── NetworkOverview.tsx       # Distribution Network & Route Metrics
│   │   │   ├── OptimizationConsole.tsx   # Advanced Real-Time Solver Console
│   │   │   ├── PlanningWizard.tsx        # 6-Step Guided Planning Wizard
│   │   │   └── UserProfileMenu.tsx       # Authenticated User Dropdown & Logout
│   │   ├── context/
│   │   │   └── AuthContext.tsx           # React Context for User & Session Management
│   │   ├── utils/
│   │   │   ├── csvParser.ts              # Robust Client-Side CSV Delimiter Parser
│   │   │   └── csvTemplates.ts           # Pre-Formatted Supply Chain CSV Templates
│   │   ├── api.ts                        # Typed API Client & Backend Connectors
│   │   ├── App.tsx                       # Main Application State & View Routing
│   │   ├── main.tsx                      # React DOM Entrypoint & Context Providers
│   │   ├── mockData.ts                   # Fallback Visual Data Definitions
│   │   └── index.css                     # Tailwind CSS & Design System Tokens
│   ├── package.json                      # Frontend Dependencies & Scripts
│   └── vite.config.ts                    # Vite Build Configuration
├── server/                               # Express.js TypeScript API Gateway
│   ├── src/
│   │   ├── auth.ts                       # Password Hashing, Session Creation, Token Verification
│   │   ├── db.ts                         # SQLite Schema Initialization & Typed Queries
│   │   └── index.ts                      # Express App, Routes, CORS, CSRF, Microservice Proxy
│   ├── package.json                      # Server Dependencies & Scripts
│   └── tsconfig.json                     # TypeScript Compilation Settings
├── engine/                               # Python FastAPI Optimization Microservice
│   ├── tests/                            # Automated Pytest Mathematical Invariant Suites
│   │   ├── test_engine.py                # Core Engine Optimization & Constraint Tests
│   │   ├── test_loader_and_shelf_life.py # M5 Loader & FEFO Shelf-Life Tests
│   │   ├── test_objective_and_stress.py  # Objective Math & Negative Cost Invariant Tests
│   │   ├── test_phase2.py                # Phase 2 FEFO Lexicographic Invariant Tests
│   │   ├── test_phase3_benchmarks.py     # Deterministic Benchmark Invariant Tests
│   │   ├── test_audit_interpretation.py  # Evidence-Based Verdict Interpretation Tests
│   │   └── test_exhaustive_oracle.py     # Exhaustive Combinatorial Oracle Tests
│   ├── baseline.py                       # Greedy Demand-Priority Baseline Strategy
│   ├── benchmarks.py                     # 15 Deterministic Benchmark Scenario Builders
│   ├── comparator.py                     # Mathematical Comparison & Neutral Verdict Engine
│   ├── demand.py                         # Time-Series Demand Forecasting (SMA & ML)
│   ├── exhaustive_oracle.py              # Brute-Force Combinatorial Validation Oracle
│   ├── m5_loader.py                      # Real Kaggle M5 Dataset Loader & Indexer
│   ├── m5_logistics.py                   # Configured DC, Batch & Route Logistics Scenario
│   ├── main.py                           # FastAPI Routes, Pydantic Endpoints, CORS
│   ├── models.py                         # Pydantic Schemas for Network Entities & Plans
│   ├── optimizer.py                      # Google OR-Tools Two-Phase MILP Formulation
│   ├── stress_tests.py                   # 50 Adversarial Stress-Test Instances & Scalability
│   └── validator.py                      # Pre-Solve Dataset & Post-Solve Invariant Validator
├── data/
│   └── m5/
│       ├── sample/                       # Bundled Real Walmart M5 Dataset Sample
│       │   ├── calendar.csv              # Calendar Dates, Weeks & Event Markers
│       │   ├── sales_train_validation.csv# 90-Day Daily Sales for 5 Products x 4 Stores
│       │   └── sell_prices.csv           # Observed Walmart Weekly Unit Prices
│       └── README.md                     # Instructions for Full Kaggle Dataset
├── scripts/                              # Automated Test & Benchmark Verification Runners
│   ├── benchmark_optimizer.py            # Executes 15 Benchmark Scenarios
│   ├── run_stress_tests.py               # Executes 50 Stress-Test Instances & Scalability
│   ├── test_auth_security.mjs            # 19 Node Security Tests (CSRF, Hashing, Cookies)
│   ├── test_user_journey.mjs             # 8 Node User Journey & Snapshot Tests
│   └── test_optimizer_lifecycle.mjs      # 5 Node Optimizer Lifecycle & Unique Run Tests
├── .env.example                          # Sanitized Environment Configuration Template
├── .gitignore                            # Secrets & Artifact Exclusion Rules
└── README.md                             # Project Overview & Quickstart Guide
```

### File-by-File Breakdown

#### Frontend (`client/src/`)
* **`api.ts`**: Defines strict TypeScript interfaces (`Product`, `Warehouse`, `Destination`, `InventoryBatch`, `Route`, `DemandRecord`, `OptimizationPlan`, `ComparisonAudit`). Implements API fetch functions configured with `credentials: 'include'` to pass HTTP-only session cookies.
* **`components/PlanningWizard.tsx`**: Implements the guided Six-Step Planning Workflow (`source` $\rightarrow$ `data` $\rightarrow$ `validate` $\rightarrow$ `configure` $\rightarrow$ `optimize` $\rightarrow$ `results`). Manages custom CSV upload state, pre-solve validation display, dynamic M5 snapshot counters, execution progress animations, and CSV export.
* **`components/AuthModal.tsx`**: Rendered conditionally for unauthenticated users. Implements field-level email and password validation, toggleable password visibility, tabs for login/registration, and a one-click "Evaluator / Demo Login" button.
* **`components/UserProfileMenu.tsx`**: Renders the authenticated user’s avatar, name, role, and a secure logout button that triggers server-side session invalidation.
* **`components/ComparisonAuditView.tsx`**: Renders side-by-side performance audit cards (freight cost, stockout penalty, fulfillment rate, expiring stock utilized) and displays the neutral evidence-based verdict.
* **`components/OptimizationConsole.tsx`**: Advanced operational console displaying interactive network topology maps, consignment tables, and granular solver metrics.
* **`context/AuthContext.tsx`**: Provides global user state (`user`, `isAuthenticated`, `isLoading`) across the component tree, auto-verifying sessions via `GET /api/auth/me` on mount.
* **`utils/csvParser.ts`**: Custom client-side CSV parser handling quoted fields, commas, CRLF line endings, and header normalization.
* **`utils/csvTemplates.ts`**: Provides downloadable CSV template definitions and pre-populated sample datasets for custom logistics planning.

#### API Gateway (`server/src/`)
* **`index.ts`**: Configures Express, CORS allowlisting, cookie parsing, and CSRF origin verification on state-changing requests (`POST`, `PUT`, `DELETE`). Maps authentication routes and proxies master data, validation, and optimization requests to the internal FastAPI engine.
* **`auth.ts`**: Implements authentication logic. Hashes passwords using `bcryptjs` (10 rounds). Generates cryptographically secure session tokens (`sess_<64 hex chars>`). Hashes session tokens with `SHA-256` before storing in SQLite. Verifies sessions, checks expiration timestamps, and implements server-side logout revocation.
* **`db.ts`**: Initializes embedded SQLite database (`supplysync.db`). Creates `users`, `sessions`, and `user_runs` tables with foreign keys and unique constraints.

#### Optimization Microservice (`engine/`)
* **`main.py`**: Initializes the FastAPI application. Exposes REST endpoints for health checks, master data, demand forecasting, pre-solve dataset validation, greedy baseline allocation, OR-Tools MILP optimization, and comparative auditing.
* **`models.py`**: Pydantic data schemas enforcing strict typing and non-negative constraints on all network entities and optimization outputs.
* **`optimizer.py`**: Core Google OR-Tools Mixed-Integer Linear Program. Formulates decision variables ($x_{w,d,p,b}$ and $u_{d,p}$), sets physical constraints, and executes the Two-Phase Lexicographic Optimization (Phase 1: Pure Economic Cost; Phase 2: FEFO Spoilage Minimization).
* **`baseline.py`**: Deterministic greedy heuristic allocating available inventory to highest-tier stores via cheapest available lanes without multi-echelon co-optimization.
* **`comparator.py`**: Evaluates baseline vs. optimized plans. Computes net economic savings, freight variance, stockout reductions, and produces evidence-based verdicts.
* **`m5_loader.py`**: High-performance parser for the Walmart M5 competition dataset. Maintains binary byte-offset indices for instant file seeking, temporal joins to calendar weeks, and pricing lookups.
* **`m5_logistics.py`**: Maps authentic M5 stores (`CA_1`, `TX_1`, etc.) and items (`FOODS_1_001`, etc.) to realistic distribution center infrastructure, dual-capacity freight routes, and lot-level inventory.
* **`demand.py`**: Demand forecasting engine providing 7-day Simple Moving Average and Time-Series Linear Regression with chronological holdout validation.
* **`validator.py`**: Enforces the 10 mathematical and physical invariants on any input dataset or resulting distribution plan.

---

## Section 6 — End-to-End Request Lifecycle

### 6.1 Lifecycle Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User as Planner / Judge
    participant Browser as React Frontend (Port 5173)
    participant Gateway as Express Gateway (Port 5001)
    participant SQLite as SQLite DB (supplysync.db)
    participant Engine as FastAPI Engine (Port 8000)
    participant Solver as Google OR-Tools (SCIP)

    Note over User, Browser: Step 1: Authentication & Bootstrap
    User->>Browser: Opens SupplySync Application
    Browser->>Gateway: GET /api/auth/me (Cookie: supplysync_session)
    Gateway->>Gateway: Hash cookie token (SHA-256)
    Gateway->>SQLite: Query active session & user
    SQLite-->>Gateway: Return UserRecord (Planner)
    Gateway-->>Browser: HTTP 200 { user: { email, name, role } }

    Note over User, Browser: Step 2: Master Data & Snapshot Loading
    Browser->>Gateway: GET /api/master-data?data_source=m5
    Gateway->>Engine: GET /api/master-data?data_source=m5
    Engine->>Engine: Load M5 Sample (5 SKUs, 4 Stores, 3 DCs, 17 Lots, 12 Routes)
    Engine-->>Gateway: Master Data JSON
    Gateway-->>Browser: HTTP 200 Master Data

    Note over User, Browser: Step 3: Pre-Solve Validation
    User->>Browser: Advances to Step 3 (Validation)
    Browser->>Gateway: POST /api/dataset/validate (Master Data Payload)
    Gateway->>Gateway: Verify Session & CSRF Origin
    Gateway->>Engine: POST /api/dataset/validate
    Engine->>Engine: Run validate_input_dataset()
    Engine-->>Gateway: HTTP 200 { valid: true, summary: { inventory: 3430, demand: 783 } }
    Gateway-->>Browser: HTTP 200 Validation Summary

    Note over User, Browser: Step 4 & 5: Optimization Execution
    User->>Browser: Clicks "Run OR-Tools Optimization" (Horizon: 7D)
    Browser->>Gateway: POST /api/optimization/run { data_source: "m5", horizon_days: 7 }
    Gateway->>Gateway: Verify Session & CSRF Origin
    Gateway->>Engine: POST /api/optimize
    
    rect rgb(240, 248, 255)
        Note over Engine, Solver: Phase 1: Economic Cost Minimization
        Engine->>Solver: Build MILP Instance (Phase 1)
        Engine->>Solver: Solve() -> Status: OPTIMAL ($1,370.25)
        Solver-->>Engine: Phase 1 Decision Variables (x1, u1)
        
        Note over Engine, Solver: Phase 2: Lexicographic FEFO Optimization
        Engine->>Solver: Build Fresh MILP Instance (Phase 2, Economic Cost Bound)
        Engine->>Solver: Solve() -> Status: OPTIMAL (FEFO Minimized)
        Solver-->>Engine: Phase 2 Decision Variables (x2, u2)
    end

    Engine-->>Gateway: HTTP 200 OptimizationPlan JSON (Run ID: run_...)
    Gateway->>SQLite: INSERT INTO user_runs (run_id, user_id, plan_data)
    Gateway-->>Browser: HTTP 200 OptimizationPlan JSON

    Note over User, Browser: Step 6: Comparative Audit & Results
    Browser->>Gateway: POST /api/optimization/compare { baseline_plan, optimized_plan }
    Gateway->>Engine: POST /api/compare
    Engine->>Engine: Compute Net Savings, Variances, and Verdict
    Engine-->>Gateway: ComparisonAudit JSON
    Gateway-->>Browser: HTTP 200 ComparisonAudit
    Browser->>User: Displays Recommendations, Metric Cards, & Neutral Verdict
```

### 6.2 Step-by-Step Execution Trace

1. **User Opens Frontend:** The browser loads the single-page application from `http://localhost:5173`.
2. **Session Resolution:** `AuthContext.tsx` dispatches `GET /api/auth/me`. The Express Gateway reads the HttpOnly cookie `supplysync_session`, hashes the token via SHA-256, verifies validity in SQLite, and returns the sanitized user profile. If absent, the modal opens.
3. **Data Source Selection (Step 1):** The user chooses either "Walmart M5 Sample Data" or "Custom CSV Upload".
4. **Data Verification (Step 2):** The frontend queries `GET /api/master-data`. The Python engine loads the active M5 files or custom bundle, returning verified counts: 5 products, 3 warehouses, 4 destinations, 17 inventory lots, 12 routes, and 20 demand records.
5. **Pre-Solve Validation (Step 3):** Moving to Step 3 triggers `POST /api/dataset/validate`. The backend validator scans entity IDs, foreign keys, non-negative quantities, positive freight tariffs, and route connectivity. It confirms 3,430 available inventory units against 783 units of forecast demand.
6. **Scenario Configuration (Step 4):** The user selects the planning horizon (7 days default, or 14/30 days) and reviews objective weighting.
7. **Optimization Execution (Step 5):** The user initiates the run via `POST /api/optimization/run`. The Express Gateway verifies authentication and forwards the request to FastAPI’s `/api/optimize`.
8. **Mathematical Solving:** The engine constructs the Google OR-Tools SCIP solver instance. It executes Phase 1 to find the absolute minimum economic cost, then executes Phase 2 in a fresh solver to prioritize near-expiry batches while strictly bounding economic cost to the Phase 1 value.
9. **Run Persistence:** The Express Gateway stores the resulting plan JSON in SQLite (`user_runs` table), binding it to the authenticated user's ID.
10. **Baseline Calculation & Audit (Step 6):** The frontend requests `POST /api/optimization/compare`. The engine generates the greedy baseline allocation on identical data, computes mathematical variances, and outputs the comparative audit.
11. **Results Rendering:** The UI displays KPI cards, consignment dispatch tables, and the neutral evidence-based verdict. The planner can download the consignment instructions as a CSV file.

---

## Section 7 — The Six-Step Planning Workflow

The guided planning wizard (`client/src/components/PlanningWizard.tsx`) structures the planner’s workflow into six logical stages, reflecting operational supply-chain practice.

```mermaid
graph LR
    S1["Step 1: Data Source<br>(M5 vs Upload)"] --> S2["Step 2: Load Data<br>(Verify Entities)"]
    S2 --> S3["Step 3: Validation<br>(Invariants Check)"]
    S3 --> S4["Step 4: Configure<br>(Horizon & SLA)"]
    S4 --> S5["Step 5: Optimize<br>(OR-Tools MILP)"]
    S5 --> S6["Step 6: Results<br>(Audit & Export)"]
```

### Step 1: Data Source (`source`)
* **Purpose:** Select the operational network data stream.
* **User Experience:** Two selectable cards:
  1. *Walmart M5 Competition Sample Data:* Real historical retail sales from California and Texas supercenters mapped to regional distribution infrastructure.
  2. *Custom Enterprise CSV Upload:* Enables planners to upload their own enterprise files or test alternative supply scenarios.
* **Permit Condition:** Source selection required. Defaults to `m5`.

### Step 2: Load Data / Verify Data (`data`)
* **Purpose:** Inspect and verify master data entities before committing to a planning run.
* **User Experience for M5:** Displays four summary metric cards:
  * **5 Products** (Dynamic label: *"5 selected M5 items"*).
  * **3 Warehouses** (*"Pacific, Texas & Midwest Regional DCs"*).
  * **4 Destinations** (*"CA & TX Stores"*).
  * **17 Inventory Lots** (*"3,430 Total Available Units"*).
  * Supporting details: 12 active freight routes, 20 demand records, default 7-day forecast horizon.
* **Correction Note:** In earlier prototype builds, the product count card displayed "5 Products" while its supporting caption erroneously stated "8 M5 Items". This was traced to a hardcoded string from an early 8-item prototype and was corrected to derive dynamically from `{m5Data.products.length} selected M5 items`.
* **User Experience for Uploaded Data:** Provides six drag-and-drop file upload zones for `products.csv`, `warehouses.csv`, `destinations.csv`, `batches.csv`, `routes.csv`, and `demand.csv`. Includes a "Load Sample Custom Data" button that populates a valid enterprise beverage/dairy dataset.
* **Permit Condition:** All six entity sets must contain at least one valid row.

### Step 3: Validation (`validate`)
* **Purpose:** Execute pre-solve validation against physical and referential constraints.
* **User Experience:** Displays validation status banner (Green "Dataset Validated & Physically Feasible") alongside live summary metrics:
  * Total Available Inventory: **3,430 units**.
  * Total Forecast Demand: **783 units**.
  * Active Transportation Corridors: **12 routes**.
  * Usable Batches: **17 batches**.
  * Network Inventory Status: Healthy (Available inventory exceeds total demand).
* **Critical Operational Insight:** Passing validation confirms that the dataset is mathematically coherent and referentially sound. It does **not** mean optimization has occurred; optimization determines the optimal allocation across the valid network.
* **Permit Condition:** Zero critical validation errors (`validationResult.valid === true`).

### Step 4: Configure (`configure`)
* **Purpose:** Define planning parameters and commercial trade-offs.
* **User Experience:**
  * Planning Horizon Selector: 7 Days (Default), 14 Days, or 30 Days. Adjusting the horizon scales demand records.
  * Objective Priority View: Displays active weights (Transportation Freight, Shortage Penalty Multiplier: 1.30x for Tier-1, FEFO Spoilage Weight).
  * Strict Demand Enforcement Toggle: Allows planners to disallow shortage slack variables (forcing infeasibility if total demand cannot be met).
* **Permit Condition:** Valid horizon selection ($h \in [1, 90]$).

### Step 5: Optimize (`optimize`)
* **Purpose:** Formulate and solve the mathematical optimization problem.
* **User Experience:** Execution panel with a "Run Google OR-Tools Optimization" button. Upon execution, displays an animated multi-stage progress indicator:
  1. *"Formulating Mathematical Constraints..."*
  2. *"Solving Google OR-Tools SCIP MILP..."*
  3. *"Executing Lexicographic Phase 2 (FEFO Optimization)..."*
  4. *"Finalizing Allocations & Verifying Invariants..."*
* **Permit Condition:** Successful solve returning `status: OPTIMAL` or `FEASIBLE`.

### Step 6: Results & Audit (`results`)
* **Purpose:** Review consignment-level dispatch instructions, compare against baseline, and export plan.
* **User Experience:**
  * Executive KPI Cards: Total Freight Cost ($), Fulfillment Rate (%), Unmet Demand (units), Near-Expiry Stock Utilized (units).
  * Side-by-Side Comparison Audit: Displays baseline vs. optimizer metrics and the neutral evidence-based verdict.
  * Consignment Dispatch Table: Granular allocation recommendations detailing Source DC, Destination Store, Product, Batch ID, Days to Expiry, Quantity, Unit Tariff, and Rationale.
  * Export Functionality: One-click "Export Dispatch Plan (CSV)" downloading the full shipment schedule.
  * Deep Dive Link: "Open Advanced Console" transitions the planner to the comprehensive analytics dashboard.

---

## Section 8 — Dataset and Data Engineering

### 8.1 The Walmart M5 Competition Dataset
The M5 dataset, published on Kaggle by the Makridakis Open Forecasting Center (MOFC) and Walmart, contains authentic point-of-sale transactional records for thousands of products across ten Walmart supercenters in California, Texas, and Wisconsin.

The active repository bundles a clean sample in `data/m5/sample/`:
1. **`sales_train_validation.csv` (21 lines, 5,812 bytes):** Contains 90 days of daily unit sales ($d\_1$ to $d\_90$) across 20 distinct series ($5 \text{ products} \times 4 \text{ stores}$).
2. **`calendar.csv` (91 lines, 4,660 bytes):** Maps daily day IDs ($d\_1, d\_2, \dots$) to calendar dates (`2011-01-29` onwards), days of the week, calendar weeks (`wm_yr_wk`), and holiday event markers.
3. **`sell_prices.csv` (261 lines, 7,890 bytes):** Records authentic weekly selling prices for each product-store pair across calendar weeks.

### 8.2 Entity Transformations: Real vs. Configured Assumptions

| Data Entity / Field | Upstream Source | Transformation in SupplySync | Consumed By | Classification |
| :--- | :--- | :--- | :--- | :--- |
| **Product Identifiers**<br>(`FOODS_1_001`, etc.) | M5 `sales_train_validation.csv` | Extracted directly from `item_id` column. | Master Data, Validator, Optimizer | **Real M5 Data** |
| **Retail Store IDs**<br>(`CA_1`, `CA_2`, `TX_1`, `TX_2`) | M5 `sales_train_validation.csv` | Extracted directly from `store_id` column. | Master Data, Validator, Optimizer | **Real M5 Data** |
| **Observed Selling Prices** | M5 `sell_prices.csv` | Temporally joined via `wm_yr_wk` in calendar; averaged across stores. | `Product.observed_sell_price` | **Real M5 Data** |
| **Historical Daily Sales** | M5 `sales_train_validation.csv` | Indexed into binary byte-offsets; daily sales $d_1 \dots d_{90}$ extracted. | Demand Forecaster (`demand.py`) | **Real M5 Data** |
| **Forecasted Demand** | Derived from M5 Sales | 7-day Simple Moving Average or Time-Series Regression with lag-1/7 and day-of-week seasonality. | Demand Records (`DemandRecord`) | **Empirical Forecast** |
| **Distribution Centers**<br>(`WH-M5-PACIFIC`, etc.) | Synthetic Logistics Model | Configured regional distribution centers located in Mira Loma, Fort Worth, and Joliet. | Warehouses (`Warehouse`) | **Configured Scenario** |
| **Inventory Batches**<br>(`M5-LOT-0001`, etc.) | Synthetic Logistics Model | Configured lot quantities (280/220/150 units) anchored to `2011-04-25` with simulated expiration dates. | Inventory (`InventoryBatch`) | **Configured Scenario** |
| **FEFO Expiry Dates** | Synthetic Logistics Model | 6-day near-expiry batches added for `FOODS_1` to stress-test perishable allocation. | Inventory (`InventoryBatch`) | **Configured Scenario** |
| **Transportation Corridors** | Synthetic Logistics Model | Distance-based tariffs ($1.75/unit local to $9.40/unit inter-region), transit days, and truck weight limits. | Routes (`Route`) | **Configured Scenario** |
| **Shortage Penalty Multiplier** | Industry FMCG Standard | Configured as $2.5 \times \text{observed unit price}$; multiplied by $1.30\times$ for Tier-1 retail stores. | `Product.shortage_penalty_per_unit` | **Configured Assumption** |

### 8.3 Historical Sales vs. Forecast Demand
A foundational operational principle in SupplySync is the strict distinction between **historical sales** and **forecast demand**:
* **Historical Sales ($y_t$):** The recorded number of units purchased by retail consumers in the past. These values are fixed, immutable observations from the M5 dataset.
* **Forecast Demand ($\hat{y}_{t+h}$):** An estimation of future customer demand over the planning horizon. In SupplySync, this is computed via:
  1. *Simple Moving Average (SMA):* $\hat{y} = \frac{1}{7} \sum_{i=1}^7 y_{T-i}$.
  2. *Time-Series Linear Regression:* $\hat{y} = \beta_0 + \beta_1 y_{t-1} + \beta_2 y_{t-7} + \beta_3 \text{DayOfWeek} + \beta_4 t$.
* Under the default 7-day horizon, the 20 series project exactly **783 units of forecast demand** across the 4 retail stores.

### 8.4 Inventory on Hand vs. Inventory Lots
* **Inventory on Hand:** The aggregate count of physical units in a warehouse (e.g., Pacific DC holds 1,210 total units).
* **Inventory Lot / Batch:** A discrete manufacturing consignment with an explicit expiration date (e.g., `M5-LOT-0002-FEFO` has exactly 90 units of `FOODS_1_001` expiring in 6 days).
* Optimization cannot treat inventory as fungible bulk stock; dispatching decisions are made at the **batch level** to respect shelf-life constraints.

---

## Section 9 — Data Model and Relationships

### 9.1 Entity Relationship Diagram

```mermaid
erDiagram
    PRODUCT ||--o{ INVENTORY_BATCH : "stocked as"
    PRODUCT ||--o{ DEMAND_RECORD : "demanded as"
    WAREHOUSE ||--o{ INVENTORY_BATCH : "stores"
    WAREHOUSE ||--o{ ROUTE : "originates"
    DESTINATION ||--o{ ROUTE : "terminates"
    DESTINATION ||--o{ DEMAND_RECORD : "forecasts"
    
    USER ||--o{ SESSION : "authenticates"
    USER ||--o{ USER_RUN : "owns"
    
    OPTIMIZATION_PLAN ||--o{ SHIPMENT_RECOMMENDATION : "contains"
    OPTIMIZATION_PLAN ||--o{ SHORTAGE_DETAIL : "records"
    
    PRODUCT {
        string id PK
        string name
        string category
        float unit_weight_kg
        int shelf_life_days
        float shortage_penalty_per_unit
        float observed_sell_price
    }

    WAREHOUSE {
        string id PK
        string name
        string city
        string state
        int storage_capacity_units
    }

    DESTINATION {
        string id PK
        string name
        string city
        string state
        string tier
        float service_level_target
    }

    INVENTORY_BATCH {
        string batch_id PK
        string product_id FK
        string warehouse_id FK
        int quantity
        int days_to_expiry
        string status
    }

    ROUTE {
        string source_warehouse_id FK
        string destination_id FK
        float unit_cost
        float distance_km
        int transit_time_days
        int max_capacity_units
        float max_capacity_kg
    }

    DEMAND_RECORD {
        string destination_id FK
        string product_id FK
        int forecasted_demand
    }

    USER {
        string id PK
        string email UK
        string name
        string password_hash
        string role
    }

    SESSION {
        string id PK "SHA-256 Token Hash"
        string user_id FK
        datetime expires_at
        datetime revoked_at
    }

    USER_RUN {
        string run_id PK
        string user_id FK
        string plan_data "JSON Blob"
        datetime created_at
    }
```

### 9.2 Data Integrity Rules
* **Batch Consistency:** Every inventory batch must reference a valid `product_id` and a valid `warehouse_id`. A batch cannot be located in multiple warehouses.
* **Corridor Uniqueness:** A route is uniquely identified by the composite key `(source_warehouse_id, destination_id)`.
* **Demand Uniqueness:** A demand record is uniquely identified by `(destination_id, product_id)`.
* **Session Cryptographic Integrity:** Session tokens are never stored in plaintext. The database primary key is the SHA-256 digest of the raw cookie token.

---

## Section 10 — Validation Engine

The validation engine (`engine/validator.py`) enforces strict pre-solve and post-solve integrity checks. It ensures that the mathematical solver never receives corrupt data and that resulting plans never violate physical reality.

```
+-----------------------------------------------------------------------------------+
|                        PRE-SOLVE DATASET VALIDATION                               |
|                     (POST /api/dataset/validate)                                  |
+-----------------------------------------------------------------------------------+
   |-- 1. Entity Existence & Non-Empty IDs (Product, DC, Store)
   |-- 2. Referential Integrity (Batches -> Valid DC & Product; Routes -> Valid DC & Store)
   |-- 3. Non-Negative Inventory Quantities & Positive Days-to-Expiry
   |-- 4. Positive Freight Tariffs (Unit cost > $0.00; prevents negative-cost loops)
   |-- 5. Network Connectivity (Every store with demand must have >=1 inbound corridor)
                                      |
                                  [Passes]
                                      v
+-----------------------------------------------------------------------------------+
|                           OR-TOOLS SOLVER EXECUTION                               |
+-----------------------------------------------------------------------------------+
                                      |
                                  [Outputs]
                                      v
+-----------------------------------------------------------------------------------+
|                       POST-SOLVE INVARIANT VALIDATION                             |
|                       (validate_plan_invariants)                                  |
+-----------------------------------------------------------------------------------+
   |-- Invariant 1: Strictly positive integer shipments (x >= 1)
   |-- Invariant 2: Batch availability (Sum shipped <= batch initial quantity)
   |-- Invariant 3: Warehouse availability (Total shipped <= warehouse stock)
   |-- Invariant 4: Expiry eligibility (Zero expired stock allocated)
   |-- Invariant 4B: Arrival shelf-life validity (days_to_expiry - transit >= min_required)
   |-- Invariant 5: Master data referential validity
   |-- Invariant 6: Demand conservation & shortage math (Fulfilled + Slack == Demand)
   |-- Invariant 7: Reported financial cost math (Sum(qty * tariff) == Reported freight)
   |-- Invariant 8: Route corridor capacity (Sum shipped <= route max_capacity_units)
   |-- Invariant 8B: Route corridor weight (Sum(qty * weight_kg) <= max_capacity_kg)
   |-- Invariant 9: No over-fulfillment (Shipment to store <= store forecast demand)
```

### Detailed Validation Rules Table

| Invariant / Rule | Operational & Mathematical Rationale | Valid Example | Invalid Example | Failure Behavior | Code Implementation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Strictly Positive Integer Shipments** | Fractional trucks or zero-unit consignments create phantom operational dispatches. | `x = 45 units` | `x = 45.7 units`<br>`x = 0`<br>`x = -10` | Raises `InvariantViolationError`; blocks plan. | `validator.py:84-89` |
| **2. Batch Inventory Limits** | A warehouse cannot physically ship more units of a lot than exist in inventory. | Batch has 100 units; ships 90 across all lanes. | Batch has 100 units; ships 60 to `CA_1` and 50 to `CA_2` (Total: 110). | Raises `InvariantViolationError`; blocks plan. | `validator.py:165-177` |
| **3. Route Corridor Unit Capacity** | Freight contracts and carrier fleet limits restrict daily volume along corridors. | Corridor max 3,000 units; total shipped 2,400. | Corridor max 3,000 units; total shipped 3,250. | Raises `InvariantViolationError`; blocks plan. | `validator.py:195-207` |
| **4. Route Corridor Weight Capacity** | Legal Gross Vehicle Weight (GVW) limits prevent truck overloading. | Corridor max 4,500 kg; shipped weight 3,800 kg. | Corridor max 4,500 kg; shipped weight 5,100 kg. | Raises `InvariantViolationError`; blocks plan. | `validator.py:209-223` |
| **5. Expiry & Shelf-Life on Arrival** | Perishable goods arriving with insufficient shelf-life cannot be sold and must be scrapped. | Batch has 10d expiry; transit is 1d; min required is 3d ($10 - 1 = 9 \ge 3$). | Batch has 4d expiry; transit is 3d; min required is 3d ($4 - 3 = 1 < 3$). | Raises `InvariantViolationError`; blocks plan. | `validator.py:121-133` |
| **6. Positive Freight Tariffs** | Non-positive or negative tariffs create artificial mathematical incentives to ship infinite loops. | Tariff: `$1.75 / unit` | Tariff: `-$0.50 / unit`<br>Tariff: `$0.00 / unit` | Validation error returned during pre-solve check. | `validator.py:418-424` |
| **7. Demand Conservation** | Ensures that every demand unit is explicitly accounted for as either fulfilled or shortage. | Store needs 100 units; receives 80; shortage slack is 20 ($80 + 20 = 100$). | Store needs 100 units; receives 80; shortage recorded as 0. | Raises `InvariantViolationError`; blocks plan. | `validator.py:237-251` |
| **8. Financial Math Consistency** | Guarantees that reported dashboard dollars exactly match individual consignment line items. | Consignment 1: $100, Consignment 2: $50. Reported Freight: $150. | Consignment 1: $100, Consignment 2: $50. Reported Freight: $120. | Raises `InvariantViolationError`; blocks plan. | `validator.py:276-285` |

### Why Valid Data Can Still Have Unfulfilled Demand
A dataset can pass all validation checks while still experiencing inventory shortages during optimization. Validation confirms that entities, quantities, tariffs, and network routes are mathematically well-formed. However, if aggregate regional customer demand exceeds total available warehouse stock (or if route weight caps choke throughput), the optimization model must record unmet demand shortages.

---

## Section 11 — Optimization Engine and Mathematical Logic

### 11.1 The Role of Google OR-Tools
**Google OR-Tools** is an open-source software suite for combinatorial optimization. SupplySync utilizes OR-Tools’ `pywraplp` linear solver wrapper configured with the **SCIP (Solving Constraint Integer Programs)** backend.

#### Optimization Paradigms Compared
* **Greedy Heuristic (Baseline):** Iterates through stores sequentially, picking the cheapest available warehouse until local inventory runs out. Fast, but blind to network-wide capacity competition and future batch spoilage.
* **Mathematical Optimization (MILP):** Evaluates all possible shipment permutations simultaneously across all warehouses, stores, products, and batches, identifying the mathematically proven global minimum cost.
* **Feasible Solution:** Any allocation plan that satisfies all constraints, but may not achieve the lowest possible cost.
* **Optimal Solution:** A feasible solution mathematically proven to have the lowest possible objective cost among all feasible candidates (MIP gap = 0.0%).
* **Infeasible Model:** A network configuration where constraints contradict each other, making any valid allocation mathematically impossible.

### 11.2 Decision Variables
Let:
* $W$ be the set of Regional Distribution Centers (Warehouses), indexed by $w$.
* $D$ be the set of Retail Supercenters (Destinations), indexed by $d$.
* $P$ be the set of Product SKUs, indexed by $p$.
* $B$ be the set of usable Inventory Batches, indexed by $b$.

The model defines two discrete decision variable families:
1. **Shipment Dispatch Quantity ($x_{w, d, p, b}$):**
   $$x_{w, d, p, b} \in \mathbb{Z}_{\ge 0}$$
   Represents the discrete number of units of product $p$ from batch $b$ stored at warehouse $w$ dispatched to destination $d$.
2. **Unmet Demand Slack ($u_{d, p}$):**
   $$u_{d, p} \in \mathbb{Z}_{\ge 0}$$
   Represents the shortage (unfulfilled demand) for product $p$ at destination $d$.

### 11.3 Objective Function Formulation
SupplySync optimizes the total economic cost of distribution across the network.

$$\min Z = \sum_{(w,d) \in R} \sum_{(p,b)} \left( c_{w,d} \cdot x_{w,d,p,b} \right) + \sum_{d \in D} \sum_{p \in P} \left( \pi_{d,p} \cdot u_{d,p} \right)$$

Where:
* $c_{w,d}$: Unit transportation tariff ($/unit) on route corridor $(w, d)$.
* $\pi_{d,p}$: Shortage penalty per unfulfilled unit ($/unit), calculated as:
  $$\pi_{d,p} = \text{base\_shortage\_penalty}_p \times \text{tier\_multiplier}_d$$
  Where $\text{tier\_multiplier}_d = 1.30$ if destination $d$ is a Tier-1 store, and $1.00$ otherwise.

#### Metric Definitions in Reporting
* **Freight Cost:** $\sum c_{w,d} \cdot x_{w,d,p,b}$ (Actual dollars paid to logistics carriers).
* **Shortage Penalty:** $\sum \pi_{d,p} \cdot u_{d,p}$ (Estimated commercial impact of unfulfilled demand).
* **Total Economic Cost:** $\text{Freight Cost} + \text{Shortage Penalty}$ (The unified solver objective).
* **Net Savings:** $\text{Baseline Total Economic Cost} - \text{Optimized Total Economic Cost}$.

### 11.4 Mathematical Constraints

#### 1. Batch Inventory Availability Constraint
A batch cannot ship more units than its current physical stock:
$$\sum_{d \in D} x_{w, d, p, b} \le Q_b \quad \forall b \in B$$
*FMCG Real-World Example:* Pacific DC has 90 units of near-expiry milk in Batch `M5-LOT-0002-FEFO`. The sum of all dispatches to Long Beach and Baldwin Park cannot exceed 90 units.  
*Source:* `engine/optimizer.py:91-98`

#### 2. Route Corridor Unit Capacity Constraint
Total shipments across all products and batches on lane $(w, d)$ cannot exceed vehicle throughput:
$$\sum_{p \in P} \sum_{b \in B} x_{w, d, p, b} \le C_{w, d}^{\text{units}} \quad \forall (w, d) \in R \quad (\text{if } C_{w,d}^{\text{units}} \ne \infty)$$
*FMCG Real-World Example:* The carrier contract between Mira Loma and Long Beach allows a maximum of 3,000 units per day.  
*Source:* `engine/optimizer.py:99-105`

#### 3. Route Corridor Weight Capacity Constraint
Total physical weight shipped along corridor $(w, d)$ cannot exceed truck gross vehicle weight limits:
$$\sum_{p \in P} \sum_{b \in B} \left( \text{weight}_p \cdot x_{w, d, p, b} \right) \le C_{w, d}^{\text{weight}} \quad \forall (w, d) \in R \quad (\text{if } C_{w,d}^{\text{weight}} \ne \infty)$$
*FMCG Real-World Example:* A truckload of heavy canned goods (`FOODS_3`, 2.0 kg/unit) hits the 4,500 kg weight limit at 2,250 units, well before reaching the 3,000 unit volume cap.  
*Source:* `engine/optimizer.py:106-116`

#### 4. Demand Conservation Constraint
For every product and store, shipments received plus unfulfilled shortage slack must exactly equal forecast demand:
$$\sum_{w \in W} \sum_{b \in B} x_{w, d, p, b} + u_{d, p} = \text{Demand}_{d, p} \quad \forall d \in D, \forall p \in P$$
*FMCG Real-World Example:* Walmart Supercenter `CA_1` forecasts demand for 45 units of `FOODS_1_001`. If the network can only supply 40 units, $u_{\text{CA\_1}, \text{FOODS\_1\_001}}$ becomes 5.  
*Source:* `engine/optimizer.py:117-127`

#### 5. Expiration & Minimum Arrival Shelf-Life Invariant
A batch is completely excluded from consideration on corridor $(w, d)$ if its shelf-life upon arrival is insufficient:
$$x_{w, d, p, b} = 0 \quad \text{if } (\text{days\_to\_expiry}_b - \text{transit\_days}_{w,d}) < \text{min\_shelf\_life}_p$$
*FMCG Real-World Example:* Fresh produce requires at least 3 days of shelf life on retail shelves. A batch expiring in 4 days cannot be shipped on a 3-day transit route to Texas ($4 - 3 = 1 < 3$).  
*Source:* `engine/optimizer.py:87-90`

### 11.5 Two-Phase Lexicographic Optimization & FEFO

```mermaid
graph TD
    Start([Input Dataset]) --> Phase1[Phase 1: Pure Economic Cost Minimization]
    Phase1 --> P1Solve[Solve SCIP MILP]
    P1Solve --> P1Check{Status Optimal?}
    P1Check -- No --> Fallback[Raise Infeasible / Fallback]
    P1Check -- Yes --> RecordP1[Record Optimal Economic Cost Z* and per-(d,p) fulfillment]
    
    RecordP1 --> Phase2[Phase 2: Fresh Solver Instance]
    Phase2 --> AddBound["Add Hard Constraint: Economic Cost <= Z* + 1e-4"]
    Phase2 --> AddFulfill["Add Hard Constraint: Fulfillment(d,p) >= Phase 1 Fulfillment(d,p)"]
    Phase2 --> P2Obj["Set New Objective: Min Sum(days_to_expiry * x)"]
    Phase2 --> P2Solve[Solve SCIP MILP]
    P2Solve --> P2Check{Status Optimal / Feasible?}
    P2Check -- Yes --> DeliverPlan[Deploy Phase 2 FEFO-Optimal Allocation]
    P2Check -- No --> FallbackP1[Deploy Phase 1 Allocation]
```

#### Why Two Phases Are Necessary
In supply-chain operations, **FEFO (First Expired, First Out)** dictates that lots closest to expiration should be shipped first to prevent spoilage. However, directly adding a large shelf-life penalty to the financial objective can distort freight decisions (e.g., spending $500 in air freight to save a $5 batch of milk).

To resolve this, SupplySync employs **Lexicographic Goal Programming**:
1. **Phase 1:** Solves the pure economic model to find the absolute minimum cost $Z^*$.
2. **Phase 2:** Instantiates a **fresh, clean solver instance** (preventing memory leaks or C++ state contamination). It introduces two hard invariants:
   * **Economic Cost Invariant:**
     $$\sum c \cdot x + \sum \pi \cdot u \le Z^* + 10^{-4}$$
   * **Fulfillment Parity Invariant:**
     $$\sum_{w, b} x_{w, d, p, b} \ge \text{Phase 1 Fulfillment}_{d, p} \quad \forall (d, p)$$
   * **Phase 2 Objective:**
     $$\min \sum_{(w,d,p,b)} \left( \text{days\_to\_expiry}_b \cdot x_{w,d,p,b} \right)$$
   This forces the solver to reallocate shipments among ties or equal-cost routes to exhaust near-expiry batches first, with **zero increase in total economic cost**.

#### Numerical Example of FEFO Reallocation
* Demand: 50 units of `FOODS_1_001` at Store `CA_1`.
* Warehouse `WH-PACIFIC` has two batches in stock:
  * Batch A: 50 units, 6 days until expiry.
  * Batch B: 50 units, 80 days until expiry.
* Freight cost for both batches is identical ($1.75/unit = $87.50).
* Phase 1 is indifferent between Batch A and Batch B (both cost $87.50).
* Phase 2 evaluates the shelf-life objective:
  * Selecting Batch A: $6 \times 50 = 300$.
  * Selecting Batch B: $80 \times 50 = 4,000$.
* Phase 2 selects **Batch A**, clearing the near-expiry stock from the warehouse racks before it spoils.

### 11.6 Solver Status Handling and Structured Error States

| Solver Status | Meaning | System Behavior & User Feedback |
| :--- | :--- | :--- |
| **`OPTIMAL`** | The globally optimal solution has been proven. | Plan accepted; UI displays green "OPTIMAL" badge; full metrics rendered. |
| **`FEASIBLE`** | A valid plan was found within the 15-second time limit, but optimality gap $> 0\%$. | Plan accepted; UI displays amber "FEASIBLE (Time-Limited)" badge and MIP gap. |
| **`INFEASIBLE`** | Contradictory constraints make allocation impossible. | Raises `OptimizationInfeasibleError`; UI displays actionable message explaining bottleneck. |
| **`MODEL_INVALID`** | Malformed parameters (e.g., negative bounds). | Caught by pre-solve validator before reaching solver. |
| **Phase 2 Failure** | Phase 2 solver times out or encounters numerical instability. | System safely falls back to the verified Phase 1 allocation plan; logs warning. |

---

## Section 12 — Baseline and Comparison Logic

### 12.1 The Greedy Nearest-Depot Baseline Strategy (`engine/baseline.py`)
To prove that mathematical optimization creates genuine commercial value, SupplySync benchmarks every run against a defensible heuristic representing standard industry practice:
1. **Demand Prioritization:** Evaluates destinations in SLA tier order (Tier-1 supercenters first).
2. **Greedy Warehouse Selection:** For each product demanded, identifies all connected warehouses holding eligible stock and sorts them by direct freight tariff ($c_{w,d}$).
3. **Local Allocation:** Allocates stock from the cheapest warehouse up to:
   $$\min(\text{remaining demand}, \text{available batch stock}, \text{remaining route capacity})$$
4. **Heuristic Blindspot:** The greedy baseline never looks ahead. It consumes local stock on the first store it considers, frequently causing downstream stores to suffer expensive stockouts or exorbitant long-haul tariffs.

### 12.2 Mathematical Comparison Formulas (`engine/comparator.py`)

#### 1. Freight Variance
$$\Delta \text{Freight} = \text{Freight}_{\text{baseline}} - \text{Freight}_{\text{optimized}}$$
$$\text{Freight Savings \%} = \left( \frac{\Delta \text{Freight}}{\text{Freight}_{\text{baseline}}} \right) \times 100$$

#### 2. Total Economic Cost Variance
$$\text{Economic Cost} = \text{Freight Cost} + \text{Shortage Penalty}$$
$$\Delta \text{Economic Cost} = \text{Cost}_{\text{baseline}} - \text{Cost}_{\text{optimized}}$$
$$\text{Net Savings \%} = \left( \frac{\Delta \text{Economic Cost}}{\text{Cost}_{\text{baseline}}} \right) \times 100$$

#### 3. Stockout Reduction
$$\Delta \text{Unmet Units} = \text{Unmet}_{\text{baseline}} - \text{Unmet}_{\text{optimized}}$$
$$\text{Stockout Reduction \%} = \left( \frac{\Delta \text{Unmet Units}}{\text{Unmet}_{\text{baseline}}} \right) \times 100$$

### 12.3 Why Freight Savings Alone Can Be Misleading
A simplistic logistics algorithm can easily "save freight" by refusing to ship goods to distant stores. This lowers freight expenditure to zero, but causes disastrous customer stockouts and millions of dollars in retail chargebacks. SupplySync’s objective and comparison engine strictly evaluate **total economic cost**, preventing false freight savings at the expense of retail customer fulfillment.

---

## Section 13 — Worked Real-Life Illustrative Example

To illustrate the mathematical mechanics, consider a small, concrete FMCG scenario. *(All numbers in this section are illustrative to explain the algorithm).*

### Scenario Setup
* **Two Warehouses:**
  * Warehouse A (Local): Holds 100 units of Product 1.
  * Warehouse B (Distant): Holds 80 units of Product 1.
* **Two Stores:**
  * Store X (Tier-1): Needs 70 units of Product 1. Shortage penalty = $50/unit.
  * Store Y (Tier-2): Needs 60 units of Product 1. Shortage penalty = $30/unit.
  * Total Demand = 130 units. Total Supply = 180 units (Sufficient stock).
* **Transportation Corridors & Tariffs:**
  * Route $A \rightarrow X$: Tariff = **$2.00 / unit**. Capacity = 100 units.
  * Route $A \rightarrow Y$: Tariff = **$3.00 / unit**. Capacity = **40 units (Tight bottleneck!)**.
  * Route $B \rightarrow X$: Tariff = **$8.00 / unit**. Capacity = 100 units.
  * Route $B \rightarrow Y$: Tariff = **$4.00 / unit**. Capacity = 100 units.

```
       [Warehouse A] (100 units)            [Warehouse B] (80 units)
          |                  \               /                  |
    $2.00 |                   \ $3.00   $8.00 /                   | $4.00
   (Cap 100)                   (Cap 40)   (Cap 100)            (Cap 100)
          |                     \         /                     |
          v                      v       v                      v
     [Store X] (Needs 70)             [Store Y] (Needs 60)
      Tier-1 (Penalty $50)             Tier-2 (Penalty $30)
```

### 1. The Greedy Baseline Decision
1. Baseline considers Store X (Tier-1) first.
2. The cheapest route to Store X is from Warehouse A ($2.00 vs. $8.00).
3. Baseline allocates **70 units** from Warehouse A $\rightarrow$ Store X.
   * Freight cost: $70 \times \$2.00 = \$140.00$.
   * Warehouse A remaining stock: $100 - 70 = 30$ units.
4. Baseline considers Store Y (Needs 60 units).
5. Cheapest route to Store Y is from Warehouse A ($3.00 vs. $4.00).
6. However, Warehouse A only has 30 units left (and route capacity is 40).
7. Baseline allocates remaining **30 units** from Warehouse A $\rightarrow$ Store Y.
   * Freight cost: $30 \times \$3.00 = \$90.00$.
   * Store Y still needs $60 - 30 = 30$ units.
8. Baseline allocates remaining **30 units** from Warehouse B $\rightarrow$ Store Y at $4.00/unit.
   * Freight cost: $30 \times \$4.00 = \$120.00$.
* **Total Baseline Freight Cost:** $\$140 + \$90 + \$120 = \mathbf{\$350.00}$.

### 2. The Global MILP Optimizer Decision
The MILP evaluates the network simultaneously. It recognizes that Route $A \rightarrow Y$ ($3.00) and Route $B \rightarrow Y$ ($4.00) have only a **$1.00 difference**, whereas Route $A \rightarrow X$ ($2.00) and Route $B \rightarrow X$ ($8.00) have a massive **$6.00 difference**.

The optimizer allocates:
* Warehouse A $\rightarrow$ Store X: **70 units** @ $2.00 = $140.00.
* Warehouse A $\rightarrow$ Store Y: **30 units** @ $3.00 = $90.00.
* Warehouse B $\rightarrow$ Store Y: **30 units** @ $4.00 = $120.00.
*(In this symmetric unconstrained instance, baseline and optimizer both find $350.00)*.

Now introduce a **capacity constraint on Route $A \rightarrow X$ capped at 40 units**:
* **Greedy Baseline:**
  * Ships 40 units from $A \rightarrow X$ ($40 \times \$2 = \$80$).
  * Needs 30 more for Store X; ships 30 from $B \rightarrow X$ ($30 \times \$8 = \$240$).
  * Warehouse A has 60 units left. Store Y needs 60. Route $A \rightarrow Y$ is capped at 40.
  * Ships 40 from $A \rightarrow Y$ ($40 \times \$3 = \$120$).
  * Ships remaining 20 from $B \rightarrow Y$ ($20 \times \$4 = \$80$).
  * **Baseline Total Cost:** $\$80 + \$240 + \$120 + \$80 = \mathbf{\$520.00}$.
* **MILP Optimizer:**
  * Recognizes that shipping from B to X costs $8.00, whereas shipping from B to Y costs only $4.00.
  * Maxes out Route $A \rightarrow X$ at 40 units ($40 \times \$2 = \$80$).
  * Maxes out Route $A \rightarrow Y$ at 40 units ($40 \times \$3 = \$120$).
  * Warehouse A is now depleted ($40 + 40 = 80 \le 100$).
  * Fulfills remaining 30 units of Store X from Warehouse B ($30 \times \$8 = \$240$).
  * Fulfills remaining 20 units of Store Y from Warehouse B ($20 \times \$4 = \$80$).
  * Identifies the optimal trade-off and routes inventory to avoid high-penalty bottlenecks.

---

## Section 14 — Metrics and Their Interpretation

| Metric Name | Mathematical Formula / Definition | Units | Source | Real, Forecast, or Derived? | Operational Interpretation & Common Misconceptions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Total Available Inventory** | $\sum_{b \in B_{\text{usable}}} Q_b$ | Units | `InventoryBatch` | Configured / Measured | Total physical units across all warehouses. *Misconception:* Does not imply all 3,430 units should be shipped; only demand (783 units) is dispatched. |
| **Forecast Demand** | $\sum_{d, p} \text{Demand}_{d,p}$ | Units | `DemandRecord` | Forecast / Derived | Total projected customer demand across the horizon. |
| **Total Fulfilled Units** | $\sum_{(w,d,p,b)} x_{w,d,p,b}$ | Units | Optimizer / Baseline | Derived Output | Actual units scheduled for dispatch. Cannot exceed forecast demand. |
| **Total Unmet Demand** | $\sum_{d,p} u_{d,p}$ | Units | Optimizer / Baseline | Derived Output | Shortage units that could not be fulfilled due to supply or capacity constraints. |
| **Fulfillment Rate** | $\left( \frac{\text{Fulfilled Units}}{\text{Demand Units}} \right) \times 100$ | % | Calculated | Derived Output | Percentage of customer demand satisfied. Target is 100%. |
| **Total Freight Cost** | $\sum c_{w,d} \cdot x_{w,d,p,b}$ | USD ($) | Plan Recommendations | Derived Output | Total transportation dollars paid to carriers based on authentic route tariffs. |
| **Estimated Shortage Cost** | $\sum \pi_{d,p} \cdot u_{d,p}$ | USD ($) | Shortage Details | Derived Output | Commercial loss from stockouts ($2.5\times \text{price} \times \text{tier multiplier}$). |
| **Total Evaluated Economic Cost**| $\text{Freight Cost} + \text{Shortage Cost}$ | USD ($) | Optimization Metrics | Derived Output | The complete financial objective minimized by the solver. |
| **Net Cost Savings** | $\text{Cost}_{\text{base}} - \text{Cost}_{\text{opt}}$ | USD ($) | Plan Comparator | Derived Output | Net dollar savings achieved by mathematical optimization over the heuristic. |
| **Net Savings Percentage** | $\left( \frac{\text{Net Savings}}{\text{Cost}_{\text{base}}} \right) \times 100$ | % | Plan Comparator | Derived Output | Proportional cost reduction. Preserves negative sign if optimizer costs more. |
| **Expiring Stock Utilized** | $\sum x_{w,d,p,b} \quad (\text{days} \le 15)$ | Units | Plan Recommendations | Derived Output | Units of near-expiry inventory successfully allocated to stores before spoiling. |
| **Active Routes Used** | Count of corridors where $\sum x > 0$ | Count | Plan Recommendations | Derived Output | Distinct logistics lanes activated in the distribution plan. |
| **Solver Status** | `OPTIMAL` \| `FEASIBLE` \| `INFEASIBLE` | Enum | Google OR-Tools | Engine Output | Mathematical proof status returned by the SCIP solver. |
| **Runtime** | Execution duration | ms | System Clock | Measured | Solver execution time in milliseconds. |

---

## Section 15 — API Reference

### 15.1 Express API Gateway Endpoints (Port 5001)

| HTTP Method | Path | Auth Required? | Request Body / Query Params | Response Structure | Purpose & Implementation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | No | `{ email, password, name, role }` | `201 Created`<br>`{ user: { id, email, name, role } }`<br>Cookie: `supplysync_session` | Registers a new user in SQLite with bcrypt password hashing. |
| `POST` | `/api/auth/login` | No | `{ email, password }` | `200 OK`<br>`{ user: { id, email, name, role } }`<br>Cookie: `supplysync_session` | Authenticates user; issues cryptographically random session token. |
| `POST` | `/api/auth/demo-login` | No (Dev Only) | None | `200 OK`<br>`{ user, message }`<br>Cookie: `supplysync_session` | One-click evaluator login for hackathon judges (disabled in production). |
| `POST` | `/api/auth/logout` | No | None | `200 OK`<br>`{ success: true }`<br>Clears cookie | Revokes active session in SQLite; clears client cookie. |
| `GET` | `/api/auth/me` | No (Reads Cookie)| None | `200 OK { user }`<br>or `401 Unauthorized` | Resolves active user session on client mount. |
| `GET` | `/api/health` | No | None | `200 OK { status, gateway, engine }` | Multi-service health check pinging gateway and FastAPI engine. |
| `GET` | `/api/master-data` | No | `?data_source=m5` | `200 OK { products, warehouses, ... }` | Proxies master data retrieval to Python engine. |
| `POST` | `/api/dataset/validate` | **Yes** (`requireAuth`) | `{ products, warehouses, ... }` | `200 OK { valid, errors, warnings, summary }` | Validates dataset entities and referential integrity before solving. |
| `POST` | `/api/optimization/run` | **Yes** (`requireAuth`) | `{ data_source, horizon_days, custom_dataset? }` | `200 OK OptimizationPlan` | Executes OR-Tools MILP optimization; stores plan in SQLite `user_runs`. |
| `POST` | `/api/optimization/baseline` | **Yes** (`requireAuth`) | `{ data_source, horizon_days, custom_dataset? }` | `200 OK OptimizationPlan` | Executes greedy baseline heuristic on identical data. |
| `POST` | `/api/optimization/compare` | **Yes** (`requireAuth`) | `{ baseline_plan, optimized_plan }` | `200 OK ComparisonAudit` | Computes comparative metrics and evidence-based verdict. |
| `GET` | `/api/runs/:id` | **Yes** (`requireAuth`) | Route parameter `:id` | `200 OK OptimizationPlan` | Retrieves historical run; enforces strict cross-user ownership isolation. |
| `GET` | `/api/optimization/runs/:id/export` | **Yes** (`requireAuth`) | Route parameter `:id` | `200 OK (text/csv)` | Generates downloadable CSV of consignment dispatch instructions. |

### 15.2 Internal FastAPI Engine Endpoints (Port 8000)

| HTTP Method | Path | Request Model | Response Model | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | None | `{ status: "ok", engine: "running" }` | Engine liveness probe. |
| `GET` | `/api/dataset-status` | None | Diagnostics JSON | Verifies availability of M5 CSV files in `data/m5/sample/`. |
| `GET` | `/api/master-data` | `?data_source=m5` | Master Data JSON | Returns products, warehouses, destinations, batches, routes, and demand. |
| `POST` | `/api/forecast` | `{ product_id, destination_id, horizon_days }` | Forecast Evaluation JSON | Backtests SMA vs. Regression on real M5 sales; projects demand. |
| `POST` | `/api/dataset/validate` | `DatasetValidationRequest` | `DatasetValidationResponse` | Executes pre-solve validation rules. |
| `POST` | `/api/baseline` | `OptimizationRequest` | `OptimizationPlan` | Executes greedy demand-priority baseline heuristic. |
| `POST` | `/api/optimize` | `OptimizationRequest` | `OptimizationPlan` | Executes Google OR-Tools Two-Phase SCIP MILP. |
| `POST` | `/api/compare` | `ComparisonAuditRequest` | `ComparisonAudit` | Computes mathematical variances and neutral evidence-based verdict. |

---

## Section 16 — Authentication and Security Architecture

### 16.1 Threat Model & Security Controls

```mermaid
graph TD
    Client[Client Request] --> OriginCheck{Origin / CSRF Check}
    OriginCheck -- Disallowed Origin --> Reject403[Reject 403 Forbidden]
    OriginCheck -- Authorized Origin --> CookieCheck{Cookie Present?}
    CookieCheck -- No / Malformed --> Reject401[Reject 401 Unauthorized]
    CookieCheck -- Has supplysync_session --> HashToken[Compute SHA-256 Digest]
    HashToken --> DBCheck{Query SQLite sessions}
    DBCheck -- Not Found / Expired / Revoked --> Reject401
    DBCheck -- Valid Active Session --> UserLookup[Query SQLite users]
    UserLookup --> AttachReq[Attach req.user & req.session]
    AttachReq --> EndpointHandler[Execute Protected API Route]
```

### 16.2 Implemented Security Architecture

1. **Password Hashing (bcrypt):**
   * Passwords are hashed using `bcryptjs` with **10 salt rounds** (`server/src/auth.ts:48-55`). Plaintext passwords are never stored or logged.
   * Password complexity rules enforce: minimum 8 characters, maximum 128 characters, containing both alphabetic letters and numbers/symbols.
2. **Cryptographic Session Token Hashing (SHA-256 in SQLite):**
   * Upon successful login, the server generates a high-entropy 64-character hexadecimal token prefixed with `sess_` using `crypto.randomBytes(32)` (`server/src/auth.ts:109`).
   * **Crucial Security Measure:** The raw session token is **never stored in the database**. The gateway hashes the token using **SHA-256** (`auth.ts:103-105`) and stores only the digest as the primary key in the `sessions` table.
   * *Protection:* In the event of a database snapshot leak or SQL injection read, the attacker obtains only SHA-256 hashes, which cannot be used to forge session cookies.
3. **HTTP-Only, Secure, SameSite Cookies:**
   * Session tokens are delivered to the browser exclusively via the `Set-Cookie` header (`server/src/index.ts:153-159`):
     * `httpOnly: true`: Completely inaccessible to client-side JavaScript (`document.cookie`), preventing session theft via Cross-Site Scripting (XSS).
     * `sameSite: 'lax'` (or `'strict'` in prod): Prevents Cross-Site Request Forgery (CSRF).
     * `secure: process.env.NODE_ENV === 'production'`: Enforces HTTPS in production.
     * `maxAge: 24 * 60 * 60 * 1000`: Hard session expiration after 24 hours.
4. **CSRF & Origin Verification Middleware:**
   * Implemented in `server/src/index.ts:68-98`.
   * For all state-changing HTTP requests (`POST`, `PUT`, `PATCH`, `DELETE`), the gateway inspects the incoming `Origin` and `Referer` headers against an explicit whitelist (`http://localhost:5173`, `http://127.0.0.1:5173`, and configured production domains).
   * Requests originating from untrusted or cross-site origins are immediately rejected with **HTTP 403 Forbidden**.
5. **Cross-User Data Isolation (Run Ownership):**
   * Optimization plans are persisted in the `user_runs` table bound to the executing user’s `user_id` (`server/src/index.ts:572-578`).
   * When fetching (`GET /api/runs/:id`) or exporting (`GET /api/optimization/runs/:id/export`), the gateway verifies that `run.user_id === req.user.id`. Requests attempting to access another user's run return **HTTP 403 Forbidden**.
6. **No Secret Leaks in Frontend Bundles:**
   * `VITE_DEMO_PASSWORD` and client-side password injection were completely removed from the client build and templates. Vite client bundles contain zero embedded secrets.
   * Development evaluator access is handled via a dedicated, server-controlled `POST /api/auth/demo-login` route that only operates in local development mode.

---

## Section 17 — Frontend Architecture and State Management

### 17.1 Component Hierarchy

```
App.tsx (Main Application Container)
├── AuthContext.Provider (Global Session State)
│   ├── Navigation Bar (Brand, Dataset Indicator, Navigation Tabs)
│   │   └── UserProfileMenu.tsx (User Avatar, Name, Role, Logout)
│   │
│   ├── [Active Tab Views]
│   │   ├── LandingPage.tsx (Hero, Overview, "Get Started" CTA)
│   │   ├── PlanningWizard.tsx (6-Step Guided Optimization Workflow)
│   │   ├── NetworkOverview.tsx (Topology Cards & Route Explorer)
│   │   ├── InventoryManager.tsx (Batch Shelf-Life & FEFO Tables)
│   │   ├── DemandForecaster.tsx (M5 Time-Series Charts & Models)
│   │   ├── OptimizationConsole.tsx (Advanced Live Solver Dashboard)
│   │   └── ComparisonAuditView.tsx (Side-by-Side Baseline vs MILP Audit)
│   │
│   └── AuthModal.tsx (Conditionally Rendered Login / Register Modal)
```

### 17.2 State Management & Reactive Data Flow
* **Authentication State (`AuthContext.tsx`):** Holds `user`, `isAuthenticated`, and `isLoading`. Re-validates on mount via `/api/auth/me`.
* **Wizard State (`PlanningWizard.tsx`):**
  * `currentStep`: Controls step navigation (`source` $\rightarrow$ `data` $\rightarrow$ `validate` $\rightarrow$ `configure` $\rightarrow$ `optimize` $\rightarrow$ `results`).
  * `activeDataset`: Memoized object dynamically selecting between verified M5 data or parsed custom CSV upload data.
  * `validationResult`: Stores pre-solve invariant confirmation or error messages.
  * `activePlan`: Stores the resulting `OptimizationPlan` returned by OR-Tools.
  * `comparisonAudit`: Stores the side-by-side comparative analysis against the greedy baseline.
* **Filter Reset Invariant:** When switching between M5 and custom uploaded data sources, warehouse and destination table filters are automatically reset to `'all'`, preventing stale foreign key filters from hiding valid recommendations.

---

## Section 18 — Testing Strategy and Evidence

The repository maintains an automated, multi-tiered test pyramid spanning Python mathematical invariant tests, Node.js security integration tests, user journey verifications, and production builds.

```
+-----------------------------------------------------------------------------------+
|                           SUPPLYSYNC TEST SUITE STATUS                            |
+-----------------------------------------------------------------------------------+
|  1. Python Engine Pytest Suite:          66 / 66 PASSED  (100%)                   |
|  2. Node Auth & Security Suite:          19 / 19 PASSED  (100%)                   |
|  3. Node User Journey Suite:              8 /  8 PASSED  (100%)                   |
|  4. Node Optimizer Lifecycle Suite:       5 /  5 PASSED  (100%)                   |
|  5. Backend TypeScript Build:            0 Errors (Clean Compile)                 |
|  6. Frontend Client Lint:                0 Errors (9 non-blocking compiler hints) |
|  7. Frontend Production Bundle:          0 Errors (Built in 217ms)                |
+-----------------------------------------------------------------------------------+
```

### 18.1 Python Pytest Suite (`engine/tests/` — 66 Tests)
* **`test_engine.py`:** Verifies core MILP optimization, route capacity caps, demand fulfillment, and shortage slack variables.
* **`test_loader_and_shelf_life.py`:** Tests M5 binary byte-offset caching, calendar week joins, shelf-life calculation, and exclusion of expired batches.
* **`test_objective_and_stress.py`:** Validates non-negative objective coefficients, financial cost math consistency, and solver stability under severe scarcity.
* **`test_phase2.py`:** Proves the two-phase lexicographic formulation: verifies that Phase 2 maximizes FEFO batch utilization while strictly bounding economic cost to the Phase 1 optimal value.
* **`test_phase3_benchmarks.py`:** Executes 15 deterministic benchmark scenarios and verifies that all mathematical invariants hold.
* **`test_audit_interpretation.py`:** Verifies that the comparator outputs a neutral, evidence-based verdict when baseline and optimizer achieve equal performance on unconstrained networks.
* **`test_exhaustive_oracle.py`:** Compares OR-Tools solutions against an exhaustive brute-force permutation oracle on small combinatorial networks, proving global optimality.

### 18.2 Node.js Integration Suites (`scripts/` — 32 Tests)
1. **`test_auth_security.mjs` (19 Tests):**
   * Rejects malformed emails and weak passwords.
   * Verifies bcrypt password hashing and unique user constraints.
   * Proves session tokens are SHA-256 hashed in SQLite (raw token absent from DB).
   * Verifies HttpOnly, SameSite, and Secure cookie flags.
   * Proves CSRF defense: rejects state-changing requests from untrusted origins with HTTP 403.
   * Proves cross-user isolation: User B cannot read or export User A’s optimization runs.
   * Verifies server-side session invalidation upon logout.
2. **`test_user_journey.mjs` (8 Tests):**
   * Validates gateway health check.
   * Validates custom CSV upload validation (passes valid, rejects invalid).
   * Executes end-to-end OR-Tools optimization on custom and M5 datasets.
   * Proves consecutive runs generate unique run IDs.
   * Verifies snapshot card consistency: proves dynamic 5-product count and 4-destination mapping.
3. **`test_optimizer_lifecycle.mjs` (5 Tests):**
   * Verifies frontend-to-backend trigger mechanics.
   * Proves consecutive runs invoke the solver fresh with zero state leakage.
   * Proves planning horizons scale demand proportionally.
   * Verifies deprecation of synthetic data requests with HTTP 400.

### 18.3 What Automated Tests Do and Do Not Prove
* **What They Prove:** Mathematical constraints are strictly enforced; solver logic matches theoretical equations; session security and CSRF barriers prevent unauthorized access; data pipelines parse M5 files without memory corruption.
* **What They Do Not Prove:** Automated tests do not simulate live physical drivers navigating road closures, unexpected warehouse forklift breakdowns, or dynamic carrier price renegotiations mid-transit.

---

## Section 19 — Performance, Benchmarks, and Stress Testing

### 19.1 15 Deterministic Benchmark Scenarios (`scripts/benchmark_optimizer.py`)
Executed via `.venv/bin/python3 scripts/benchmark_optimizer.py`. Compares Google OR-Tools against the greedy baseline across 15 structured operational scenarios:

```
=============================================================================================================
SUPPLYSYNC BENCHMARK SUITE: OR-TOOLS MILP OPTIMIZER vs. GREEDY BASELINE
Triwizathon 2026 | Problem Statement 2
=============================================================================================================
ID   | Scenario Name                                  | Opt Total ($)  | Base Total ($) | Savings ($)  | Opt ms  | Status
-------------------------------------------------------------------------------------------------------------------------
1    | High Demand with Insufficient Inventory        | $6,300.00      | $6,300.00      | $0.00        | 42.84   | OPTIMAL
2    | Regional Inventory Imbalance                   | $1,600.00      | $1,600.00      | $0.00        | 3.19    | OPTIMAL
3    | Products Approaching Expiry (FEFO)             | $180.00        | $180.00        | $0.00        | 6.20    | OPTIMAL
4    | Routes with Different Transit Times            | $250.00        | $250.00        | $0.00        | 3.31    | OPTIMAL
5    | Mixed Products with Different Weights          | $240.00        | $240.00        | $0.00        | 3.16    | OPTIMAL
6    | Tight Vehicle Weight Capacity                  | $1,750.00      | $1,750.00      | $0.00        | 2.89    | OPTIMAL
7    | Multi-Store Tier SLA Competition               | $3,120.00      | $3,120.00      | $0.00        | 3.03    | OPTIMAL
8    | Expensive vs Cheap Feasible Alternatives       | $100.00        | $100.00        | $0.00        | 2.86    | OPTIMAL
9    | Missing M5 Selling Prices                      | $100.00        | $100.00        | $0.00        | 2.99    | OPTIMAL
10   | Zero Demand and Zero Stock                     | $0.00          | $0.00          | $0.00        | 2.96    | OPTIMAL
11   | Zero Eligible Supply (100% Shortage Slack)     | $3,250.00      | $3,250.00      | $0.00        | 2.75    | OPTIMAL
12   | Alternative Route Restores Feasibility         | $300.00        | $300.00        | $0.00        | 3.02    | OPTIMAL
13   | Multi-Product Shelf-Life Divergence            | $2,050.00      | $2,050.00      | $0.00        | 3.04    | OPTIMAL
14   | Identical Baseline vs Optimizer Result         | $200.00        | $200.00        | $0.00        | 2.98    | OPTIMAL
15   | Global Optimization Superiority (Tariff Trap)  | $275.00        | $1,725.00      | $1,450.00    | 3.04    | OPTIMAL
-------------------------------------------------------------------------------------------------------------------------
SUM  | ALL 15 BENCHMARK SCENARIOS                     | $19,715.00     | $21,165.00     | $1,450.00    (6.85%)
=============================================================================================================
Total benchmark execution time: ~90 ms across all 15 scenarios. 100% Invariants Validated.
```

*Key Insight:* Across Scenarios 1–14, unconstrained supply allows the greedy baseline to match the global optimum ($0.00 variance), which SupplySync reports honestly. In Scenario 15 ("The Tariff Trap"), the greedy baseline falls into a local minimum ($1,725.00), while OR-Tools co-optimizes globally for $275.00, yielding **$1,450.00 (84.1%) in net savings**.

### 19.2 50 Adversarial Stress-Test Instances (`scripts/run_stress_tests.py`)
Executed via `.venv/bin/python3 scripts/run_stress_tests.py`:
* **Total Instances Evaluated:** 50 deterministic adversarial topologies (Seed 42).
* **Proven Optimal Solves:** **50 / 50 instances (100%)**.
* **Invariant Violations:** **0 (100% passed independent validator)**.
* **Economic Cost Comparison:**
  * Aggregate Baseline Cost: **$823,272.67**.
  * Aggregate MILP Cost: **$763,790.00**.
  * Aggregate Net Savings: **$59,482.67 (7.23% net reduction)**.
* **Customer Service Impact:**
  * Baseline Unmet Units: 19,927 units.
  * MILP Unmet Units: 18,134 units (**1,793 customer stockouts eliminated**).
* **Average Solve Time:** **8.81 milliseconds** per instance.

### 19.3 Enterprise Scalability Benchmarks

| Network Scale Tier | Warehouses | Destinations | SKUs | Routes | Batches | Solve Time (ms) | Peak Heap | Process RSS | Solver Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Small (Local Cluster)** | 3 | 6 | 2 | 18 | 12 | **14.29 ms** | 169.5 KB | 65.3 MB | `OPTIMAL` |
| **Medium (Regional Distribution)**| 6 | 18 | 4 | 108 | 35 | **49.71 ms** | 851.8 KB | 75.1 MB | `OPTIMAL` |
| **Large (Multi-State Network)** | 10 | 35 | 6 | 350 | 93 | **288.02 ms** | 3.12 MB | 114.1 MB | `OPTIMAL` |
| **Enterprise Tier (National)** | 15 | 60 | 10 | 900 | 222 | **1,713.32 ms** | 10.22 MB | 240.7 MB | `OPTIMAL` |

*Takeaway:* Even on a nationwide enterprise network with 15 distribution centers, 60 retail supercenters, 900 transportation corridors, and 222 inventory lots, Google OR-Tools solves the complete mixed-integer program to proven mathematical optimality in **under 1.75 seconds**.

---

## Section 20 — Running the Application Locally

### 20.1 Prerequisites
* **Operating System:** macOS, Linux, or Windows (WSL2 recommended).
* **Node.js:** v18.0.0 or higher (v20+ recommended).
* **Python:** 3.10 to 3.14 (with virtual environment support).
* **Package Managers:** `npm` (v9+) and `pip`.

### 20.2 Initial Environment Setup
In the project root (`/Users/utkarshsood/Desktop/SupplySync`):

```bash
# 1. Configure Environment File
cp .env.example .env

# 2. Setup Python Virtual Environment and Install Engine Dependencies
python3 -m venv .venv
source .venv/bin/activate
pip install -r engine/requirements.txt   # or pip install fastapi uvicorn ortools pandas numpy scikit-learn pydantic pytest

# 3. Install Server (Gateway) Dependencies
cd server && npm install && cd ..

# 4. Install Client (Frontend) Dependencies
cd client && npm install && cd ..
```

### 20.3 Starting the Multi-Service Application
SupplySync requires three services running concurrently. Open three separate terminal windows:

#### Terminal 1: Python FastAPI Optimization Engine (Port 8000)
```bash
cd /Users/utkarshsood/Desktop/SupplySync
source .venv/bin/activate
python3 -m uvicorn engine.main:app --host 127.0.0.1 --port 8000 --reload
```
*Verification:* Open `http://127.0.0.1:8000/health` in your browser. Expected response: `{"status":"ok","engine":"running"}`.

#### Terminal 2: Node.js / Express API Gateway (Port 5001)
```bash
cd /Users/utkarshsood/Desktop/SupplySync/server
npm run dev    # or npm start
```
*Verification:* Open `http://localhost:5001/api/health` in your browser. Expected response: `{"status":"healthy","gateway":"running","engine":"connected"}`.

#### Terminal 3: React / Vite Frontend Client (Port 5173)
```bash
cd /Users/utkarshsood/Desktop/SupplySync/client
npm run dev
```
*Access Application:* Open **`http://localhost:5173`** in Google Chrome or any modern browser.

### 20.4 Troubleshooting & Common Issues
* **Port Conflict (Port 5001 or 8000 in use):**
  Identify the blocking process via `lsof -i :5001` or `lsof -i :8000`, and terminate it using `kill -9 <PID>`.
* **API Gateway Returns 502 / Connection Refused:**
  Ensure Terminal 1 (Python Uvicorn) is running on port 8000. The Express Gateway acts as a proxy to `http://127.0.0.1:8000`.
* **CORS / CSRF 403 Forbidden Errors:**
  Ensure you are accessing the frontend via `http://localhost:5173` or `http://127.0.0.1:5173`. Do not access via custom hosts unless added to `ALLOWED_ORIGINS` in `.env`.
* **Evaluator Access:**
  In development mode, click the prominent green button **"Evaluator / Demo Login"** on the login modal to authenticate instantly without manual typing.

---

## Section 21 — Practical Demo Guide for Hackathon Judges

### 21.1 Presentation Pitches

#### 30-Second Pitch (The Elevator Hook)
> *"Judges, FMCG retail supply chains operate on paper-thin margins, where uncoordinated shipping causes massive stockouts, carrier weight violations, and food spoilage. SupplySync replaces blind heuristics with Google OR-Tools mathematical optimization over authentic Walmart M5 sales data. We formulate replenishment as a two-phase Mixed-Integer Linear Program that co-optimizes freight tariffs, truck weight limits, and batch-level FEFO expiration schedules. In stress testing, we proved a 7.23% economic cost reduction and eliminated over 1,700 stockouts. And when simple networks permit heuristic optimality, our auditor honestly reports parity—proving our results are real, mathematically verifiable, and unhallucinated."*

#### 2-Minute Walkthrough (The Core Workflow)
1. **Show Landing Page & Log In:** Open `http://localhost:5173`. Click "Evaluator / Demo Login" to demonstrate real session authentication and role resolution.
2. **Start Planning Wizard:** Click "Start Planning Run". Point out Step 1 (Data Source). Select "Walmart M5 Sample Data".
3. **Verify Master Data (Step 2):** Point out the verified counts: 5 M5 products, 3 regional DCs, 4 stores, 17 inventory lots, and 12 routes. Explain that these reflect authentic Walmart sales and pricing.
4. **Inspect Validation (Step 3):** Show the green validation status. Explain the difference between pre-solve integrity (3,430 available units vs. 783 demand units) and mathematical optimization.
5. **Configure & Optimize (Steps 4 & 5):** Keep the 7-day horizon. Click "Run Optimization". Point out the live solver progress through Phase 1 (Economic Cost) and Phase 2 (FEFO Spoilage Minimization).
6. **Review Results & Audit (Step 6):** Walk through the KPI cards. Show the Side-by-Side Comparison Audit. Point out the neutral evidence-based verdict explaining why baseline and optimizer achieve equal performance on this unconstrained network. Highlight the consignment dispatch table and click "Export Dispatch Plan (CSV)".

#### 5-Minute Deep-Dive (Technical & Mathematical Proof)
* Follow the 2-minute walkthrough, then transition to **Advanced Console**:
  * Navigate to the **Network Overview** tab to show the spatial distribution between Mira Loma, Fort Worth, Joliet, and retail supercenters.
  * Open the **Inventory Manager** tab to show the lot-level shelf-life tracker and explain how Phase 2 selects `M5-LOT-0002-FEFO` (6 days left) over newer batches.
  * Open the **Demand Forecaster** tab to demonstrate chronological backtesting (SMA vs. Linear Regression with day-of-week seasonality) on raw M5 time-series data.
  * Switch back to the **Planning Wizard**, select **Custom CSV Upload**, click "Load Sample Custom Data", and run optimization to demonstrate custom enterprise data ingestion and immediate cost savings.

### 21.2 Five Likely Judge Questions & Authoritative Answers

#### Q1: "Did you build an AI forecasting model, and if so, how does it connect to the optimizer?"
> **Answer:** *"Yes, but we maintain strict architectural separation between forecasting and optimization. In `engine/demand.py`, we implement a time-series model utilizing lag-1, lag-7, day-of-week seasonality, and trend regression evaluated chronologically without future lookahead on authentic Walmart M5 sales. The resulting demand projections feed directly into our Google OR-Tools Mixed-Integer Linear Program as right-hand-side demand conservation constraints. We do not claim an opaque neural network 'optimizes' distribution; machine learning forecasts demand, while exact operations research solves the constrained allocation."*

#### Q2: "Why do your 7-day M5 results show equal performance between baseline and optimizer?"
> **Answer:** *"Because on the unconstrained 7-day M5 network, total inventory is abundant (3,430 units vs. 783 demand) and lowest-tariff direct lanes have ample capacity. In operations research, when local supply satisfies demand on the cheapest lanes without bottleneck competition, the greedy choice is already globally optimal. Rather than fabricating fake savings, our comparator detects this and outputs an honest, evidence-based verdict. When network bottlenecks, tight truck weight caps, or regional shortages are introduced—as shown in our 50 stress tests and Scenario 15—the optimizer outperforms the baseline by 7.23% to 84.1%."*

#### Q3: "How does your FEFO logic work without driving up freight costs?"
> **Answer:** *"We implement a Two-Phase Lexicographic MILP in `engine/optimizer.py`. Phase 1 solves for pure economic cost (freight plus shortage penalties), establishing the global minimum dollar cost $Z^*$. Phase 2 creates a fresh solver instance with a hard constraint bounding economic cost to $Z^* + 10^{-4}$ and maintaining strict fulfillment parity. Phase 2's objective then minimizes remaining shelf-life days. This guarantees that near-expiry batches are prioritized among equal-cost routes without increasing freight expenditure by even one cent."*

#### Q4: "How does the system handle route weight limits versus unit volume?"
> **Answer:** *"In `engine/optimizer.py` lines 106–116, we enforce dual physical constraints along every route corridor. Constraint B enforces maximum unit capacity, while Constraint B2 enforces gross vehicle weight by multiplying each unit shipment by the product's unit weight in kilograms ($\sum x \cdot \text{weight\_kg} \le \text{max\_kg}$). This prevents heavy goods from violating road weight regulations even when unit volume caps appear available."*

#### Q5: "Is your authentication real, or just a mock frontend state?"
> **Answer:** *"It is a genuine full-stack authentication system. The backend uses Express and SQLite with bcrypt password hashing (10 salt rounds). Sessions issue high-entropy 64-character tokens delivered via HttpOnly, SameSite cookies. The raw token is never stored in the database; SQLite stores only its SHA-256 cryptographic digest. We enforce CSRF Origin verification on all state-changing routes and enforce strict cross-user ownership isolation on all optimization runs. This is validated by 19 automated security tests."*

---

## Section 22 — Limitations and Future Roadmap

### 22.1 Current System Limitations

| Domain | Current Implementation Limitation | Practical Real-World Impact |
| :--- | :--- | :--- |
| **Dataset Scale** | Bundled M5 data is an indexed sample (5 SKUs, 4 stores, 90 days) rather than the complete 50,000-series Kaggle file. | Suitable for demonstration and testing; enterprise deployment requires connection to full data lakes. |
| **Forecasting Model** | Linear regression with temporal lags; does not incorporate deep learning (DeepAR, Temporal Fusion Transformers). | Fast and interpretable, but may underperform on complex multi-year holiday interactions. |
| **Vehicle Routing** | Direct corridor representation ($w \rightarrow d$); does not solve multi-stop vehicle routing (VRP). | Models aggregate lane throughput and tariffs, but does not sequence individual delivery truck stops. |
| **Dynamic In-Transit Stock**| Considers inventory currently inside warehouses; does not dynamically track rolling stock in-transit on water or rail. | Requires pipeline buffers in planning horizons. |
| **Real-Time Carrier API** | Freight tariffs are configured matrix values rather than real-time dynamic spot rates from Uber Freight or DAT. | Planners must periodically update route rate sheets. |

### 22.2 Future Roadmap Priorities

```
[Phase 1: Current Release] ---> [Phase 2: Near-Term Integration] ---> [Phase 3: Enterprise Target]
  - Two-Phase SCIP MILP            - Multi-Stop Vehicle Routing (VRP)    - Real-Time SAP / Oracle ERP Sync
  - Real M5 Data & FEFO            - Dynamic Carrier Spot Rates (DAT)    - Live Telematics & RFID Scanning
  - Express & SQLite Auth          - Deep Learning Forecasting (TFT)     - Multi-Tier Supplier Network
```

1. **Multi-Stop Vehicle Routing (VRP with Time Windows):** Integrate OR-Tools’ Routing library to sequence delivery trucks across multiple retail stores on a single dispatch leg.
2. **Enterprise ERP Connectors (SAP / Oracle NetSuite):** Develop bi-directional connectors to ingest live Purchase Orders and automatically write back approved Transfer Orders.
3. **Dynamic Carrier Spot Rate API Integration:** Ingest real-time freight market pricing feeds to dynamically shift allocations between contract and spot carriers.
4. **Deep Probabilistic Demand Forecasting:** Upgrade the forecasting engine to produce probabilistic prediction intervals (P10, P50, P90) to optimize safety stock buffers under extreme volatility.

---

## Section 23 — Glossary

* **FMCG (Fast-Moving Consumer Goods):** High-turnover consumer products (food, beverages, toiletries) characterized by low margins, high volume, and perishable shelf-life.
* **SKU (Stock Keeping Unit):** A distinct item identification code tracking product type, size, and packaging.
* **DC (Distribution Center):** A regional warehouse facility holding bulk inventory for replenishment to retail stores.
* **Inventory Lot / Batch:** A specific manufacturing run of a product sharing identical production and expiration dates.
* **FEFO (First Expired, First Out):** An inventory management principle dictating that batches with the nearest expiration date must be picked and dispatched first.
* **Planning Horizon:** The forward-looking time window (e.g., 7, 14, 30 days) over which demand is forecasted and inventory is allocated.
* **MILP (Mixed-Integer Linear Programming):** A mathematical optimization technique where an objective function is minimized subject to linear constraints, with some or all variables restricted to discrete integer values.
* **Decision Variable:** A mathematical variable in an optimization model whose value is determined by the solver (e.g., how many units to ship).
* **Objective Function:** The mathematical equation defining the total cost to be minimized or profit to be maximized.
* **Constraint:** A mathematical equality or inequality restricting decision variables based on physical reality (e.g., capacity, inventory).
* **Feasible Solution:** Any combination of decision variable values that satisfies all constraints simultaneously.
* **Optimal Solution:** A feasible solution proven to achieve the best possible objective function value.
* **Infeasible Model:** A configuration of constraints that cannot be satisfied simultaneously by any combination of variables.
* **MIP Gap:** The relative percentage difference between the best known feasible integer solution and the theoretical mathematical relaxation bound. A gap of 0.0% proves global optimality.
* **Shortage Penalty:** A mathematical penalty coefficient ($/unit) representing the commercial and reputational cost of failing to fulfill customer demand.
* **Total Economic Cost:** The unified financial metric combining direct transportation freight expenditure and customer stockout penalties.
* **WAPE (Weighted Absolute Percentage Error):** An established retail forecasting metric measuring demand forecast accuracy without encountering division-by-zero errors on zero-sales days: $\frac{\sum |y - \hat{y}|}{\sum y} \times 100$.

---

## Section 24 — Final Project Status and Handoff

### 24.1 Comprehensive System Verification Checklist

- [x] **Core Optimization Engine:** Google OR-Tools SCIP MILP implemented and validated (`engine/optimizer.py`).
- [x] **Two-Phase FEFO Optimization:** Implemented in clean solver instances; proven to minimize spoilage without increasing economic cost.
- [x] **Greedy Baseline Heuristic:** Deterministic demand-priority benchmark implemented (`engine/baseline.py`).
- [x] **Honest Comparative Auditor:** Implemented in `engine/comparator.py`; outputs evidence-based verdicts on equal performance.
- [x] **Kaggle Walmart M5 Dataset:** Real daily sales, calendar weeks, and weekly selling prices ingested from `data/m5/sample/`.
- [x] **Pre-Solve & Post-Solve Validators:** 10 mathematical and physical invariants enforced (`engine/validator.py`).
- [x] **Guided 6-Step Planning Wizard:** Complete UI workflow implemented in `client/src/components/PlanningWizard.tsx`.
- [x] **Custom CSV Upload Pipeline:** Ingests and validates custom enterprise CSVs with downloadable templates.
- [x] **Dynamic Snapshot Consistency:** Product counters derive dynamically from verified master data (5 M5 products).
- [x] **Production Authentication Security:** Bcrypt hashing, SHA-256 token hashing in SQLite, HttpOnly cookies, and CSRF origin verification implemented.
- [x] **Automated Test Pyramid:** 66 Python pytest tests and 32 Node.js integration tests passing with 100% success rate.
- [x] **Zero Build Errors:** Server TypeScript compile, client linter (0 errors), and client production build verified.

### 24.2 Recommended Learning Order for New Engineers
1. Read **`engine/models.py`** to understand the foundational data structures and network entities.
2. Read **`engine/optimizer.py`** to master the mathematical constraints and the two-phase lexicographic formulation.
3. Read **`engine/validator.py`** to understand the 10 mathematical invariants protecting system integrity.
4. Read **`engine/baseline.py`** and **`engine/comparator.py`** to understand the heuristic benchmark and metric math.
5. Read **`server/src/auth.ts`** and **`server/src/index.ts`** to inspect the API gateway, session hashing, and CSRF protection.
6. Read **`client/src/components/PlanningWizard.tsx`** to trace the 6-step reactive UI lifecycle from source selection to export.

### 24.3 Essential Commands Quick Reference
```bash
# Run All Python Invariant Tests
.venv/bin/pytest engine/tests/ -v

# Run 15 Benchmark Scenarios
.venv/bin/python3 scripts/benchmark_optimizer.py

# Run 50 Stress-Test Instances & Scalability Audit
.venv/bin/python3 scripts/run_stress_tests.py

# Run All Node Security & Integration Tests
node --test scripts/test_auth_security.mjs scripts/test_user_journey.mjs scripts/test_optimizer_lifecycle.mjs

# Verify Production Compilation
npm --prefix server run build && npm --prefix client run lint && npm --prefix client run build
```

---

## Source of Truth and Verification Notes

To maintain strict architectural integrity, every claim in this document has been verified against active source code and reproducible test evidence:

1. **Verified Directly from Source Code:**
   * Two-phase optimization formulation and SCIP solver integration (`engine/optimizer.py`).
   * Greedy baseline allocation algorithm (`engine/baseline.py`).
   * Plan comparator variance formulas and neutral verdict text (`engine/comparator.py`).
   * M5 dataset file loading, byte-offset indexation, and calendar week temporal joins (`engine/m5_loader.py`).
   * Configured logistics scenario: 3 DCs, 4 stores, 12 corridors, 17 lots, 3,430 units (`engine/m5_logistics.py`).
   * Pre-solve and post-solve invariant rules (`engine/validator.py`).
   * Authentication architecture, bcrypt salt rounds, SHA-256 session token hashing, HttpOnly cookie flags, and CSRF Origin validation (`server/src/auth.ts`, `server/src/index.ts`).
   * Guided 6-step planning wizard state and dynamic product counter logic (`client/src/components/PlanningWizard.tsx`).
2. **Verified Through Automated Test Execution:**
   * 66 passed pytest tests verifying shelf-life, objectives, invariants, benchmarks, and oracle correctness.
   * 19 passed security tests verifying email validation, password strength, cookie flags, CSRF rejection, and token hashing.
   * 8 passed user journey tests verifying custom CSV uploads, M5 runs, unique run IDs, and snapshot consistency.
   * 5 passed optimizer lifecycle tests verifying frontend-backend triggers, fresh solver invocations, and horizon scaling.
   * 15/15 benchmark scenarios solved to proven optimality ($19,715.00 vs $21,165.00; $1,450.00 / 6.85% net savings).
   * 50/50 stress-test instances solved to proven optimality (7.23% net savings; 1,793 stockouts eliminated; 8.81 ms mean runtime).
   * Enterprise scalability solve times: 15 DCs, 60 stores, 10 SKUs, 900 routes, 222 batches solved in ~1.71 seconds.
3. **Explicitly Identified Assumptions & Configured Inputs:**
   * M5 competition data supplies authentic historical sales, calendar mappings, and observed store selling prices.
   * Regional distribution centers (`WH-M5-PACIFIC`, etc.), route tariffs ($1.75 to $9.40), route distance/transit days, vehicle unit/weight caps, initial batch quantities, and shelf-life expiration dates are **configured logistics scenario assumptions** designed to mirror realistic FMCG operations.
   * Shortage penalties are modeled as $2.5 \times \text{observed unit price} \times \text{tier multiplier}$ based on standard FMCG retail practice.
   * ERP integrations (SAP/Oracle), live GPS telematics, and multi-stop vehicle routing (VRP) are documented strictly as **future roadmap items**.
