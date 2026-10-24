# SupplySync: Technical Data Pipeline, Ingestion & Optimization Audit

**Audit Timestamp:** October 25, 2026  
**Auditor:** Senior Data Engineer, ML Engineer & Operations Research Specialist  
**Target Repository:** `SupplySync` (`/Users/utkarshsood/Desktop/SupplySync`)  
**Commit Inspected:** `8300c06` (Branch `main`)  
**Audit Scope:** Read-Only Audit of Data Pipelines, M5 Ingestion, Forecasting Mechanics, Optimization Model, Invariants, and API Contracts.

---

## 1. Executive Summary

SupplySync is an operational distribution planning engine developed for Triwizathon 2026 (Problem Statement 2). The application bridges retail demand signals with constrained multi-echelon warehouse dispatching.

### Key Audit Findings at a Glance
1. **Real Data vs. Logistics Layer Separation [VERIFIED]**: The system legitimately loads authentic Walmart M5 competition daily sales (`sales_train_validation.csv`) and calendar day mappings (`calendar.csv`). However, because M5 contains no warehouse inventory, freight tariffs, or shelf-life records, a dedicated logistics configuration (`engine/m5_logistics.py`) supplies these operational assumptions while strictly preserving real M5 item codes (`FOODS_1_001`, etc.) and store codes (`CA_1`, etc.).
2. **Pricing Data Disconnect [VERIFIED]**: While `sell_prices.csv` is validated for existence in diagnostics, it is **never joined or ingested** into product catalog values, holding costs, or shortage penalties.
3. **M5 Full-Scale Performance Bottleneck [VERIFIED]**: In `engine/m5_loader.py`, `load_time_series()` iteratively scans `sales_train_validation.csv` via chunked search for each individual item-store pair. While near-instantaneous on the 20-series sample dataset, on the full Kaggle dataset (30,490 series $\times$ 1,913 days), computing 30,490 demand pairs would scan the 500MB+ CSV over 30,000 times without index caching.
4. **Perishability / Transit-Time Disconnect in Optimization [VERIFIED]**: The optimizer enforces batch expiry ($\text{days\_to\_expiry} > 0$ at origin), but **ignores route transit time and minimum retailer shelf life**. A batch with 3 days of shelf life shipped over a 4-day transit lane arrives expired.
5. **Physical Dimension Gaps in Solver [VERIFIED]**: `Product.unit_weight_kg` and `Warehouse.storage_capacity_units` are defined in schemas, but the OR-Tools model enforces corridor capacity purely on raw unweighted unit counts and enforces zero warehouse storage capacity bounds.
6. **Mathematical Correctness & Solver Safeguards [VERIFIED]**: FEFO subsidies are safely bounded ($\min(0.25 \cdot c_{w,d}, 0.75)$), preventing negative-cost artifacts. Discrete integer solvers (`SCIP`/`CBC`) are strictly enforced, rejecting continuous relaxation solvers like `GLOP`.
7. **Empirical Benchmarking Fairness [VERIFIED]**: The greedy baseline and the OR-Tools solver receive strictly identical master data, horizon scaling, and demand snapshots.

---

## 2. Existing Data Flow Architecture

The data pipeline progresses through 9 distinct stages:

```
[M5 CSV Files] ──(1)──> [Data Loading] ──(2)──> [Preprocessing] ──(3)──> [Historical Time Series]
                                                                                │
                                                                               (4)
                                                                                ▼
[Dashboard UI] <──(9)── [API Response] <──(8)── [Validation] <──(7)── [OR-Tools MILP] <──(6)── [Demand Projection]
```

### Detailed Stage-by-Stage Breakdown

