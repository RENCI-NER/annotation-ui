"""
Resolve CURIE names via the Translator Node Normalizer API.

Usage:
    from node_norm import resolve_names

    # Batch resolve
    names = resolve_names(["CHEBI:6801", "NCBIGene:836", "MONDO:0005148"])
    # -> {"CHEBI:6801": "metformin", "NCBIGene:836": "CASP3", "MONDO:0005148": "type 2 diabetes mellitus"}

    # Backfill existing edges in the database
    python node_norm.py --backfill
"""

import urllib.request
import json
import time
from typing import Optional


NODE_NORM_URL = "https://nodenormalization-sri.renci.org/get_normalized_nodes"
BATCH_SIZE = 100


def resolve_names(curies: list[str]) -> dict[str, Optional[str]]:
    """
    Resolve a list of CURIEs to their canonical labels via Node Normalizer.
    Returns a dict mapping CURIE -> label (or None if not found).
    Handles batching internally for large lists.
    """
    results: dict[str, Optional[str]] = {}

    for i in range(0, len(curies), BATCH_SIZE):
        batch = curies[i:i + BATCH_SIZE]
        batch_results = _resolve_batch(batch)
        results.update(batch_results)
        if i + BATCH_SIZE < len(curies):
            time.sleep(0.2)

    return results


def _resolve_batch(curies: list[str]) -> dict[str, Optional[str]]:
    payload = json.dumps({"curies": curies}).encode("utf-8")
    req = urllib.request.Request(
        NODE_NORM_URL,
        data=payload,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )

    results: dict[str, Optional[str]] = {c: None for c in curies}

    try:
        resp = urllib.request.urlopen(req, timeout=30)
        data = json.loads(resp.read().decode("utf-8"))

        for curie in curies:
            node_info = data.get(curie)
            if node_info and node_info.get("id"):
                label = node_info["id"].get("label")
                if label:
                    results[curie] = label
    except Exception as e:
        print(f"  Node Normalizer error: {e}")

    return results


def backfill_names():
    """Backfill subject_name and object_name for edges missing them."""
    from database import SessionLocal
    import models

    db = SessionLocal()

    edges = db.query(models.TmkpEdge).filter(
        (models.TmkpEdge.subject_name.is_(None)) | (models.TmkpEdge.object_name.is_(None))
    ).all()

    if not edges:
        print("All edges already have names.")
        db.close()
        return

    print(f"Found {len(edges)} edges needing name resolution...")

    all_curies = set()
    for edge in edges:
        if not edge.subject_name:
            all_curies.add(edge.subject_id)
        if not edge.object_name:
            all_curies.add(edge.object_id)

    print(f"Resolving {len(all_curies)} unique CURIEs...")
    names = resolve_names(list(all_curies))

    resolved = sum(1 for v in names.values() if v is not None)
    print(f"  Resolved {resolved}/{len(all_curies)} CURIEs")

    updated = 0
    for edge in edges:
        changed = False
        if not edge.subject_name and names.get(edge.subject_id):
            edge.subject_name = names[edge.subject_id]
            changed = True
        if not edge.object_name and names.get(edge.object_id):
            edge.object_name = names[edge.object_id]
            changed = True
        if changed:
            updated += 1

    db.commit()
    db.close()
    print(f"Updated {updated} edges with resolved names.")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Node Normalizer utilities")
    parser.add_argument("--backfill", action="store_true", help="Backfill names for edges missing them")
    parser.add_argument("--test", nargs="+", help="Test resolution for given CURIEs")
    args = parser.parse_args()

    if args.backfill:
        backfill_names()
    elif args.test:
        results = resolve_names(args.test)
        for curie, name in results.items():
            print(f"  {curie} -> {name or '(not found)'}")
    else:
        parser.print_help()
