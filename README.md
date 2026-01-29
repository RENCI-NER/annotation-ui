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
2. The interface automatically loads the next unannotated article
3. Select a Biolink predicate from the dropdown (searchable)
4. Use keyboard shortcuts for efficient annotation:
   - `Space`: Skip triple
   - `F`: Flag for review
   - `← →`: Navigate between triples
5. Review skipped/flagged items via the header buttons

### For Admins

1. Open `http://localhost:5173/?admin=true`
2. Assign articles to annotators
3. Monitor progress and completion rates
4. Delete assignments if needed

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
- **`triples`**: Entity pairs to annotate (subject, object, distance metrics)
- **`annotations`**: Saved annotations (predicate, confidence, notes, flags)
- **`annotator_stats`**: Progress tracking (total annotations, streaks, achievements)
- **`article_assignments`**: Article-to-annotator assignments

### Data Flow

1. **Corpus Loading**: `load_corpus.py` reads JSON corpus → creates Articles, Entities, Triples
2. **Annotation**: Frontend fetches next unannotated triple → User annotates → Saves to `annotations`
3. **Assignment**: Admin assigns articles → Creates `article_assignments` → Annotators see only assigned articles

## API Endpoints

### Annotation Endpoints
- `GET /articles/next/unannotated?annotator=<name>` - Get next article
- `POST /annotations` - Save annotation
- `GET /progress?annotator=<name>` - Get progress stats
- `GET /stats?annotator=<name>` - Get gamification stats

### Admin Endpoints
- `GET /admin/annotators` - List all annotators
- `POST /admin/assign` - Assign N articles to annotator
- `GET /admin/stats` - Overall statistics
- `DELETE /admin/annotator/{name}` - Delete assignments

### Review Endpoints
- `GET /articles/skipped?annotator=<name>` - PMIDs with skipped triples
- `GET /articles/flagged?annotator=<name>` - PMIDs with flagged triples

## Deployment

### Using Docker Compose (Local)
```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f
```

### Using Kubernetes + Helm
```bash
# Install chart
helm install annotation-ui ./helm/annotation-ui -n <namespace> --create-namespace

# Upgrade deployment
helm upgrade annotation-ui ./helm/annotation-ui -n <namespace>

# Uninstall
helm uninstall annotation-ui -n <namespace>
```

### Manual Deployment
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
│   ├── main.py              # FastAPI application
│   ├── models.py            # SQLAlchemy models
│   ├── schemas.py           # Pydantic schemas
│   ├── database.py          # Database configuration
│   ├── load_corpus.py       # Corpus loader script
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── AbstractView.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── AnnotationPanel.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   └── AdminDashboard.tsx
│   │   ├── hooks/
│   │   │   └── useBiolinkPredicates.ts
│   │   ├── App.tsx          # Main application
│   │   ├── api.ts           # API client
│   │   └── types.ts         # TypeScript types
│   ├── nginx.conf           # Production nginx config
│   ├── Dockerfile
│   └── package.json
└── helm/
    └── annotation-ui/       # Helm chart
```

### Adding New Features

#### Backend Changes

1. **Add Database Model** (`models.py`):
```python
class MyNewTable(Base):
    __tablename__ = "my_table"
    id = Column(Integer, primary_key=True)
    # ... fields
```

2. **Add Schema** (`schemas.py`):
```python
class MyNewSchema(BaseModel):
    id: int
    # ... fields
```

3. **Add Endpoint** (`main.py`):
```python
@app.get("/my-endpoint")
def my_endpoint(db: Session = Depends(get_db)):
    # ... logic
    return result
```

#### Frontend Changes

1. **Add API Method** (`api.ts`):
```typescript
export const api = {
  myNewMethod: async () => {
    const response = await axios.get(`${API_BASE}/my-endpoint`);
    return response.data;
  }
}
```

2. **Create Component** (`components/MyComponent.tsx`):
```tsx
export const MyComponent: React.FC = () => {
  // ... component logic
}
```

3. **Update App** (`App.tsx`):
```tsx
import { MyComponent } from './components/MyComponent';
// ... use component
```

### Biolink Predicate System

The annotation system uses **Biolink Model** predicates:

1. **Predicates are fetched dynamically** from Biolink YAML schema
2. **Qualified predicates** are augmented from a curated list
3. **Searchable dropdown** for easy predicate selection
4. **Fallback list** if Biolink schema unreachable

To update predicates, edit:
- `frontend/src/hooks/useBiolinkPredicates.ts` - Add qualified predicates to `QUALIFIED_PREDICATES` array

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

### Environment Variables

**Backend** (optional):
- `DATABASE_URL` - SQLite database path (default: `sqlite:///./annotations.db`)

**Frontend** (build-time):
- `VITE_API_BASE_URL` - API base URL (default: `/api` in production, `http://localhost:8000` in dev)

## Troubleshooting

### Backend Issues

**Problem**: `404 Not Found` on all endpoints  
**Solution**: Check `root_path="/api"` in `main.py` and ensure nginx proxy is configured

**Problem**: Database locked errors  
**Solution**: SQLite doesn't support concurrent writes - ensure backend `replicaCount: 1`

**Problem**: CORS errors  
**Solution**: Add your domain to `allow_origins` in `main.py`

### Frontend Issues

**Problem**: Network errors when calling API  
**Solution**: Check `API_BASE` in `api.ts` matches your deployment

**Problem**: Predicates not loading  
**Solution**: Check browser console for YAML fetch errors, will fallback to local list

**Problem**: TypeScript errors on `import.meta.env`  
**Solution**: Ensure `vite-env.d.ts` exists with proper type definitions

### Kubernetes Issues

**Problem**: Multi-Attach volume error  
**Solution**: Backend must have `replicaCount: 1` (SQLite limitation)

**Problem**: ImagePullBackOff  
**Solution**: Check image exists in registry and imagePullSecrets are configured

**Problem**: Pods not starting  
**Solution**: Check `kubectl logs <pod-name>` and `kubectl describe pod <pod-name>`

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- **Biolink Model** for standardized biomedical predicates
- **ROBOKOP** project for knowledge graph infrastructure
- **NIH Biomedical Data Translator Consortium**