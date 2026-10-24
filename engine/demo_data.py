"""
SupplySync Reproducible FMCG Demonstration Dataset Generator
Deterministic synthetic dataset capturing realistic FMCG supply chain challenges:
- Perishable dairy & beverage products with FEFO urgency and expired batches
- Network-wide scarce products where demand strictly exceeds supply
- Route capacities and asymmetric transportation tariffs
- Distinct regional hubs (Mumbai, Delhi-NCR, Bengaluru, Kolkata) and retail destinations
"""

import random
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple
from .models import (
    Product, 
    Warehouse, 
    Destination, 
    InventoryBatch, 
    Route, 
    DemandRecord
)

# Reference simulation anchor date
SIMULATION_DATE = datetime(2026, 10, 24)


def get_demo_products() -> List[Product]:
    return [
        Product(
            id="PROD-001",
            name="Organic Whole Milk 1L",
            category="Dairy & Beverages",
            uom="cartons",
            unit_weight_kg=1.05,
            shelf_life_days=14,
            holding_cost_per_day=0.15,
            shortage_penalty_per_unit=35.0,
            min_shelf_life_required_days=3
        ),
        Product(
            id="PROD-002",
            name="Fortified Whole Wheat Flour 5kg",
            category="Staples & Grains",
            uom="bags",
            unit_weight_kg=5.0,
            shelf_life_days=120,
            holding_cost_per_day=0.08,
            shortage_penalty_per_unit=45.0,
            min_shelf_life_required_days=15
        ),
        Product(
            id="PROD-003",
            name="Roasted Masala Cashews 200g",
            category="Packaged Snacks",
            uom="pouches",
            unit_weight_kg=0.22,
            shelf_life_days=60,
            holding_cost_per_day=0.04,
            shortage_penalty_per_unit=20.0,
            min_shelf_life_required_days=10
        ),
        Product(
            id="PROD-004",
            name="Cold-Pressed Virgin Coconut Oil 500ml",
            category="Edible Oils (Scarce)",
            uom="bottles",
            unit_weight_kg=0.55,
            shelf_life_days=180,
            holding_cost_per_day=0.10,
            shortage_penalty_per_unit=60.0,  # High penalty for scarce premium SKU
            min_shelf_life_required_days=20
        ),
        Product(
            id="PROD-005",
            name="Antibacterial Herbal Handwash 250ml",
            category="Personal Care",
            uom="units",
            unit_weight_kg=0.30,
            shelf_life_days=365,
            holding_cost_per_day=0.03,
            shortage_penalty_per_unit=18.0,
            min_shelf_life_required_days=30
        )
    ]


def get_demo_warehouses() -> List[Warehouse]:
    return [
        Warehouse(
            id="WH-MUMBAI",
            name="Western Regional DC (Bhiwandi)",
            city="Mumbai",
            state="Maharashtra",
            latitude=19.2967,
            longitude=73.0631,
            storage_capacity_units=150000
        ),
        Warehouse(
            id="WH-DELHI",
            name="Northern Mega Fulfillment Center",
            city="Gurugram",
            state="Haryana",
            latitude=28.4595,
            longitude=77.0266,
            storage_capacity_units=200000
        ),
        Warehouse(
            id="WH-BLR",
            name="Southern Distribution Hub",
            city="Bengaluru",
            state="Karnataka",
            latitude=12.9716,
            longitude=77.5946,
            storage_capacity_units=120000
        ),
        Warehouse(
            id="WH-KOLKATA",
            name="Eastern Gateway Warehouse",
            city="Kolkata",
            state="West Bengal",
            latitude=22.5726,
            longitude=88.3639,
            storage_capacity_units=100000
        )
    ]


