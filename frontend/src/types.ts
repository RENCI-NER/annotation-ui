export interface Entity {
  id: number;
  text: string;
  normalized_id: string | null;
  normalized_label: string | null;
  biolink_types: string[];
  start_pos: number;
  end_pos: number;
}

export interface Triple {
  id: number;
  subject: Entity;
  subject_start: number;
  subject_end: number;
  object: Entity;
  object_start: number;
  object_end: number;
  distance_words: number;
  same_sentence: boolean;
  llm_suggestion: string | null;
  relationship_start: number;
  relationship_end: number;
  predicate: string | null;
  confidence: string | null;
  notes: string | null |undefined;
  skipped: boolean;
  flagged: boolean;
  annotated: boolean;
}

export interface Article {
  pmid: string;
  title: string;
  abstract: string;
  year: number;
  target_entity_count: number;
  entities: Entity[];
  triples: Triple[];
}

export interface Progress {
  total_articles: number;
  annotated_articles: number;
  total_triples: number;
  annotated_triples: number;
  skipped_triples: number;
  flagged_triples: number;
  unannotated_triples: number;
  completion_percentage: number;
}

export interface Stats {
  total_annotations: number;
  streak_days: number;
  annotations_today: number;
  avg_per_minute: number;
  achievements: string[];
}

export interface AnnotationCreate {
  triple_id: number;
  predicate?: string;
  confidence: string;
  notes?: string | null;
  skipped: boolean;
  flagged: boolean;
  annotator: string;
}


// ── TMKP Types ──────────────────────────────────────────────────────────────

export interface TmkpEvidence {
  id: number;
  publication: string;
  supporting_text: string;
  subject_start: number;
  subject_end: number;
  object_start: number;
  object_end: number;
  extraction_confidence: number;
  document_year: number | null;
  section_type: string | null;
}

export interface TmkpEdge {
  id: number;
  edge_id: string;
  category: string | null;
  subject_id: string;
  subject_name: string | null;
  predicate: string;
  object_id: string;
  object_name: string | null;
  qualified_predicate: string | null;
  object_aspect_qualifier: string | null;
  object_direction_qualifier: string | null;
  confidence_score: number;
  evidence_count: number;
  knowledge_level: string | null;
  agent_type: string | null;
  evidences: TmkpEvidence[];
  verdict: TmkpVerdict | null;
  verdict_notes: string | null;
}

export type TmkpVerdict = 'correct' | 'swap_so' | 'wrong_predicate' | 'wrong_subject' | 'wrong_object' | 'reject' | 'skip';

export interface TmkpAnnotationItem {
  edge_db_id: number;
  evidence_id: number;
  edge_id: string;
  category: string | null;
  subject_id: string;
  subject_name: string | null;
  predicate: string;
  object_id: string;
  object_name: string | null;
  qualified_predicate: string | null;
  object_aspect_qualifier: string | null;
  object_direction_qualifier: string | null;
  confidence_score: number;
  evidence_count: number;
  knowledge_level: string | null;
  agent_type: string | null;
  evidence: TmkpEvidence;
  verdict: TmkpVerdict | null;
  verdict_notes: string | null;
  item_index: number;
  total_items: number;
}

export interface TmkpVerificationCreate {
  edge_db_id: number;
  evidence_id?: number | null;
  verdict: TmkpVerdict;
  corrected_predicate?: string | null;
  corrected_subject?: string | null;
  corrected_object?: string | null;
  corrected_qualifiers?: Record<string, string> | null;
  notes?: string | null;
  annotator: string;
}

export interface TmkpProgress {
  total_edges: number;
  verified_edges: number;
  correct_count: number;
  rejected_count: number;
  swapped_count: number;
  wrong_predicate_count: number;
  wrong_subject_count: number;
  wrong_object_count: number;
  skipped_count: number;
  remaining: number;
  completion_percentage: number;
}