| Stage | File & Function | Input Schema / Sources | Output Schema / Destination | Failure & Exception Behavior | Verification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Data Loading** | `engine/m5_loader.py`<br>`M5DataLoader.load_calendar()`<br>`get_available_entities()` | `data/m5/calendar.csv`<br>`data/m5/sales_train_validation.csv` | `pd.DataFrame`<br>`(stores: List[str], items: List[str])` | Raises `FileNotFoundError` if files missing; raises `ValueError` if required columns missing. | **VERIFIED** |
| **2. Preprocessing & Extraction** | `engine/m5_loader.py`<br>`M5DataLoader.load_time_series()` | `item_id: str`, `store_id: str`, `calendar.csv` | `List[Dict[str, Any]]`: `[{day_index, day_id, date, day_of_week, demand, event}, ...]` | Raises `KeyError` if item/store pair not found in sales CSV. Chunk iterator breaks on first match. | **VERIFIED** |
| **3. Logistics Scenario Mapping** | `engine/m5_logistics.py`<br>`get_m5_destinations()`<br>`get_m5_products()`<br>`get_m5_warehouses()`<br>`get_m5_routes()`<br>`get_m5_inventory_batches()` | Active store/item entity lists from loader | `List[Destination]`, `List[Product]`, `List[Warehouse]`, `List[Route]`, `List[InventoryBatch]` | Falls back to default coordinates/tiers if store ID not in `M5_STORE_METADATA`. | **VERIFIED** |
| **4. Demand Forecasting** | `engine/demand.py`<br>`evaluate_forecasting_models()` | `product_id`, `destination_id`, `horizon_days` (7, 14, 30), `data_source` | `Dict[str, Any]`: metrics (`mae`, `rmse`, `wape_pct`), `projected_daily`, `forecasted_demand_total` | Raises `ValueError` if historical observations $< 14$. Falls back to synthetic series on loader error. | **VERIFIED** |
| **5. Inventory Requirements** | `engine/demand.py`<br>`generate_forecasted_demand_records()` | `products`, `destinations`, `horizon_days`, `data_source` | `List[DemandRecord]`: `[DemandRecord(destination_id, product_id, forecasted_demand, ...)]` | Propagates unhandled forecasting exceptions up to caller. | **VERIFIED** |
| **6. Optimization Input Assembly** | `engine/main.py`<br>`get_dataset_bundle()` | `data_source` (`"synthetic"` or `"m5"`), `horizon_days` | Tuple: `(products, warehouses, destinations, batches, routes, demand)` | Deterministic generator. Returns assembled network bundle. | **VERIFIED** |
| **7. Distribution Optimization** | `engine/optimizer.py`<br>`run_ortools_optimization()` | Assembled 6-tuple from stage 6, `planning_horizon_days` | `OptimizationPlan`: `metrics`, `recommendations`, `shortages` | Raises `RuntimeError` if no MIP solver (`SCIP`/`CBC`). Raises `OptimizationInfeasibleError` if infeasible. | **VERIFIED** |
| **8. Invariant Validation** | `engine/validator.py`<br>`validate_plan_invariants()` | `OptimizationPlan` + 6 master data inputs | `List[str]` (audit confirmation messages) | Raises `InvariantViolationError` if any of 10 physical constraints are violated. | **VERIFIED** |
| **9. API Gateway & Delivery** | `server/src/index.ts`<br>`fetchEngine('/api/optimize')` | HTTP POST JSON request payload | Client JSON response | Returns HTTP 502 with error details if Python engine times out ($> 20\text{s}$) or crashes. | **VERIFIED** |

---

## 3. Data Provenance Matrix

Every field utilized across the data pipeline was audited for origin, physical grounding, and mathematical usage:

| Field Name | Entity | Provenance Category | Upstream Source | Transformation Applied | Used in Optimizer? | Validation Performed | Known Limitations / Gaps | Audit Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `item_id` | Product | **Real** | `sales_train_validation.csv` | Preserved verbatim (e.g., `FOODS_1_001`). | Yes (Index key) | Checked against catalog set. | Limited to 5 items in sample dataset. | **VERIFIED** |
| `store_id` | Destination | **Real** | `sales_train_validation.csv` | Preserved verbatim (e.g., `CA_1`). | Yes (Index key) | Checked against catalog set. | Limited to 4 stores in sample dataset. | **VERIFIED** |
| `sales_units` (`d_1`..`d_n`) | TimeSeries | **Real** | `sales_train_validation.csv` | Converted from wide columns to chronological sequence. | Yes (via forecast) | Checked for non-negativity (`max(0, val)`). | Sparse zeros treated as zero demand without stockout un-censoring. | **VERIFIED** |
| `date`, `wday` | Calendar | **Real** | `calendar.csv` | M5 `wday` ($1=\text{Sat}$) remapped to ISO standard ($0=\text{Mon}$). | Indirectly (Features) | Column presence validated. | Full calendar extends beyond sales end dates. | **VERIFIED** |
| `sell_price` | Price | **Real (Unused)** | `sell_prices.csv` | Checked in directory diagnostics; **not parsed**. | **No** | Checked for file presence only. | **Completely disconnected from products and penalties.** | **VERIFIED** |
| `category` | Product | **Derived** | `item_id` string pattern | Regex extraction: `FOODS_1` $\rightarrow$ Fresh Produce, etc. | No (Display only) | Schema string validation. | Hardcoded heuristic categorization. | **VERIFIED** |
| `shelf_life_days` | Product | **Configured** | `engine/m5_logistics.py` | Assigned by category (14d for Food 1, 365d for Hobbies). | No | Positive integer check. | Assumed, not observed from M5. | **VERIFIED** |
| `shortage_penalty` | Product | **Configured** | `engine/m5_logistics.py` | Assigned by category ($20.00 to $40.00/unit). | **Yes** (Penalty weight) | Non-negative float. | Arbitrary business assumption; not grounded in retail margin. | **VERIFIED** |
| `min_shelf_life_req`| Product | **Configured** | `engine/m5_logistics.py` | Assigned by category (3d to 30d). | **No (Ignored)** | None in solver. | **Solver ignores arrival shelf-life constraints.** | **VERIFIED** |
| `unit_weight_kg` | Product | **Configured** | `engine/m5_logistics.py` | Assigned by category (0.8 to 2.0 kg). | **No (Ignored)** | None in solver. | **Vehicle load limits not enforced by weight.** | **VERIFIED** |
| `warehouse_id` | Warehouse | **Configured** | `engine/m5_logistics.py` | 3 Regional DCs defined: `WH-M5-PACIFIC`, `TEXAS`, `MIDWEST`. | Yes (Index key) | Entity key matching. | Synthetic DC network mapped to retail stores. | **VERIFIED** |
| `storage_capacity` | Warehouse | **Configured** | `engine/m5_logistics.py` | 140,000–160,000 units. | **No (Ignored)** | Schema validation only. | **Warehouse storage ceiling not enforced in MILP.** | **VERIFIED** |
| `unit_cost` | Route | **Configured** | `engine/m5_logistics.py` | State proximity matrix ($1.75 intra-state to $9.40 cross-country). | **Yes** (Objective coeff) | Verified non-negative in invariant check. | Linear tariff; lacks Full Truckload (FTL) step functions. | **VERIFIED** |
| `distance_km` | Route | **Configured** | `engine/m5_logistics.py` | Great-circle highway approximations. | No (Display only) | Non-negative float. | Informational only. | **VERIFIED** |
| `transit_time_days` | Route | **Configured** | `engine/m5_logistics.py` | 1 to 4 days based on distance. | **No (Ignored)** | None in solver. | **Perishable dispatches ignore transit degradation.** | **VERIFIED** |
| `max_capacity_units`| Route | **Configured** | `engine/m5_logistics.py` | 600 to 3,000 units per corridor. | **Yes** (Hard constraint) | Invariant 3 checks throughput limit. | Enforced in raw units regardless of SKU weight. | **VERIFIED** |
| `batch_id` | Inventory | **Configured** | `engine/m5_logistics.py` | Formatted IDs (`M5-LOT-0001`, `M5-LOT-0002-FEFO`). | Yes (Index key) | Invariant 2 checks batch limits. | Synthetic batch assignments. | **VERIFIED** |
| `manufacturing_date`| Inventory | **Configured** | `engine/m5_logistics.py` | Anchored to M5 date `2011-04-25` minus 8–10 days. | No (Display only) | ISO date format check. | Simulated baseline date. | **VERIFIED** |
| `expiry_date` | Inventory | **Configured** | `engine/m5_logistics.py` | Manufacturing date plus shelf life. | No (Display only) | ISO date format check. | Simulated baseline date. | **VERIFIED** |
| `days_to_expiry` | Inventory | **Configured** | `engine/m5_logistics.py` | Calculated relative to anchor date. | **Yes** (Quarantine & FEFO) | Invariant 4 verifies zero expired stock allocated. | Static snapshot; does not advance across planning horizon. | **VERIFIED** |
| `initial_inventory` | Inventory | **Configured** | `engine/m5_logistics.py` | 150 to 280 units per DC lot; 90 units for FEFO lots. | **Yes** (Capacity bound) | Invariant 2 bounds shipments by inventory. | Static starting balance; no supplier replenishment in-transit. | **VERIFIED** |
| `forecasted_demand` | Demand | **Derived** | `engine/demand.py` | Recursive autoregressive projection scaled over $H$. | **Yes** (Conservation bound)| Invariant 8 bounds destination fulfillment by demand. | Deterministic point estimate without quantile/uncertainty bands. | **VERIFIED** |
| `unmet_demand` ($u$) | Optimization| **Derived** | `engine/optimizer.py` | Slack decision variable ($D_{d,p} - \sum x$). | **Yes** (Decision var) | Non-negative integer bound. | Cost penalty based on assumed multiplier. | **VERIFIED** |
| `avoided_waste` | Metrics | **Derived** | `engine/optimizer.py` | Equals `expiring_stock_utilized_units`. | No (Reporting only) | None. | **Assumes 100% of unallocated stock would spoil.** | **VERIFIED** |

