# RELATE Annotation Interface

A full-stack web application for annotating biomedical relations from PubMed articles with Biolink predicates.

## Features

- 🔬 Annotate biomedical entity relations from PubMed abstracts
- 🎯 Entity highlighting and position tracking
- ⌨️ Keyboard shortcuts for efficient annotation
- 📊 Progress tracking with streaks, achievements
- 👥 Multi-annotator support with assignment system
- 🚩 Skip and flag triples for review
- 📈 Admin dashboard for managing annotators

## Quick Start

### 1. Backend Setup
```bash
cd backend
pip install -r requirements.txt

# Load your corpus into the database
python load_corpus.py /path/to/your/corpus.json

# Start the backend server
python main.py
```

Backend runs on `http://localhost:8000`

### 2. Frontend Setup
```bash
cd frontend
npm install

# Start the development server
npm run dev
```

Frontend runs on `http://localhost:5173`

## Usage

### For Annotators

1. Open `http://localhost:5173` in your browser
2. Enter your annotator name to start
3. The interface shows only articles assigned to you
4. Select a Biolink predicate from the searchable dropdown
5. Use keyboard shortcuts for efficient annotation:
   - `Space`: Skip triple
   - `F`: Flag for review (only works outside input fields)
   - `← →`: Navigate between triples
6. Auto-advances to next triple after annotation
7. Completion modal appears when finishing an article
8. Review skipped/flagged items via header buttons
9. Toggle theme with 🌙/☀️ button

### For Admins

1. Open `http://localhost:5173/?admin=true`
2. Assign articles to annotators (specify number of articles)
3. Monitor progress and completion rates
4. Reset annotator progress (keeps assignments, deletes annotations)
5. Delete annotator assignments completely

## Architecture

**Backend**: FastAPI + SQLAlchemy + SQLite  
**Frontend**: React + TypeScript + Tailwind CSS + Framer Motion  
**Deployment**: Kubernetes (Helm charts)

### Tech Stack Details

- **Backend Framework**: FastAPI (Python 3.11+)
- **Database**: SQLite with SQLAlchemy ORM
- **Frontend Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion
- **Build Tool**: Vite
- **Containerization**: Docker
- **Orchestration**: Kubernetes (Helm)

## Database Schema

### Core Tables

- **`articles`**: PubMed articles with metadata (PMID, title, abstract, year)
- **`entities`**: Extracted entities with Biolink normalization (text, CURIEs, types, positions)
- **`triples`**: Entity pairs to annotate (subject, object, LLM suggestions)
- **`annotations`**: Saved annotations (predicate, confidence, notes, flags)
- **`annotator_stats`**: Progress tracking (total annotations, streaks, achievements)
- **`article_assignments`**: Article-to-annotator assignments with completion tracking


### Data Flow

1. **Corpus Loading**: `load_corpus.py` reads JSON corpus → creates Articles, Entities, Triples
2. **Assignment**: Admin assigns articles → Creates `article_assignments` → Annotators see only assigned articles
3. **Annotation**: Frontend fetches next unannotated triple → User annotates → Saves to `annotations` → Updates completion status
4. **Review**: Annotators can review skipped/flagged items or completed articles


## API Endpoints

### Annotation Endpoints
- `GET /articles/next/unannotated?annotator=<name>` - Get next assigned unannotated article
- `GET /articles/{pmid}?annotator=<name>` - Get specific article with annotations
- `POST /annotations` - Save annotation (auto-updates assignment completion)
- `GET /progress?annotator=<name>` - Get progress stats (only for assigned articles)
- `GET /stats?annotator=<name>` - Get gamification stats

### Admin Endpoints
- `GET /admin/annotators` - List all annotators with assignment counts
- `POST /admin/assign` - Assign N articles to annotator
- `GET /admin/stats` - Overall statistics (total/assigned/unassigned/completed)
- `POST /admin/annotator/{name}/reset` - Reset annotator (delete annotations, keep assignments)
- `DELETE /admin/annotator/{name}` - Delete all assignments

### Review Endpoints
- `GET /articles/skipped?annotator=<name>` - PMIDs with skipped triples
- `GET /articles/flagged?annotator=<name>` - PMIDs with flagged triples


## Deployment

### Using Kubernetes + Helm
```bash
helm install annotation-ui ./helm/annotation-ui -n  --create-namespace
```

**Load corpus data into Kubernetes:**

```bash
# Get backend pod name so you can identify the backend pod name
kubectl get pods -n <namesapce>

# Copy corpus file
kubectl cp corpus.json <nmespace>/<backend-podname>:/app/corpus.json

# Exec into pod and load
kubectl exec -it -n  <namespace> <backend-podname> -- bash

# Inside the pod, run:**
ls -la  # Check if corpus.json is there
python load_corpus.py corpus.json

# Exit the pod
exit
```

**Upgrade deployment:**
```bash
helm upgrade annotation-ui ./helm/annotation-ui -n <namespace>
```

**Restart specific service:**
```bash
kubectl rollout restart deployment/annotation-backend -n <namespace>
kubectl rollout restart deployment/annotation-frontend -n <namespace>
```

### Using Docker Compose (Local)
```bash
docker-compose up -d
docker-compose logs -f
```
#### Manual Deployment
```bash
# Build backend image
cd backend
docker build -t annotation-backend:latest .

# Build frontend image
cd frontend
docker build -t annotation-frontend:latest .

# Push to registry
docker tag annotation-backend:latest ghcr.io/<username>/annotation-backend:latest
docker push ghcr.io/<username>/annotation-backend:latest

docker tag annotation-frontend:latest ghcr.io/<username>/annotation-frontend:latest
docker push ghcr.io/<username>/annotation-frontend:latest
```

## Development Guide

### Project Structure
```
annotation/
├── backend/
│   ├── main.py              # FastAPI application with all endpoints
│   ├── models.py            # SQLAlchemy models
│   ├── schemas.py           # Pydantic schemas
│   ├── database.py          # Database configuration
│   ├── load_corpus.py       # Corpus loader script
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── AbstractView.tsx      # Entity highlighting (blue/red/yellow)
    │   │   ├── AnnotationPanel.tsx   # Predicate selection & controls
    │   │   ├── ProgressBar.tsx       # Progress visualization
    │   │   ├── AdminDashboard.tsx    # Admin interface
    │   │   ├── Login.tsx             # Annotator login
    │   │   └── CompletionModal.tsx   # Article completion popup
    │   ├── contexts/
    │   │   └── ThemeContext.tsx      # Dark/light theme provider
    │   ├── hooks/
    │   │   └── useBiolinkPredicates.ts  # Predicate fetching & smart search
    │   ├── App.tsx          # Main application with routing
    │   ├── api.ts           # API client
    │   └── types.ts         # TypeScript types
    └── package.json
```

### Corpus Format

The corpus loader expects JSON with this structure:
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
        "subject_label": "Gene Symbol",
        "subject_types": ["biolink:Gene"],
        "subject_start": 10,
        "subject_end": 20,
        "object": "disease name",
        "object_id": "MONDO:0001",
        "object_label": "Disease Name",
        "object_types": ["biolink:Disease"],
        "object_start": 50,
        "object_end": 65,
        "relationship": "associated with"
      }
    ]
  }
]
```

### Testing
```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test

# E2E tests
npm run test:e2e
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](/LICENSE) file for details
