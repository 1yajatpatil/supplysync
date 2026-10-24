"""
SupplySync Real M5 Kaggle Dataset Loader
Parses, validates, caches, and prepares Walmart M5 competition data for demand forecasting and optimization.
"""

import os
import csv
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import pandas as pd
import numpy as np

M5_DATA_DIR = Path("data/m5")
M5_SAMPLE_DIR = Path("data/m5/sample")

# In-memory cache for loaded M5 data structures
_CACHE: Dict[str, Any] = {}


def get_m5_directory() -> Tuple[Optional[Path], str]:
    """
    Identifies the active M5 data directory.
    Prefers full Kaggle dataset in data/m5/; falls back to data/m5/sample/.
    Returns (path, 'full' | 'sample' | 'none').
    """
    full_sales = M5_DATA_DIR / "sales_train_validation.csv"
    full_calendar = M5_DATA_DIR / "calendar.csv"
    if full_sales.is_file() and full_calendar.is_file():
        return M5_DATA_DIR, "full"

    sample_sales = M5_SAMPLE_DIR / "sales_train_validation.csv"
    sample_calendar = M5_SAMPLE_DIR / "calendar.csv"
    if sample_sales.is_file() and sample_calendar.is_file():
        return M5_SAMPLE_DIR, "sample"

    return None, "none"


def get_m5_status() -> Dict[str, Any]:
    """
    Returns diagnostics on M5 dataset availability, location, and file integrity.
    """
    active_dir, source_type = get_m5_directory()
    
    files_to_check = [
        "sales_train_validation.csv",
        "calendar.csv",
        "sell_prices.csv",
        "sales_train_evaluation.csv"
    ]
    
    full_presence = {f: (M5_DATA_DIR / f).is_file() for f in files_to_check}
    sample_presence = {f: (M5_SAMPLE_DIR / f).is_file() for f in files_to_check}

    if source_type == "none":
        return {
            "available": False,
            "active_source": "none",
            "message": "No M5 dataset files detected in data/m5/ or data/m5/sample/.",
            "data_dir_files": full_presence,
            "sample_dir_files": sample_presence,
            "instructions": "Place calendar.csv and sales_train_validation.csv in data/m5/ as described in data/m5/README.md."
        }

    # Read quick summary metadata
    try:
        active_path = active_dir  # type: ignore
        calendar_df = pd.read_csv(active_path / "calendar.csv", nrows=100)
        sales_peek = pd.read_csv(active_path / "sales_train_validation.csv", nrows=10)
        
        stores = sales_peek["store_id"].unique().tolist()
        items = sales_peek["item_id"].unique().tolist()
        
        return {
            "available": True,
            "active_source": source_type,
            "directory": str(active_path),
            "files_present": [f for f, exists in (full_presence if source_type == "full" else sample_presence).items() if exists],
            "store_sample": stores[:6],
            "item_sample": items[:6],
            "message": f"Real M5 dataset active ({source_type} mode). Verified calendar and sales schemas."
        }
    except Exception as e:
        return {
            "available": False,
            "active_source": "error",
            "error": str(e),
            "message": f"Error validating M5 files in {active_dir}: {str(e)}"
        }


class M5DataLoader:
    """
    Loads, filters, and slices M5 historical daily sales for time-series forecasting.
    """
    def __init__(self, use_cache: bool = True):
        self.active_dir, self.source_type = get_m5_directory()
        if not self.active_dir:
            raise FileNotFoundError(
                "M5 dataset not found in data/m5/ or data/m5/sample/. Please refer to data/m5/README.md for setup instructions."
            )
        self.use_cache = use_cache

    def load_calendar(self) -> pd.DataFrame:
        cache_key = f"calendar_{self.source_type}"
        if self.use_cache and cache_key in _CACHE:
            return _CACHE[cache_key]

        cal_path = self.active_dir / "calendar.csv"
        df = pd.read_csv(cal_path)
        required_cols = ["date", "wm_yr_wk", "weekday", "wday", "d"]
        for c in required_cols:
            if c not in df.columns:
                raise ValueError(f"calendar.csv missing required column '{c}'")
        
        if self.use_cache:
            _CACHE[cache_key] = df
        return df

    def get_available_entities(self) -> Tuple[List[str], List[str]]:
        """
        Returns list of (store_ids, item_ids) present in the active dataset.
        """
        cache_key = f"entities_{self.source_type}"
        if self.use_cache and cache_key in _CACHE:
            return _CACHE[cache_key]

        sales_path = self.active_dir / "sales_train_validation.csv"
        # Read only entity metadata columns
        df = pd.read_csv(sales_path, usecols=["item_id", "store_id"])
        stores = sorted(df["store_id"].unique().tolist())
        items = sorted(df["item_id"].unique().tolist())
        res = (stores, items)
        if self.use_cache:
            _CACHE[cache_key] = res
        return res

    def load_time_series(
        self,
        item_id: str,
        store_id: str
    ) -> List[Dict[str, Any]]:
        """
        Extracts chronological daily sales history for a specific (item_id, store_id) pair.
        Returns list of dicts: [{day_index, date, day_of_week, demand, event_name}, ...]
        """
        cal_df = self.load_calendar()
        d_to_meta = {}
        for _, row in cal_df.iterrows():
            d_to_meta[row["d"]] = {
                "date": row["date"],
                "wday": int(row["wday"]),  # 1=Saturday, 2=Sunday, ... 7=Friday
                "event": str(row["event_name_1"]) if pd.notna(row.get("event_name_1")) else ""
            }

        sales_path = self.active_dir / "sales_train_validation.csv"
        
        # Read row matching item_id and store_id
        # For memory efficiency, read chunked or filter directly
        matched_row = None
        for chunk in pd.read_csv(sales_path, chunksize=1000):
            hit = chunk[(chunk["item_id"] == item_id) & (chunk["store_id"] == store_id)]
            if not hit.empty:
                matched_row = hit.iloc[0]
                break

        if matched_row is None:
            raise KeyError(f"Item '{item_id}' not found in store '{store_id}' in M5 dataset.")

        # Identify day columns d_1, d_2, ... in order
        d_cols = [c for c in matched_row.index if c.startswith("d_") and c[2:].isdigit()]
        d_cols.sort(key=lambda x: int(x[2:]))

        series = []
        for idx, d_col in enumerate(d_cols):
            val = float(matched_row[d_col])
            meta = d_to_meta.get(d_col, {"date": "", "wday": (idx % 7) + 1, "event": ""})
            
            # Map M5 wday (1=Sat, 2=Sun, 3=Mon... 7=Fri) to standard day_of_week (0=Mon... 6=Sun)
            wday_val = meta["wday"]
            dow = (wday_val - 3) % 7

            series.append({
                "day_index": idx,
                "day_id": d_col,
                "date": meta["date"],
                "day_of_week": dow,
                "demand": max(0, int(round(val))),
                "event": meta["event"]
            })

        return series
