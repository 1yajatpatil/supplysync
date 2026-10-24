# M5 Forecasting Dataset Integration for SupplySync

This directory houses the dataset for real-world demand forecasting and multi-echelon inventory optimization using the official **Walmart M5 Forecasting Competition** dataset from Kaggle.

- **Competition**: [M5 Forecasting - Accuracy](https://www.kaggle.com/competitions/m5-forecasting-accuracy)
- **Problem Statement**: Triwizathon 2026, Problem Statement 2 — Distribution Intelligence & Inventory Optimization Engine

---

## 1. Supported Files

When using full Kaggle data, place the uncompressed CSV files directly in this directory (`data/m5/`):

| File Name | Mandatory | Description |
| :--- | :---: | :--- |
| `calendar.csv` | **Yes** | Dates on which products are sold, holiday/event indicators, day-of-week mappings (`d_1` to `d_1969`). |
| `sales_train_validation.csv` | **Yes** | Historical daily unit sales per product per store (`d_1` to `d_1913`). |
| `sell_prices.csv` | Optional | Weekly prices per product per store. |
| `sales_train_evaluation.csv` | Optional | Extended sales history (`d_1` to `d_1941`). If present, can be used for extra validation. |

> **Note**: Large CSV files (`*.csv`) in `data/m5/` are excluded from Git commits via `.gitignore`. Never commit raw multi-gigabyte datasets.

---

## 2. Setup Instructions

### Option A: Local Sample Subset (Immediate Demo / Offline Testing)
SupplySync comes equipped with a verified sample M5 subset in `data/m5/sample/` containing authentic M5 calendar entries, real product IDs (`FOODS_1_001`, `FOODS_1_002`, `FOODS_2_001`, `HOBBIES_1_001`, `HOUSEHOLD_1_001`), and real store identifiers across California (`CA_1`, `CA_2`) and Texas (`TX_1`, `TX_2`).

When `data/m5/sales_train_validation.csv` is not present, SupplySync automatically uses `data/m5/sample/` so you can test and demonstrate Real M5 mode out of the box with zero external downloads required!

### Option B: Downloading the Official Kaggle Dataset
1. Download from Kaggle:
   ```bash
   kaggle competitions download -c m5-forecasting-accuracy
   ```
2. Unzip the archives into this directory:
   ```bash
   unzip m5-forecasting-accuracy.zip -d data/m5/
   ```
3. Confirm files exist:
   ```bash
   ls -lh data/m5/*.csv
   ```
4. Restart or query the engine. SupplySync will detect the full dataset and provide real historical demand series.

---

## 3. Data Integrity & Operational Assumptions

The M5 dataset is a **retail point-of-sale time series dataset**. It does not contain upstream warehouse inventory, freight tariffs, truck capacity limits, or batch expiration lots.

To solve the end-to-end multi-echelon optimization problem honestly without fabricating historical data:

| Dimension | Data Source | Transparency & Description |
| :--- | :---: | :--- |
| **Retail Sales History** | **Real M5 Data** | Genuine daily unit sales per store and SKU from `sales_train_validation.csv`. |
| **Calendar & Events** | **Real M5 Data** | Authentic Gregorian dates, days of week, and national events from `calendar.csv`. |
| **Store Metadata** | **Real M5 Data** | Original M5 Store IDs (`CA_1`, `CA_2`, `TX_1`, etc.) mapped to retail destination nodes with realistic state coordinates. |
| **Product Catalog** | **Real M5 Data** | Original M5 Item IDs (`FOODS_1_...`, etc.) preserving category hierarchies. |
| **Regional Warehouses** | **Configured Logistics** | Regional Distribution Centers (e.g. Los Angeles DC, Dallas DC, Chicago DC) configured to supply retail stores. |
| **Initial Inventory & Batches** | **Configured Scenario** | Initial stock allocated into discrete lots with simulated manufacturing dates and remaining shelf life. |
| **Route Tariffs & Capacities** | **Configured Logistics** | Authentic inter-state freight tariffs ($/unit) based on transit distances and corridor throughput constraints. |
| **Batch Expiration** | **Simulated Assumption** | Perishable food SKUs (`FOODS_...`) include FEFO expiry tracking; non-perishables (`HOBBIES_...`, `HOUSEHOLD_...`) have indefinite shelf life. |

---

## 4. Pipeline Traceability

1. **M5 Sales History**: Daily unit sales extracted from wide table format.
2. **Chronological Time-Series Forecast**: Backtested using 7-day Simple Moving Average and Seasonal Regression models evaluated on MAE, RMSE, and WAPE.
3. **Horizon Projection**: Forecasted demand for 7D, 14D, or 30D horizons.
4. **Optimization Input**: Projected demand fed directly into Google OR-Tools Mixed-Integer Linear Programming (MILP) solver.
5. **Traceable Recommendations**: Each shipment recommendation links directly to the original M5 store and product identifier.
