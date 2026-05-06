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
    keywords: List[str] = []
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


# ── TMKP Schemas ─────────────────────────────────────────────────────────────

class TmkpEvidenceResponse(BaseModel):
    id: int
    publication: str
    supporting_text: str
    subject_start: int
    subject_end: int
    object_start: int
    object_end: int
    extraction_confidence: float
    document_year: Optional[int] = None
    section_type: Optional[str] = None

    class Config:
        from_attributes = True


class TmkpEdgeResponse(BaseModel):
    id: int
    edge_id: str
    category: Optional[str] = None
    subject_id: str
    subject_name: Optional[str] = None
    predicate: str
    object_id: str
    object_name: Optional[str] = None
    qualified_predicate: Optional[str] = None
    object_aspect_qualifier: Optional[str] = None
    object_direction_qualifier: Optional[str] = None
    confidence_score: float
    evidence_count: int
    knowledge_level: Optional[str] = None
    agent_type: Optional[str] = None
    evidences: List[TmkpEvidenceResponse] = []
    verdict: Optional[str] = None
    verdict_notes: Optional[str] = None

    class Config:
        from_attributes = True


class TmkpAnnotationItem(BaseModel):
    """One unit of annotation: a triple paired with a single evidence."""
    edge_db_id: int
    evidence_id: int
    edge_id: str
    category: Optional[str] = None
    subject_id: str
    subject_name: Optional[str] = None
    predicate: str
    object_id: str
    object_name: Optional[str] = None
    qualified_predicate: Optional[str] = None
    object_aspect_qualifier: Optional[str] = None
    object_direction_qualifier: Optional[str] = None
    confidence_score: float
    evidence_count: int
    knowledge_level: Optional[str] = None
    agent_type: Optional[str] = None
    evidence: TmkpEvidenceResponse
    verdict: Optional[str] = None
    verdict_notes: Optional[str] = None
    item_index: int
    total_items: int


class TmkpVerificationCreate(BaseModel):
    edge_db_id: int
    evidence_id: Optional[int] = None
    verdict: str
    corrected_predicate: Optional[str] = None
    corrected_subject: Optional[str] = None
    corrected_object: Optional[str] = None
    corrected_qualifiers: Optional[dict] = None
    notes: Optional[str] = None
    annotator: str = "default"


class TmkpVerificationResponse(BaseModel):
    id: int
    edge_db_id: int
    evidence_id: Optional[int] = None
    annotator: str
    verdict: str
    corrected_predicate: Optional[str] = None
    corrected_subject: Optional[str] = None
    corrected_object: Optional[str] = None
    corrected_qualifiers: Optional[dict] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TmkpProgressResponse(BaseModel):
    total_edges: int
    verified_edges: int
    correct_count: int
    rejected_count: int
    swapped_count: int
    wrong_predicate_count: int
    wrong_subject_count: int
    wrong_object_count: int
    skipped_count: int
    remaining: int
    completion_percentage: float


class TmkpAssignmentCreate(BaseModel):
    annotator: str
    num_edges: int


class TmkpAssignmentResponse(BaseModel):
    annotator: str
    assigned_edges: int
    message: str