# SupplySync

> **AI-Powered FMCG Distribution Intelligence & Inventory Optimization Engine**  
> *Triwizathon 2026 — Problem Statement 2*

---

## 1. Problem Statement Overview

Fast-Moving Consumer Goods (FMCG) distribution networks span multiple manufacturing plants, regional distribution centers (warehouses), and hundreds of retail or distributor endpoints. Operations face acute friction points:
- **Regional Demand Asymmetries**: Unpredictable local surges and seasonal swings.
- **Inventory Imbalances**: Stockouts at high-turnover retailers coinciding with excess deadstock at distant warehouses.
- **Transportation Costs**: Escalating shipping costs across sub-optimal route allocations.
- **Perishability & Expiry**: Shelf-life depreciation and avoidable batch waste.
- **Route & Fleet Bottlenecks**: Vehicle load limits and route capacities.

**SupplySync** is a full-stack distribution intelligence engine that replaces manual heuristics with mathematical optimization (Google OR-Tools Mixed-Integer Programming) and demand forecasting to generate defensible, cost-minimized, stockout-reducing, and expiry-aware distribution plans.

---

## 2. Architecture

SupplySync follows a microservice architecture separating concerns cleanly:

```
[ Frontend: React + Vite + Tailwind CSS + Recharts ]
                       │
                  (HTTP REST)
                       ▼
       [ API Gateway: Node.js + Express + TypeScript ]
                       │
              (Validated Contracts)
                       ▼
  [ Optimization Engine: Python + FastAPI + Google OR-Tools ]
```

- **Client (`client/`)**: Modern responsive UI with design fidelity to enterprise FMCG specifications (warm palette, forest green accents `#526B50`, interactive network views, baseline vs. optimized comparison dashboards, and CSV export).
- **Application Server (`server/`)**: Express & TypeScript gateway handling FMCG master data, synthetic simulation datasets, request validation, run history, and exports.
- **Optimization & Forecasting Engine (`engine/`)**: Python service leveraging Google OR-Tools `SCIP` solver for constrained mixed-integer programming (MILP), batch-level FEFO expiry routing, demand forecasting, and invariant validations.

---

## 3. Technology Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Recharts, Lucide React
- **Application Server**: Node.js, Express, TypeScript, CORS, Zod
- **Optimization Service**: Python 3.10+, FastAPI, Google OR-Tools, Pandas, NumPy, scikit-learn, Pytest

---

## 4. Getting Started

### Prerequisites
- Node.js (v18+) & npm (v9+)
- Python (v3.10+) with `venv`
- Git

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/1yajatpatil/supplysync.git
   cd supplysync
   ```

2. **Set up Python Virtual Environment & Engine Dependencies:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r engine/requirements.txt
   ```

3. **Set up Node.js Server:**
   ```bash
   cd server
   npm install
   cd ..
   ```

4. **Set up Frontend Client:**
   ```bash
   cd client
   npm install
   cd ..
   ```

5. **Configure Environment:**
   ```bash
   cp .env.example .env
   ```

---

## 5. Running the Application Locally

Run the 3 services in separate terminal sessions:

1. **Python Engine**:
   ```bash
   source .venv/bin/activate
   uvicorn engine.main:app --host 0.0.0.0 --port 8000 --reload
   ```

2. **Node Server**:
   ```bash
   cd server
   npm run dev
   ```

3. **Frontend Client**:
   ```bash
   cd client
   npm run dev
   ```

Visit `http://localhost:5173` in your browser.
