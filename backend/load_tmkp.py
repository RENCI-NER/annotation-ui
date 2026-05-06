"""
Load TMKP edges from a local JSONL file or stream directly from a URL.

Supports filtering by confidence range, predicate, entity prefix, and
stratified sampling across confidence tiers so the review queue is
representative rather than skewed toward whatever the file happens to
list first.

Usage:
    # Stream from URL (no download required)
    python load_tmkp.py https://kgx-storage.rtx.ai/.../tmkp_edges.jsonl --limit 2000

    # Local file
    python load_tmkp.py tmkp_edges.jsonl --limit 5000

    # Filter: only edges in the 40-85% confidence band (most valuable to verify)
    python load_tmkp.py tmkp_edges.jsonl --limit 3000 --min-confidence 0.4 --max-confidence 0.85

    # Filter: only edges with a specific predicate
    python load_tmkp.py tmkp_edges.jsonl --limit 2000 --predicate biolink:affects

    # Filter: only edges whose subject starts with DRUGBANK
    python load_tmkp.py tmkp_edges.jsonl --limit 1000 --subject-prefix DRUGBANK

    # Stratified: sample evenly across confidence tiers
    python load_tmkp.py tmkp_edges.jsonl --limit 2000 --stratified

    # Scan-only: just print stats about the file without loading anything
    python load_tmkp.py tmkp_edges.jsonl --scan --scan-lines 50000
"""

import argparse
import json
import random
import sys
import urllib.request
from collections import Counter, defaultdict
from database import SessionLocal, engine
import models
from node_norm import resolve_names

models.Base.metadata.create_all(bind=engine)

CONFIDENCE_TIERS = [
    (0.0, 0.3, "low (0-30%)"),
    (0.3, 0.5, "below-mid (30-50%)"),
    (0.5, 0.7, "mid (50-70%)"),
    (0.7, 0.85, "above-mid (70-85%)"),
    (0.85, 1.01, "high (85-100%)"),
]


def open_source(source: str):
    """Return an iterable of lines from a local file or URL."""
    if source.startswith("http://") or source.startswith("https://"):
        print(f"Streaming from URL: {source}")
        req = urllib.request.Request(source, headers={"User-Agent": "tmkp-loader/1.0"})
        resp = urllib.request.urlopen(req, timeout=60)
        for raw_line in resp:
            yield raw_line.decode("utf-8", errors="replace")
        resp.close()
    else:
        print(f"Reading local file: {source}")
        with open(source, "r") as f:
            yield from f


def confidence_tier(score: float) -> str:
    for lo, hi, label in CONFIDENCE_TIERS:
        if lo <= score < hi:
            return label
    return "unknown"


def passes_filters(data: dict, args) -> bool:
    score = data.get("has_confidence_score", 0.0)
    if score < args.min_confidence or score > args.max_confidence:
        return False

    if args.predicate:
        if data.get("predicate", "") != args.predicate:
            return False

    if args.subject_prefix:
        subj = data.get("subject", "")
        if not subj.startswith(args.subject_prefix):
            return False

    if args.object_prefix:
        obj = data.get("object", "")
        if not obj.startswith(args.object_prefix):
            return False

    if args.category:
        cats = data.get("category", [])
        if not any(args.category in c for c in cats):
            return False

    return True


def ingest_edge(data: dict, db) -> bool:
    edge_id = data.get("id", "")
    if not edge_id:
        return False

    existing = db.query(models.TmkpEdge).filter(models.TmkpEdge.edge_id == edge_id).first()
    if existing:
        return False

    category_list = data.get("category", [])
    category = category_list[0] if category_list else None

    edge = models.TmkpEdge(
        edge_id=edge_id,
        category=category,
        subject_id=data.get("subject", ""),
        predicate=data.get("predicate", ""),
        object_id=data.get("object", ""),
        qualified_predicate=data.get("qualified_predicate"),
        object_aspect_qualifier=data.get("object_aspect_qualifier"),
        object_direction_qualifier=data.get("object_direction_qualifier"),
        confidence_score=data.get("has_confidence_score", 0.0),
        evidence_count=data.get("evidence_count", 1),
        knowledge_level=data.get("knowledge_level"),
        agent_type=data.get("agent_type"),
    )
    db.add(edge)
    db.flush()

    studies = data.get("has_supporting_studies", {})
    for study_id, study in studies.items():
        for result in study.get("has_study_results", []):
            texts = result.get("supporting_text", [])
            subj_loc = result.get("subject_location_in_text", [0, 0])
            obj_loc = result.get("object_location_in_text", [0, 0])
            pubs = result.get("xref", data.get("publications", []))

            for text in texts:
                ev = models.TmkpEvidence(
                    edge_db_id=edge.id,
                    study_id=study_id,
                    result_id=result.get("id"),
                    publication=pubs[0] if pubs else "",
                    supporting_text=text,
                    subject_start=subj_loc[0] if len(subj_loc) > 0 else 0,
                    subject_end=subj_loc[1] if len(subj_loc) > 1 else 0,
                    object_start=obj_loc[0] if len(obj_loc) > 0 else 0,
                    object_end=obj_loc[1] if len(obj_loc) > 1 else 0,
                    extraction_confidence=result.get("extraction_confidence_score", 0.0),
                    document_year=result.get("supporting_document_year"),
                    section_type=result.get("supporting_text_section_type"),
                )
                db.add(ev)

    return True


