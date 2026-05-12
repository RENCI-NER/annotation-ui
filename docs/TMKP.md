# TMKP Verification — Evidence-Level Fact-Checking

Fact-check text-mined knowledge graph edges from the [Text Mining Knowledge Provider](https://kgx-storage.rtx.ai/data/tmkp/). Each (edge, evidence) pair is a separate annotation item — an edge with 2 supporting texts produces 2 items to review.

## Features

- Five verdict actions: Correct, Swap S/O, Wrong Predicate, Wrong Subject, Wrong Object
- Multi-select verdicts: all non-correct verdicts are combinable (e.g. swap_so + wrong_predicate)
- Correct is exclusive — selecting it auto-submits immediately
- Optional correction inputs for wrong subject/object/predicate (not required)
- Supporting text display with highlighted subject/object character spans
- Entity names resolved via the [Node Normalizer](https://nodenormalization-sri.renci.org) API
- Batch-based workflow: 100 items per batch with visual progress strip
- Evidences grouped by edge so you review all evidence for one triple before moving on
- Dual-annotator targeting for inter-annotator agreement
- Per-annotator item caps (admin-configurable)

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `C` | Correct (auto-submits) |
| `S` | Toggle Swap Subject/Object |
| `W` | Toggle Wrong Predicate |
| `U` | Toggle Wrong Subject |
| `O` | Toggle Wrong Object |
| `Enter` | Submit selected verdicts |

## Annotator Workflow

1. Go to `/tmkp-triples` and log in with your first and last name
2. A batch of 100 items loads automatically (grouped by edge)
3. Review the edge assertion (subject, predicate, object) and any qualifiers
4. Read the supporting text — subject is highlighted in blue, object in red
5. Click Correct to auto-submit, or toggle one or more other verdicts then double-click or press Enter to submit
6. Correction fields appear when relevant but are optional
7. The progress strip shows answered (colored) vs. unanswered (gray) items; click any dot to jump
8. After completing a batch, click "Load Next Batch" for more
9. Switch to Review mode to revisit your previous answers

## Loading Data

```bash
cd backend

# Basic load from local file
python load_tmkp.py /path/to/tmkp_edges.jsonl --limit 5000

# Stream from URL (no download required)
python load_tmkp.py https://kgx-storage.rtx.ai/.../tmkp_edges.jsonl --limit 2000

# Filter by confidence range (most valuable to verify)
python load_tmkp.py tmkp_edges.jsonl --limit 3000 --min-confidence 0.4 --max-confidence 0.85

# Filter by predicate or entity prefix
python load_tmkp.py tmkp_edges.jsonl --limit 1000 --predicate biolink:affects
python load_tmkp.py tmkp_edges.jsonl --limit 1000 --subject-prefix DRUGBANK

# Stratified sampling across confidence tiers
python load_tmkp.py tmkp_edges.jsonl --limit 2000 --stratified

# Scan file stats without loading anything
python load_tmkp.py tmkp_edges.jsonl --scan

# Backfill entity names if needed
python node_norm.py --backfill
```

### Edge Format (JSONL, one per line)
```json
{
  "id": "urn:uuid:...",
  "category": ["biolink:ChemicalAffectsGeneAssociation"],
  "subject": "DRUGBANK:DB00163",
  "predicate": "biolink:affects",
  "object": "UniProtKB:P47712",
  "publications": ["PMC3065441"],
  "has_supporting_studies": {
    "urn:uuid:...": {
      "has_study_results": [{
        "supporting_text": ["The supporting sentence..."],
        "subject_location_in_text": [50, 59],
        "object_location_in_text": [112, 138],
        "extraction_confidence_score": 0.80
      }]
    }
  },
  "has_confidence_score": 0.80,
  "evidence_count": 1,
  "object_aspect_qualifier": "activity_or_abundance",
  "object_direction_qualifier": "decreased",
  "qualified_predicate": "biolink:causes"
}
```

## Database Tables

| Table | Purpose |
|-------|---------|
| `tmkp_edges` | Knowledge graph edges (subject/object IDs and names, predicate, qualifiers, confidence) |
| `tmkp_evidences` | Supporting text snippets with character offsets and publication refs |
| `tmkp_verifications` | Annotator verdicts per (edge, evidence) pair with optional corrections |
| `tmkp_annotator_limits` | Per-annotator item caps set by admin |
