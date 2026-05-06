from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, timezone
import json
import random

import models
import schemas
from database import get_db

router = APIRouter(prefix="/tmkp", tags=["tmkp"])

TARGET_REVIEWERS = 2


def normalize_annotator(name: str) -> str:
    return name.lower().strip()


# ── Annotation item (edge + single evidence) ───────────────────────────────

def _make_annotation_item(
    edge: models.TmkpEdge,
    evidence: models.TmkpEvidence,
    db: Session,
    annotator: str,
    item_index: int,
    total_items: int,
) -> schemas.TmkpAnnotationItem:
    verification = db.query(models.TmkpVerification).filter(
        models.TmkpVerification.edge_db_id == edge.id,
        models.TmkpVerification.evidence_id == evidence.id,
        models.TmkpVerification.annotator == annotator,
    ).first()

    return schemas.TmkpAnnotationItem(
        edge_db_id=edge.id,
        evidence_id=evidence.id,
        edge_id=edge.edge_id,
        category=edge.category,
        subject_id=edge.subject_id,
        subject_name=edge.subject_name,
        predicate=edge.predicate,
        object_id=edge.object_id,
        object_name=edge.object_name,
        qualified_predicate=edge.qualified_predicate,
        object_aspect_qualifier=edge.object_aspect_qualifier,
        object_direction_qualifier=edge.object_direction_qualifier,
        confidence_score=edge.confidence_score,
        evidence_count=edge.evidence_count,
        knowledge_level=edge.knowledge_level,
        agent_type=edge.agent_type,
        evidence=schemas.TmkpEvidenceResponse(
            id=evidence.id,
            publication=evidence.publication,
            supporting_text=evidence.supporting_text,
            subject_start=evidence.subject_start,
            subject_end=evidence.subject_end,
            object_start=evidence.object_start,
            object_end=evidence.object_end,
            extraction_confidence=evidence.extraction_confidence,
            document_year=evidence.document_year,
            section_type=evidence.section_type,
        ),
        verdict=verification.verdict if verification else None,
        verdict_notes=verification.notes if verification else None,
        item_index=item_index,
        total_items=total_items,
    )


# ── Next item ───────────────────────────────────────────────────────────────

@router.get("/items/next", response_model=schemas.TmkpAnnotationItem)
def get_next_item(annotator: str = "default", db: Session = Depends(get_db)):
    """
    Self-serve evidence-level assignment with dual-annotator priority.
    Each (edge, evidence) pair is one annotation item.
    Priority:
      1. Items with exactly 1 other annotator (needs 2nd for IAA)
      2. Items with 0 annotations (fresh)
    Never gives the same annotator an item twice.
    """
    annotator = normalize_annotator(annotator)

    my_verified = set(
        (v.edge_db_id, v.evidence_id) for v in db.query(
            models.TmkpVerification.edge_db_id,
            models.TmkpVerification.evidence_id,
        ).filter(
            models.TmkpVerification.annotator == annotator,
            models.TmkpVerification.evidence_id.isnot(None),
        ).all()
    )

    all_evidences = db.query(models.TmkpEvidence).all()
    if not all_evidences:
        raise HTTPException(status_code=404, detail="No edges in database. Upload a JSONL file first.")

    verification_counts: dict[tuple[int, int], int] = {}
    for row in db.query(
        models.TmkpVerification.edge_db_id,
        models.TmkpVerification.evidence_id,
        func.count(models.TmkpVerification.id),
    ).filter(
        models.TmkpVerification.evidence_id.isnot(None),
    ).group_by(
        models.TmkpVerification.edge_db_id,
        models.TmkpVerification.evidence_id,
    ).all():
        verification_counts[(row[0], row[1])] = row[2]

    needs_second = []
    needs_first = []

    for ev in all_evidences:
        key = (ev.edge_db_id, ev.id)
        if key in my_verified:
            continue
        count = verification_counts.get(key, 0)
        if count == 1:
            needs_second.append(ev)
        elif count == 0:
            needs_first.append(ev)

    if needs_second:
        chosen_ev = random.choice(needs_second)
    elif needs_first:
        chosen_ev = random.choice(needs_first)
    else:
        if my_verified:
            raise HTTPException(status_code=404, detail="All available edges verified! Great work.")
        raise HTTPException(status_code=404, detail="No edges available. Upload a JSONL file first.")

    edge = db.query(models.TmkpEdge).filter(models.TmkpEdge.id == chosen_ev.edge_db_id).first()
    all_ev_for_edge = db.query(models.TmkpEvidence).filter(
        models.TmkpEvidence.edge_db_id == edge.id
    ).order_by(models.TmkpEvidence.id).all()
    ev_index = next((i for i, e in enumerate(all_ev_for_edge) if e.id == chosen_ev.id), 0)

    return _make_annotation_item(edge, chosen_ev, db, annotator, ev_index + 1, len(all_ev_for_edge))