# ── Scan mode ────────────────────────────────────────────────────────────────

def scan_source(source: str, max_lines: int):
    """Print statistics about the JSONL without loading anything."""
    print(f"\nScanning {source} (up to {max_lines:,} lines)...\n")

    predicate_counts = Counter()
    category_counts = Counter()
    subject_prefix_counts = Counter()
    object_prefix_counts = Counter()
    tier_counts = Counter()
    total = 0
    parse_errors = 0

    for line in open_source(source):
        line = line.strip()
        if not line:
            continue
        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            parse_errors += 1
            continue

        total += 1
        predicate_counts[data.get("predicate", "?")] += 1
        cats = data.get("category", [])
        if cats:
            category_counts[cats[0]] += 1
        subj = data.get("subject", "")
        obj = data.get("object", "")
        subject_prefix_counts[subj.split(":")[0] if ":" in subj else subj] += 1
        object_prefix_counts[obj.split(":")[0] if ":" in obj else obj] += 1
        tier_counts[confidence_tier(data.get("has_confidence_score", 0.0))] += 1

        if total >= max_lines:
            break
        if total % 50000 == 0:
            print(f"  scanned {total:,} lines...")

    print(f"\n{'='*60}")
    print(f"  Scanned {total:,} edges ({parse_errors} parse errors)")
    print(f"{'='*60}")

    print(f"\n  Confidence distribution:")
    for _, _, label in CONFIDENCE_TIERS:
        c = tier_counts.get(label, 0)
        pct = c / total * 100 if total else 0
        bar = "█" * int(pct / 2)
        print(f"    {label:25s}  {c:>8,}  ({pct:5.1f}%)  {bar}")

    print(f"\n  Top 15 predicates:")
    for pred, c in predicate_counts.most_common(15):
        print(f"    {pred:45s}  {c:>8,}")

    print(f"\n  Subject prefixes (top 10):")
    for pfx, c in subject_prefix_counts.most_common(10):
        print(f"    {pfx:25s}  {c:>8,}")

    print(f"\n  Object prefixes (top 10):")
    for pfx, c in object_prefix_counts.most_common(10):
        print(f"    {pfx:25s}  {c:>8,}")

    print(f"\n  Categories (top 10):")
    for cat, c in category_counts.most_common(10):
        print(f"    {cat:55s}  {c:>8,}")

    print()


# ── Load modes ───────────────────────────────────────────────────────────────

def load_filtered(source: str, args):
    """Load edges that pass the filters, up to --limit."""
    db = SessionLocal()
    added = 0
    skipped = 0
    errors = 0
    scanned = 0

    limit = args.limit
    filters_active = (
        args.min_confidence > 0.0
        or args.max_confidence < 1.0
        or args.predicate
        or args.subject_prefix
        or args.object_prefix
        or args.category
    )

    print(f"\nLoading edges (limit={limit or 'none'})...")
    if filters_active:
        parts = []
        if args.min_confidence > 0.0 or args.max_confidence < 1.0:
            parts.append(f"confidence {args.min_confidence:.2f}-{args.max_confidence:.2f}")
        if args.predicate:
            parts.append(f"predicate={args.predicate}")
        if args.subject_prefix:
            parts.append(f"subject={args.subject_prefix}:*")
        if args.object_prefix:
            parts.append(f"object={args.object_prefix}:*")
        if args.category:
            parts.append(f"category=*{args.category}*")
        print(f"  Filters: {', '.join(parts)}")

    for line in open_source(source):
        if limit and added >= limit:
            break

        line = line.strip()
        if not line:
            continue
        scanned += 1

        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            errors += 1
            continue

        if not passes_filters(data, args):
            skipped += 1
            continue

        try:
            if ingest_edge(data, db):
                added += 1
            else:
                skipped += 1
        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"  Error: {e}")

        if added % 500 == 0 and added > 0:
            db.commit()
            print(f"  {added:,} added / {scanned:,} scanned ({skipped:,} filtered, {errors} errors)")

    db.commit()
    db.close()
    print(f"\nDone: {added:,} added, {skipped:,} filtered out, {errors} errors (scanned {scanned:,} lines)")

    if added > 0 and not args.skip_names:
        print("\nResolving entity names via Node Normalizer...")
        from node_norm import backfill_names
        backfill_names()


