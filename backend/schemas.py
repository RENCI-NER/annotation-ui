from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class EntityResponse(BaseModel):
    id: int
    text: str
    normalized_id: Optional[str]
    normalized_label: Optional[str]
    biolink_types: List[str]
    start_pos: int
    end_pos: int
    
    class Config:
        from_attributes = True

class TripleResponse(BaseModel):
    id: int
    subject: EntityResponse
    object: EntityResponse
    distance_words: int
    same_sentence: bool
    llm_suggestion: Optional[str] = None
    predicate: Optional[str] = None
    confidence: Optional[str] = None
    notes: Optional[str] = None
    skipped: bool = False
    flagged: bool = False
    distance_words: Optional[int] = None  
    same_sentence: Optional[bool] = None
    
    class Config:
        from_attributes = True

class FlaggedTripleInfo(BaseModel):
    triple_id: int
    pmid: str
    article_title: str
    subject_text: str
    object_text: str
    relationship: Optional[str]
    annotator: str
    predicate: Optional[str]
    notes: Optional[str]
    flagged_at: datetime
    
class ArticleResponse(BaseModel):
    pmid: str
    title: str
    abstract: str
    year: int
    target_entity_count: int
    entities: List[EntityResponse]
    triples: List[TripleResponse]
    
    class Config:
        from_attributes = True

class AnnotationCreate(BaseModel):
    triple_id: int
    predicate: Optional[str] = None
    confidence: str = "medium"
    notes: Optional[str] = None
    skipped: bool = False
    flagged: bool = False
    annotator: str = "default"

class AnnotatorInfo(BaseModel):
    annotator: str
    assigned_count: int
    completed_count: int
    pending_count: int
    
    class Config:
        from_attributes = True

class AssignmentCreate(BaseModel):
    annotator: str
    num_articles: int

class AssignmentResponse(BaseModel):
    annotator: str
    assigned_articles: int
    message: str

class AnnotationResponse(BaseModel):
    id: int
    triple_id: int
    predicate: Optional[str]
    confidence: str
    notes: Optional[str]
    skipped: bool
    flagged: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class ProgressResponse(BaseModel):
    total_articles: int
    annotated_articles: int
    total_triples: int
    annotated_triples: int
    skipped_triples: int
    flagged_triples: int
    unannotated_triples: int 
    completion_percentage: float

class StatsResponse(BaseModel):
    total_annotations: int
    streak_days: int
    annotations_today: int
    avg_per_minute: float
    achievements: List[str]

class AnnotatorInfo(BaseModel):
    annotator: str
    assigned_count: int
    completed_count: int
    pending_count: int

class AssignmentCreate(BaseModel):
    annotator: str
    num_articles: int

class AssignmentResponse(BaseModel):
    annotator: str
    assigned_articles: int
    message: str