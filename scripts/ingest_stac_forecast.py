#!/usr/bin/env python3
"""
Ingest forecast-7day-PRED and forecast-7day-GRND layers into PgSTAC
as STAC collections and items.
"""

import json
import os
import re
import sys
import tempfile
from datetime import datetime, timezone

import rasterio
from rasterio.warp import transform_bounds
from pypgstac.db import PgstacDB
from pypgstac.load import Loader, Methods

DSN = os.environ.get(
    "PGSTAC_DSN",
    "postgresql://user:password@localhost:54843/mmgis-stac",
)

MISSIONS_DIR = os.path.join(os.path.dirname(__file__), "..", "Missions", "frozon", "Layers")

LAYERS = [
    {
        "collection_id": "forecast-7day-PRED",
        "title": "SNFO Prediction Daily 10 km 2022-2024",
        "description": "Sea ice concentration AI prediction (SFNO model) at 10 km resolution",
        "dir": os.path.join(MISSIONS_DIR, "forecast-7day-PRED"),
        "pattern": r"NSIDC_SICONC_AI_PRED_(\d{8})\.tif$",
    },
    {
        "collection_id": "forecast-7day-GRND",
        "title": "SNFO Ground Truth Daily 10 km 2022-2024",
        "description": "Sea ice concentration ground truth (NSIDC) at 10 km resolution",
        "dir": os.path.join(MISSIONS_DIR, "forecast-7day-GRND"),
        "pattern": r"NSIDC_SICONC_AI_GRND_(\d{8})\.tif$",
    },
]

# The asset href needs to be a path that TiTiler can access.
# In docker, Missions/ is mounted at /Missions/
ASSET_PREFIX = "/Missions/frozon/Layers"


def parse_date(datestr):
    return datetime.strptime(datestr, "%Y%m%d").replace(tzinfo=timezone.utc)


def get_bbox_4326(filepath):
    """Get bounding box in EPSG:4326 from any CRS."""
    with rasterio.open(filepath) as src:
        bounds = transform_bounds(src.crs, "EPSG:4326", *src.bounds)
        return list(bounds)  # [west, south, east, north]


def make_collection(layer_info, bbox, temporal_extent):
    return {
        "type": "Collection",
        "id": layer_info["collection_id"],
        "stac_version": "1.0.0",
        "title": layer_info["title"],
        "description": layer_info["description"],
        "license": "proprietary",
        "extent": {
            "spatial": {"bbox": [bbox]},
            "temporal": {
                "interval": [
                    [
                        temporal_extent[0].isoformat(),
                        temporal_extent[1].isoformat(),
                    ]
                ]
            },
        },
        "links": [],
    }


def make_item(collection_id, filepath, filename, date_dt, bbox):
    item_id = os.path.splitext(filename)[0]
    dt_str = date_dt.isoformat()
    asset_href = f"{ASSET_PREFIX}/{collection_id}/{filename}"

    # Geometry as a simple bbox polygon
    west, south, east, north = bbox
    geometry = {
        "type": "Polygon",
        "coordinates": [
            [
                [west, south],
                [east, south],
                [east, north],
                [west, north],
                [west, south],
            ]
        ],
    }

    return {
        "type": "Feature",
        "stac_version": "1.0.0",
        "id": item_id,
        "collection": collection_id,
        "geometry": geometry,
        "bbox": bbox,
        "properties": {
            "datetime": dt_str,
        },
        "links": [],
        "assets": {
            "asset": {
                "href": asset_href,
                "type": "image/tiff; application=geotiff",
                "roles": ["data"],
            }
        },
    }


def process_layer(layer_info):
    layer_dir = layer_info["dir"]
    collection_id = layer_info["collection_id"]
    pattern = re.compile(layer_info["pattern"])

    files = sorted(os.listdir(layer_dir))
    tif_files = []
    for f in files:
        m = pattern.match(f)
        if m:
            tif_files.append((f, m.group(1)))

    if not tif_files:
        print(f"  No matching files in {layer_dir}")
        return None, []

    print(f"  Found {len(tif_files)} files")

    # Get bbox from first file (all should be same extent)
    sample_path = os.path.join(layer_dir, tif_files[0][0])
    bbox = get_bbox_4326(sample_path)
    print(f"  BBox (EPSG:4326): {bbox}")

    # Parse all dates
    dates = [parse_date(datestr) for _, datestr in tif_files]
    temporal_extent = (min(dates), max(dates))
    print(f"  Time range: {temporal_extent[0].date()} to {temporal_extent[1].date()}")

    # Build collection
    collection = make_collection(layer_info, bbox, temporal_extent)

    # Build items
    items = []
    for filename, datestr in tif_files:
        filepath = os.path.join(layer_dir, filename)
        date_dt = parse_date(datestr)
        item = make_item(collection_id, filepath, filename, date_dt, bbox)
        items.append(item)

    return collection, items


def main():
    print(f"Connecting to PgSTAC: {DSN}")

    all_collections = []
    all_items = []

    for layer_info in LAYERS:
        print(f"\nProcessing: {layer_info['collection_id']}")
        collection, items = process_layer(layer_info)
        if collection:
            all_collections.append(collection)
            all_items.extend(items)

    if not all_collections:
        print("No data to ingest.")
        sys.exit(1)

    print(f"\nIngesting {len(all_collections)} collections and {len(all_items)} items...")

    with PgstacDB(dsn=DSN) as db:
        loader = Loader(db=db)

        # Load collections via temp file
        for col in all_collections:
            print(f"  Collection: {col['id']}")
            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".json", delete=False
            ) as f:
                # Write one collection per line (ndjson)
                f.write(json.dumps(col) + "\n")
                f.flush()
                loader.load_collections(
                    file=f.name,
                    insert_mode=Methods.upsert,
                )
                os.unlink(f.name)

        # Load items in batches via temp file
        batch_size = 200
        for i in range(0, len(all_items), batch_size):
            batch = all_items[i : i + batch_size]
            print(f"  Items batch {i // batch_size + 1}: {len(batch)} items")
            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".json", delete=False
            ) as f:
                for item in batch:
                    f.write(json.dumps(item) + "\n")
                f.flush()
                loader.load_items(
                    file=f.name,
                    insert_mode=Methods.upsert,
                )
                os.unlink(f.name)

    print("\nDone! Verifying...")

    # Verify
    with PgstacDB(dsn=DSN) as db:
        with db.connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM pgstac.collections;")
                cols = [r[0] for r in cur.fetchall()]
                print(f"  Collections: {cols}")

                cur.execute("SELECT collection, count(*) FROM pgstac.items GROUP BY collection;")
                for row in cur.fetchall():
                    print(f"  Items in '{row[0]}': {row[1]}")

    print("\nSTAC ingestion complete!")


if __name__ == "__main__":
    main()
