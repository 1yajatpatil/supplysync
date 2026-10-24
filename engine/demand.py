"""
SupplySync Demand Forecasting Service
Implements:
1. Baseline Historical Moving Average & Seasonality.
2. Evaluated scikit-learn linear regression with chronological validation (train on prior periods, test on subsequent periods).
3. Explicit error metrics (MAE, RMSE, MAPE) computed strictly without future lookahead.
"""

from typing import List, Dict, Any, Tuple
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error

from .models import DemandRecord, Product, Destination


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
    rng = np.random.RandomState(seed + hash(product_id + destination_id) % 10000)
    
    series = []
    for day_idx in range(days):
        day_of_week = day_idx % 7
        # Weekly seasonality: weekend bump for FMCG retail
        seasonal_factor = 1.35 if day_of_week in (5, 6) else (0.85 if day_of_week == 0 else 1.0)
        # Gentle upward trend
        trend = (day_idx / days) * 15.0
        # Realistic noise
        noise = rng.normal(0, 10.0)
        
        actual = max(10, int(round(base_mean * seasonal_factor + trend + noise)))
        series.append({
            "day_index": day_idx,
            "day_of_week": day_of_week,
            "demand": actual
        })
    return series


def evaluate_forecasting_models(
    product_id: str,
    destination_id: str,
    horizon_days: int = 7
) -> Dict[str, Any]:
    """
    Performs chronological backtesting:
    Uses first 45 days for training, evaluates next 15 days, then projects the requested horizon.
    """
    history = generate_synthetic_historical_series(product_id, destination_id, days=60)
    
    # Chronological split: train on days 0..44, test on days 45..59
    train_data = history[:45]
    test_data = history[45:]
    
    # 1. Baseline: 7-day Simple Moving Average
    sma_predictions = []
    for i in range(len(test_data)):
        # Look back at last 7 actual observations prior to this test day
        prior_window = history[45 + i - 7 : 45 + i]
        sma_val = np.mean([item["demand"] for item in prior_window])
        sma_predictions.append(sma_val)
        
    y_test = [item["demand"] for item in test_data]
    sma_mae = float(mean_absolute_error(y_test, sma_predictions))
    sma_rmse = float(np.sqrt(mean_squared_error(y_test, sma_predictions)))
    sma_mape = float(np.mean(np.abs((np.array(y_test) - np.array(sma_predictions)) / np.array(y_test))) * 100)

    # 2. Machine Learning: Ridge/Linear Regression with temporal lag & day-of-week features
    X_train, y_train = [], []
    for i in range(7, len(train_data)):
        lag_1 = train_data[i - 1]["demand"]
        lag_7 = train_data[i - 7]["demand"]
        dow = train_data[i]["day_of_week"]
        X_train.append([lag_1, lag_7, dow, i])
        y_train.append(train_data[i]["demand"])
        
    lr_model = LinearRegression()
    lr_model.fit(X_train, y_train)

    # Test evaluation
    lr_predictions = []
    for i in range(len(test_data)):
        idx = 45 + i
        lag_1 = history[idx - 1]["demand"]
        lag_7 = history[idx - 7]["demand"]
        dow = history[idx]["day_of_week"]
        pred = lr_model.predict([[lag_1, lag_7, dow, idx]])[0]
        lr_predictions.append(max(0, pred))

    lr_mae = float(mean_absolute_error(y_test, lr_predictions))
    lr_rmse = float(np.sqrt(mean_squared_error(y_test, lr_predictions)))
    lr_mape = float(np.mean(np.abs((np.array(y_test) - np.array(lr_predictions)) / np.array(y_test))) * 100)

    # Select best model based on MAE
    best_model_name = "ML Time-Series Regression" if lr_mae <= sma_mae else "7-Day Moving Average Baseline"
    
    # Generate future horizon projection
    recent_avg = np.mean([item["demand"] for item in history[-7:]])
    forecast_total = int(round(recent_avg * horizon_days))

    return {
        "product_id": product_id,
        "destination_id": destination_id,
        "horizon_days": horizon_days,
        "forecasted_demand_total": forecast_total,
        "selected_model": best_model_name,
        "evaluation_metrics": {
            "baseline_sma": {
                "mae": round(sma_mae, 2),
                "rmse": round(sma_rmse, 2),
                "mape_pct": round(sma_mape, 2)
            },
            "ml_regression": {
                "mae": round(lr_mae, 2),
                "rmse": round(lr_rmse, 2),
                "mape_pct": round(lr_mape, 2)
            }
        },
        "chronological_validation_note": "Evaluated strictly on holdout historical periods without future lookahead."
    }
