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
