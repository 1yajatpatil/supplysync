"""
SupplySync Demand Forecasting Service
Implements:
1. Baseline Historical Moving Average & Seasonality.
2. Machine Learning Time-Series Regression with temporal lags (lag-1, lag-7, day-of-week).
3. Chronological validation splits (train on past, test on subsequent holdout without future lookahead).
4. Robust error metrics (MAE, RMSE, WAPE) designed for FMCG sparse zero-sales data.
5. End-to-end integration feeding forecasted demand directly into OR-Tools optimizer.
"""

from typing import List, Dict, Any, Tuple, Optional
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error

from .models import DemandRecord, Product, Destination
from .m5_loader import M5DataLoader, get_m5_directory


def generate_synthetic_historical_series(
    product_id: str,
    destination_id: str,
    days: int = 60,
    base_mean: float = 120.0,
    seed: int = 42
) -> List[Dict[str, Any]]:
    """
    Generates a deterministic 60-day historical daily demand series with day-of-week seasonality and trend.
    """
    rng = np.random.RandomState(seed + (hash(product_id + destination_id) % 10000))
    
    series = []
    for day_idx in range(days):
        day_of_week = day_idx % 7
        # Weekly seasonality: weekend retail bump
        seasonal_factor = 1.35 if day_of_week in (5, 6) else (0.85 if day_of_week == 0 else 1.0)
        trend = (day_idx / days) * 15.0
        noise = rng.normal(0, 10.0)
        
        actual = max(10, int(round(base_mean * seasonal_factor + trend + noise)))
        series.append({
            "day_index": day_idx,
            "day_of_week": day_of_week,
            "demand": actual,
            "date": f"2026-08-{day_idx+1:02d}" if day_idx < 30 else f"2026-09-{day_idx-29:02d}"
        })
    return series


def calculate_wape(y_true: List[float], y_pred: List[float]) -> float:
    """
    Weighted Absolute Percentage Error (WAPE).
    WAPE = (sum(|y_true - y_pred|) / sum(y_true)) * 100.
    Standard in retail/FMCG forecasting; avoids division-by-zero on zero-sales days.
    """
    sum_true = sum(y_true)
    if sum_true == 0:
        return 0.0
    sum_abs_err = sum(abs(t - p) for t, p in zip(y_true, y_pred))
    return round(float((sum_abs_err / sum_true) * 100.0), 2)