def load_stratified(source: str, args):
    """
    Reservoir-sample edges into confidence tiers, then load an equal
    number from each tier. Single pass — works on streams and huge files.
    """
    limit = args.limit or 2000
    per_tier = limit // len(CONFIDENCE_TIERS)

    print(f"\nStratified sampling: {per_tier} edges per tier, {len(CONFIDENCE_TIERS)} tiers, ~{per_tier * len(CONFIDENCE_TIERS)} total")
    if args.min_confidence > 0.0 or args.max_confidence < 1.0:
        print(f"  (confidence filter {args.min_confidence:.2f}-{args.max_confidence:.2f} still applied)")

    reservoirs: dict[str, list] = {label: [] for _, _, label in CONFIDENCE_TIERS}
    tier_seen: dict[str, int] = {label: 0 for _, _, label in CONFIDENCE_TIERS}
    scanned = 0
    errors = 0

    print(f"  Pass 1: scanning and sampling...")
    for line in open_source(source):
        line = line.strip()
        if not line:
            continue
        scanned += 1

        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            errors += 1
            continue

        if not passes_filters(data, args):
            continue

        tier = confidence_tier(data.get("has_confidence_score", 0.0))
        if tier not in reservoirs:
            continue

        tier_seen[tier] += 1
        n = tier_seen[tier]

        if len(reservoirs[tier]) < per_tier:
            reservoirs[tier].append(data)
        else:
            j = random.randint(0, n - 1)
            if j < per_tier:
                reservoirs[tier][j] = data

        if scanned % 100000 == 0:
            print(f"    scanned {scanned:,}...")

    print(f"  Scanned {scanned:,} lines ({errors} parse errors)")
    print(f"\n  Tier distribution in source:")
    for _, _, label in CONFIDENCE_TIERS:
        seen = tier_seen.get(label, 0)
        sampled = len(reservoirs.get(label, []))
        print(f"    {label:25s}  seen={seen:>8,}  sampled={sampled}")

    print(f"\n  Pass 2: loading {sum(len(v) for v in reservoirs.values())} edges into database...")
    db = SessionLocal()
    added = 0
    for _, _, label in CONFIDENCE_TIERS:
        for data in reservoirs[label]:
            try:
                if ingest_edge(data, db):
                    added += 1
            except Exception as e:
                if added < 5:
                    print(f"    Error: {e}")

        db.commit()

    db.close()
    print(f"\nDone: {added:,} edges loaded across {len(CONFIDENCE_TIERS)} tiers")

    if added > 0 and not args.skip_names:
        print("\nResolving entity names via Node Normalizer...")
        from node_norm import backfill_names
        backfill_names()


# ── CLI ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Load TMKP edges from a JSONL file or URL into the database.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Scan a URL to see what's in it (no loading)
  python load_tmkp.py https://kgx-storage.rtx.ai/.../tmkp_edges.jsonl --scan

  # Stream 2000 low-confidence edges from a URL
  python load_tmkp.py https://...jsonl --limit 2000 --max-confidence 0.85

  # Load from local file with stratified sampling
  python load_tmkp.py tmkp_edges.jsonl --limit 3000 --stratified

  # Only DRUGBANK subjects with biolink:affects predicate
  python load_tmkp.py tmkp_edges.jsonl --limit 1000 --subject-prefix DRUGBANK --predicate biolink:affects
        """,
    )
    parser.add_argument("source", help="Path to JSONL file or URL")
    parser.add_argument("--limit", type=int, default=None, help="Max edges to load")
    parser.add_argument("--min-confidence", type=float, default=0.0, help="Min confidence score (default 0.0)")
    parser.add_argument("--max-confidence", type=float, default=1.0, help="Max confidence score (default 1.0)")
    parser.add_argument("--predicate", type=str, default=None, help="Only edges with this predicate (e.g. biolink:affects)")
    parser.add_argument("--subject-prefix", type=str, default=None, help="Only edges whose subject starts with this (e.g. DRUGBANK)")
    parser.add_argument("--object-prefix", type=str, default=None, help="Only edges whose object starts with this (e.g. UniProtKB)")
    parser.add_argument("--category", type=str, default=None, help="Only edges whose category contains this string")
    parser.add_argument("--stratified", action="store_true", help="Reservoir-sample evenly across confidence tiers")
    parser.add_argument("--scan", action="store_true", help="Scan only — print stats without loading")
    parser.add_argument("--scan-lines", type=int, default=200000, help="Lines to scan in --scan mode (default 200000)")
    parser.add_argument("--skip-names", action="store_true", help="Skip Node Normalizer name resolution after loading")

    args = parser.parse_args()

    if args.scan:
        scan_source(args.source, args.scan_lines)
    elif args.stratified:
        load_stratified(args.source, args)
    else:
        load_filtered(args.source, args)


if __name__ == "__main__":
    main()