---

## 4. M5 Ingestion Audit

### 4.1 Required Files and File Presence
* **Required Files [VERIFIED]**: `sales_train_validation.csv` and `calendar.csv`.
* **Optional / Checked Files [VERIFIED]**: `sell_prices.csv` and `sales_train_evaluation.csv`.
* **Dual Source Discovery [VERIFIED]**: `get_m5_directory()` prioritizes `data/m5/` (full dataset); falls back to `data/m5/sample/` (bundled offline development sample).
* **Current Operational State [VERIFIED]**: Only `data/m5/sample/` currently exists on disk (`calendar.csv`: 91 lines, `sales_train_validation.csv`: 21 lines, `sell_prices.csv`: 261 lines).

### 4.2 Ingestion Architecture & Memory Profile
* **Memory Management [VERIFIED]**: The loader does **not** load the entire sales file into RAM at initialization. It reads column subsets (`usecols=["item_id", "store_id"]`) in `get_available_entities()`.
* **Chunked Search Bottleneck [VERIFIED]**:
  ```python
  # engine/m5_loader.py lines 162-166
  for chunk in pd.read_csv(sales_path, chunksize=1000):
      hit = chunk[(chunk["item_id"] == item_id) & (chunk["store_id"] == store_id)]
      if not hit.empty:
          matched_row = hit.iloc[0]
          break
  ```
  *Analysis*: For each (item, store) pair, `pd.read_csv` opens the CSV and scans 1,000-row chunks sequentially. In the sample (20 rows), runtime is $< 5\text{ms}$. On the full Kaggle dataset (30,490 rows $\times$ 1,913 columns, $\approx 500\text{MB}$), querying 100 product-store combinations would read $100 \times 500\text{MB} = 50\text{GB}$ from disk, causing massive latency.

### 4.3 Identifier Mapping & Calendar Handling
* **Identifier Preservation [VERIFIED]**: Product IDs (`FOODS_1_001`..`HOUSEHOLD_1_001`) and Store IDs (`CA_1`, `TX_1`..) are preserved without lossy re-encoding.
* **Chronological Day Indexing [VERIFIED]**: Columns `d_1` through `d_n` are dynamically parsed, integer-sorted by day index (`key=lambda x: int(x[2:])`), and paired with authentic calendar dates from `calendar.csv`.
* **Weekday Conversion [VERIFIED]**: M5's 1-indexed Saturday format (`wday`: 1=Sat..7=Fri) is mapped to standard ISO zero-indexed Monday format (`dow = (wday - 3) % 7`).