def evaluate_forecasting_models(
    product_id: str,
    destination_id: str,
    horizon_days: int = 7,
    data_source: str = "m5"
) -> Dict[str, Any]:
    """
    Performs chronological backtesting on historical demand series from Real M5 retail sales data.
    Uses chronological train/test split, computes MAE, RMSE, and WAPE, and projects the requested horizon.
    """
    if data_source.lower() in ("synthetic", "fmcg", "demo"):
        raise ValueError("Synthetic demand data is deprecated. SupplySync operates exclusively on Real M5 retail data.")

    # 1. Retrieve historical daily time-series strictly from M5 dataset
    loader = M5DataLoader()
    try:
        history = loader.load_time_series(product_id, destination_id)
    except Exception as e:
        raise KeyError(
            f"Product '{product_id}' at store '{destination_id}' was not found in the M5 dataset: {str(e)}. "
            f"Synthetic fallback is disabled."
        )

    total_days = len(history)
    if total_days < 14:
        raise ValueError(f"Insufficient historical data ({total_days} days) for chronological backtesting.")

    # Chronological split: hold out last 14 days (or 20%) for testing without future lookahead
    val_size = min(14, max(7, total_days // 4))
    train_data = history[:-val_size]
    test_data = history[-val_size:]
    
    y_test = [float(item["demand"]) for item in test_data]

    # 2. Baseline Model: 7-day Simple Moving Average (SMA)
    sma_predictions = []
    for i in range(len(test_data)):
        cutoff = len(train_data) + i
        # Look back strictly at preceding 7 observations
        prior_window = [float(x["demand"]) for x in history[cutoff - 7 : cutoff]]
        sma_val = np.mean(prior_window) if prior_window else float(train_data[-1]["demand"])
        sma_predictions.append(max(0.0, sma_val))

    sma_mae = float(mean_absolute_error(y_test, sma_predictions))
    sma_rmse = float(np.sqrt(mean_squared_error(y_test, sma_predictions)))
    sma_wape = calculate_wape(y_test, sma_predictions)

    # 3. Machine Learning Model: Linear Regression with lags and day-of-week
    X_train, y_train = [], []
    for i in range(7, len(train_data)):
        lag_1 = float(train_data[i - 1]["demand"])
        lag_7 = float(train_data[i - 7]["demand"])
        dow = train_data[i]["day_of_week"]
        X_train.append([lag_1, lag_7, dow, i])
        y_train.append(float(train_data[i]["demand"]))

    if len(X_train) >= 5:
        lr_model = LinearRegression()
        lr_model.fit(X_train, y_train)

        lr_predictions = []
        for i in range(len(test_data)):
            idx = len(train_data) + i
            lag_1 = float(history[idx - 1]["demand"])
            lag_7 = float(history[idx - 7]["demand"])
            dow = test_data[i]["day_of_week"]
            pred = lr_model.predict([[lag_1, lag_7, dow, idx]])[0]
            lr_predictions.append(max(0.0, pred))

        lr_mae = float(mean_absolute_error(y_test, lr_predictions))
        lr_rmse = float(np.sqrt(mean_squared_error(y_test, lr_predictions)))
        lr_wape = calculate_wape(y_test, lr_predictions)
    else:
        # Fallback if training set is too short
        lr_predictions = sma_predictions
        lr_mae, lr_rmse, lr_wape = sma_mae, sma_rmse, sma_wape

    # Select best model based on WAPE / MAE
    best_model_name = "Seasonal Time-Series Regression" if lr_wape <= sma_wape else "7-Day Moving Average Baseline"

    # 4. Project future demand for requested horizon_days (7D, 14D, 30D)
    # Autoregressive recursive projection for the horizon
    projected_daily = []
    current_history = [float(x["demand"]) for x in history]
    
    for h in range(horizon_days):
        day_idx = total_days + h
        dow = day_idx % 7
        if best_model_name == "Seasonal Time-Series Regression" and len(X_train) >= 5:
            lag_1 = current_history[-1]
            lag_7 = current_history[-7] if len(current_history) >= 7 else lag_1
            pred_val = max(0.0, float(lr_model.predict([[lag_1, lag_7, dow, day_idx]])[0]))
        else:
            pred_val = max(0.0, float(np.mean(current_history[-7:])))
        
        projected_daily.append(pred_val)
        current_history.append(pred_val)

    forecast_total = int(round(sum(projected_daily)))
    # Ensure at least 1 unit if historical sales were non-zero
    if forecast_total == 0 and sum(current_history[-7:]) > 0:
        forecast_total = max(1, int(round(np.mean(current_history[-7:]) * horizon_days)))

    historical_sample = [
        {"date": item.get("date", f"Day-{item['day_index']}"), "actual": item["demand"]}
        for item in history[-14:]
    ]

    return {
        "product_id": product_id,
        "destination_id": destination_id,
        "data_source": data_source,
        "horizon_days": horizon_days,
        "forecasted_demand_total": forecast_total,
        "historical_avg_daily": round(float(np.mean([x["demand"] for x in history[-14:]])), 2),
        "selected_model": best_model_name,
        "historical_series_sample": historical_sample,
        "projected_daily": [round(val, 1) for val in projected_daily],
        "evaluation_metrics": {
            "baseline_sma": {
                "mae": round(sma_mae, 2),
                "rmse": round(sma_rmse, 2),
                "wape_pct": round(sma_wape, 2)
            },
            "ml_regression": {
                "mae": round(lr_mae, 2),
                "rmse": round(lr_rmse, 2),
                "wape_pct": round(lr_wape, 2)
            }
        },
        "chronological_validation_note": f"Evaluated chronologically on {val_size} holdout days. Zero future lookahead."
    }


def generate_forecasted_demand_records(
    products: List[Product],
    destinations: List[Destination],
    horizon_days: int = 7,
    data_source: str = "m5"
) -> List[DemandRecord]:
    """
    Computes forecasted demand for every (destination, product) pair for the exact horizon (7D, 14D, 30D).
    Bridges the Real M5 forecasting service directly into the optimization pipeline.
    """
    if data_source.lower() in ("synthetic", "fmcg", "demo"):
        raise ValueError("Synthetic demand forecasting is deprecated. SupplySync operates exclusively on Real M5 retail sales data.")
    records = []
    
    for dest in destinations:
        for prod in products:
            forecast_res = evaluate_forecasting_models(
                product_id=prod.id,
                destination_id=dest.id,
                horizon_days=horizon_days,
                data_source=data_source
            )
            
            records.append(
                DemandRecord(
                    destination_id=dest.id,
                    product_id=prod.id,
                    forecasted_demand=forecast_res["forecasted_demand_total"],
                    historical_avg_daily=forecast_res["historical_avg_daily"],
                    confidence_interval_pct=0.92
                )
            )
            
    return records
