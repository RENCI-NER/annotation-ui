from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta

import models
import schemas
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)


app = FastAPI(title="Relation Annotation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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

@app.get("/articles/{pmid}", response_model=schemas.ArticleResponse)
def get_article(pmid: str, db: Session = Depends(get_db)):
    article = db.query(models.Article).filter(models.Article.pmid == pmid).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
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
    return article

@app.get("/articles/next/unannotated", response_model=schemas.ArticleResponse)
def get_next_unannotated_article(annotator: str = "default", db: Session = Depends(get_db)):
    """Get next article assigned to this annotator"""
    
    # Check if this annotator has assignments
    assignments = db.query(models.ArticleAssignment).filter(
        models.ArticleAssignment.annotator == annotator
    ).all()
    
    if assignments:
        # User has assignments - only show their assigned articles
        assigned_pmids = [a.pmid for a in assignments]
        
        for pmid in assigned_pmids:
            article = db.query(models.Article).filter(
                models.Article.pmid == pmid
            ).first()
            
            if not article:
                continue
            
            # Check if has unannotated triples for this annotator
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
                # Attach existing annotations
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
        
        raise HTTPException(
            status_code=404,
            detail=f"All your assigned articles are completed!"
        )
    
    else:
        # No assignments - show any unannotated article (old behavior)
        articles = db.query(models.Article).all()
        for article in articles:
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
                return article
        
        raise HTTPException(
            status_code=404,
            detail="No unannotated articles remaining"
        )   

@app.post("/annotations", response_model=schemas.AnnotationResponse)
def create_annotation(annotation: schemas.AnnotationCreate, db: Session = Depends(get_db)):
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
        return existing
    else:
        db_annotation = models.Annotation(**annotation.model_dump())
        db.add(db_annotation)
        db.commit()
        db.refresh(db_annotation)
        update_annotator_stats(annotation.annotator, db)
        return db_annotation

@app.get("/admin/annotators", response_model=List[schemas.AnnotatorInfo])
def get_annotators(db: Session = Depends(get_db)):
    """Get list of all annotators and their stats"""
    # Get all unique annotators
    annotators = db.query(models.ArticleAssignment.annotator).distinct().all()
    
    result = []
    for (annotator,) in annotators:
        assignments = db.query(models.ArticleAssignment).filter(
            models.ArticleAssignment.annotator == annotator
        ).all()
        
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
    """Assign N articles to an annotator"""
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
    
    # Create assignments
    for article in unassigned:
        new_assignment = models.ArticleAssignment(
            annotator=assignment.annotator,
            pmid=article.pmid
        )
        db.add(new_assignment)
    
    db.commit()
    
    return schemas.AssignmentResponse(
        annotator=assignment.annotator,
        assigned_articles=len(unassigned),
        message=f"Successfully assigned {len(unassigned)} articles"
    )

@app.get("/admin/stats")
def get_admin_stats(db: Session = Depends(get_db)):
    """Get overall statistics"""
    total_articles = db.query(models.Article).count()
    total_assigned = db.query(models.ArticleAssignment).count()
    total_completed = db.query(models.ArticleAssignment).filter(
        models.ArticleAssignment.completed == True
    ).count()
    
    return {
        "total_articles": total_articles,
        "total_assigned": total_assigned,
        "total_unassigned": total_articles - total_assigned,
        "total_completed": total_completed
    }

@app.delete("/admin/annotator/{annotator}")
def delete_annotator_assignments(annotator: str, db: Session = Depends(get_db)):
    """Delete all assignments for an annotator"""
    deleted = db.query(models.ArticleAssignment).filter(
        models.ArticleAssignment.annotator == annotator
    ).delete()
    
    db.commit()
    
    return {"message": f"Deleted {deleted} assignments for {annotator}"}

# @app.get("/progress", response_model=schemas.ProgressResponse)
# def get_progress(annotator: str = "default", db: Session = Depends(get_db)):
#     # Check if annotator has assignments
#     assignments = db.query(models.ArticleAssignment).filter(
#         models.ArticleAssignment.annotator == annotator
#     ).all()
    
#     if assignments:
#         # Show progress for assigned articles only
#         assigned_pmids = [a.pmid for a in assignments]
#         total_articles = len(assigned_pmids)
        
#         # Get triples from assigned articles
#         all_triples = db.query(models.Triple).filter(
#             models.Triple.pmid.in_(assigned_pmids)
#         ).all()
#         total_triples = len(all_triples)
        
#         # Get annotations by this annotator for assigned articles
#         triple_ids = [t.id for t in all_triples]
#         annotations = db.query(models.Annotation).filter(
#             models.Annotation.annotator == annotator,
#             models.Annotation.triple_id.in_(triple_ids)
#         ).all()
#     else:
#         # Show progress for all articles (old behavior)
#         total_articles = db.query(models.Article).count()
#         total_triples = db.query(models.Triple).count()
#         annotations = db.query(models.Annotation).filter(
#             models.Annotation.annotator == annotator
#         ).all()
    
#     annotated_triples = len([a for a in annotations if not a.skipped])
#     skipped_triples = len([a for a in annotations if a.skipped])
#     flagged_triples = len([a for a in annotations if a.flagged])
    
#     annotated_articles = len(set([
#         db.query(models.Triple).filter(models.Triple.id == a.triple_id).first().pmid
#         for a in annotations
#     ]))
    
#     completion_pct = (len(annotations) / total_triples * 100) if total_triples > 0 else 0
    
#     return schemas.ProgressResponse(
#         total_articles=total_articles,
#         annotated_articles=annotated_articles,
#         total_triples=total_triples,
#         annotated_triples=annotated_triples,
#         skipped_triples=skipped_triples,
#         flagged_triples=flagged_triples,
#         completion_percentage=round(completion_pct, 1)
#     )

@app.get("/articles/{pmid}", response_model=schemas.ArticleResponse)
def get_article(pmid: str, annotator: str = "default", db: Session = Depends(get_db)):
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
            triple.annotated = True  # Add this flag
        else:
            triple.annotated = False  # Not yet annotated
    
    return article

@app.get("/progress", response_model=schemas.ProgressResponse)
def get_progress(annotator: str = "default", db: Session = Depends(get_db)):
    total_articles = db.query(models.Article).count()
    total_triples = db.query(models.Triple).count()
    
    annotations = db.query(models.Annotation).filter(
        models.Annotation.annotator == annotator
    ).all()
    
    annotated_triples = len([a for a in annotations if a.predicate])  # Has predicate
    skipped_triples = len([a for a in annotations if a.skipped])
    flagged_triples = len([a for a in annotations if a.flagged])
    unannotated_triples = total_triples - len(annotations)
    
    annotated_articles = len(set([
        db.query(models.Triple).filter(models.Triple.id == a.triple_id).first().pmid
        for a in annotations if a.predicate
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

# Add endpoint to view skipped/flagged
@app.get("/annotations/review", response_model=List[schemas.AnnotationResponse])
def get_review_items(
    annotator: str = "default",
    status: str = "flagged",  # "flagged" or "skipped"
    db: Session = Depends(get_db)
):
    """Get all flagged or skipped annotations for review"""
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
    """Get list of PMIDs with skipped triples"""
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
    """Get list of PMIDs with flagged triples"""
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
    """Update annotator statistics"""
    stats = db.query(models.AnnotatorStats).filter(
        models.AnnotatorStats.annotator == annotator
    ).first()
    
    if not stats:
        # Create new stats if doesn't exist
        stats = models.AnnotatorStats(
            annotator=annotator,
            total_annotations=1,
            streak_days=1,
            last_annotation_date=datetime.utcnow(),
            achievements=[]
        )
        db.add(stats)
        db.commit()
        return  # STOP HERE - don't continue to the code below
    
    # Only reach here if stats already exists
    # CRITICAL: Initialize NULL fields BEFORE doing any math
    if stats.total_annotations is None:
        stats.total_annotations = 0
    if stats.streak_days is None:
        stats.streak_days = 0
    if stats.achievements is None:
        stats.achievements = []
    
    # NOW it's safe to increment
    stats.total_annotations += 1
    
    today = datetime.utcnow().date()
    
    # Update streak
    if stats.last_annotation_date:
        last_date = stats.last_annotation_date.date() if isinstance(stats.last_annotation_date, datetime) else stats.last_annotation_date
        days_diff = (today - last_date).days
        
        if days_diff == 1:
            stats.streak_days += 1
        elif days_diff > 1:
            stats.streak_days = 1
    else:
        stats.streak_days = 1
    
    stats.last_annotation_date = datetime.utcnow()
    
    # Update achievements
    achievements = list(stats.achievements)  # Make a copy
    
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