def get_demo_destinations() -> List[Destination]:
    return [
        Destination(
            id="DEST-PUNE",
            name="Pune Metro Hypermarket Cluster",
            city="Pune",
            state="Maharashtra",
            latitude=18.5204,
            longitude=73.8567,
            tier="Tier-1",
            service_level_target=0.98
        ),
        Destination(
            id="DEST-AHMEDABAD",
            name="Gujarat Central Wholesale Depot",
            city="Ahmedabad",
            state="Gujarat",
            latitude=23.0225,
            longitude=72.5714,
            tier="Tier-1",
            service_level_target=0.95
        ),
        Destination(
            id="DEST-JAIPUR",
            name="Rajasthan FMCG Distributors",
            city="Jaipur",
            state="Rajasthan",
            latitude=26.9124,
            longitude=75.7873,
            tier="Tier-2",
            service_level_target=0.90
        ),
        Destination(
            id="DEST-CHANDIGARH",
            name="Punjab & Haryana Retail Network",
            city="Chandigarh",
            state="Punjab",
            latitude=30.7333,
            longitude=76.7794,
            tier="Tier-1",
            service_level_target=0.96
        ),
        Destination(
            id="DEST-HYDERABAD",
            name="Deccan Retail Superstores",
            city="Hyderabad",
            state="Telangana",
            latitude=17.3850,
            longitude=78.4867,
            tier="Tier-1",
            service_level_target=0.95
        ),
        Destination(
            id="DEST-CHENNAI",
            name="Tamil Nadu Modern Trade Hub",
            city="Chennai",
            state="Tamil Nadu",
            latitude=13.0827,
            longitude=80.2707,
            tier="Tier-1",
            service_level_target=0.95
        ),
        Destination(
            id="DEST-PATNA",
            name="Bihar Distribution Consortium",
            city="Patna",
            state="Bihar",
            latitude=25.5941,
            longitude=85.1376,
            tier="Tier-2",
            service_level_target=0.88
        ),
        Destination(
            id="DEST-BHUBANESWAR",
            name="Odisha Coastal Retailers",
            city="Bhubaneswar",
            state="Odisha",
            latitude=20.2961,
            longitude=85.8245,
            tier="Tier-2",
            service_level_target=0.90
        )
    ]


