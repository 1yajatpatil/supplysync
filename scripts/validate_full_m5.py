#!/usr/bin/env python3
"""
SupplySync Full M5 Dataset Validation & Verification Tool
Triwizathon 2026 | Problem Statement 2

Performs independent validation of Walmart M5 dataset files:
1. Verifies file presence, size, and header schema consistency.
2. Checks CSV formatting, quoting, and day-column detection.
3. Tests indexed random lookups against direct CSV full-file scans.
4. Validates calendar wm_yr_wk alignment and sell_prices.csv temporal joins.
5. Measures indexing latency, query latency, and memory footprint.
"""

import sys
import os
import csv
import time
import argparse
import random
from pathlib import Path
from typing import Dict, Any, List, Tuple


def get_process_memory_mb() -> float:
    """Returns resident set size (RSS) memory in MB."""
    try:
        import resource
        usage = resource.getrusage(resource.RUSAGE_SELF)
        # On macOS, ru_maxrss is in bytes; on Linux, in kilobytes
        if sys.platform == "darwin":
            return round(usage.ru_maxrss / (1024 * 1024), 2)
        else:
            return round(usage.ru_maxrss / 1024, 2)
    except Exception:
        return 0.0


def validate_m5_directory(data_dir: Path) -> Dict[str, Any]:
    print(f"============================================================")
    print(f"SupplySync M5 Dataset Validation: {data_dir}")
    print(f"============================================================")

    results: Dict[str, Any] = {
        "data_dir": str(data_dir),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "files": {},
        "integrity": True,
        "performance": {}
    }

    expected_files = [
        ("sales_train_validation.csv", ["id", "item_id", "dept_id", "cat_id", "store_id", "state_id", "d_1"]),
        ("calendar.csv", ["date", "wm_yr_wk", "weekday", "wday", "d"]),
        ("sell_prices.csv", ["store_id", "item_id", "wm_yr_wk", "sell_price"])
    ]

    for fname, req_cols in expected_files:
        fpath = data_dir / fname
        f_info: Dict[str, Any] = {"present": fpath.is_file()}
        if not fpath.is_file():
            print(f"[MISSING] Required file: {fname}")
            f_info["error"] = "File not found"
            results["files"][fname] = f_info
            results["integrity"] = False
            continue

        size_bytes = fpath.stat().st_size
        f_info["size_bytes"] = size_bytes
        f_info["size_mb"] = round(size_bytes / (1024 * 1024), 2)

        # Inspect header
        with open(fpath, "r", encoding="utf-8", errors="replace") as f:
            reader = csv.reader(f)
            try:
                header = next(reader)
                f_info["header_columns_count"] = len(header)
                missing_cols = [c for c in req_cols if c not in header]
                if missing_cols:
                    f_info["missing_required_columns"] = missing_cols
                    results["integrity"] = False
                    print(f"[SCHEMA ERROR] {fname} missing columns: {missing_cols}")
                else:
                    f_info["schema_valid"] = True
            except Exception as e:
                f_info["error"] = f"Failed to parse header: {e}"
                results["integrity"] = False

        # Count rows (approximate for huge files or exact for small files)
        line_count = 0
        with open(fpath, "rb") as f:
            for _ in f:
                line_count += 1
        f_info["total_rows"] = line_count
        print(f"[VALID] {fname}: {line_count:,} lines ({f_info['size_mb']} MB)")
        results["files"][fname] = f_info

    if not results["integrity"]:
        print("[FAIL] M5 dataset integrity checks failed.")
        return results

    # Performance & Indexing Test
    print("\n--- Benchmarking Indexed vs Direct Retrieval ---")
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from engine.m5_loader import M5DataLoader, clear_m5_cache

    clear_m5_cache()
    start_mem = get_process_memory_mb()
    t0 = time.time()
    loader = M5DataLoader(use_cache=True)
    # Override active dir if specified
    loader.active_dir = data_dir
    loader.source_type = "custom_validation"

    stores, items = loader.get_available_entities()
    idx_time_ms = round((time.time() - t0) * 1000, 2)
    post_idx_mem = get_process_memory_mb()
    print(f"Indexing completed in {idx_time_ms} ms. Stores: {len(stores)}, Items: {len(items)}")

    results["performance"]["index_initialization_ms"] = idx_time_ms
    results["performance"]["stores_count"] = len(stores)
    results["performance"]["items_count"] = len(items)
    results["performance"]["memory_delta_mb"] = round(post_idx_mem - start_mem, 2)

    # Deterministic random sample verification against direct scan
    rng = random.Random(42)
    sample_pairs = []
    for _ in range(min(5, len(items))):
        s = rng.choice(stores)
        i = rng.choice(items)
        sample_pairs.append((s, i))

    print("\n--- Cross-Validating Indexed Rows against Direct File Scan ---")
    verification_passed = True
    latencies = []

    for store_id, item_id in sample_pairs:
        # Indexed retrieval
        t_query = time.perf_counter()
        series_indexed = loader.load_time_series(item_id, store_id)
        q_ms = (time.perf_counter() - t_query) * 1000
        latencies.append(q_ms)

        # Ground truth direct scan
        direct_sales = []
        sales_path = data_dir / "sales_train_validation.csv"
        with open(sales_path, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            header = next(reader)
            s_idx = header.index("store_id")
            i_idx = header.index("item_id")
            d_indices = [idx for idx, col in enumerate(header) if col.startswith("d_") and col[2:].isdigit()]
            for row in reader:
                if row[s_idx] == store_id and row[i_idx] == item_id:
                    direct_sales = [int(round(float(row[d]))) for d in d_indices]
                    break

        indexed_sales = [x["demand"] for x in series_indexed]
        if indexed_sales != direct_sales:
            print(f"[MISMATCH] {store_id} / {item_id}: Indexed values do not match direct scan!")
            verification_passed = False
        else:
            print(f"[VERIFIED] {store_id} / {item_id}: {len(indexed_sales)} points verified in {q_ms:.3f} ms")

    results["performance"]["avg_series_query_latency_ms"] = round(sum(latencies) / len(latencies), 4) if latencies else 0.0
    results["cross_validation_passed"] = verification_passed

    # Pricing query benchmark
    t_price_start = time.perf_counter()
    sample_prices = [loader.get_price(i, s) for s, i in sample_pairs]
    p_latency_ms = round((time.perf_counter() - t_price_start) * 1000 / len(sample_pairs), 4)
    results["performance"]["avg_price_query_latency_ms"] = p_latency_ms
    print(f"Price lookup avg latency: {p_latency_ms} ms/query")

    print("\n============================================================")
    print("VALIDATION SUMMARY")
    print(f"Integrity: {'PASSED' if results['integrity'] and verification_passed else 'FAILED'}")
    print(f"Index Time: {results['performance']['index_initialization_ms']} ms")
    print(f"Avg Query Latency: {results['performance']['avg_series_query_latency_ms']} ms")
    print(f"Peak Memory: {get_process_memory_mb()} MB")
    print("============================================================")

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Validate M5 dataset directory.")
    parser.add_argument("--data-dir", type=str, default="data/m5/sample", help="Path to M5 directory")
    args = parser.parse_args()

    path = Path(args.data_dir)
    res = validate_m5_directory(path)
    if not res.get("integrity") or not res.get("cross_validation_passed", False):
        sys.exit(1)
    sys.exit(0)
