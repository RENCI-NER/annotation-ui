# RELATE Annotation Interface

A full-stack web application for annotating biomedical relations from PubMed articles.

## Setup Instructions

### 1. Backend Setup

```bash
cd backend
pip install -r requirements.txt

# Load your corpus into the database
python load_corpus.py /path/to/your/corpus.json

# Start the backend server
python main.py
```

Backend will run on `http://localhost:8000`

### 2. Frontend Setup

```bash
cd frontend
npm install

# Start the development server
npm run dev
```

Frontend will run on `http://localhost:5173`

## Usage

1. Open `http://localhost:5173` in your browser
2. The interface will automatically load the next unannotated article
3. Use keyboard shortcuts for fast annotation:
   - `1-8`: Select predicate
   - `Space`: Skip triple
   - `F`: Flag for review
   - `← →`: Navigate between triples


## Architecture

**Backend**: FastAPI + SQLAlchemy + SQLite
**Frontend**: React + TypeScript + Tailwind CSS + Framer Motion

## Database Schema

- `articles`: PubMed articles with metadata
- `entities`: Extracted entities with normalization
- `triples`: Entity pairs to annotate
- `annotations`: Saved annotations
- `annotator_stats`: Progress and achievements
