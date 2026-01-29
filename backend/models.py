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
    