// frontend/src/App.tsx - REPLACE ENTIRE FILE

import React, { useState, useEffect } from 'react';
import { AbstractView } from './components/AbstractView';
import { AnnotationPanel } from './components/AnnotationPanel';
import { ProgressBar } from './components/ProgressBar';
import { AdminDashboard } from './components/AdminDashboard';
import { api } from './api';
import { Article, Progress, Stats } from './types';

type Mode = 'normal' | 'review-skipped' | 'review-flagged';

function App() {
  const isAdminPage = window.location.pathname === '/admin' || 
                      new URLSearchParams(window.location.search).get('admin') === 'true';
  if (isAdminPage) {
    return <AdminDashboard />;
  }
  const [article, setArticle] = useState<Article | null>(null);
  const [currentTripleIndex, setCurrentTripleIndex] = useState(0);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('normal');
  const [reviewPmids, setReviewPmids] = useState<string[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);

  const annotator = 'default';

  const loadArticle = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getNextArticle();
      setArticle(data);
      setCurrentTripleIndex(0);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load article');
    } finally {
      setLoading(false);
    }
  };

  const loadSpecificArticle = async (pmid: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getArticle(pmid);
      setArticle(data);
      
      // Find first skipped/flagged triple
      let firstIndex = 0;
      if (mode === 'review-skipped') {
        firstIndex = data.triples.findIndex(t => t.skipped);
      } else if (mode === 'review-flagged') {
        firstIndex = data.triples.findIndex(t => t.flagged);
      }
      
      setCurrentTripleIndex(firstIndex >= 0 ? firstIndex : 0);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load article');
    } finally {
      setLoading(false);
    }
  };

  const enterReviewMode = async (reviewMode: 'review-skipped' | 'review-flagged') => {
    try {
      setLoading(true);
      const pmids = reviewMode === 'review-skipped' 
        ? await api.getSkippedArticles(annotator)
        : await api.getFlaggedArticles(annotator);
      
      if (pmids.length === 0) {
        alert(`No ${reviewMode === 'review-skipped' ? 'skipped' : 'flagged'} items to review!`);
        return;
      }
      
      setMode(reviewMode);
      setReviewPmids(pmids);
      setReviewIndex(0);
      await loadSpecificArticle(pmids[0]);
    } catch (err) {
      console.error('Failed to enter review mode:', err);
    } finally {
      setLoading(false);
    }
  };

  const exitReviewMode = () => {
    setMode('normal');
    setReviewPmids([]);
    setReviewIndex(0);
    loadArticle();
  };

  const nextReviewArticle = () => {
    if (reviewIndex < reviewPmids.length - 1) {
      const nextIndex = reviewIndex + 1;
      setReviewIndex(nextIndex);
      loadSpecificArticle(reviewPmids[nextIndex]);
    } else {
      // Finished reviewing
      exitReviewMode();
    }
  };

  const prevReviewArticle = () => {
    if (reviewIndex > 0) {
      const prevIndex = reviewIndex - 1;
      setReviewIndex(prevIndex);
      loadSpecificArticle(reviewPmids[prevIndex]);
    }
  };

  const loadProgress = async () => {
    try {
      const data = await api.getProgress(annotator);
      setProgress(data);
    } catch (err) {
      console.error('Failed to load progress:', err);
    }
  };

  const loadStats = async () => {
    try {
      const data = await api.getStats(annotator);
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  useEffect(() => {
    loadArticle();
    loadProgress();
    loadStats();
  }, []);

  const handleAnnotate = async (predicate: string, confidence: string, notes?: string) => {
    if (!article) return;

    const triple = article.triples[currentTripleIndex];

    try {
      await api.saveAnnotation({
        triple_id: triple.id,
        predicate,
        confidence,
        notes,
        skipped: false,
        flagged: false,
        annotator
      });

      const updatedTriples = [...article.triples];
      updatedTriples[currentTripleIndex] = {
        ...triple,
        predicate,
        confidence,
        notes,
        skipped: false,
        flagged: false
      };
      setArticle({ ...article, triples: updatedTriples });

      loadProgress();
      loadStats();
    } catch (err) {
      console.error('Failed to save annotation:', err);
    }
  };

  const handleSkip = async () => {
    if (!article) return;

    const triple = article.triples[currentTripleIndex];

    try {
      await api.saveAnnotation({
        triple_id: triple.id,
        confidence: 'medium',
        skipped: true,
        flagged: false,
        annotator
      });

      loadProgress();
      loadStats();

      if (currentTripleIndex < article.triples.length - 1) {
        setCurrentTripleIndex(currentTripleIndex + 1);
      } else {
        if (mode === 'review-skipped') {
          nextReviewArticle();
        } else {
          loadArticle();
        }
      }
    } catch (err) {
      console.error('Failed to skip:', err);
    }
  };

  const handleFlag = async () => {
    if (!article) return;

    const triple = article.triples[currentTripleIndex];

    try {
      await api.saveAnnotation({
        triple_id: triple.id,
        confidence: 'medium',
        skipped: false,
        flagged: true,
        annotator
      });

      loadProgress();
      loadStats();

      if (currentTripleIndex < article.triples.length - 1) {
        setCurrentTripleIndex(currentTripleIndex + 1);
      } else {
        if (mode === 'review-flagged') {
          nextReviewArticle();
        } else {
          loadArticle();
        }
      }
    } catch (err) {
      console.error('Failed to flag:', err);
    }
  };

  const handlePrevious = () => {
    if (currentTripleIndex > 0) {
      setCurrentTripleIndex(currentTripleIndex - 1);
    }
  };

  const handleNext = () => {
    if (!article) return;

    if (currentTripleIndex < article.triples.length - 1) {
      setCurrentTripleIndex(currentTripleIndex + 1);
    } else {
      if (mode.startsWith('review-')) {
        nextReviewArticle();
      } else {
        loadArticle();
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <div className="text-lg text-gray-600">Loading annotation task...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🎉</div>
          <div className="text-2xl font-bold mb-2">All Done!</div>
          <div className="text-gray-600">{error}</div>
        </div>
      </div>
    );
  }

  if (!article || article.triples.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🎉</div>
          <div className="text-2xl font-bold mb-2">No More Articles!</div>
          <div className="text-gray-600">You've completed all annotations.</div>
        </div>
      </div>
    );
  }

  const currentTriple = article.triples[currentTripleIndex];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-800">
              🔬 RELATE Annotation Interface
            </h1>
            <div className="flex items-center gap-4">
              {mode !== 'normal' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={exitReviewMode}
                    className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
                  >
                    ← Exit Review Mode
                  </button>
                  <div className="text-sm text-gray-600">
                    {mode === 'review-skipped' ? '⏭️ Reviewing Skipped' : '🚩 Reviewing Flagged'}
                    {' '}({reviewIndex + 1}/{reviewPmids.length})
                  </div>
                </div>
              )}
              {mode === 'normal' && (
                <>
                  <button
                    onClick={() => enterReviewMode('review-skipped')}
                    className="px-4 py-2 text-sm bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-lg"
                  >
                    ⏭️ Review Skipped
                  </button>
                  <button
                    onClick={() => enterReviewMode('review-flagged')}
                    className="px-4 py-2 text-sm bg-orange-100 hover:bg-orange-200 text-orange-800 rounded-lg"
                  >
                    🚩 Review Flagged
                  </button>
                </>
              )}
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Refresh
              </button>
              <div className="text-sm text-gray-600">
                👤 {annotator}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4">
        {progress && stats && <ProgressBar progress={progress} stats={stats} />}
      </div>

      <div className="max-w-7xl mx-auto px-4 mb-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">PMID: {article.pmid}</div>
              <div className="font-semibold text-gray-800">{article.title}</div>
            </div>
            <div className="text-sm text-gray-600">
              Year: {article.year} | {article.target_entity_count} target entities
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="grid grid-cols-2 gap-4" style={{ height: 'calc(100vh - 320px)' }}>
          <AbstractView
            abstract={article.abstract}
            highlightedEntities={[currentTriple.subject, currentTriple.object]}
          />
          <AnnotationPanel
            triple={currentTriple}
            tripleIndex={currentTripleIndex}
            totalTriples={article.triples.length}
            onAnnotate={handleAnnotate}
            onSkip={handleSkip}
            onFlag={handleFlag}
            onPrevious={handlePrevious}
            onNext={handleNext}
          />
        </div>
      </div>
    </div>
  );
}

export default App;