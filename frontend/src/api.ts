import axios from 'axios';
import { Article, Progress, Stats, AnnotationCreate } from './types';

const API_BASE = 'http://localhost:8000';

export const api = {
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

  getArticle: async (pmid: string): Promise<Article> => {
    const response = await axios.get(`${API_BASE}/articles/${pmid}`);
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
  }
};

export interface AnnotatorInfo {
  annotator: string;
  assigned_count: number;
  completed_count: number;
  pending_count: number;
}

export interface AdminStats {
  total_articles: number;
  total_assigned: number;
  total_unassigned: number;
  total_completed: number;
}

