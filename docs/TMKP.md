# TMKP Verification — Evidence-Level Fact-Checking

Fact-check text-mined knowledge graph edges from the [Text Mining Knowledge Provider](https://kgx-storage.rtx.ai/data/tmkp/). Each (edge, evidence) pair is a separate annotation item — an edge with 2 supporting texts produces 2 items to review.

## Features

- Five verdict actions: Correct, Swap S/O, Wrong Predicate, Wrong Subject, Wrong Object
- Multi-select verdicts: all non-correct verdicts are combinable (e.g. swap_so + wrong_predicate)
- Correct is exclusive — selecting it auto-submits immediately
- Optional correction inputs for wrong subject/object/predicate (not required)
- Supporting text display with highlighted subject/object character spans
- Entity names resolved via [Node Normalizer](https://nodenormalization-sri.renci.org); suggested CURIEs via [Name Resolver](https://name-resolution-sri.renci.org) when in-text name doesn't match
- Clickable predicate showing Biolink model description
- Batch-based workflow: 100 items per batch with visual progress strip
- Evidences grouped by edge so you review all evidence for one triple before moving on
- Dual-annotator targeting for inter-annotator agreement
- Per-annotator item caps (admin-configurable)

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Shift+C` | Correct (auto-submits) |
| `Shift+S` | Toggle Swap Subject/Object |
| `Shift+W` | Toggle Wrong Predicate |
| `Shift+U` | Toggle Wrong Subject |
| `Shift+O` | Toggle Wrong Object |
| `Enter` | Submit selected verdicts |

## Annotator Workflow

1. Go to `/tmkp-triples` and log in with your first and last name
2. A batch of 100 items loads automatically (grouped by edge)
3. Review the edge assertion (subject, predicate, object) and any qualifiers
4. Entity names shown are the Node Normalizer preferred labels for each CURIE
5. If the in-text name doesn't match NN labels, a **Suggested** CURIE appears beneath — click it to see Name Resolver details
6. Click the predicate to see its Biolink model definition
7. Read the supporting text — subject is highlighted in blue, object in red
8. Click Correct to auto-submit, or toggle one or more other verdicts then press Enter to submit
9. Correction fields appear when relevant but are optional
10. The progress strip shows answered (colored) vs. unanswered (gray) items; click any dot to jump
11. After completing a batch, click "Load Next Batch" for more
12. Switch to Review mode to revisit your previous answers

## Loading Data

### Local (development)

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

### Kubernetes (production)

```bash
# Find the backend pod
kubectl get pods -n olawumi -l app=annotation-backend

# Upload a JSONL file via the admin API
kubectl port-forward -n olawumi svc/annotation-backend 8000:8000
# Then use the admin upload endpoint or load script:
curl -X POST http://localhost:8000/tmkp/admin/upload-jsonl \
  -F "file=@tmkp_edges.jsonl"

# Or exec into the pod and run the load script directly
kubectl exec -it -n olawumi deploy/annotation-backend -- \
  python load_tmkp.py /path/to/tmkp_edges.jsonl --limit 5000

# Check logs
kubectl logs -n olawumi -l app=annotation-backend --tail=100 -f
```

## Deployment

Images are built on push to `main` via GitHub Actions and published to `ghcr.io/renci-ner/annotation-{backend,frontend}:latest`.

### Helm install / upgrade

```bash
# Initial install
helm install annotation-ui ./helm/annotation-ui -n olawumi

# Upgrade after code changes (images rebuild automatically)
helm upgrade annotation-ui ./helm/annotation-ui -n olawumi

# Force pod restart to pull latest images
kubectl rollout restart -n olawumi deploy/annotation-backend deploy/annotation-frontend
```

The app is served at `https://annotation.apps.renci.org`. Ingress uses nginx with TLS via cert-manager.

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