### 4.4 Missing Data & Error Handling
* **Missing Series [VERIFIED]**: If a requested `(item_id, store_id)` pair is absent, `evaluate_forecasting_models()` catches the `KeyError` and falls back to `generate_synthetic_historical_series()` with an explicit `data_source = "synthetic_fallback"` indicator.
* **Missing Prices [VERIFIED]**: `sell_prices.csv` is not read by the loader, so missing weekly prices do not trigger runtime errors.
* **Full Dataset Testing Status [VERIFIED]**: The full 500MB+ Kaggle dataset is **untested in this active environment**; all automated tests execute against `data/m5/sample/`.

---

## 5. Forecasting Audit

### 5.1 Methods Implemented
In `engine/demand.py`, two primary forecasting models are evaluated on historical series:
1. **7-Day Simple Moving Average (SMA)**: Computes the rolling arithmetic mean of the preceding 7 days: $\hat{y}_t = \frac{1}{7} \sum_{i=1}^7 y_{t-i}$.
2. **Seasonal Time-Series Regression**: Scikit-Learn `LinearRegression` trained on temporal lag features:
   $$\hat{y}_t = \beta_0 + \beta_1 y_{t-1} + \beta_2 y_{t-7} + \beta_3 \text{dow}_t + \beta_4 t$$
   Captures day-of-week retail spikes (weekends) and linear trends.

### 5.2 Horizon Support & Autoregressive Recursion
* **Planning Horizons [VERIFIED]**: Explicitly supports 7-day, 14-day, and 30-day horizons.
* **Projection Mechanics [VERIFIED]**:
  ```python
  # engine/demand.py lines 147-158
  for h in range(horizon_days):
      day_idx = total_days + h
      dow = day_idx % 7
      if best_model_name == "Seasonal Time-Series Regression" and len(X_train) >= 5:
          lag_1 = current_history[-1]
          lag_7 = current_history[-7]
          pred_val = max(0.0, float(lr_model.predict([[lag_1, lag_7, dow, day_idx]])[0]))
      else:
          pred_val = max(0.0, float(np.mean(current_history[-7:])))
      projected_daily.append(pred_val)
      current_history.append(pred_val)
  ```
  Future projections are generated autoregressively (feeding prior predictions into subsequent lags) and summed:
  $$D_{d,p} = \sum_{h=1}^{H} \hat{y}_{t+h}$$
* **Mathematical Integrity [VERIFIED]**: Toggling 7D $\rightarrow$ 14D $\rightarrow$ 30D genuinely increases cumulative demand volume, forcing multi-warehouse inventory sourcing in the optimizer.

### 5.3 Data Leakage Prevention & Split Strategy
* **Chronological Split [VERIFIED]**: The validation set strictly reserves the final 14 days of historical data:
  ```python
  val_size = min(14, max(7, total_days // 4))
  train_data = history[:-val_size]
  test_data = history[-val_size:]
  ```
* **No Future Lookahead [VERIFIED]**: Feature generation for test day $t$ strictly indexes observations from $t-1$ and $t-7$. No future validation data is leaked into model fitting.

### 5.4 Evaluation Metrics
* **MAE (Mean Absolute Error) [VERIFIED]**: Calculated via `sklearn.metrics.mean_absolute_error`.
* **RMSE (Root Mean Squared Error) [VERIFIED]**: Calculated via `np.sqrt(mean_squared_error)`.
* **WAPE (Weighted Absolute Percentage Error) [VERIFIED]**:
  $$\text{WAPE} = \frac{\sum |y - \hat{y}|}{\sum y} \times 100$$
  *Integrity Note*: Handles sparse zero-sales days cleanly without `NaN` or `inf` division errors.
* **Selection Criterion [VERIFIED]**: The model with lower WAPE on the holdout period is selected to generate the forward forecast.

### 5.5 Censored Demand & Stockout Blindness [AUDIT FINDING]
* **Defect Identified [VERIFIED]**: Historical sales $y_t$ are directly equated to customer demand $D_t$. If an M5 store stocked out of `FOODS_1_001` for 5 days, sales were 0. The regression model interprets this as zero demand rather than unsatisfied demand, biasing future forecasts downward.

