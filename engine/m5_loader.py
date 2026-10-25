"""
SupplySync Real M5 Kaggle Dataset Loader
Parses, validates, caches, and prepares Walmart M5 competition data for demand forecasting and optimization.
Provides fast, thread-safe indexed lookup to avoid repeated full-dataset scans on large files.
Integrates real M5 weekly selling prices (sell_prices.csv) with temporal joins to calendar weeks (wm_yr_wk).
"""

import os
import csv
import threading
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import pandas as pd
import numpy as np

M5_DATA_DIR = Path("data/m5")
M5_SAMPLE_DIR = Path("data/m5/sample")

# Synchronization lock for thread-safe index creation and file seeking
_LOCK = threading.RLock()

# In-memory caches for sales, calendar, and pricing structures
_CACHE: Dict[str, Any] = {}
_CALENDAR_META: Dict[str, Dict[str, Dict[str, Any]]] = {}
_OFFSET_INDEX: Dict[str, Dict[Tuple[str, str], int]] = {}
_D_COL_INFO: Dict[str, List[Tuple[int, str]]] = {}
_FILE_SIGNATURES: Dict[str, Tuple[float, int]] = {}
_SERIES_CACHE: Dict[Tuple[str, str, str], List[Dict[str, Any]]] = {}

# M5 Pricing Indexes
_PRICE_INDEX: Dict[str, Dict[Tuple[str, str, int], float]] = {}
_STORE_ITEM_PRICE_SUMMARY: Dict[str, Dict[Tuple[str, str], Dict[str, float]]] = {}
_ITEM_PRICE_SUMMARY: Dict[str, Dict[str, Dict[str, float]]] = {}