# ── Get specific item ───────────────────────────────────────────────────────

@router.get("/items/{evidence_id}", response_model=schemas.TmkpAnnotationItem)
def get_item(evidence_id: int, annotator: str = "default", db: Session = Depends(get_db)):
    annotator = normalize_annotator(annotator)
    evidence = db.query(models.TmkpEvidence).filter(models.TmkpEvidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")
    edge = db.query(models.TmkpEdge).filter(models.TmkpEdge.id == evidence.edge_db_id).first()
    all_ev = db.query(models.TmkpEvidence).filter(
        models.TmkpEvidence.edge_db_id == edge.id
    ).order_by(models.TmkpEvidence.id).all()
    ev_index = next((i for i, e in enumerate(all_ev) if e.id == evidence_id), 0)
    return _make_annotation_item(edge, evidence, db, annotator, ev_index + 1, len(all_ev))


# ── List verified items ─────────────────────────────────────────────────────

@router.get("/items", response_model=List[schemas.TmkpAnnotationItem])
def list_items(
    annotator: str = "default",
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """List items this annotator has verified (for review mode)."""
    annotator = normalize_annotator(annotator)

    verifications = db.query(models.TmkpVerification).filter(
        models.TmkpVerification.annotator == annotator,
        models.TmkpVerification.evidence_id.isnot(None),
    ).order_by(models.TmkpVerification.created_at).offset(skip).limit(limit).all()

    results = []
    for v in verifications:
        evidence = db.query(models.TmkpEvidence).filter(models.TmkpEvidence.id == v.evidence_id).first()
        if not evidence:
            continue
        edge = db.query(models.TmkpEdge).filter(models.TmkpEdge.id == v.edge_db_id).first()
        if not edge:
            continue
        all_ev = db.query(models.TmkpEvidence).filter(
            models.TmkpEvidence.edge_db_id == edge.id
        ).order_by(models.TmkpEvidence.id).all()
        ev_index = next((i for i, e in enumerate(all_ev) if e.id == evidence.id), 0)
        results.append(_make_annotation_item(edge, evidence, db, annotator, ev_index + 1, len(all_ev)))
    return results


# ── Legacy edge endpoints (kept for admin/export) ──────────────────────────

@router.get("/edges/next", response_model=schemas.TmkpEdgeResponse)
def get_next_edge(annotator: str = "default", db: Session = Depends(get_db)):
    """Legacy: redirects logic to item-based. Still returns edge-level response."""
    annotator = normalize_annotator(annotator)

    my_verified_ids = set(
        v.edge_db_id for v in db.query(models.TmkpVerification.edge_db_id).filter(
            models.TmkpVerification.annotator == annotator
        ).all()
    )

    total_edges = db.query(models.TmkpEdge).count()
    if total_edges == 0:
        raise HTTPException(status_code=404, detail="No edges in database. Upload a JSONL file first.")

    verification_counts = dict(
        db.query(models.TmkpVerification.edge_db_id, func.count(models.TmkpVerification.id))
        .filter(models.TmkpVerification.evidence_id.is_(None))
        .group_by(models.TmkpVerification.edge_db_id)
        .all()
    )

    needs_second = []
    needs_first = []

    all_edge_ids = [eid for (eid,) in db.query(models.TmkpEdge.id).all()]

    for eid in all_edge_ids:
        if eid in my_verified_ids:
            continue
        count = verification_counts.get(eid, 0)
        if count == 1:
            needs_second.append(eid)
        elif count == 0:
            needs_first.append(eid)

    if needs_second:
        edge_id = random.choice(needs_second)
    elif needs_first:
        edge_id = random.choice(needs_first)
    else:
        my_count = len(my_verified_ids)
        if my_count > 0:
            raise HTTPException(status_code=404, detail="All available edges verified! Great work.")
        raise HTTPException(status_code=404, detail="No edges available. Upload a JSONL file first.")

    edge = db.query(models.TmkpEdge).filter(models.TmkpEdge.id == edge_id).first()
    return _edge_to_response(edge, db, annotator)


@router.get("/edges/{edge_db_id}", response_model=schemas.TmkpEdgeResponse)
def get_edge(edge_db_id: int, annotator: str = "default", db: Session = Depends(get_db)):
    annotator = normalize_annotator(annotator)
    edge = db.query(models.TmkpEdge).filter(models.TmkpEdge.id == edge_db_id).first()
    if not edge:
        raise HTTPException(status_code=404, detail="Edge not found")
    return _edge_to_response(edge, db, annotator)


@router.get("/edges", response_model=List[schemas.TmkpEdgeResponse])
def list_edges(
    annotator: str = "default",
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """List edges this annotator has verified (for review mode)."""
    annotator = normalize_annotator(annotator)

    verified_ids = [
        v.edge_db_id for v in db.query(models.TmkpVerification).filter(
            models.TmkpVerification.annotator == annotator,
        ).order_by(models.TmkpVerification.created_at).offset(skip).limit(limit).all()
    ]

    results = []
    seen = set()
    for eid in verified_ids:
        if eid in seen:
            continue
        seen.add(eid)
        edge = db.query(models.TmkpEdge).filter(models.TmkpEdge.id == eid).first()
        if edge:
            results.append(_edge_to_response(edge, db, annotator))
    return results


# ── Verification ─────────────────────────────────────────────────────────────

@router.post("/verify", response_model=schemas.TmkpVerificationResponse)
def save_verification(v: schemas.TmkpVerificationCreate, db: Session = Depends(get_db)):
    v.annotator = normalize_annotator(v.annotator)

    edge = db.query(models.TmkpEdge).filter(models.TmkpEdge.id == v.edge_db_id).first()
    if not edge:
        raise HTTPException(status_code=404, detail="Edge not found")

    filters = [
        models.TmkpVerification.edge_db_id == v.edge_db_id,
        models.TmkpVerification.annotator == v.annotator,
    ]
    if v.evidence_id is not None:
        filters.append(models.TmkpVerification.evidence_id == v.evidence_id)
    else:
        filters.append(models.TmkpVerification.evidence_id.is_(None))

    existing = db.query(models.TmkpVerification).filter(*filters).first()

    if existing:
        existing.verdict = v.verdict
        existing.corrected_predicate = v.corrected_predicate
        existing.corrected_subject = v.corrected_subject
        existing.corrected_object = v.corrected_object
        existing.corrected_qualifiers = v.corrected_qualifiers
        existing.notes = v.notes
        existing.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return existing
    else:
        db_v = models.TmkpVerification(**v.model_dump())
        db.add(db_v)
        db.commit()
        db.refresh(db_v)
        return db_v


# ── Progress ─────────────────────────────────────────────────────────────────

@router.get("/progress", response_model=schemas.TmkpProgressResponse)
def get_progress(annotator: str = "default", db: Session = Depends(get_db)):
    annotator = normalize_annotator(annotator)

    verifications = db.query(models.TmkpVerification).filter(
        models.TmkpVerification.annotator == annotator,
    ).all()

    counts = {
        "correct": 0, "reject": 0, "swap_so": 0,
        "wrong_predicate": 0, "wrong_subject": 0, "wrong_object": 0,
        "skip": 0,
    }
    for v in verifications:
        if v.verdict in counts:
            counts[v.verdict] += 1

    verified = len(verifications)
    total_evidences = db.query(models.TmkpEvidence).count()

    my_verified_keys = {(v.edge_db_id, v.evidence_id) for v in verifications if v.evidence_id is not None}
    remaining = total_evidences - len(my_verified_keys)
    remaining = max(0, remaining)

    pct = (verified / (verified + remaining) * 100) if (verified + remaining) > 0 else 0

    return schemas.TmkpProgressResponse(
        total_edges=verified + remaining,
        verified_edges=verified,
        correct_count=counts["correct"],
        rejected_count=counts["reject"],
        swapped_count=counts["swap_so"],
        wrong_predicate_count=counts["wrong_predicate"],
        wrong_subject_count=counts["wrong_subject"],
        wrong_object_count=counts["wrong_object"],
        skipped_count=counts["skip"],
        remaining=remaining,
        completion_percentage=round(pct, 1),
    )


# ── Admin ────────────────────────────────────────────────────────────────────

@router.get("/admin/stats")
def get_admin_stats(db: Session = Depends(get_db)):
    total_evidences = db.query(models.TmkpEvidence).count()
    total_edges = db.query(models.TmkpEdge).count()

    verified_items = db.query(
        models.TmkpVerification.edge_db_id,
        models.TmkpVerification.evidence_id,
    ).filter(
        models.TmkpVerification.evidence_id.isnot(None),
    ).distinct().count()

    verification_counts: dict[tuple, int] = {}
    for row in db.query(
        models.TmkpVerification.edge_db_id,
        models.TmkpVerification.evidence_id,
        func.count(models.TmkpVerification.id),
    ).filter(
        models.TmkpVerification.evidence_id.isnot(None),
    ).group_by(
        models.TmkpVerification.edge_db_id,
        models.TmkpVerification.evidence_id,
    ).all():
        verification_counts[(row[0], row[1])] = row[2]

    dual_reviewed = sum(1 for c in verification_counts.values() if c >= TARGET_REVIEWERS)

    return {
        "total_edges": total_edges,
        "total_items": total_evidences,
        "total_verified": verified_items,
        "dual_reviewed": dual_reviewed,
        "needs_second": verified_items - dual_reviewed,
        "unreviewed": total_evidences - verified_items,
    }


@router.get("/admin/annotators")
def get_tmkp_annotators(db: Session = Depends(get_db)):
    annotators = db.query(models.TmkpVerification.annotator).distinct().all()
    result = []
    for (annotator,) in annotators:
        count = db.query(models.TmkpVerification).filter(
            models.TmkpVerification.annotator == annotator
        ).count()
        result.append({
            "annotator": annotator,
            "verified_count": count,
        })
    result.sort(key=lambda x: x["verified_count"], reverse=True)
    return result


@router.get("/admin/export")
def export_collated(db: Session = Depends(get_db)):
    """
    Collated export grouped by edge (triple).
    - Evidence-level verdicts are resolved by majority across annotators.
    - Rejected/skipped evidences are removed from the edge.
    - If all evidences are rejected, the entire edge is dropped.
    - Corrections (predicate, subject, object) are included when present.
    """
    edges = db.query(models.TmkpEdge).all()
    export = []

    for edge in edges:
        evidences = db.query(models.TmkpEvidence).filter(
            models.TmkpEvidence.edge_db_id == edge.id
        ).all()
        if not evidences:
            continue

        surviving_evidences = []
        edge_corrections: dict = {}

        for ev in evidences:
            verifications = db.query(models.TmkpVerification).filter(
                models.TmkpVerification.edge_db_id == edge.id,
                models.TmkpVerification.evidence_id == ev.id,
            ).all()

            if not verifications:
                surviving_evidences.append(_export_evidence(ev, []))
                continue

            verdicts = [v.verdict for v in verifications]
            majority = max(set(verdicts), key=verdicts.count)

            if majority in ("reject", "skip"):
                continue

            for v in verifications:
                if v.corrected_predicate and "corrected_predicate" not in edge_corrections:
                    edge_corrections["corrected_predicate"] = v.corrected_predicate
                if v.corrected_subject and "corrected_subject" not in edge_corrections:
                    edge_corrections["corrected_subject"] = v.corrected_subject
                if v.corrected_object and "corrected_object" not in edge_corrections:
                    edge_corrections["corrected_object"] = v.corrected_object

            surviving_evidences.append(_export_evidence(ev, verifications))

        if not surviving_evidences:
            continue

        edge_data = {
            "edge_id": edge.edge_id,
            "subject_id": edge.subject_id,
            "subject_name": edge.subject_name,
            "predicate": edge.predicate,
            "object_id": edge.object_id,
            "object_name": edge.object_name,
            "qualified_predicate": edge.qualified_predicate,
            "object_aspect_qualifier": edge.object_aspect_qualifier,
            "object_direction_qualifier": edge.object_direction_qualifier,
            "confidence_score": edge.confidence_score,
            "category": edge.category,
            "knowledge_level": edge.knowledge_level,
            "agent_type": edge.agent_type,
            "total_evidences": len(evidences),
            "surviving_evidences": len(surviving_evidences),
            **edge_corrections,
            "evidences": surviving_evidences,
        }
        export.append(edge_data)

    return export


@router.get("/admin/export/raw")
def export_raw(annotator: Optional[str] = None, db: Session = Depends(get_db)):
    """Flat export: one row per verification (for analysis)."""
    query = db.query(models.TmkpVerification)
    if annotator:
        query = query.filter(models.TmkpVerification.annotator == normalize_annotator(annotator))

    verifications = query.all()
    export = []
    for v in verifications:
        edge = db.query(models.TmkpEdge).filter(models.TmkpEdge.id == v.edge_db_id).first()
        if not edge:
            continue
        item = {
            "edge_id": edge.edge_id,
            "subject_id": edge.subject_id,
            "subject_name": edge.subject_name,
            "predicate": edge.predicate,
            "object_id": edge.object_id,
            "object_name": edge.object_name,
            "qualified_predicate": edge.qualified_predicate,
            "confidence_score": edge.confidence_score,
            "annotator": v.annotator,
            "verdict": v.verdict,
            "corrected_predicate": v.corrected_predicate,
            "corrected_subject": v.corrected_subject,
            "corrected_object": v.corrected_object,
            "notes": v.notes,
            "verified_at": v.updated_at.isoformat() if v.updated_at else None,
        }
        if v.evidence_id:
            evidence = db.query(models.TmkpEvidence).filter(models.TmkpEvidence.id == v.evidence_id).first()
            if evidence:
                item["evidence_id"] = evidence.id
                item["evidence_publication"] = evidence.publication
                item["evidence_text"] = evidence.supporting_text
        export.append(item)
    return export


def _export_evidence(ev: models.TmkpEvidence, verifications: list) -> dict:
    verdicts = [v.verdict for v in verifications] if verifications else []
    majority = max(set(verdicts), key=verdicts.count) if verdicts else None
    return {
        "evidence_id": ev.id,
        "publication": ev.publication,
        "supporting_text": ev.supporting_text,
        "subject_start": ev.subject_start,
        "subject_end": ev.subject_end,
        "object_start": ev.object_start,
        "object_end": ev.object_end,
        "extraction_confidence": ev.extraction_confidence,
        "document_year": ev.document_year,
        "section_type": ev.section_type,
        "consensus_verdict": majority,
        "annotator_verdicts": [
            {"annotator": v.annotator, "verdict": v.verdict, "notes": v.notes}
            for v in verifications
        ],
    }


@router.post("/admin/upload-jsonl")
async def upload_tmkp_jsonl(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".jsonl"):
        raise HTTPException(status_code=400, detail="File must be .jsonl")

    contents = await file.read()
    lines = contents.decode("utf-8").strip().split("\n")

    added = 0
    skipped = 0
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            data = json.loads(line)
            result = _ingest_tmkp_edge(data, db)
            if result:
                added += 1
            else:
                skipped += 1
        except (json.JSONDecodeError, KeyError):
            skipped += 1

    db.commit()

    if added > 0:
        try:
            from node_norm import resolve_names
            edges_needing_names = db.query(models.TmkpEdge).filter(
                (models.TmkpEdge.subject_name.is_(None)) | (models.TmkpEdge.object_name.is_(None))
            ).all()
            curies = set()
            for e in edges_needing_names:
                if not e.subject_name:
                    curies.add(e.subject_id)
                if not e.object_name:
                    curies.add(e.object_id)
            if curies:
                names = resolve_names(list(curies))
                for e in edges_needing_names:
                    if not e.subject_name and names.get(e.subject_id):
                        e.subject_name = names[e.subject_id]
                    if not e.object_name and names.get(e.object_id):
                        e.object_name = names[e.object_id]
                db.commit()
        except Exception:
            pass

    return {"added": added, "skipped": skipped, "total_lines": len(lines)}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _edge_to_response(
    edge: models.TmkpEdge, db: Session, annotator: str
) -> schemas.TmkpEdgeResponse:
    verification = db.query(models.TmkpVerification).filter(
        models.TmkpVerification.edge_db_id == edge.id,
        models.TmkpVerification.annotator == annotator,
        models.TmkpVerification.evidence_id.is_(None),
    ).first()

    return schemas.TmkpEdgeResponse(
        id=edge.id,
        edge_id=edge.edge_id,
        category=edge.category,
        subject_id=edge.subject_id,
        subject_name=edge.subject_name,
        predicate=edge.predicate,
        object_id=edge.object_id,
        object_name=edge.object_name,
        qualified_predicate=edge.qualified_predicate,
        object_aspect_qualifier=edge.object_aspect_qualifier,
        object_direction_qualifier=edge.object_direction_qualifier,
        confidence_score=edge.confidence_score,
        evidence_count=edge.evidence_count,
        knowledge_level=edge.knowledge_level,
        agent_type=edge.agent_type,
        evidences=[
            schemas.TmkpEvidenceResponse(
                id=ev.id,
                publication=ev.publication,
                supporting_text=ev.supporting_text,
                subject_start=ev.subject_start,
                subject_end=ev.subject_end,
                object_start=ev.object_start,
                object_end=ev.object_end,
                extraction_confidence=ev.extraction_confidence,
                document_year=ev.document_year,
                section_type=ev.section_type,
            )
            for ev in edge.evidences
        ],
        verdict=verification.verdict if verification else None,
        verdict_notes=verification.notes if verification else None,
    )


def _ingest_tmkp_edge(data: dict, db: Session) -> bool:
    edge_id = data.get("id", "")
    if not edge_id:
        return False

    existing = db.query(models.TmkpEdge).filter(models.TmkpEdge.edge_id == edge_id).first()
    if existing:
        return False

    category_list = data.get("category", [])
    category = category_list[0] if category_list else None

    edge = models.TmkpEdge(
        edge_id=edge_id,
        category=category,
        subject_id=data.get("subject", ""),
        predicate=data.get("predicate", ""),
        object_id=data.get("object", ""),
        qualified_predicate=data.get("qualified_predicate"),
        object_aspect_qualifier=data.get("object_aspect_qualifier"),
        object_direction_qualifier=data.get("object_direction_qualifier"),
        confidence_score=data.get("has_confidence_score", 0.0),
        evidence_count=data.get("evidence_count", 1),
        knowledge_level=data.get("knowledge_level"),
        agent_type=data.get("agent_type"),
    )
    db.add(edge)
    db.flush()

    studies = data.get("has_supporting_studies", {})
    for study_id, study in studies.items():
        for result in study.get("has_study_results", []):
            texts = result.get("supporting_text", [])
            subj_loc = result.get("subject_location_in_text", [0, 0])
            obj_loc = result.get("object_location_in_text", [0, 0])
            pubs = result.get("xref", data.get("publications", []))

            for text in texts:
                ev = models.TmkpEvidence(
                    edge_db_id=edge.id,
                    study_id=study_id,
                    result_id=result.get("id"),
                    publication=pubs[0] if pubs else "",
                    supporting_text=text,
                    subject_start=subj_loc[0] if len(subj_loc) > 0 else 0,
                    subject_end=subj_loc[1] if len(subj_loc) > 1 else 0,
                    object_start=obj_loc[0] if len(obj_loc) > 0 else 0,
                    object_end=obj_loc[1] if len(obj_loc) > 1 else 0,
                    extraction_confidence=result.get("extraction_confidence_score", 0.0),
                    document_year=result.get("supporting_document_year"),
                    section_type=result.get("supporting_text_section_type"),
                )
                db.add(ev)

    return True