def get_demo_inventory_batches() -> List[InventoryBatch]:
    """
    Realistic inventory batches with deterministic expiry schedules.
    Includes:
    - BATCH-MILK-EXP: Expired batch (must be flagged and unusable)
    - BATCH-MILK-01: Critical short expiry (4 days left)
    - BATCH-MILK-02: Normal expiry (11 days left)
    - Scarce product PROD-004 with limited stock across the entire network
    """
    batches = [
        # PROD-001 Organic Whole Milk (Highly Perishable)
        InventoryBatch(
            batch_id="BATCH-001-MUM-A",
            product_id="PROD-001",
            warehouse_id="WH-MUMBAI",
            quantity=1200,
            manufacturing_date="2026-10-20",
            expiry_date="2026-10-28",
            days_to_expiry=4,  # Near expiry! Needs FEFO prioritization
            is_expired=False,
            status="near_expiry"
        ),
        InventoryBatch(
            batch_id="BATCH-001-MUM-B",
            product_id="PROD-001",
            warehouse_id="WH-MUMBAI",
            quantity=2400,
            manufacturing_date="2026-10-23",
            expiry_date="2026-11-04",
            days_to_expiry=11,
            is_expired=False,
            status="usable"
        ),
        InventoryBatch(
            batch_id="BATCH-001-DEL-EXPIRED",
            product_id="PROD-001",
            warehouse_id="WH-DELHI",
            quantity=450,
            manufacturing_date="2026-10-05",
            expiry_date="2026-10-19",
            days_to_expiry=-5,  # EXPIRED! Invariant: must NEVER be shipped
            is_expired=True,
            status="expired"
        ),
        InventoryBatch(
            batch_id="BATCH-001-DEL-A",
            product_id="PROD-001",
            warehouse_id="WH-DELHI",
            quantity=3100,
            manufacturing_date="2026-10-22",
            expiry_date="2026-11-03",
            days_to_expiry=10,
            is_expired=False,
            status="usable"
        ),
        InventoryBatch(
            batch_id="BATCH-001-BLR-A",
            product_id="PROD-001",
            warehouse_id="WH-BLR",
            quantity=1800,
            manufacturing_date="2026-10-21",
            expiry_date="2026-10-30",
            days_to_expiry=6,
            is_expired=False,
            status="near_expiry"
        ),

        # PROD-002 Fortified Atta (Excess inventory at WH-DELHI & WH-KOLKATA)
        InventoryBatch(
            batch_id="BATCH-002-DEL-01",
            product_id="PROD-002",
            warehouse_id="WH-DELHI",
            quantity=6000,
            manufacturing_date="2026-09-01",
            expiry_date="2026-12-30",
            days_to_expiry=67,
            is_expired=False,
            status="usable"
        ),
        InventoryBatch(
            batch_id="BATCH-002-KOL-01",
            product_id="PROD-002",
            warehouse_id="WH-KOLKATA",
            quantity=4500,
            manufacturing_date="2026-08-15",
            expiry_date="2026-12-13",
            days_to_expiry=50,
            is_expired=False,
            status="usable"
        ),
        InventoryBatch(
            batch_id="BATCH-002-MUM-01",
            product_id="PROD-002",
            warehouse_id="WH-MUMBAI",
            quantity=1500,
            manufacturing_date="2026-09-10",
            expiry_date="2027-01-08",
            days_to_expiry=76,
            is_expired=False,
            status="usable"
        ),

        # PROD-003 Roasted Masala Cashews (High demand in Tier-1, short expiry batch at BLR)
        InventoryBatch(
            batch_id="BATCH-003-BLR-URGENT",
            product_id="PROD-003",
            warehouse_id="WH-BLR",
            quantity=800,
            manufacturing_date="2026-09-15",
            expiry_date="2026-11-08",
            days_to_expiry=15,  # Approaching expiry
            is_expired=False,
            status="near_expiry"
        ),
        InventoryBatch(
            batch_id="BATCH-003-DEL-01",
            product_id="PROD-003",
            warehouse_id="WH-DELHI",
            quantity=2200,
            manufacturing_date="2026-10-01",
            expiry_date="2026-11-30",
            days_to_expiry=37,
            is_expired=False,
            status="usable"
        ),
        InventoryBatch(
            batch_id="BATCH-003-MUM-01",
            product_id="PROD-003",
            warehouse_id="WH-MUMBAI",
            quantity=1900,
            manufacturing_date="2026-10-10",
            expiry_date="2026-12-09",
            days_to_expiry=46,
            is_expired=False,
            status="usable"
        ),

        # PROD-004 SCARCE PRODUCT: Total available usable stock = 1,300 units vs Total Demand = 2,750 units!
        InventoryBatch(
            batch_id="BATCH-004-SCARCE-MUM",
            product_id="PROD-004",
            warehouse_id="WH-MUMBAI",
            quantity=500,
            manufacturing_date="2026-09-01",
            expiry_date="2027-02-28",
            days_to_expiry=127,
            is_expired=False,
            status="usable"
        ),
        InventoryBatch(
            batch_id="BATCH-004-SCARCE-BLR",
            product_id="PROD-004",
            warehouse_id="WH-BLR",
            quantity=800,
            manufacturing_date="2026-09-15",
            expiry_date="2027-03-14",
            days_to_expiry=141,
            is_expired=False,
            status="usable"
        ),

        # PROD-005 Antibacterial Herbal Handwash (Ample non-perishable stock)
        InventoryBatch(
            batch_id="BATCH-005-MUM-01",
            product_id="PROD-005",
            warehouse_id="WH-MUMBAI",
            quantity=3500,
            manufacturing_date="2026-08-01",
            expiry_date="2027-08-01",
            days_to_expiry=281,
            is_expired=False,
            status="usable"
        ),
        InventoryBatch(
            batch_id="BATCH-005-DEL-01",
            product_id="PROD-005",
            warehouse_id="WH-DELHI",
            quantity=4200,
            manufacturing_date="2026-07-15",
            expiry_date="2027-07-15",
            days_to_expiry=264,
            is_expired=False,
            status="usable"
        ),
        InventoryBatch(
            batch_id="BATCH-005-KOL-01",
            product_id="PROD-005",
            warehouse_id="WH-KOLKATA",
            quantity=2800,
            manufacturing_date="2026-08-20",
            expiry_date="2027-08-20",
            days_to_expiry=300,
            is_expired=False,
            status="usable"
        ),
    ]
    return batches


