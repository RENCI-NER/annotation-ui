import axios from 'axios';
import { Article, Progress, Stats, AnnotationCreate, TmkpAnnotationItem, TmkpProgress, TmkpVerificationCreate } from './types';

const API_BASE = window.location.hostname === 'localhost' 
  ? 'http://localhost:8000'  // Development
  : '/api';  // Production


export const adminAuth = async (password: string): Promise<boolean> => {
  try {
    await axios.post(`${API_BASE}/admin/auth`, { password });
    return true;
  } catch {
    return false;
  }
};

export const checkNameTaken = async (name: string): Promise<boolean> => {
  try {
    const response = await axios.post(`${API_BASE}/check-name`, { name });
    return response.data.taken;
  } catch {
    return false;
  }
};

export const api = {
  createAnnotator: async (name: string) => {
    const response = await axios.post(`${API_BASE}/admin/annotator/${name}`);
    return response.data;
  },
  
  getAllAnnotatorNames: async () => {
    const response = await axios.get(`${API_BASE}/admin/all-annotators`);
    return response.data;
  },
  
  getAssignmentMatrix: async (keywords?: string) => {
    const params = keywords ? { keywords } : {};
    const response = await axios.get(`${API_BASE}/admin/assignment-matrix`, { params });
    return response.data;
  },

  getAllKeywords: async () => {
    const response = await axios.get(`${API_BASE}/admin/keywords`);
    return response.data;
  },

  extractAllKeywords: async () => {
    const response = await axios.post(`${API_BASE}/admin/extract-all-keywords`);
    return response.data;
  },

  getSkippedArticles: async (annotator: string = 'default'): Promise<string[]> => {
    const response = await axios.get(`${API_BASE}/articles/skipped`, {
      params: { annotator }
    });
    return response.data;
  },

  getFlaggedArticles: async (annotator: string = 'default'): Promise<string[]> => {
    const response = await axios.get(`${API_BASE}/articles/flagged`, {
      params: { annotator }
    });
    return response.data;  
  },

  getNextArticle: async (annotator: string = 'default'): Promise<Article> => {
    const response = await axios.get(`${API_BASE}/articles/next/unannotated`, {
      params: { annotator }  
    });
    return response.data;
  },

  getSkippedTriples: async (annotator: string) => {
    const response = await axios.get(`${API_BASE}/admin/skipped`, {  
      params: { annotator }
    });
    return response.data;
  },
  
  getFlaggedTriples: async (annotator: string) => {
    const response = await axios.get(`${API_BASE}/admin/flagged`, {
      params: { annotator }
    });
    return response.data;
  },

  getArticle: async (pmid: string, annotator: string = 'default'): Promise<Article> => {
    const response = await axios.get(`${API_BASE}/articles/${pmid}`, {
      params: { annotator }  
    });
    return response.data;
  },

  saveAnnotation: async (annotation: AnnotationCreate) => {
    const response = await axios.post(`${API_BASE}/annotations`, annotation);
    return response.data;
  },

  getProgress: async (annotator: string = 'default'): Promise<Progress> => {
    const response = await axios.get(`${API_BASE}/progress`, {
      params: { annotator }
    });
    return response.data;
  },

  getStats: async (annotator: string = 'default'): Promise<Stats> => {
    const response = await axios.get(`${API_BASE}/stats`, {
      params: { annotator }
    });
    return response.data;
  },

  getAnnotators: async (): Promise<AnnotatorInfo[]> => {
    const response = await axios.get(`${API_BASE}/admin/annotators`);
    return response.data;
  },

  assignArticles: async (annotator: string, numArticles: number) => {
    const response = await axios.post(`${API_BASE}/admin/assign`, {
      annotator,
      num_articles: numArticles
    });
    return response.data;
  },

  getAdminStats: async (): Promise<AdminStats> => {
    const response = await axios.get(`${API_BASE}/admin/stats`);
    return response.data;
  },

  deleteAnnotatorAssignments: async (annotator: string) => {
    const response = await axios.delete(`${API_BASE}/admin/annotator/${annotator}`);
    return response.data;
  },
  
  resetAnnotator: async (annotator: string) => {
    const response = await axios.post(`${API_BASE}/admin/annotator/${annotator}/reset`);
    return response.data;
  },

  exportAnnotations: async (annotator?: string, status: 'all' | 'completed' | 'partial' = 'all') => {
    const params = new URLSearchParams();
    if (annotator) params.append('annotator', annotator);
    params.append('status', status);
    
    const response = await axios.get(`${API_BASE}/admin/export/annotations?${params}`, {
      responseType: 'blob'
    });
    
    // Trigger download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `annotations_${annotator || 'all'}_${status}.json`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },
  
  getAllFlagged: async () => {
    const response = await axios.get(`${API_BASE}/admin/flagged`);
    return response.data;
  },
  
  deleteTriple: async (tripleId: number) => {
    const response = await axios.delete(`${API_BASE}/admin/triple/${tripleId}`);
    return response.data;
  },
  
  reassignTriple: async (tripleId: number, newAnnotator: string) => {
    const response = await axios.post(`${API_BASE}/admin/triple/${tripleId}/reassign`, null, {
      params: { new_annotator: newAnnotator }
    });
    return response.data;
  },

  getMultiAnnotatedArticles: async () => {
    const response = await axios.get(`${API_BASE}/admin/multi-annotated-articles`);
    return response.data;
  },

  getAnnotationComparison: async (pmid: string) => {
    const response = await axios.get(`${API_BASE}/admin/comparison/${pmid}`);
    return response.data;
  },
  
  assignSpecificArticle: async (pmid: string, annotator: string) => {
    const response = await axios.post(`${API_BASE}/admin/assign-article/${pmid}/${annotator}`);
    return response.data;
  },
  
  unassignArticle: async (pmid: string, annotator: string) => {
    const response = await axios.delete(`${API_BASE}/admin/unassign-article/${pmid}/${annotator}`);
    return response.data;
  },

  uploadCorpus: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await axios.post(`${API_BASE}/admin/upload-corpus`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  },
};

export interface AnnotatorInfo {
  annotator: string;
  assigned_count: number;
  completed_count: number;
  pending_count: number;
};

export interface AdminStats {
  total_articles: number;
  total_assigned: number;
  total_unassigned: number;
  total_completed: number;
};


// ── TMKP API ────────────────────────────────────────────────────────────────

export const tmkpApi = {
  getBatch: async (annotator: string = 'default', limit = 100): Promise<TmkpAnnotationItem[]> => {
    const response = await axios.get(`${API_BASE}/tmkp/items/batch`, {
      params: { annotator, limit },
    });
    return response.data;
  },

  getItem: async (evidenceId: number, annotator: string = 'default'): Promise<TmkpAnnotationItem> => {
    const response = await axios.get(`${API_BASE}/tmkp/items/${evidenceId}`, {
      params: { annotator },
    });
    return response.data;
  },

  listItems: async (annotator: string = 'default', skip = 0, limit = 100): Promise<TmkpAnnotationItem[]> => {
    const response = await axios.get(`${API_BASE}/tmkp/items`, {
      params: { annotator, skip, limit },
    });
    return response.data;
  },

  saveVerification: async (verification: TmkpVerificationCreate) => {
    const response = await axios.post(`${API_BASE}/tmkp/verify`, verification);
    return response.data;
  },

  deleteVerification: async (edgeDbId: number, annotator: string, evidenceId?: number | null) => {
    const params: Record<string, any> = { edge_db_id: edgeDbId, annotator };
    if (evidenceId != null) params.evidence_id = evidenceId;
    const response = await axios.delete(`${API_BASE}/tmkp/verify`, { params });
    return response.data;
  },

  getProgress: async (annotator: string = 'default'): Promise<TmkpProgress> => {
    const response = await axios.get(`${API_BASE}/tmkp/progress`, {
      params: { annotator },
    });
    return response.data;
  },

  getAdminStats: async () => {
    const response = await axios.get(`${API_BASE}/tmkp/admin/stats`);
    return response.data;
  },

  getAnnotators: async () => {
    const response = await axios.get(`${API_BASE}/tmkp/admin/annotators`);
    return response.data;
  },

  setAnnotatorLimit: async (annotator: string, maxItems: number) => {
    const response = await axios.post(`${API_BASE}/tmkp/admin/set-limit`, {
      annotator,
      max_items: maxItems,
    });
    return response.data;
  },

  getAnnotatorLimits: async () => {
    const response = await axios.get(`${API_BASE}/tmkp/admin/limits`);
    return response.data;
  },

  exportVerifications: async () => {
    const response = await axios.get(`${API_BASE}/tmkp/admin/export`);
    return response.data;
  },

  exportRaw: async (annotator?: string) => {
    const params = annotator ? { annotator } : {};
    const response = await axios.get(`${API_BASE}/tmkp/admin/export/raw`, { params });
    return response.data;
  },

  suggestVerdict: async (edgeDbId: number, evidenceId: number): Promise<{ verdict: string; confidence: number; reasoning: string }> => {
    const response = await axios.post(`${API_BASE}/tmkp/suggest-verdict`, {
      edge_db_id: edgeDbId,
      evidence_id: evidenceId,
    });
    return response.data;
  },

  uploadJsonl: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post(`${API_BASE}/tmkp/admin/upload-jsonl`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getLlmConfig: async () => {
    const response = await axios.get(`${API_BASE}/tmkp/admin/llm-config`);
    return response.data;
  },

  setLlmConfig: async (config: { provider?: string; base_url?: string; model?: string; api_key?: string }) => {
    const response = await axios.post(`${API_BASE}/tmkp/admin/llm-config`, config);
    return response.data;
  },
};

