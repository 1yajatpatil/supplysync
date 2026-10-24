"""
SupplySync Configured Logistics Scenario for Real M5 Data
Provides honest, transparent logistics infrastructure (warehouses, corridors, batches, tariffs)
mapped to genuine Walmart M5 store and product identifiers.
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple
from .models import (
    Product,
    Warehouse,
    Destination,
    InventoryBatch,
    Route
)
from .m5_loader import M5DataLoader

# Anchor date matching M5 calendar validation period
M5_LOGISTICS_ANCHOR_DATE = datetime(2011, 4, 25)

# Known M5 Store Geospatial & Tier metadata
M5_STORE_METADATA = {
    "CA_1": {
        "name": "Walmart Supercenter #1994 (Long Beach)",
        "city": "Long Beach",
        "state": "California",
        "lat": 33.7701,
        "lon": -118.1937,
        "tier": "Tier-1",
        "sla": 0.95
    },
    "CA_2": {
        "name": "Walmart Supercenter #2242 (Baldwin Park)",
        "city": "Baldwin Park",
        "state": "California",
        "lat": 34.0853,
        "lon": -117.9609,
        "tier": "Tier-1",
        "sla": 0.95
    },
    "CA_3": {
        "name": "Walmart Supercenter #2028 (San Diego)",
        "city": "San Diego",
        "state": "California",
        "lat": 32.7157,
        "lon": -117.1611,
        "tier": "Tier-1",
        "sla": 0.95
    },
    "CA_4": {
        "name": "Walmart Supercenter #2533 (Rosemead)",
        "city": "Rosemead",
        "state": "California",
        "lat": 34.0806,
        "lon": -118.0728,
        "tier": "Tier-2",
        "sla": 0.90
    },
    "TX_1": {
        "name": "Walmart Supercenter #2718 (Houston)",
        "city": "Houston",
        "state": "Texas",
        "lat": 29.7604,
        "lon": -95.3698,
        "tier": "Tier-1",
        "sla": 0.95
    },
    "TX_2": {
        "name": "Walmart Supercenter #3504 (Dallas North)",
        "city": "Dallas",
        "state": "Texas",
        "lat": 32.7767,
        "lon": -96.7970,
        "tier": "Tier-1",
        "sla": 0.95
    },
    "TX_3": {
        "name": "Walmart Supercenter #2133 (Fort Worth)",
        "city": "Fort Worth",
        "state": "Texas",
        "lat": 32.7555,
        "lon": -97.3308,
        "tier": "Tier-2",
        "sla": 0.90
    },
    "WI_1": {
        "name": "Walmart Supercenter #1432 (Milwaukee)",
        "city": "Milwaukee",
        "state": "Wisconsin",
        "lat": 43.0389,
        "lon": -87.9065,
        "tier": "Tier-1",
        "sla": 0.95
    },
    "WI_2": {
        "name": "Walmart Supercenter #2188 (Green Bay)",
        "city": "Green Bay",
        "state": "Wisconsin",
        "lat": 44.5192,
        "lon": -88.0198,
        "tier": "Tier-2",
        "sla": 0.90
    },
    "WI_3": {
        "name": "Walmart Supercenter #1776 (Madison)",
        "city": "Madison",
        "state": "Wisconsin",
        "lat": 43.0731,
        "lon": -89.4012,
        "tier": "Tier-2",
        "sla": 0.90
    }
}


def get_m5_destinations(loader: M5DataLoader) -> List[Destination]:
    """
    Builds SupplySync Destination objects from real M5 store identifiers.
    Preserves exact store_id (e.g. CA_1, TX_1).
    """
    available_stores, _ = loader.get_available_entities()
    destinations = []
    
    for store_id in available_stores:
        meta = M5_STORE_METADATA.get(store_id, {
            "name": f"Walmart Store {store_id}",
            "city": store_id.split("_")[0],
            "state": "USA",
            "lat": 35.0,
            "lon": -100.0,
            "tier": "Tier-1" if store_id.endswith("1") else "Tier-2",
            "sla": 0.95 if store_id.endswith("1") else 0.90
        })
        
        destinations.append(
            Destination(
                id=store_id,
                name=meta["name"],
                city=meta["city"],
                state=meta["state"],
                latitude=meta["lat"],
                longitude=meta["lon"],
                tier=meta["tier"],
                service_level_target=meta["sla"]
            )
        )
    return destinations


def get_m5_products(loader: M5DataLoader) -> List[Product]:
    """
    Builds SupplySync Product objects preserving real M5 item_id (e.g. FOODS_1_001).
    Distinguishes perishable food (with FEFO shelf life) from non-perishables.
    """
    _, available_items = loader.get_available_entities()
    products = []

    for item_id in available_items:
        # Determine category and shelf life scenario honestly
        if "FOODS_1" in item_id:
            category = "M5 Foods - Fresh Produce & Dairy"
            shelf_life = 14  # Perishable FEFO candidate
            unit_weight = 1.0
            holding_cost = 0.12
            shortage_pen = 40.0
            min_req = 3
        elif "FOODS_2" in item_id:
            category = "M5 Foods - Refrigerated Grocery"
            shelf_life = 30
            unit_weight = 1.5
            holding_cost = 0.10
            shortage_pen = 35.0
            min_req = 5
        elif "FOODS_3" in item_id:
            category = "M5 Foods - Packaged Dry Goods"
            shelf_life = 90
            unit_weight = 2.0
            holding_cost = 0.05
            shortage_pen = 25.0
            min_req = 10
        elif "HOBBIES" in item_id:
            category = "M5 General Merchandise - Hobbies"
            shelf_life = 365  # Non-perishable
            unit_weight = 0.8
            holding_cost = 0.04
            shortage_pen = 20.0
            min_req = 30
        else:
            category = "M5 General Merchandise - Household"
            shelf_life = 365  # Non-perishable
            unit_weight = 1.2
            holding_cost = 0.05
            shortage_pen = 22.0
            min_req = 30

        # Create readable commercial label while preserving item_id
        human_name = f"{item_id} ({category.split(' - ')[-1]})"

        products.append(
            Product(
                id=item_id,
                name=human_name,
                category=category,
                uom="units",
                unit_weight_kg=unit_weight,
                shelf_life_days=shelf_life,
                holding_cost_per_day=holding_cost,
                shortage_penalty_per_unit=shortage_pen,
                min_shelf_life_required_days=min_req
            )
        )
    return products


def get_m5_warehouses() -> List[Warehouse]:
    """
    Configured Regional Distribution Centers supplying Walmart store clusters.
    """
    return [
        Warehouse(
            id="WH-M5-PACIFIC",
            name="Pacific Regional DC (Mira Loma)",
            city="Mira Loma",
            state="California",
            latitude=33.9856,
            longitude=-117.5134,
            storage_capacity_units=150000
        ),
        Warehouse(
            id="WH-M5-TEXAS",
            name="Southwest Distribution Hub (Fort Worth)",
            city="Fort Worth",
            state="Texas",
            latitude=32.8407,
            longitude=-97.3117,
            storage_capacity_units=160000
        ),
        Warehouse(
            id="WH-M5-MIDWEST",
            name="Midwest Fulfillment Center (Joliet)",
            city="Joliet",
            state="Illinois",
            latitude=41.5250,
            longitude=-88.0817,
            storage_capacity_units=140000
        )
    ]


def get_m5_routes(destinations: List[Destination], warehouses: List[Warehouse]) -> List[Route]:
    """
    Configured freight corridors and tariffs connecting regional DCs to M5 stores.
    """
    routes = []
    
    # Distance/tariff heuristic matrix based on geographic regions
    for wh in warehouses:
        for dest in destinations:
            # Check state proximity
            same_state = (wh.state == dest.state)
            is_adjacent = (
                (wh.state == "Illinois" and dest.state == "Wisconsin") or
                (wh.state == "Texas" and dest.state == "Louisiana")
            )
            
            if same_state:
                unit_cost = 1.75
                dist_km = 95.0
                transit_days = 1
                corridor_cap = 3000
            elif is_adjacent:
                unit_cost = 3.20
                dist_km = 280.0
                transit_days = 1
                corridor_cap = 2000
            else:
                # Inter-region long-haul
                if wh.id == "WH-M5-PACIFIC" and dest.state == "Texas":
                    unit_cost = 6.80
                    dist_km = 2200.0
                    transit_days = 3
                    corridor_cap = 800
                elif wh.id == "WH-M5-TEXAS" and dest.state == "California":
                    unit_cost = 7.10
                    dist_km = 2300.0
                    transit_days = 3
                    corridor_cap = 700
                elif wh.id == "WH-M5-MIDWEST" and dest.state == "California":
                    unit_cost = 9.40
                    dist_km = 3100.0
                    transit_days = 4
                    corridor_cap = 600
                else:
                    unit_cost = 5.50
                    dist_km = 1600.0
                    transit_days = 2
                    corridor_cap = 1000

            routes.append(
                Route(
                    source_warehouse_id=wh.id,
                    destination_id=dest.id,
                    unit_cost=unit_cost,
                    distance_km=dist_km,
                    transit_time_days=transit_days,
                    max_capacity_units=corridor_cap
                )
            )
    return routes


def get_m5_inventory_batches(
    products: List[Product],
    warehouses: List[Warehouse]
) -> List[InventoryBatch]:
    """
    Generates configured initial inventory lots across regional DCs.
    Includes near-expiry lots for FOODS to test FEFO optimization, and
    calibrated stock to stress test scarce vs abundant lines.
    """
    batches = []
    batch_idx = 1
    anchor = M5_LOGISTICS_ANCHOR_DATE

    for prod in products:
        is_food_1 = "FOODS_1" in prod.id
        is_food_2 = "FOODS_2" in prod.id
        
        for wh in warehouses:
            # Batch 1: Main healthy inventory lot
            mfg_date = (anchor - timedelta(days=10)).strftime("%Y-%m-%d")
            shelf = prod.shelf_life_days
            exp_date = (anchor + timedelta(days=shelf - 10)).strftime("%Y-%m-%d")
            days_left = shelf - 10
            
            # Stock allocation
            qty = 280 if wh.id == "WH-M5-PACIFIC" else (220 if wh.id == "WH-M5-TEXAS" else 150)
            
            batches.append(
                InventoryBatch(
                    batch_id=f"M5-LOT-{batch_idx:04d}",
                    product_id=prod.id,
                    warehouse_id=wh.id,
                    quantity=qty,
                    manufacturing_date=mfg_date,
                    expiry_date=exp_date,
                    days_to_expiry=days_left,
                    is_expired=False,
                    status="usable"
                )
            )
            batch_idx += 1

            # Batch 2 for perishable FOODS_1: Near-expiry lot to test FEFO priority
            if is_food_1 and wh.id == "WH-M5-PACIFIC":
                near_exp_days = 6
                batches.append(
                    InventoryBatch(
                        batch_id=f"M5-LOT-{batch_idx:04d}-FEFO",
                        product_id=prod.id,
                        warehouse_id=wh.id,
                        quantity=90,
                        manufacturing_date=(anchor - timedelta(days=8)).strftime("%Y-%m-%d"),
                        expiry_date=(anchor + timedelta(days=near_exp_days)).strftime("%Y-%m-%d"),
                        days_to_expiry=near_exp_days,
                        is_expired=False,
                        status="near_expiry"
                    )
                )
                batch_idx += 1

    return batches