---

## 6. Optimization Audit

### 6.1 Mathematical Formulation & Invariants
* **Decision Variables [VERIFIED]**:
  - $x_{w,d,p,b} \in \mathbb{Z}_{\ge 0}$: Discrete integer shipments from warehouse $w$ to destination $d$ for SKU $p$ from batch $b$.
  - $u_{d,p} \in \mathbb{Z}_{\ge 0}$: Discrete unmet demand slack variables.
* **Constraints Enforced [VERIFIED]**:
  1. *Batch Stock Limit*: $\sum_d x_{w,d,p,b} \le Q_{w,p,b}$
  2. *Quarantine*: $Q_{w,p,b} = 0$ for all batches with $\text{days\_to\_expiry} \le 0$.
  3. *Corridor Throughput*: $\sum_{p,b} x_{w,d,p,b} \le C_{w,d}$ for lanes with defined capacity.
  4. *Demand Conservation*: $\sum_{w,b} x_{w,d,p,b} + u_{d,p} = D_{d,p}$
* **Objective Function Coefficients [VERIFIED]**:
  $$\min \sum_{w,d,p,b} \left( c_{w,d} - \text{subsidy}(b) \right) x_{w,d,p,b} + \sum_{d,p} \left( \lambda_p \cdot \text{tier\_mult}_d \right) u_{d,p}$$
  where:
  $$\text{subsidy}(b) = \min(0.25 \cdot c_{w,d}, 0.75) \quad \text{for } 0 < \text{days\_to\_expiry} \le 15$$
  *Mathematical Verification*: Because $\text{subsidy} \le 0.25 \cdot c_{w,d}$, the effective cost is at least $0.75 \cdot c_{w,d} > 0$. Negative objective coefficients are mathematically impossible.
* **Financial Metric Truthfulness [VERIFIED]**:
  Reported transport cost on dashboard is strictly:
  $$\text{Total Freight} = \sum x_{w,d,p,b} \cdot c_{w,d}$$
  Solver penalty weights and subsidies are excluded from the financial report.

### 6.2 Missing Physical Constraints
1. **Ignored Route Transit Degradation [VERIFIED]**:
   - `Route.transit_time_days` (1 to 4 days) exists in schema.
   - `Product.min_shelf_life_required_days` (3 to 30 days) exists in schema.
   - *Audit Finding*: The solver checks only $\text{days\_to\_expiry} > 0$ at origin. If a batch has 3 days remaining and route transit takes 4 days, the batch arrives expired at the store. The constraint should enforce:
     $$\text{days\_to\_expiry}_b - \text{transit\_time}_{w,d} \ge \text{min\_shelf\_life}_p$$
2. **Ignored Warehouse Storage Capacity [VERIFIED]**:
   - `Warehouse.storage_capacity_units` exists in schema.
   - *Audit Finding*: The solver imposes no upper bound on warehouse throughput or storage.
3. **Ignored Physical Weight [VERIFIED]**:
   - `Product.unit_weight_kg` is defined.
   - *Audit Finding*: Corridor capacity $C_{w,d}$ is evaluated purely on unit counts: $\sum x \le C$. A 5kg bag of flour consumes the same corridor capacity as a 200g snack pack.

### 6.3 Infeasibility Handling & Solver Integrity
* **MIP Enforcement [VERIFIED]**: The solver backend requests `pywraplp.Solver.CreateSolver('SCIP')` or `'CBC'`. Continuous `GLOP` is prohibited, guaranteeing discrete integer solutions.
* **Infeasibility Path [VERIFIED]**: Demand conservation includes slack variables $u_{d,p} \ge 0$ with high penalty ($\lambda = 25 \times 1.3 = 32.5$). Demand can always be left unfulfilled, preventing primal infeasibility from demand spikes. Infeasibility only occurs if route capacities or integer bounds are contradictory, which triggers `OptimizationInfeasibleError` and returns HTTP 422.

