from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey, DateTime, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Article(Base):
    __tablename__ = "articles"
    
    pmid = Column(String, primary_key=True)
    title = Column(Text)
    abstract = Column(Text)
    year = Column(Integer)
    target_entity_count = Column(Integer)
    target_entity_percentage = Column(Float)
    keywords = Column(JSON, default = list)
    
    entities = relationship("Entity", back_populates="article", cascade="all, delete-orphan")
    triples = relationship("Triple", back_populates="article", cascade="all, delete-orphan")

class Entity(Base):
    __tablename__ = "entities"
    
    id = Column(Integer, primary_key=True, index=True)
    pmid = Column(String, ForeignKey("articles.pmid"))
    text = Column(String)
    normalized_id = Column(String)
    normalized_label = Column(String)
    biolink_types = Column(JSON)
    start_pos = Column(Integer)
    end_pos = Column(Integer)
    
    article = relationship("Article", back_populates="entities")

class Triple(Base):
    __tablename__ = "triples"
    
    id = Column(Integer, primary_key=True, index=True)
    pmid = Column(String, ForeignKey("articles.pmid"))
    subject_id = Column(Integer, ForeignKey("entities.id"))
    object_id = Column(Integer, ForeignKey("entities.id"))
    distance_words = Column(Integer)
    same_sentence = Column(Boolean)
    llm_suggestion = Column(String, nullable=True)  #
    
    article = relationship("Article", back_populates="triples")
    subject = relationship("Entity", foreign_keys=[subject_id])
    object = relationship("Entity", foreign_keys=[object_id])
    annotations = relationship("Annotation", back_populates="triple", cascade="all, delete-orphan")

class Annotation(Base):
    __tablename__ = "annotations"
    
    id = Column(Integer, primary_key=True, index=True)
    triple_id = Column(Integer, ForeignKey("triples.id"))
    predicate = Column(String, nullable=True)
    confidence = Column(String)
    notes = Column(Text, nullable=True)
    annotator = Column(String, default="default")
    skipped = Column(Boolean, default=False)
    flagged = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    triple = relationship("Triple", back_populates="annotations")

class AnnotatorStats(Base):
    __tablename__ = "annotator_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    annotator = Column(String, unique=True)
    total_annotations = Column(Integer, default=0)
    streak_days = Column(Integer, default=0)
    last_annotation_date = Column(DateTime)
    achievements = Column(JSON, default=list)

class ArticleAssignment(Base):
    __tablename__ = "article_assignments"
    
    id = Column(Integer, primary_key=True, index=True)
    annotator = Column(String, index=True)
    pmid = Column(String, ForeignKey("articles.pmid"))
    assigned_at = Column(DateTime, default=datetime.utcnow)
    completed = Column(Boolean, default=False)
    
    article = relationship("Article")

class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    pmid = Column(String, ForeignKey("articles.pmid"))
    annotator = Column(String)
    assigned_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="pending")  # pending, in_progress, completed

    article = relationship("Article")


# ── TMKP Models ──────────────────────────────────────────────────────────────

class TmkpEdge(Base):
    __tablename__ = "tmkp_edges"

    id = Column(Integer, primary_key=True, index=True)
    edge_id = Column(String, unique=True, index=True)
    category = Column(String)
    subject_id = Column(String, index=True)
    subject_name = Column(String, nullable=True)
    predicate = Column(String)
    object_id = Column(String, index=True)
    object_name = Column(String, nullable=True)
    qualified_predicate = Column(String, nullable=True)
    object_aspect_qualifier = Column(String, nullable=True)
    object_direction_qualifier = Column(String, nullable=True)
    confidence_score = Column(Float)
    evidence_count = Column(Integer, default=1)
    knowledge_level = Column(String, nullable=True)
    agent_type = Column(String, nullable=True)

    evidences = relationship("TmkpEvidence", back_populates="edge", cascade="all, delete-orphan")
    verifications = relationship("TmkpVerification", back_populates="edge", cascade="all, delete-orphan")


class TmkpEvidence(Base):
    __tablename__ = "tmkp_evidences"

    id = Column(Integer, primary_key=True, index=True)
    edge_db_id = Column(Integer, ForeignKey("tmkp_edges.id"))
    study_id = Column(String, nullable=True)
    result_id = Column(String, nullable=True)
    publication = Column(String)
    supporting_text = Column(Text)
    subject_start = Column(Integer)
    subject_end = Column(Integer)
    object_start = Column(Integer)
    object_end = Column(Integer)
    extraction_confidence = Column(Float)
    document_year = Column(Integer, nullable=True)
    section_type = Column(String, nullable=True)

    edge = relationship("TmkpEdge", back_populates="evidences")


class TmkpVerification(Base):
    __tablename__ = "tmkp_verifications"

    id = Column(Integer, primary_key=True, index=True)
    edge_db_id = Column(Integer, ForeignKey("tmkp_edges.id"))
    evidence_id = Column(Integer, ForeignKey("tmkp_evidences.id"), nullable=True)
    annotator = Column(String, index=True)
    verdict = Column(String)  # correct, swap_so, wrong_predicate, wrong_subject, wrong_object, reject, skip
    corrected_predicate = Column(String, nullable=True)
    corrected_subject = Column(String, nullable=True)
    corrected_object = Column(String, nullable=True)
    corrected_qualifiers = Column(JSON, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    edge = relationship("TmkpEdge", back_populates="verifications")
    evidence = relationship("TmkpEvidence")


class TmkpAnnotatorLimit(Base):
    __tablename__ = "tmkp_annotator_limits"

    id = Column(Integer, primary_key=True, index=True)
    annotator = Column(String, unique=True, index=True)
    max_items = Column(Integer, default=500)
    created_at = Column(DateTime, default=datetime.utcnow)