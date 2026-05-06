# Biomedical Relation Annotation Platform

A full-stack web application with two annotation modes: **RELATE** for predicate annotation of PubMed abstracts, and **TMKP Verification** for fact-checking text-mined knowledge graph edges.

## Features

### RELATE Triples (`/relate-triples`)
- Annotate biomedical entity relations from PubMed abstracts with Biolink predicates
- Entity highlighting with subject (blue), object (red), and relationship (yellow) spans
- Smart predicate search with LLM suggestion prioritization
- Keyboard shortcuts for efficient annotation (Space: skip, F: flag, arrows: navigate)
- Auto-advance after annotation with progress tracking, streaks, and achievements
- Multi-annotator support with article assignment system
- Skip/flag triples for later review
- Admin dashboard for managing annotators, assignments, and exports
- Builds a controlled corpus for the [RELATE predicate mapping project](https://arxiv.org/abs/2509.19057)

### TMKP Verification (`/tmkp-triples`)
- Fact-check text-mined knowledge graph edges from the [Text Mining Knowledge Provider](https://kgx-storage.rtx.ai/data/tmkp/)
- Five verdict actions: Correct, Swap Subject/Object, Wrong Predicate, Reject, Skip
- Supporting text display with highlighted subject/object character spans
- Predicate correction picker (when "Wrong Predicate" is selected)
- Edge metadata: qualifiers, confidence score, evidence count, publication links
- Keyboard shortcuts (C: correct, S: swap, W: wrong predicate, R: reject, →: skip)
- Edges assigned by lowest confidence first (most valuable to verify)
- Admin panel for JSONL upload, edge assignment, and export

## Quick Start

### 1. Backend Setup
```bash
cd backend
pip install -r requirements.txt

# Start the backend server
python main.py
```

Backend runs on `http://localhost:8000`

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

### 3. Load Data

**RELATE corpus** (JSON array of PubMed articles):
```bash
cd backend
python load_corpus.py /path/to/corpus.json
# Or use the Upload Corpus tab in the RELATE Admin UI
```

**TMKP edges** (JSONL, one edge per line):
```bash
cd backend
python load_tmkp.py /path/to/tmkp_edges.jsonl --limit 5000
# Or upload via the TMKP Admin UI at /tmkp-triples/admin
```

## Usage

### Landing Page (`/`)
Choose between RELATE Triples (predicate annotation) and TMKP Verification (edge fact-checking).

### RELATE Annotators (`/relate-triples`)
1. Enter your annotator name to log in
2. The interface shows only articles assigned to you
3. Select a Biolink predicate from the searchable dropdown
4. Keyboard shortcuts: `Space` skip, `F` flag, `← →` navigate
5. Auto-advances after annotation; completion modal at end of each article
6. Review skipped/flagged items via header buttons

### RELATE Admin (`/relate-triples/admin`)
- Assign articles to annotators (specify count)
- Upload corpus JSON files
- Monitor progress, completion rates, inter-annotator agreement
- Reset annotator progress or delete assignments
- Export annotations as JSON

### TMKP Annotators (`/tmkp-triples`)
1. Enter your annotator name to log in
2. Review the edge assertion (subject → predicate → object) and qualifiers
3. Read the supporting text with highlighted entity spans
4. Click a verdict: Correct, Swap S/O, Wrong Predicate, Reject, or Skip
5. Keyboard shortcuts: `C` correct, `S` swap, `W` wrong predicate, `R` reject, `→` skip
6. For "Wrong Predicate", select the correct predicate from the picker
7. Add optional notes, then auto-advances to next edge

### TMKP Admin (`/tmkp-triples/admin`)
<!-- - Upload TMKP JSONL files
- Assign edges to annotators (lowest confidence first) -->
- View annotator progress
- Export all verifications as JSON

## Architecture

**Backend**: FastAPI + SQLAlchemy + SQLite
**Frontend**: React + TypeScript + Tailwind CSS + Framer Motion
**Deployment**: Kubernetes (Helm) or Docker Compose

### Tech Stack
- **Backend**: FastAPI, Python 3.11+, SQLAlchemy, SQLite
- **Frontend**: React 18, TypeScript, Tailwind CSS, Framer Motion
- **Build**: Vite
- **Containerization**: Docker, Kubernetes (Helm)

## Database Schema

### RELATE Tables
- **`articles`** — PubMed articles (PMID, title, abstract, year, keywords)
- **`entities`** — Extracted entities (text, CURIEs, Biolink types, positions)
- **`triples`** — Entity pairs to annotate (subject, object, LLM suggestion)
- **`annotations`** — Saved annotations (predicate, confidence, notes, flags)
- **`annotator_stats`** — Streaks, achievements, annotation counts
- **`article_assignments`** — Article-to-annotator mapping with completion tracking

### TMKP Tables
- **`tmkp_edges`** — Knowledge graph edges (subject/object IDs, predicate, qualifiers, confidence)
- **`tmkp_evidences`** — Supporting text snippets with character offsets and publication refs
- **`tmkp_verifications`** — Annotator verdicts (correct/swap/wrong_predicate/reject/skip)
- **`tmkp_assignments`** — Edge-to-annotator mapping with completion tracking

## API Endpoints

### RELATE Endpoints
- `GET /articles/next/unannotated?annotator=<name>` — Next assigned unannotated article
- `GET /articles/{pmid}?annotator=<name>` — Specific article with annotations
- `POST /annotations` — Save annotation
- `GET /progress?annotator=<name>` — Progress stats
- `GET /stats?annotator=<name>` — Gamification stats
- `POST /admin/assign` — Assign articles to annotator
- `POST /admin/upload-corpus` — Upload corpus JSON
- `GET /admin/export/annotations` — Export annotations

### TMKP Endpoints
- `GET /tmkp/edges/next?annotator=<name>` — Next assigned unverified edge
- `GET /tmkp/edges/{id}?annotator=<name>` — Specific edge with evidence
- `POST /tmkp/verify` — Save verification verdict
- `GET /tmkp/progress?annotator=<name>` — Verification progress
<!-- - `POST /tmkp/admin/assign` — Assign edges to annotator -->
<!-- - `POST /tmkp/admin/upload-jsonl` — Upload TMKP JSONL -->
- `GET /tmkp/admin/export` — Export all verifications

## Data Formats

### RELATE Corpus Format (JSON)
```json
[
  {
    "pmid": "12345678",
    "title": "Article Title",
    "abstract": "Article abstract text...",
    "year": 2024,
    "triples": [
      {
        "subject": "gene name",
        "subject_id": "HGNC:12345",
        "subject_types": ["biolink:Gene"],
        "subject_start": 10,
        "subject_end": 20,
        "object": "disease name",
        "object_id": "MONDO:0001",
        "object_types": ["biolink:Disease"],
        "object_start": 50,
        "object_end": 65,
        "relationship": "associated with"
      }
    ]
  }
]
```

### TMKP Edge Format (JSONL, one per line)
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

## Project Structure
```
annotation-ui/
├── backend/
│   ├── main.py              # FastAPI app + RELATE endpoints
│   ├── tmkp_routes.py       # TMKP API router
│   ├── models.py            # SQLAlchemy models (RELATE + TMKP)
│   ├── schemas.py           # Pydantic schemas
│   ├── database.py          # Database config (SQLite)
│   ├── load_corpus.py       # RELATE corpus loader
│   ├── load_tmkp.py         # TMKP JSONL loader
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── LandingPage.tsx       # Home — choose RELATE or TMKP
│   │   │   ├── RelateApp.tsx         # RELATE annotation interface
│   │   │   ├── TmkpApp.tsx           # TMKP verification interface + admin
│   │   │   ├── AbstractView.tsx      # Entity highlighting in abstracts
│   │   │   ├── AnnotationPanel.tsx   # Predicate selection & controls
│   │   │   ├── AdminDashboard.tsx    # RELATE admin interface
│   │   │   ├── Login.tsx             # Annotator login
│   │   │   ├── CompletionModal.tsx   # Article completion popup
│   │   │   └── ProgressBar.tsx       # Progress visualization
│   │   ├── contexts/
│   │   │   └── ThemeContext.tsx       # Dark/light theme provider
│   │   ├── hooks/
│   │   │   └── useBiolinkPredicates.ts  # Predicate fetching & search
│   │   ├── App.tsx           # Router (/, /relate-triples, /tmkp-triples)
│   │   ├── api.ts            # API client (RELATE + TMKP)
│   │   └── types.ts          # TypeScript types
│   └── package.json
└── annotations.db            # SQLite database (auto-created)
```

## Deployment

### Kubernetes + Helm
```bash
helm install annotation-ui ./annotation-ui -n <namespace> --create-namespace
```

Load data into the running pod:
```bash
# Option 1: Use the Admin UI upload feature

# Option 2: Copy and load manually
kubectl cp corpus.json <namespace>/<backend-pod>:/app/corpus.json
kubectl exec -it -n <namespace> <backend-pod> -- python load_corpus.py corpus.json

# For TMKP edges
kubectl cp tmkp_edges.jsonl <namespace>/<backend-pod>:/app/tmkp_edges.jsonl
kubectl exec -it -n <namespace> <backend-pod> -- python load_tmkp.py tmkp_edges.jsonl --limit 5000
```

Upgrade / restart / delete:
```bash
helm upgrade annotation-ui ./helm/annotation-ui -n <namespace>
kubectl rollout restart deployment/annotation-backend -n <namespace>
kubectl rollout restart deployment/annotation-frontend -n <namespace>
helm uninstall annotation-ui -n <namespace>
kubectl delete pvc annotation-data-pvc -n <namespace>
```

### Docker Compose (Local)
```bash
docker-compose up -d
docker-compose logs -f
```

## License

MIT License — see [LICENSE](LICENSE) for details.