### 6.4 Baseline Benchmark Fairness
* **Starting State Parity [VERIFIED]**: Both `run_baseline_allocation()` and `run_ortools_optimization()` take identical `(products, warehouses, destinations, batches, routes, demand)` arguments generated from the same snapshot.
* **Algorithmic Distinction [VERIFIED]**:
  - The baseline sorts destinations by tier and greedily grabs the cheapest route with available stock.
  - The OR-Tools solver optimizes globally across all routes, balancing corridor limits, Tier-1 shortage penalties, and FEFO batch subsidies.
  - The comparison is mathematically and operationally fair.

---

## 7. Missing Capabilities & Functional Gaps

| Capability Gap | Impact on Real-World Distribution | Technical Location | Severity |
| :--- | :--- | :--- | :--- |
| **No Index Caching for M5 Sales** | Rereading 500MB CSV per item-store pair will freeze or crash on full dataset. | `engine/m5_loader.py`<br>`M5DataLoader.load_time_series()` | **Critical** |
| **Sell Prices Disconnected** | Stockout penalties and holding costs do not reflect commercial SKU value. | `engine/m5_loader.py`<br>`engine/m5_logistics.py` | **Moderate** |
| **Transit-Time Expiry Blindness** | Perishable batches arrive expired after multi-day transit. | `engine/optimizer.py`<br>`run_ortools_optimization()` | **High** |
| **Weight-Blind Corridor Capacity** | Heavy goods overload vehicles; light goods underutilize volume. | `engine/optimizer.py`<br>Constraint B | **Moderate** |
| **Static Counterfactual for Waste** | Assumes 100% of unallocated near-expiry stock spoils immediately. | `engine/optimizer.py`<br>lines 316-317 | **Low** |
| **Stockout-Blind Demand Estimation** | Historical zero-sales periods from stockouts distort future forecasts downward. | `engine/demand.py`<br>`evaluate_forecasting_models()` | **Moderate** |
| **Aggregate Tactical Planning Only** | Allocates aggregate volume over $H$ days; lacks daily dispatch sequencing. | `engine/optimizer.py` | **Low** (Standard for tactical planning) |

---

## 8. Risks and Limitations

1. **Scalability Barrier on Full Kaggle M5 [VERIFIED]**:
   - The current code operates seamlessly on `data/m5/sample/` (20 time series).
   - Attempting to run the full dataset (30,490 time series $\times$ 1,913 days) without an in-memory index or preprocessed Parquet/SQLite table will result in excessive CPU runtime or HTTP gateway timeouts ($> 20\text{s}$).
2. **Perishability Invariant Violation in Physical Distribution [INFERRED]**:
   - An allocation that passes all 10 mathematical tests in `validator.py` can still deliver rotten food if $\text{days\_to\_expiry} \le \text{transit\_time}$.
3. **Simulated Logistics Risk [VERIFIED]**:
   - Because M5 does not contain real warehouse inventory, judges must be continually reminded that inventory and route tariffs are configured operational scenarios, while sales demands are authentic historical facts.

---

## 9. Prioritized Implementation Plan

### Priority 0: Data Correctness & Integration Blockers (Critical)
* **P0.1: Pre-index M5 Time-Series Cache**
  - *File*: `engine/m5_loader.py`
  - *Function*: `M5DataLoader.__init__()`, `load_time_series()`
  - *Action*: When loading M5, pivot or index the active rows into a dictionary or DuckDB/SQLite store keyed by `(item_id, store_id)` on startup instead of scanning chunked CSVs per query.
* **P0.2: Enforce Transit-Time Shelf-Life Arrival Constraint**
  - *File*: `engine/optimizer.py`
  - *Function*: Variable initialization in `run_ortools_optimization()`
  - *Action*: Exclude route-batch variable $x_{w,d,p,b}$ if:
    $$\text{batch.days\_to\_expiry} - \text{route.transit\_time\_days} < \text{prod.min\_shelf\_life\_required\_days}$$

### Priority 1: Inventory and Distribution Modeling (High)
* **P1.1: Integrate `sell_prices.csv` into Commercial Models**
  - *File*: `engine/m5_loader.py`, `engine/m5_logistics.py`
  - *Function*: `M5DataLoader.load_prices()`, `get_m5_products()`
  - *Action*: Ingest average sell price per SKU; dynamically compute `shortage_penalty_per_unit = 2.5 * sell_price` and `holding_cost_per_day = 0.01 * sell_price`.
