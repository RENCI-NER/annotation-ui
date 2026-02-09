from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta, timezone 
from fastapi.responses import StreamingResponse
import json
import io


import models
import schemas
from database import engine, get_db
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    db = next(get_db())
    try:
        # Normalize article assignments
        assignments = db.query(models.ArticleAssignment).all()
        for a in assignments:
            a.annotator = a.annotator.lower().strip()
        
        # Normalize annotations
        annotations = db.query(models.Annotation).all()
        for a in annotations:
            a.annotator = a.annotator.lower().strip()
        
        # Normalize stats
        stats = db.query(models.AnnotatorStats).all()
        for s in stats:
            s.annotator = s.annotator.lower().strip()
        
        db.commit()
    except Exception as e:
        print(f"Migration error (likely already done): {e}")
        db.rollback()
    finally:
        db.close()
    
    yield

app = FastAPI(
    title="Relation Annotation API",
    root_path="/api" ,
    lifespan = lifespan 
)
models.Base.metadata.create_all(bind=engine)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://annotation-test.apps.renci.org"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Relation Annotation API"}

@app.get("/articles", response_model=List[schemas.ArticleResponse])
def get_articles(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    articles = db.query(models.Article).offset(skip).limit(limit).all()
    for article in articles:
        for triple in article.triples:
            annotation = db.query(models.Annotation).filter(
                models.Annotation.triple_id == triple.id
            ).first()
            if annotation:
                triple.predicate = annotation.predicate
                triple.confidence = annotation.confidence
                triple.notes = annotation.notes
                triple.skipped = annotation.skipped
                triple.flagged = annotation.flagged
    return articles

# REMOVE THE FIRST /articles/{pmid} - KEEP ONLY THIS ONE
@app.get("/articles/{pmid}", response_model=schemas.ArticleResponse)
def get_article(pmid: str, annotator: str = "default", db: Session = Depends(get_db)):
    annotator = normalize_annotator(annotator)
    article = db.query(models.Article).filter(models.Article.pmid == pmid).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    for triple in article.triples:
        annotation = db.query(models.Annotation).filter(
            models.Annotation.triple_id == triple.id,
            models.Annotation.annotator == annotator
        ).first()
        if annotation:
            triple.predicate = annotation.predicate
            triple.confidence = annotation.confidence
            triple.notes = annotation.notes
            triple.skipped = annotation.skipped
            triple.flagged = annotation.flagged
            triple.annotated = True
        else:
            triple.annotated = False
    
    return article

@app.get("/articles/next/unannotated", response_model=schemas.ArticleResponse)
def get_next_unannotated_article(annotator: str = "default", db: Session = Depends(get_db)):
    """Get next article assigned to this annotator"""
    annotator = normalize_annotator(annotator)
    
    # Get assignments for this annotator
    assignments = db.query(models.ArticleAssignment).filter(
        models.ArticleAssignment.annotator == annotator
    ).all()
    
    # If NO assignments, return 404
    if not assignments:
        raise HTTPException(
            status_code=404,
            detail=f"No articles assigned to {annotator}. Contact admin to assign articles."
        )
    
    # Get assigned PMIDs
    assigned_pmids = [a.pmid for a in assignments]
    
    # Find first assigned article with unannotated triples
    for pmid in assigned_pmids:
        article = db.query(models.Article).filter(
            models.Article.pmid == pmid
        ).first()
        
        if not article:
            continue
        
        # Check if has unannotated triples
        has_unannotated = False
        for triple in article.triples:
            annotation = db.query(models.Annotation).filter(
                models.Annotation.triple_id == triple.id,
                models.Annotation.annotator == annotator
            ).first()
            
            if not annotation:
                has_unannotated = True
                break
        
        if has_unannotated:
            # Attach annotations
            for t in article.triples:
                ann = db.query(models.Annotation).filter(
                    models.Annotation.triple_id == t.id,
                    models.Annotation.annotator == annotator
                ).first()
                
                if ann:
                    t.predicate = ann.predicate
                    t.confidence = ann.confidence
                    t.notes = ann.notes
                    t.skipped = ann.skipped
                    t.flagged = ann.flagged
                else:
                    t.predicate = None
                    t.confidence = None
                    t.notes = None
                    t.skipped = False
                    t.flagged = False
            
            return article
    
    # All completed - return first article for review (READ-ONLY mode)
    if assigned_pmids:
        first_article = db.query(models.Article).filter(
            models.Article.pmid == assigned_pmids[0]
        ).first()
        
        if first_article:
            for t in first_article.triples:
                ann = db.query(models.Annotation).filter(
                    models.Annotation.triple_id == t.id,
                    models.Annotation.annotator == annotator
                ).first()
                
                if ann:
                    t.predicate = ann.predicate
                    t.confidence = ann.confidence
                    t.notes = ann.notes
                    t.skipped = ann.skipped
                    t.flagged = ann.flagged
                else:
                    # Should not happen, but handle it
                    t.predicate = None
                    t.confidence = None
                    t.notes = None
                    t.skipped = False
                    t.flagged = False
            
            return first_article
    
    # Should never reach here, but just in case
    raise HTTPException(
        status_code=404,
        detail=f"No articles available"
    )

@app.post("/annotations", response_model=schemas.AnnotationResponse)
def create_annotation(annotation: schemas.AnnotationCreate, db: Session = Depends(get_db)):
    annotation.annotator = normalize_annotator(annotation.annotator)
    existing = db.query(models.Annotation).filter(
        models.Annotation.triple_id == annotation.triple_id,
        models.Annotation.annotator == annotation.annotator
    ).first()
    
    if existing:
        existing.predicate = annotation.predicate
        existing.confidence = annotation.confidence
        existing.notes = annotation.notes
        existing.skipped = annotation.skipped
        existing.flagged = annotation.flagged
        existing.updated_at = datetime.now()
        db.commit()
        db.refresh(existing)
    else:
        db_annotation = models.Annotation(**annotation.model_dump())
        db.add(db_annotation)
        db.commit()
        db.refresh(db_annotation)
        update_annotator_stats(annotation.annotator, db)
    
    # Check if article is now complete
    triple = db.query(models.Triple).filter(models.Triple.id == annotation.triple_id).first()
    if triple:
        article = db.query(models.Article).filter(models.Article.pmid == triple.pmid).first()
        if article:
            # Check if all triples in this article are annotated
            all_annotated = True
            for t in article.triples:
                ann = db.query(models.Annotation).filter(
                    models.Annotation.triple_id == t.id,
                    models.Annotation.annotator == annotation.annotator
                ).first()
                if not ann:
                    all_annotated = False
                    break
            
            # Update assignment completion
            if all_annotated:
                assignment = db.query(models.ArticleAssignment).filter(
                    models.ArticleAssignment.pmid == triple.pmid,
                    models.ArticleAssignment.annotator == annotation.annotator
                ).first()
                if assignment:
                    assignment.completed = True
                    db.commit()
    
    return existing if existing else db_annotation

@app.get("/admin/annotators", response_model=List[schemas.AnnotatorInfo])
def get_annotators(db: Session = Depends(get_db)):
    # Get distinct annotators who have assignments
    annotators = db.query(models.ArticleAssignment.annotator).distinct().all()
    
    result = []
    for (annotator,) in annotators:
        assignments = db.query(models.ArticleAssignment).filter(
            models.ArticleAssignment.annotator == annotator
        ).all()
        
        if not assignments:
            continue
        
        assigned_count = len(assignments)
        completed_count = len([a for a in assignments if a.completed])
        pending_count = assigned_count - completed_count
        
        result.append(schemas.AnnotatorInfo(
            annotator=annotator,
            assigned_count=assigned_count,
            completed_count=completed_count,
            pending_count=pending_count
        ))
    
    return result

@app.post("/admin/assign", response_model=schemas.AssignmentResponse)
def assign_articles(assignment: schemas.AssignmentCreate, db: Session = Depends(get_db)):
    assignment.annotator = normalize_annotator(assignment.annotator)

    # Get already assigned PMIDs
    assigned_pmids = [a.pmid for a in db.query(models.ArticleAssignment).all()]
    
    # Get unassigned articles
    unassigned = db.query(models.Article).filter(
        ~models.Article.pmid.in_(assigned_pmids) if assigned_pmids else True
    ).limit(assignment.num_articles).all()
    
    if len(unassigned) == 0:
        return schemas.AssignmentResponse(
            annotator=assignment.annotator,
            assigned_articles=0,
            message="No unassigned articles available"
        )
    added = 0
    # Add new assignments (doesn't remove existing ones)
    for article in unassigned:
        existing = db.query(models.ArticleAssignment).filter(
            models.ArticleAssignment.annotator == assignment.annotator,
            models.ArticleAssignment.pmid == article.pmid
        ).first()
        
        if not existing:
            new_assignment = models.ArticleAssignment(
                annotator=assignment.annotator,
                pmid=article.pmid
            )
            db.add(new_assignment)
            added += 1
    
    db.commit()
    
    return schemas.AssignmentResponse(
        annotator=assignment.annotator,
        assigned_articles=added,
        message=f"Successfully assigned {added} new articles"
    )

@app.get("/admin/stats")
def get_admin_stats(db: Session = Depends(get_db)):
    total_articles = db.query(models.Article).count()

    assigned_pmids = db.query(models.ArticleAssignment.pmid).distinct().all()
    total_assigned = len(assigned_pmids)

    completed_pmids = db.query(models.ArticleAssignment.pmid).filter(
        models.ArticleAssignment.completed == True
    ).distinct().all()
    total_completed = len(completed_pmids)

    return {
        "total_articles": total_articles,
        "total_assigned": total_assigned,
        "total_unassigned": total_articles - total_assigned,
        "total_completed": total_completed
    }

@app.delete("/admin/annotator/{annotator}")
def delete_annotator_assignments(annotator: str, db: Session = Depends(get_db)):
    annotator = normalize_annotator(annotator)
    
    deleted_assignments = db.query(models.ArticleAssignment).filter(
        models.ArticleAssignment.annotator == annotator
    ).delete()
    
    db.query(models.AnnotatorStats).filter(
        models.AnnotatorStats.annotator == annotator
    ).delete()
    
    db.commit()
    
    return {"message": f"Deleted {deleted_assignments} assignments and stats for {annotator}"}

@app.post("/admin/annotator/{annotator}/reset")
def reset_annotator(annotator: str, db: Session = Depends(get_db)):
    """Reset annotator - delete all their annotations but keep assignments"""
    annotator = normalize_annotator(annotator)
    # Delete all annotations for this annotator
    deleted_annotations = db.query(models.Annotation).filter(
        models.Annotation.annotator == annotator
    ).delete()
    
    # Reset their stats
    stats = db.query(models.AnnotatorStats).filter(
        models.AnnotatorStats.annotator == annotator
    ).first()
    
    if stats:
        stats.total_annotations = 0
        stats.streak_days = 0
        stats.last_annotation_date = None
        stats.achievements = []
    
    # Mark all their assignments as incomplete
    assignments = db.query(models.ArticleAssignment).filter(
        models.ArticleAssignment.annotator == annotator
    ).all()
    
    for assignment in assignments:
        assignment.completed = False
    
    db.commit()
    
    return {
        "message": f"Reset {annotator}: deleted {deleted_annotations} annotations",
        "annotator": annotator,
        "deleted_annotations": deleted_annotations
    }

@app.get("/admin/export/annotations")
def export_annotations(annotator: str = None, status: str = "all", db: Session = Depends(get_db)):
    """
    Export annotations in original corpus format
    status: all (all annotations), completed (fully annotated articles), partial (partially annotated)
    """
    if annotator:
        annotator = normalize_annotator(annotator)

    articles = db.query(models.Article).all()
  
    export_data = []
    
    for article in articles:
        # Get annotations for this article
        annotations_query = db.query(models.Annotation).join(
            models.Triple, models.Annotation.triple_id == models.Triple.id
        ).filter(models.Triple.pmid == article.pmid)
        
        if annotator:
            annotations_query = annotations_query.filter(
                models.Annotation.annotator == annotator
            )
        
        annotations = annotations_query.all()
        
        # Filter by status
        if status == "completed":
            # Only include if all triples are annotated
            if len(annotations) < len(article.triples):
                continue
        elif status == "partial":
            # Only include if some but not all triples are annotated
            if len(annotations) == 0 or len(annotations) >= len(article.triples):
                continue
        
        # Build triples with annotations
        triples_data = []
        for triple in article.triples:
            annotation = next(
                (a for a in annotations if a.triple_id == triple.id),
                None
            )
  
            triple_dict = {
                "subject": triple.subject.text,
                "subject_id": triple.subject.normalized_id,
                "subject_label": triple.subject.text,  
                "subject_types": triple.subject.biolink_types or [],
                "subject_start": triple.subject.start_pos,
                "subject_end": triple.subject.end_pos,
                "object": triple.object.text,
                "object_id": triple.object.normalized_id,
                "object_label": triple.object.text,  
                "object_types": triple.object.biolink_types or [],
                "object_start": triple.object.start_pos,
                "object_end": triple.object.end_pos,
                "relationship": triple.llm_suggestion
            }
            
            # Add annotation if exists
            if annotation:
                triple_dict["annotation"] = {
                    "predicate": annotation.predicate,
                    "confidence": annotation.confidence,
                    "notes": annotation.notes,
                    "skipped": annotation.skipped,
                    "flagged": annotation.flagged,
                    "annotator": annotation.annotator,
                    "created_at": annotation.created_at.isoformat() if annotation.created_at else None,
                    "updated_at": annotation.updated_at.isoformat() if annotation.updated_at else None
                }
            
            triples_data.append(triple_dict)
        
        # Skip articles with no triples (after filtering)
        if len(triples_data) == 0:
            continue
        
        article_dict = {
            "pmid": article.pmid,
            "title": article.title,
            "abstract": article.abstract,
            "year": article.year,
            "triples": triples_data
        }
        
        export_data.append(article_dict)
    
    # Create JSON file in memory
    json_str = json.dumps(export_data, indent=2)
    json_bytes = json_str.encode('utf-8')
    
    filename = f"annotations_{annotator if annotator else 'all'}_{status}.json"
    
    return StreamingResponse(
        io.BytesIO(json_bytes),
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

@app.get("/admin/flagged", response_model=List[schemas.FlaggedTripleInfo])
def get_all_flagged_triples(db: Session = Depends(get_db)):
    """Get all flagged triples across all annotators"""
    flagged = db.query(models.Annotation).filter(
        models.Annotation.flagged == True
    ).all()
    
    result = []
    for ann in flagged:
        triple = db.query(models.Triple).filter(
            models.Triple.id == ann.triple_id
        ).first()
        
        if triple:
            article = db.query(models.Article).filter(
                models.Article.pmid == triple.pmid
            ).first()
            
            result.append(schemas.FlaggedTripleInfo(
                triple_id=triple.id,
                pmid=triple.pmid,
                article_title=article.title if article else "",
                subject_text=triple.subject.text,
                object_text=triple.object.text,
                relationship=triple.llm_suggestion,
                annotator=ann.annotator,
                predicate=ann.predicate,
                notes=ann.notes,
                flagged_at=ann.updated_at
            ))
    
    return result

@app.delete("/admin/triple/{triple_id}")
def delete_triple(triple_id: int, db: Session = Depends(get_db)):
    """Delete a triple (admin only - for removing bad triples)"""
    # Delete annotations first
    db.query(models.Annotation).filter(
        models.Annotation.triple_id == triple_id
    ).delete()
    
    # Get triple to find PMID
    triple = db.query(models.Triple).filter(models.Triple.id == triple_id).first()
    if not triple:
        raise HTTPException(status_code=404, detail="Triple not found")
    
    pmid = triple.pmid
    
    # Delete the triple
    db.query(models.Triple).filter(models.Triple.id == triple_id).delete()
    
    # Check if article has any remaining triples
    remaining = db.query(models.Triple).filter(models.Triple.pmid == pmid).count()
    
    if remaining == 0:
        # Delete the article if no triples left
        db.query(models.Article).filter(models.Article.pmid == pmid).delete()
        db.commit()
        return {"message": "Triple and empty article deleted", "article_deleted": True}
    
    db.commit()
    return {"message": "Triple deleted", "article_deleted": False}

@app.post("/admin/triple/{triple_id}/reassign")
def reassign_flagged_triple(triple_id: int, new_annotator: str, db: Session = Depends(get_db)):
    """Reassign a flagged triple to another annotator"""
    new_annotator = normalize_annotator(new_annotator)
    # Remove existing annotation
    db.query(models.Annotation).filter(
        models.Annotation.triple_id == triple_id
    ).delete()
    
    # Get triple and article
    triple = db.query(models.Triple).filter(models.Triple.id == triple_id).first()
    if not triple:
        raise HTTPException(status_code=404, detail="Triple not found")
    
    # Ensure new annotator has assignment for this article
    assignment = db.query(models.ArticleAssignment).filter(
        models.ArticleAssignment.pmid == triple.pmid,
        models.ArticleAssignment.annotator == new_annotator
    ).first()
    
    if not assignment:
        assignment = models.ArticleAssignment(
            pmid=triple.pmid,
            annotator=new_annotator
        )
        db.add(assignment)
    
    db.commit()
    return {"message": f"Triple reassigned to {new_annotator}"}

@app.post("/admin/cleanup-duplicates")
def cleanup_duplicate_assignments(db: Session = Depends(get_db)):
    """Remove duplicate assignments (keep first occurrence)"""
    # Get all assignments
    all_assignments = db.query(models.ArticleAssignment).all()
    
    # Track seen combinations
    seen = set()
    to_delete = []
    
    for assignment in all_assignments:
        key = (assignment.annotator, assignment.pmid)
        if key in seen:
            to_delete.append(assignment.id)
        else:
            seen.add(key)
    
    # Delete duplicates
    if to_delete:
        db.query(models.ArticleAssignment).filter(
            models.ArticleAssignment.id.in_(to_delete)
        ).delete(synchronize_session=False)
        db.commit()
    
    return {"message": f"Deleted {len(to_delete)} duplicate assignments"}
    
@app.get("/progress", response_model=schemas.ProgressResponse)
def get_progress(annotator: str = "default", db: Session = Depends(get_db)):
    annotator = normalize_annotator(annotator)
    assignments = db.query(models.ArticleAssignment).filter(
        models.ArticleAssignment.annotator == annotator
    ).all()
    
    assigned_pmids = [a.pmid for a in assignments]
    total_articles = len(assigned_pmids)
    
    total_triples = 0
    for pmid in assigned_pmids:
        article = db.query(models.Article).filter(models.Article.pmid == pmid).first()
        if article:
            total_triples += len(article.triples)
    
    annotations = db.query(models.Annotation).filter(
        models.Annotation.annotator == annotator
    ).all()
    
    # Only count annotations with actual values
    annotated_triples = len([a for a in annotations if a.predicate and not a.skipped and not a.flagged])
    skipped_triples = len([a for a in annotations if a.skipped])
    flagged_triples = len([a for a in annotations if a.flagged])
    
    # Triples that have NO annotation at all
    annotated_triple_ids = {a.triple_id for a in annotations}
    all_triple_ids = set()
    for pmid in assigned_pmids:
        article = db.query(models.Article).filter(models.Article.pmid == pmid).first()
        if article:
            all_triple_ids.update([t.id for t in article.triples])
    
    unannotated_triples = len(all_triple_ids - annotated_triple_ids)
    
    annotated_articles = len(set([
        db.query(models.Triple).filter(models.Triple.id == a.triple_id).first().pmid
        for a in annotations if a.predicate and not a.skipped and not a.flagged
    ]))
    
    completion_pct = (len(annotations) / total_triples * 100) if total_triples > 0 else 0
    
    return schemas.ProgressResponse(
        total_articles=total_articles,
        annotated_articles=annotated_articles,
        total_triples=total_triples,
        annotated_triples=annotated_triples,
        skipped_triples=skipped_triples,
        flagged_triples=flagged_triples,
        unannotated_triples=unannotated_triples,
        completion_percentage=round(completion_pct, 1)
    )

@app.get("/annotations/review", response_model=List[schemas.AnnotationResponse])
def get_review_items(annotator: str = "default", status: str = "flagged", db: Session = Depends(get_db)):
    query = db.query(models.Annotation).filter(
        models.Annotation.annotator == annotator
    )
    
    if status == "flagged":
        query = query.filter(models.Annotation.flagged == True)
    elif status == "skipped":
        query = query.filter(models.Annotation.skipped == True)
    
    return query.all()

@app.get("/articles/skipped", response_model=List[str])
def get_articles_with_skipped(annotator: str = "default", db: Session = Depends(get_db)):
    annotator = normalize_annotator(annotator)
    annotations = db.query(models.Annotation).filter(
        models.Annotation.annotator == annotator,
        models.Annotation.skipped == True
    ).all()
    
    pmids = set()
    for ann in annotations:
        triple = db.query(models.Triple).filter(models.Triple.id == ann.triple_id).first()
        if triple:
            pmids.add(triple.pmid)
    
    return list(pmids)

@app.get("/articles/flagged", response_model=List[str])
def get_articles_with_flagged(annotator: str = "default", db: Session = Depends(get_db)):
    annotator = normalize_annotator(annotator)
    annotations = db.query(models.Annotation).filter(
        models.Annotation.annotator == annotator,
        models.Annotation.flagged == True
    ).all()
    
    pmids = set()
    for ann in annotations:
        triple = db.query(models.Triple).filter(models.Triple.id == ann.triple_id).first()
        if triple:
            pmids.add(triple.pmid)
    
    return list(pmids)

@app.get("/stats", response_model=schemas.StatsResponse)
def get_stats(annotator: str = "default", db: Session = Depends(get_db)):
    annotator = normalize_annotator(annotator)
    stats = db.query(models.AnnotatorStats).filter(
        models.AnnotatorStats.annotator == annotator
    ).first()
    if not stats:
        return schemas.StatsResponse(
            total_annotations=0,
            streak_days=0,
            annotations_today=0,
            avg_per_minute=0.0,
            achievements=[]
        )
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    annotations_today = db.query(models.Annotation).filter(
        models.Annotation.annotator == annotator,
        models.Annotation.created_at >= today_start
    ).count()
    return schemas.StatsResponse(
        total_annotations=stats.total_annotations,
        streak_days=stats.streak_days,
        annotations_today=annotations_today,
        avg_per_minute=0.0,
        achievements=stats.achievements or []
    )

def update_annotator_stats(annotator: str, db: Session):
    stats = db.query(models.AnnotatorStats).filter(
        models.AnnotatorStats.annotator == annotator
    ).first()
    
    if not stats:
        stats = models.AnnotatorStats(
            annotator=annotator,
            total_annotations=1,
            streak_days=1,
            last_annotation_date=datetime.utcnow(timezone.utc),
            achievements=[]
        )
        db.add(stats)
        db.commit()
        return
    
    if stats.total_annotations is None:
        stats.total_annotations = 0
    if stats.streak_days is None:
        stats.streak_days = 0
    if stats.achievements is None:
        stats.achievements = []
    
    stats.total_annotations += 1
    
    today = datetime.now(timezone.utc).date()
    
    if stats.last_annotation_date:
        last_date = stats.last_annotation_date.date() if isinstance(stats.last_annotation_date, datetime) else stats.last_annotation_date
        days_diff = (today - last_date).days
        
        if days_diff == 1:
            stats.streak_days += 1
        elif days_diff > 1:
            stats.streak_days = 1
    else:
        stats.streak_days = 1
    
    stats.last_annotation_date = datetime.now(timezone.utc)
    
    achievements = list(stats.achievements)
    
    if stats.total_annotations >= 10 and 'first_10' not in achievements:
        achievements.append('first_10')
    if stats.total_annotations >= 100 and 'century' not in achievements:
        achievements.append('century')
    if stats.total_annotations >= 1000 and 'marathon' not in achievements:
        achievements.append('marathon')
    if stats.streak_days >= 3 and 'streak_3' not in achievements:
        achievements.append('streak_3')
    if stats.streak_days >= 7 and 'streak_7' not in achievements:
        achievements.append('streak_7')
    
    stats.achievements = achievements
    db.commit()

def normalize_annotator(name: str) -> str:
    """Normalize annotator name to lowercase"""
    return name.lower().strip()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)