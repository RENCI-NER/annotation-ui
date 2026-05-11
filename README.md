# Biomedical Relation Annotation Platform

A full-stack web application with two annotation modes for biomedical knowledge graph curation.

| Mode | Route | Purpose |
|------|-------|---------|
| [RELATE](docs/RELATE.md) | `/relate-triples` | Predicate annotation of PubMed abstracts |
| [TMKP Verification](docs/TMKP.md) | `/tmkp-triples` | Fact-checking text-mined knowledge graph edges |

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
python main.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Backend runs on `http://localhost:8000`, frontend on `http://localhost:5173`.

## Architecture

**Backend**: FastAPI + SQLAlchemy + SQLite
**Frontend**: React + TypeScript + Tailwind CSS + Framer Motion
**Deployment**: Kubernetes (Helm) or Docker Compose

### Annotator Login
Both modes use the same login: first name + last name, creating a `firstname.lastname` identifier. Name collisions are detected automatically and resolved with a middle initial.

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
│   ├── load_tmkp.py         # TMKP JSONL loader (filters, sampling, streaming)
│   ├── node_norm.py         # Node Normalizer CURIE name resolution
│   ├── assign_dual.py       # Dual-annotator assignment utility
│   └── requirements.txt
├── frontend/src/
│   ├── components/
│   │   ├── LandingPage.tsx       # Home — choose RELATE or TMKP
│   │   ├── RelateApp.tsx         # RELATE annotation interface
│   │   ├── TmkpApp.tsx           # TMKP verification interface
│   │   ├── Login.tsx             # Shared login with collision detection
│   │   ├── AbstractView.tsx      # Entity highlighting in abstracts
│   │   ├── AnnotationPanel.tsx   # Predicate selection & controls
│   │   ├── AdminDashboard.tsx    # RELATE admin interface
│   │   ├── CompletionModal.tsx   # Article completion popup
│   │   └── ProgressBar.tsx       # Progress visualization
│   ├── api.ts / types.ts        # API client + TypeScript types
│   └── App.tsx                   # Router
├── docs/
│   ├── RELATE.md
│   └── TMKP.md
├── helm/                         # Kubernetes Helm chart
└── annotations.db                # SQLite database (auto-created)
```

## Deployment

### Kubernetes + Helm
```bash
helm install annotation-ui ./helm/annotation-ui -n <namespace> --create-namespace
```

Upgrade / restart:
```bash
helm upgrade annotation-ui ./helm/annotation-ui -n <namespace>
kubectl rollout restart deployment/annotation-backend -n <namespace>
kubectl rollout restart deployment/annotation-frontend -n <namespace>
```

### Docker Compose (Local)
```bash
docker-compose up -d
```

## License

MIT License — see [LICENSE](LICENSE) for details.