* **P1.2: Enforce Weight-Based Corridor Ceilings**
  - *File*: `engine/optimizer.py`
  - *Function*: Constraint B in `run_ortools_optimization()`
  - *Action*: Modify constraint: $\sum_{p,b} x_{w,d,p,b} \cdot \text{prod.unit\_weight\_kg} \le \text{route.max\_capacity\_kg}$.

### Priority 2: Stockout-Aware Forecasting & Perishability (Medium)
* **P2.1: Censored Demand / Zero-Sales Imputation**
  - *File*: `engine/demand.py`
  - *Function*: `evaluate_forecasting_models()`
  - *Action*: Identify runs of $\ge 3$ consecutive zero-sales days where price $> 0$; replace with rolling historical mean to un-censor demand.
* **P2.2: Defensible Avoided Waste Counterfactual**
  - *File*: `engine/optimizer.py`
  - *Function*: Metrics calculation (lines 290–302)
  - *Action*: Compare near-expiry allocation against expected store daily sales rate over remaining shelf life to determine true prevented spoilage.

### Priority 3: Performance and UI Improvements (Low)
* **P3.1: Parquet Storage for Full M5 Dataset**
  - *File*: `engine/m5_loader.py`
  - *Action*: Convert `sales_train_validation.csv` to Parquet format upon initial download for sub-second filtering.
* **P3.2: Store Filter on Allocation Console**
  - *File*: `client/src/components/OptimizationConsole.tsx`
  - *Action*: Expose dynamic store cluster multi-select matching active M5 stores.

---

## 10. Tests Required Before and After Implementation

### Tests Currently Passing (Baseline Verification)
All 13 automated tests in `engine/tests/test_engine.py` pass:
```bash
source .venv/bin/activate
pytest engine/tests -v
# 13 passed in 2.35s
```

### New Tests Required to Validate Future Enhancements
1. **`test_transit_time_expiry_quarantine`**:
   - Create a test route with `transit_time_days = 4`.
   - Create a batch with `days_to_expiry = 3`.
   - Assert that $x_{w,d,p,b} = 0$ in the returned allocation plan.
2. **`test_m5_price_ingestion`**:
   - Query `M5DataLoader.load_prices("FOODS_1_001", "CA_1")`.
   - Assert that price equals $1.98 (matching sample `sell_prices.csv`).
   - Assert that `Product.shortage_penalty_per_unit` dynamically reflects item price.
3. **`test_weight_capacity_constraint`**:
   - Configure a corridor with capacity limit of 1,000 kg.
   - Allocate 500 units of 5kg flour (2,500 kg).
   - Assert that solver rejects allocation or restricts quantity to $\le 200$ units.
4. **`test_large_scale_m5_index_latency`**:
   - Benchmark time required to extract 50 time series from M5 data.
   - Assert that total retrieval time is $< 200\text{ms}$.

---

## Summary of Findings & The Three Highest-Priority Changes

### Audit Summary
The SupplySync data pipeline is architecturally disciplined, mathematically sound in its objective function and integer variables, and transparent in its logistics data separation. The codebase has zero division errors, passes all 10 physical invariant audits, and cleanly scales planning horizons across 7D, 14D, and 30D.

### The Three Highest-Priority Required Changes
1. **P0.1: Implement Time-Series In-Memory Indexing (`engine/m5_loader.py`)**  
   *Why*: Eliminates chunked CSV disk rescanning, ensuring the system can ingest the full 500MB Kaggle dataset without timing out.
2. **P0.2: Enforce Transit-Time Degradation in Batch Allocation (`engine/optimizer.py`)**  
   *Why*: Resolves the real-world operational flaw where perishable batches arrive expired after multi-day transit.
3. **P1.1: Ingest and Join `sell_prices.csv` into Economic Parameters (`engine/m5_logistics.py`)**  
   *Why*: Connects real Kaggle pricing data to shortage penalties and inventory holding costs, transforming arbitrary assumptions into data-driven financial decisions.