def get_demo_routes() -> List[Route]:
    """
    Realistic transportation matrix reflecting geographic corridors, unit freight costs,
    and bottleneck route capacities.
    """
    raw_routes = [
        # From WH-MUMBAI (West)
        ("WH-MUMBAI", "DEST-PUNE", 1.80, 150, 1, 2500),         # Local intra-state lane (High capacity)
        ("WH-MUMBAI", "DEST-AHMEDABAD", 3.20, 530, 2, 2000),    # Regional West corridor
        ("WH-MUMBAI", "DEST-JAIPUR", 6.50, 1150, 3, 1200),
        ("WH-MUMBAI", "DEST-CHANDIGARH", 9.80, 1650, 4, 800),
        ("WH-MUMBAI", "DEST-HYDERABAD", 5.20, 710, 2, 1500),
        ("WH-MUMBAI", "DEST-CHENNAI", 7.80, 1340, 3, 1000),
        ("WH-MUMBAI", "DEST-PATNA", 11.50, 1780, 4, 600),
        ("WH-MUMBAI", "DEST-BHUBANESWAR", 10.20, 1640, 4, 600),

        # From WH-DELHI (North)
        ("WH-DELHI", "DEST-PUNE", 8.90, 1450, 3, 1000),
        ("WH-DELHI", "DEST-AHMEDABAD", 6.20, 940, 2, 1200),
        ("WH-DELHI", "DEST-JAIPUR", 2.20, 280, 1, 3000),       # High volume local North
        ("WH-DELHI", "DEST-CHANDIGARH", 2.10, 250, 1, 3000),   # High volume local North
        ("WH-DELHI", "DEST-HYDERABAD", 9.50, 1580, 3, 800),
        ("WH-DELHI", "DEST-CHENNAI", 12.80, 2180, 4, 500),
        ("WH-DELHI", "DEST-PATNA", 5.80, 1080, 2, 1500),
        ("WH-DELHI", "DEST-BHUBANESWAR", 9.20, 1630, 3, 700),

        # From WH-BLR (South)
        ("WH-BLR", "DEST-PUNE", 5.40, 840, 2, 1400),
        ("WH-BLR", "DEST-AHMEDABAD", 9.00, 1490, 3, 800),
        ("WH-BLR", "DEST-JAIPUR", 11.20, 1950, 4, 500),
        ("WH-BLR", "DEST-CHANDIGARH", 13.50, 2380, 5, 400),
        ("WH-BLR", "DEST-HYDERABAD", 3.00, 570, 1, 2500),      # Fast Southern corridor
        ("WH-BLR", "DEST-CHENNAI", 2.00, 350, 1, 3500),        # High frequency local lane
        ("WH-BLR", "DEST-PATNA", 12.60, 2050, 4, 500),
        ("WH-BLR", "DEST-BHUBANESWAR", 8.40, 1430, 3, 800),

        # From WH-KOLKATA (East)
        ("WH-KOLKATA", "DEST-PUNE", 10.50, 1720, 4, 600),
        ("WH-KOLKATA", "DEST-AHMEDABAD", 11.80, 1920, 4, 500),
        ("WH-KOLKATA", "DEST-JAIPUR", 9.40, 1510, 3, 700),
        ("WH-KOLKATA", "DEST-CHANDIGARH", 10.80, 1680, 4, 500),
        ("WH-KOLKATA", "DEST-HYDERABAD", 8.10, 1480, 3, 800),
        ("WH-KOLKATA", "DEST-CHENNAI", 9.10, 1660, 3, 700),
        ("WH-KOLKATA", "DEST-PATNA", 2.90, 550, 1, 2800),       # High frequency East corridor
        ("WH-KOLKATA", "DEST-BHUBANESWAR", 2.40, 440, 1, 3000)  # Close coastal corridor
    ]

    routes = []
    for src, dst, cost, dist, days, cap in raw_routes:
        routes.append(
            Route(
                source_warehouse_id=src,
                destination_id=dst,
                unit_cost=cost,
                distance_km=dist,
                transit_time_days=days,
                max_capacity_units=cap
            )
        )
    return routes