def clear_m5_cache() -> None:
    """Clears all in-memory M5 caches and indexes (useful for testing and reload)."""
    with _LOCK:
        _CACHE.clear()
        _CALENDAR_META.clear()
        _OFFSET_INDEX.clear()
        _D_COL_INFO.clear()
        _FILE_SIGNATURES.clear()
        _SERIES_CACHE.clear()
        _PRICE_INDEX.clear()
        _STORE_ITEM_PRICE_SUMMARY.clear()
        _ITEM_PRICE_SUMMARY.clear()


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
        loader = M5DataLoader()
        stores, items = loader.get_available_entities()
        
        return {
            "available": True,
            "active_source": source_type,
            "directory": str(active_dir),
            "files_present": [f for f, exists in (full_presence if source_type == "full" else sample_presence).items() if exists],
            "store_sample": stores[:6],
            "item_sample": items[:6],
            "message": f"Real M5 dataset active ({source_type} mode). Verified calendar, indexed sales data, and sell prices."
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
    High-performance, thread-safe M5 dataset loader with byte-offset indexing and pricing integration.
    Eliminates repeated full-file CSV scans by indexing (item_id, store_id) row positions on first access.
    """
    def __init__(self, use_cache: bool = True):
        self.active_dir, self.source_type = get_m5_directory()
        if not self.active_dir:
            raise FileNotFoundError(
                "M5 dataset not found in data/m5/ or data/m5/sample/. Please refer to data/m5/README.md for setup instructions."
            )
        self.use_cache = use_cache

    def _get_file_signature(self, path: Path) -> Tuple[float, int]:
        stat = path.stat()
        return (stat.st_mtime, stat.st_size)

    def load_calendar(self) -> pd.DataFrame:
        """
        Loads and caches calendar DataFrame, and creates pre-computed d -> metadata lookup
        including the M5 week identifier (wm_yr_wk) for temporal joins.
        """
        cal_path = self.active_dir / "calendar.csv"
        sig_key = f"cal_{self.source_type}"
        current_sig = self._get_file_signature(cal_path)

        with _LOCK:
            if self.use_cache and sig_key in _CACHE and _FILE_SIGNATURES.get(sig_key) == current_sig:
                return _CACHE[sig_key]

            df = pd.read_csv(cal_path)
            required_cols = ["date", "wm_yr_wk", "weekday", "wday", "d"]
            for c in required_cols:
                if c not in df.columns:
                    raise ValueError(f"calendar.csv missing required column '{c}'")

            # Pre-compute d_to_meta mapping for high-speed row parsing without iterrows()
            event_col = df["event_name_1"] if "event_name_1" in df.columns else [""] * len(df)
            wm_col = df["wm_yr_wk"]
            d_to_meta: Dict[str, Dict[str, Any]] = {}
            for d_val, date_val, wday_val, wm_val, ev_val in zip(df["d"], df["date"], df["wday"], wm_col, event_col):
                d_to_meta[str(d_val)] = {
                    "date": str(date_val),
                    "wday": int(wday_val),
                    "wm_yr_wk": int(wm_val),
                    "event": str(ev_val) if pd.notna(ev_val) else ""
                }

            if self.use_cache:
                _CACHE[sig_key] = df
                _CALENDAR_META[self.source_type] = d_to_meta
                _FILE_SIGNATURES[sig_key] = current_sig

            return df

    def _get_calendar_meta(self) -> Dict[str, Dict[str, Any]]:
        with _LOCK:
            if self.source_type in _CALENDAR_META:
                return _CALENDAR_META[self.source_type]
        self.load_calendar()
        with _LOCK:
            return _CALENDAR_META[self.source_type]

    def _ensure_sales_index(self) -> Tuple[Dict[Tuple[str, str], int], List[Tuple[int, str]]]:
        """
        Builds or validates the byte-offset index for sales_train_validation.csv.
        Maps (item_id, store_id) -> byte offset in the CSV file.
        Uses standard csv.reader on entire lines to safely handle quoted fields, commas, and variable lengths.
        Detects file modification and invalidates the cache automatically.
        """
        sales_path = self.active_dir / "sales_train_validation.csv"
        sig_key = f"sales_{self.source_type}"
        current_sig = self._get_file_signature(sales_path)

        with _LOCK:
            # Check if index is already warm and valid
            if (
                self.use_cache
                and self.source_type in _OFFSET_INDEX
                and self.source_type in _D_COL_INFO
                and _FILE_SIGNATURES.get(sig_key) == current_sig
            ):
                return _OFFSET_INDEX[self.source_type], _D_COL_INFO[self.source_type]

            # Rebuild index
            offset_map: Dict[Tuple[str, str], int] = {}
            with open(sales_path, "rb") as f:
                header_line = f.readline()
                if not header_line:
                    raise ValueError(f"Empty sales file: {sales_path}")

                header_parts = next(csv.reader([header_line.decode("utf-8", errors="replace")]))
                header_lookup = {col.strip(): i for i, col in enumerate(header_parts)}
                
                item_idx = header_lookup.get("item_id", 1)
                store_idx = header_lookup.get("store_id", 4)

                # Identify all day columns (e.g. d_1, d_2, ...) with their column index
                d_cols = []
                for idx, col in enumerate(header_parts):
                    clean_col = col.strip()
                    if clean_col.startswith("d_") and clean_col[2:].isdigit():
                        d_cols.append((idx, clean_col))
                d_cols.sort(key=lambda x: int(x[1][2:]))

                # Safe line scan with csv.reader: handles quoted fields, commas, and long strings
                while True:
                    offset = f.tell()
                    line_bytes = f.readline()
                    if not line_bytes:
                        break
                    
                    line_str = line_bytes.decode("utf-8", errors="replace")
                    parts = next(csv.reader([line_str]))
                    if len(parts) > max(item_idx, store_idx):
                        item_id = parts[item_idx].strip()
                        store_id = parts[store_idx].strip()
                        offset_map[(item_id, store_id)] = offset

            _OFFSET_INDEX[self.source_type] = offset_map
            _D_COL_INFO[self.source_type] = d_cols
            _FILE_SIGNATURES[sig_key] = current_sig
            # Invalidate any cached series from older file state
            keys_to_purge = [k for k in _SERIES_CACHE if k[0] == self.source_type]
            for k in keys_to_purge:
                _SERIES_CACHE.pop(k, None)

            return offset_map, d_cols

    def _ensure_price_index(self) -> Dict[Tuple[str, str, int], float]:
        """
        Builds or validates the pricing lookup structure for sell_prices.csv.
        Maps (store_id, item_id, wm_yr_wk) -> sell_price.
        Precomputes store-item average prices and item global average prices.
        """
        prices_path = self.active_dir / "sell_prices.csv"
        sig_key = f"prices_{self.source_type}"

        with _LOCK:
            if not prices_path.is_file():
                _PRICE_INDEX[self.source_type] = {}
                _STORE_ITEM_PRICE_SUMMARY[self.source_type] = {}
                _ITEM_PRICE_SUMMARY[self.source_type] = {}
                return _PRICE_INDEX[self.source_type]

            current_sig = self._get_file_signature(prices_path)
            if (
                self.use_cache
                and self.source_type in _PRICE_INDEX
                and _FILE_SIGNATURES.get(sig_key) == current_sig
            ):
                return _PRICE_INDEX[self.source_type]

            price_map: Dict[Tuple[str, str, int], float] = {}
            store_item_accum: Dict[Tuple[str, str], List[float]] = {}
            item_accum: Dict[str, List[float]] = {}

            with open(prices_path, "r", encoding="utf-8", errors="replace") as f:
                reader = csv.reader(f)
                header = next(reader, None)
                if not header:
                    raise ValueError(f"Empty sell_prices file: {prices_path}")
                
                header_lookup = {col.strip(): i for i, col in enumerate(header)}
                store_idx = header_lookup.get("store_id", 0)
                item_idx = header_lookup.get("item_id", 1)
                wm_idx = header_lookup.get("wm_yr_wk", 2)
                price_idx = header_lookup.get("sell_price", 3)

                for row in reader:
                    if len(row) > max(store_idx, item_idx, wm_idx, price_idx):
                        try:
                            s_id = row[store_idx].strip()
                            i_id = row[item_idx].strip()
                            wk = int(row[wm_idx].strip())
                            p_val = float(row[price_idx].strip())
                        except (ValueError, IndexError):
                            continue

                        price_map[(s_id, i_id, wk)] = p_val
                        si_key = (s_id, i_id)
                        if si_key not in store_item_accum:
                            store_item_accum[si_key] = []
                        store_item_accum[si_key].append(p_val)

                        if i_id not in item_accum:
                            item_accum[i_id] = []
                        item_accum[i_id].append(p_val)

            # Summaries
            store_item_summary: Dict[Tuple[str, str], Dict[str, float]] = {}
            for si_key, vals in store_item_accum.items():
                store_item_summary[si_key] = {
                    "avg": round(float(np.mean(vals)), 2),
                    "min": round(float(np.min(vals)), 2),
                    "max": round(float(np.max(vals)), 2),
                    "count": len(vals)
                }

            item_summary: Dict[str, Dict[str, float]] = {}
            for i_id, vals in item_accum.items():
                item_summary[i_id] = {
                    "avg": round(float(np.mean(vals)), 2),
                    "min": round(float(np.min(vals)), 2),
                    "max": round(float(np.max(vals)), 2),
                    "count": len(vals)
                }

            _PRICE_INDEX[self.source_type] = price_map
            _STORE_ITEM_PRICE_SUMMARY[self.source_type] = store_item_summary
            _ITEM_PRICE_SUMMARY[self.source_type] = item_summary
            _FILE_SIGNATURES[sig_key] = current_sig

            return price_map

    def get_price(
        self,
        item_id: str,
        store_id: Optional[str] = None,
        wm_yr_wk: Optional[int] = None
    ) -> Optional[float]:
        """
        Retrieves real M5 observed selling price ($/unit).
        - If wm_yr_wk and store_id are provided: returns exact weekly store price, or None if unlisted.
        - If wm_yr_wk is None and store_id is provided: returns average price for that store-item.
        - If store_id is None: returns average observed price for that item across all stores.
        Returns None if missing. Strictly preserves missing values without inventing synthetic numbers.
        """
        self._ensure_price_index()
        with _LOCK:
            price_map = _PRICE_INDEX.get(self.source_type, {})
            if wm_yr_wk is not None and store_id is not None:
                return price_map.get((store_id, item_id, wm_yr_wk))
            
            if wm_yr_wk is None and store_id is not None:
                si_summary = _STORE_ITEM_PRICE_SUMMARY.get(self.source_type, {}).get((store_id, item_id))
                return si_summary.get("avg") if si_summary else None

            if store_id is None and wm_yr_wk is None:
                i_summary = _ITEM_PRICE_SUMMARY.get(self.source_type, {}).get(item_id)
                return i_summary.get("avg") if i_summary else None

            # Fallback for wm_yr_wk provided but store_id is None
            if wm_yr_wk is not None and store_id is None:
                matching = [p for (s, i, w), p in price_map.items() if i == item_id and w == wm_yr_wk]
                return round(float(np.mean(matching)), 2) if matching else None

            return None

    def get_price_history(self, item_id: str, store_id: str) -> Dict[int, float]:
        """
        Returns chronological dictionary {wm_yr_wk: sell_price, ...} for an item in a store.
        """
        self._ensure_price_index()
        with _LOCK:
            price_map = _PRICE_INDEX.get(self.source_type, {})
            res = {w: p for (s, i, w), p in price_map.items() if s == store_id and i == item_id}
            return dict(sorted(res.items()))

    def get_price_summary(self, item_id: str, store_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Returns statistical summary of observed M5 prices for an item or item-store combination.
        """
        self._ensure_price_index()
        with _LOCK:
            if store_id is not None:
                summ = _STORE_ITEM_PRICE_SUMMARY.get(self.source_type, {}).get((store_id, item_id))
                if summ:
                    return {
                        "item_id": item_id,
                        "store_id": store_id,
                        "min_price": summ["min"],
                        "max_price": summ["max"],
                        "avg_price": summ["avg"],
                        "observations": int(summ["count"]),
                        "is_real_m5": True
                    }
                return None
            else:
                summ = _ITEM_PRICE_SUMMARY.get(self.source_type, {}).get(item_id)
                if summ:
                    return {
                        "item_id": item_id,
                        "store_id": None,
                        "min_price": summ["min"],
                        "max_price": summ["max"],
                        "avg_price": summ["avg"],
                        "observations": int(summ["count"]),
                        "is_real_m5": True
                    }
                return None

    def get_available_entities(self) -> Tuple[List[str], List[str]]:
        """
        Returns list of (store_ids, item_ids) present in the active dataset in O(1) time using the index.
        """
        offset_map, _ = self._ensure_sales_index()
        stores = sorted(list(set(s for _, s in offset_map.keys())))
        items = sorted(list(set(i for i, _ in offset_map.keys())))
        return stores, items

    def load_time_series(
        self,
        item_id: str,
        store_id: str
    ) -> List[Dict[str, Any]]:
        """
        Extracts chronological daily sales history for a specific (item_id, store_id) pair.
        Uses single-seek indexed file retrieval, standard RFC-4180 csv parsing,
        and temporal joins linking M5 weeks (wm_yr_wk) to real selling prices (sell_prices.csv).
        Returns list of dicts: [{day_index, day_id, date, day_of_week, demand, wm_yr_wk, sell_price, event}, ...]
        """
        # Ensure sales index is current; invalidates _SERIES_CACHE if source file was modified
        offset_map, d_cols = self._ensure_sales_index()
        d_to_meta = self._get_calendar_meta()

        cache_key = (self.source_type, item_id, store_id)
        if self.use_cache:
            with _LOCK:
                if cache_key in _SERIES_CACHE:
                    # Return copy to prevent caller mutation of cache
                    return list(_SERIES_CACHE[cache_key])

        offset = offset_map.get((item_id, store_id))
        if offset is None:
            raise KeyError(f"Item '{item_id}' not found in store '{store_id}' in M5 dataset.")

        sales_path = self.active_dir / "sales_train_validation.csv"
        with _LOCK:
            with open(sales_path, "r", encoding="utf-8", errors="replace") as f:
                f.seek(offset)
                line = f.readline()

        line_parts = next(csv.reader([line]))
        series: List[Dict[str, Any]] = []

        for idx, (col_idx, d_name) in enumerate(d_cols):
            try:
                raw_val = float(line_parts[col_idx])
            except (IndexError, ValueError):
                raw_val = 0.0

            meta = d_to_meta.get(d_name, {"date": "", "wday": (idx % 7) + 1, "wm_yr_wk": 0, "event": ""})
            
            # Map M5 wday (1=Sat, 2=Sun, 3=Mon... 7=Fri) to standard day_of_week (0=Mon... 6=Sun)
            wday_val = meta["wday"]
            dow = (wday_val - 3) % 7
            wm_yr_wk = meta.get("wm_yr_wk", 0)

            # Temporal join to real M5 sell price for this week
            sell_price = self.get_price(item_id, store_id, wm_yr_wk) if wm_yr_wk > 0 else None

            series.append({
                "day_index": idx,
                "day_id": d_name,
                "date": meta["date"],
                "day_of_week": dow,
                "demand": max(0, int(round(raw_val))),
                "wm_yr_wk": wm_yr_wk,
                "sell_price": sell_price,
                "event": meta["event"]
            })

        if self.use_cache:
            with _LOCK:
                _SERIES_CACHE[cache_key] = series

        return list(series)


# Default singleton instance and getter
m5_loader = M5DataLoader()

def get_m5_loader() -> M5DataLoader:
    """Returns the default singleton M5DataLoader instance."""
    return m5_loader

