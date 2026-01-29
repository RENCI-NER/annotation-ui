import json
from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models

models.Base.metadata.create_all(bind=engine)

def find_entity_positions(abstract: str, entity_text: str):
    """Find start and end positions of entity in abstract"""
    start = abstract.lower().find(entity_text.lower())
    if start == -1:
        return 0, 0
    end = start + len(entity_text)
    return start, end

def add_entity_positions():
    """Add start/end positions for entities, using heuristics for multiple occurrences"""
    
    print("Loading corpus...")
    with open("corpus_final_clean.json", "r") as f:
        data = json.load(f)
    
    print(f"Processing {len(data)} articles...")
    
    for article_idx, article in enumerate(data):
        if (article_idx + 1) % 50 == 0:
            print(f"  Processed {article_idx + 1}/{len(data)} articles...")
        
        abstract = article.get("abstract", "")
        abstract_lower = abstract.lower()
        
        for triple in article.get("triples", []):
            subject_text = triple.get("subject", "")
            object_text = triple.get("object", "")
            
            # Find all occurrences
            subject_positions = find_all_occurrences(abstract_lower, subject_text.lower())
            object_positions = find_all_occurrences(abstract_lower, object_text.lower())
            
            if not subject_positions or not object_positions:
                # Not found in abstract (shouldn't happen after filtering)
                triple["subject_start"] = -1
                triple["subject_end"] = -1
                triple["object_start"] = -1
                triple["object_end"] = -1
                continue
            
            # HEURISTIC: Pick the pair with minimum distance
            best_distance = float('inf')
            best_subj_pos = subject_positions[0]
            best_obj_pos = object_positions[0]
            
            for subj_start, subj_end in subject_positions:
                for obj_start, obj_end in object_positions:
                    # Don't allow overlapping spans
                    if subj_end > obj_start and subj_start < obj_end:
                        continue
                    
                    # Calculate distance between entities
                    distance = abs(subj_start - obj_start)
                    
                    if distance < best_distance:
                        best_distance = distance
                        best_subj_pos = (subj_start, subj_end)
                        best_obj_pos = (obj_start, obj_end)
            
            # Store the best positions
            triple["subject_start"] = best_subj_pos[0]
            triple["subject_end"] = best_subj_pos[1]
            triple["object_start"] = best_obj_pos[0]
            triple["object_end"] = best_obj_pos[1]
            triple["distance_chars"] = best_distance
    
    # Save
    with open("corpus_with_positions.json", "w") as f:
        json.dump(data, f, indent=2)
    
    print(f"\n✓ Saved to corpus_with_positions.json")

def find_all_occurrences(text, substring):
    """Find all occurrences of substring in text, return list of (start, end) tuples"""
    positions = []
    start = 0
    while True:
        pos = text.find(substring, start)
        if pos == -1:
            break
        positions.append((pos, pos + len(substring)))
        start = pos + 1
    return positions

def load_corpus(json_file: str):
    """Load triple-based corpus into database"""
    db = SessionLocal()
    
    with open(json_file, 'r') as f:
        articles = json.load(f)
    
    print(f"Loading {len(articles)} articles...")
    
    for i, article_data in enumerate(articles):
        if (i + 1) % 10 == 0:
            print(f"  Loaded {i + 1}/{len(articles)} articles...")
        
        pmid = article_data['pmid']
        
        # Check if article already exists
        existing = db.query(models.Article).filter(models.Article.pmid == pmid).first()
        if existing:
            print(f"  Skipping PMID {pmid} (already exists)")
            continue
        
        # Combine title and abstract
        title = article_data.get('title', '')
        abstract = article_data.get('abstract', '')
        combined_text = f"{title}: {abstract}" if title else abstract
        
        # Create article
        article = models.Article(
            pmid=pmid,
            title=title,
            abstract=combined_text,  # Store combined text
            year=article_data.get('year'),
            target_entity_count=len(article_data.get('triples', []))
        )
        db.add(article)
        db.flush()
        
        # Process triples - search in combined text
        for triple_data in article_data.get('triples', []):
            # Create subject entity
            subject_start, subject_end = find_entity_positions(
                combined_text,  # Search in combined text
                triple_data.get('subject', '')
            )
            
            subject_entity = models.Entity(
                pmid=article.pmid,
                text=triple_data.get('subject', ''),
                normalized_id=triple_data.get('subject_id'),
                normalized_label=triple_data.get('subject_label'),
                biolink_types=triple_data.get('subject_types', []),
                start_pos=subject_start,
                end_pos=subject_end
            )
            db.add(subject_entity)
            db.flush()
            
            # Create object entity
            object_start, object_end = find_entity_positions(
                combined_text,  # Search in combined text
                triple_data.get('object', '')
            )
            
            object_entity = models.Entity(
                pmid=article.pmid,
                text=triple_data.get('object', ''),
                normalized_id=triple_data.get('object_id'),
                normalized_label=triple_data.get('object_label'),
                biolink_types=triple_data.get('object_types', []),
                start_pos=object_start,
                end_pos=object_end
            )
            db.add(object_entity)
            db.flush()
            
            # Calculate distance
            distance = abs(subject_start - object_start)
            
            # Create triple
            triple = models.Triple(
                pmid=article.pmid,
                subject_id=subject_entity.id,
                object_id=object_entity.id,
                llm_suggestion=triple_data.get('relationship', ''), 
                distance_words=distance // 6,
                same_sentence=distance < 200
            )
            db.add(triple)
            db.flush()
    
    db.commit()
    print(f"\n✓ Loaded {len(articles)} articles into database")
    db.close()


if __name__ == "__main__":
    import sys
    if len(sys.argv) != 2:
        print("Usage: python load_corpus.py <corpus.json>")
        sys.exit(1)
    
    load_corpus(sys.argv[1])