def get_demo_demand_records() -> List[DemandRecord]:
    """
    Deterministic demand table across 8 destinations for 5 products.
    Includes deliberate operational challenges:
    - High demand for PROD-001 (Milk) in Pune (1,500) and Ahmedabad (1,000)
    - Heavy demand for PROD-004 (Virgin Coconut Oil) totaling 2,750 units against available network supply of 1,300 units!
    - High demand for staples in Northern / Eastern destinations
    """
    demand_matrix = [
        # DEST-PUNE
        ("DEST-PUNE", "PROD-001", 1500, 214.2),
        ("DEST-PUNE", "PROD-002", 1200, 171.4),
        ("DEST-PUNE", "PROD-003", 900, 128.5),
        ("DEST-PUNE", "PROD-004", 450, 64.2),   # Scarce SKU
        ("DEST-PUNE", "PROD-005", 1100, 157.1),

        # DEST-AHMEDABAD
        ("DEST-AHMEDABAD", "PROD-001", 1100, 157.1),
        ("DEST-AHMEDABAD", "PROD-002", 1400, 200.0),
        ("DEST-AHMEDABAD", "PROD-003", 850, 121.4),
        ("DEST-AHMEDABAD", "PROD-004", 350, 50.0),   # Scarce SKU
        ("DEST-AHMEDABAD", "PROD-005", 950, 135.7),

        # DEST-JAIPUR
        ("DEST-JAIPUR", "PROD-001", 800, 114.2),
        ("DEST-JAIPUR", "PROD-002", 1800, 257.1),
        ("DEST-JAIPUR", "PROD-003", 600, 85.7),
        ("DEST-JAIPUR", "PROD-004", 250, 35.7),   # Scarce SKU
        ("DEST-JAIPUR", "PROD-005", 800, 114.2),

        # DEST-CHANDIGARH
        ("DEST-CHANDIGARH", "PROD-001", 1300, 185.7),
        ("DEST-CHANDIGARH", "PROD-002", 2200, 314.2),
        ("DEST-CHANDIGARH", "PROD-003", 750, 107.1),
        ("DEST-CHANDIGARH", "PROD-004", 400, 57.1),  # Scarce SKU
        ("DEST-CHANDIGARH", "PROD-005", 1000, 142.8),

        # DEST-HYDERABAD
        ("DEST-HYDERABAD", "PROD-001", 950, 135.7),
        ("DEST-HYDERABAD", "PROD-002", 1300, 185.7),
        ("DEST-HYDERABAD", "PROD-003", 700, 100.0),
        ("DEST-HYDERABAD", "PROD-004", 350, 50.0),   # Scarce SKU
        ("DEST-HYDERABAD", "PROD-005", 1200, 171.4),

        # DEST-CHENNAI
        ("DEST-CHENNAI", "PROD-001", 1200, 171.4),
        ("DEST-CHENNAI", "PROD-002", 1100, 157.1),
        ("DEST-CHENNAI", "PROD-003", 800, 114.2),
        ("DEST-CHENNAI", "PROD-004", 500, 71.4),   # Scarce SKU
        ("DEST-CHENNAI", "PROD-005", 1400, 200.0),

        # DEST-PATNA
        ("DEST-PATNA", "PROD-001", 600, 85.7),
        ("DEST-PATNA", "PROD-002", 1900, 271.4),
        ("DEST-PATNA", "PROD-003", 450, 64.2),
        ("DEST-PATNA", "PROD-004", 250, 35.7),   # Scarce SKU
        ("DEST-PATNA", "PROD-005", 750, 107.1),

        # DEST-BHUBANESWAR
        ("DEST-BHUBANESWAR", "PROD-001", 550, 78.5),
        ("DEST-BHUBANESWAR", "PROD-002", 1100, 157.1),
        ("DEST-BHUBANESWAR", "PROD-003", 400, 57.1),
        ("DEST-BHUBANESWAR", "PROD-004", 200, 28.5),  # Scarce SKU
        ("DEST-BHUBANESWAR", "PROD-005", 650, 92.8)
    ]

    records = []
    for dst, prod, fc_demand, avg_daily in demand_matrix:
        records.append(
            DemandRecord(
                destination_id=dst,
                product_id=prod,
                forecasted_demand=fc_demand,
                historical_avg_daily=avg_daily,
                confidence_interval_pct=0.92
            )
        )
    return records
