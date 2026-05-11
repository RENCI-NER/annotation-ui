# RELATE — Predicate Annotation

Annotate biomedical entity relations from PubMed abstracts with [Biolink](https://biolink.github.io/biolink-model/) predicates. Builds a controlled corpus for the [RELATE predicate mapping project](https://arxiv.org/abs/2509.19057).

## Features

- Entity highlighting: subject (blue), object (red), relationship context (yellow)
- Smart predicate search with LLM suggestion prioritization
- Keyboard shortcuts: `Space` skip, `F` flag, `← →` navigate triples
- Auto-advance after annotation with progress tracking, streaks, and achievements
- Multi-annotator support with article assignment system
- Skip/flag triples for later review

## Annotator Workflow

1. Go to `/relate-triples` and log in with your first and last name
2. The interface shows only articles assigned to you
3. For each triple, select a Biolink predicate from the searchable dropdown
4. Auto-advances to the next triple; completion modal at end of each article
5. Review skipped/flagged items via the header buttons

## Loading Data

```bash
cd backend

# From a local JSON file
python load_corpus.py /path/to/corpus.json
```

### Corpus Format (JSON)
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

## Database Tables

| Table | Purpose |
|-------|---------|
| `articles` | PubMed articles (PMID, title, abstract, year, keywords) |
| `entities` | Extracted entities (text, CURIEs, Biolink types, positions) |
| `triples` | Entity pairs to annotate (subject, object, LLM suggestion) |
| `annotations` | Saved annotations (predicate, confidence, notes, flags) |
| `annotator_stats` | Streaks, achievements, annotation counts |
| `article_assignments` | Article-to-annotator mapping with completion tracking |
