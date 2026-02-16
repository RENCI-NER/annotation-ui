import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AbstractView } from './components/AbstractView';
import { AnnotationPanel } from './components/AnnotationPanel';
import { ProgressBar } from './components/ProgressBar';
import { AdminDashboard } from './components/AdminDashboard';
import { Login } from './components/Login';
import { useTheme } from './contexts/ThemeContext';
import { api } from './api';
import { CompletionModal } from './components/CompletionModal';
import { Article, Progress, Stats } from './types';

type Mode = 'normal' | 'review-skipped' | 'review-flagged';


function App() {
  const location = useLocation();
  const navigate = useNavigate();
  // ============ ALL HOOKS FIRST ============
  const { theme, toggleTheme } = useTheme();
  const [annotator, setAnnotator] = useState<string | null>(() => {
    return localStorage.getItem('annotator');
  });
  const [article, setArticle] = useState<Article | null>(null);
  const [currentTripleIndex, setCurrentTripleIndex] = useState(0);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('normal');
  const [reviewPmids, setReviewPmids] = useState<string[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showCompletionBanner, setShowCompletionBanner] = useState(false);


  // ============ ALL FUNCTIONS NEXT ============
  const loadArticle = async () => {
    if (!annotator) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.getNextArticle(annotator);
      setArticle(data);
      setCurrentTripleIndex(0);
      setShowCompletionBanner(false); // Hide banner when loading new article
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to load article';
      
      // If no assignments, show error screen
      if (errorMsg.includes("No articles assigned")) {
        setError(errorMsg);
        setArticle(null);
      } else {
        // All completed - still load the article but show banner
        setError(null);
        setShowCompletionBanner(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadSpecificArticle = async (pmid: string) => {
    if (!annotator) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.getArticle(pmid, annotator);
      setArticle(data);
      
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
    if (!annotator) return;
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
    if (!annotator) return;
    try {
      const data = await api.getProgress(annotator);
      setProgress(data);
    } catch (err) {
      console.error('Failed to load progress:', err);
    }
  };

  const loadStats = async () => {
    if (!annotator) return;
    try {
      const data = await api.getStats(annotator);
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const handleAnnotate = async (predicate: string, confidence: string, notes?: string) => {
    if (!article || !annotator) return;
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

      if (currentTripleIndex === article.triples.length - 1) {
        // Last triple - show completion modal
        setShowCompletionModal(true);
      } else {
        // Auto-advance to next triple
        setTimeout(() => {
          setCurrentTripleIndex(currentTripleIndex + 1);
        }, 500);
      }
    } catch (err) {
      console.error('Failed to save annotation:', err);
    }
  };

  const handleSkip = async () => {
    if (!article || !annotator) return;
    const triple = article.triples[currentTripleIndex];
  
    try {
      await api.saveAnnotation({
        triple_id: triple.id,
        confidence: 'medium',
        skipped: true,
        flagged: false,
        annotator
      });
  
      await loadProgress();
      await loadStats();
  
      // Only one advancement logic
      if (currentTripleIndex === article.triples.length - 1) {
        setShowCompletionModal(true);
      } else {
        setTimeout(() => {
          setCurrentTripleIndex(currentTripleIndex + 1);
        }, 300);
      }
    } catch (err) {
      console.error('Failed to skip:', err);
    }
  };
  
  const handleFlag = async () => {
    if (!article || !annotator) return;
    const triple = article.triples[currentTripleIndex];
  
    try {
      await api.saveAnnotation({
        triple_id: triple.id,
        confidence: 'medium',
        skipped: false,
        flagged: true,
        annotator
      });
  
      await loadProgress();
      await loadStats();
  
      // Only one advancement logic
      if (currentTripleIndex === article.triples.length - 1) {
        setShowCompletionModal(true);
      } else {
        setTimeout(() => {
          setCurrentTripleIndex(currentTripleIndex + 1);
        }, 300);
      }
    } catch (err) {
      console.error('Failed to flag:', err);
    }
  };

  const handleContinueToNextArticle = () => {
    setShowCompletionModal(false);
    if (mode.startsWith('review-')) {
      nextReviewArticle();
    } else {
      loadArticle();
    }
  };

  const handleReviewArticle = () => {
    setShowCompletionModal(false);
    setCurrentTripleIndex(0); // Go back to first triple
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

  // ============ useEffect AFTER ALL FUNCTIONS ============
  useEffect(() => {
    if (annotator && !isAdminPage) {
      loadArticle();
      loadProgress();
      loadStats();
    }
  }, [annotator]);

  // // ============ NOW CONDITIONALS AND RETURNS ============
  // const isAdminPage = window.location.pathname === '/admin' || 
  //                     new URLSearchParams(window.location.search).get('admin') === 'true';

  const isAdminPage = location.pathname == '/admin'

  if (isAdminPage) {
    return <AdminDashboard />;
  }

  if (!annotator) {
    return (
      <Login
        onLogin={(name) => {
          localStorage.setItem('annotator', name);
          setAnnotator(name);
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <div className="text-lg text-gray-600 dark:text-gray-300">Loading...</div>
        </div>
      </div>
    ); 
  }

  if (error) {
    const isCompleted = error.includes("completed");
    const noAssignments = error.includes("No articles assigned");
    
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">🎉</div>
          <div className="text-2xl font-bold mb-2 dark:text-white">
            {noAssignments ? "No Assignments" : isCompleted ? "All Done!" : "Complete!"}
          </div>
          <div className="text-gray-600 dark:text-gray-300 mb-6">{error}</div>
          
          {noAssignments && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Contact your administrator to get articles assigned.
              </p>
              <button
                onClick={() => {
                  localStorage.removeItem('annotator');
                  window.location.reload();
                }}
                className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"
              >
                Logout & Switch User
              </button>
            </div>
          )}
          
          {isCompleted && (
            <div className="space-y-3">
              <button
                onClick={() => {
                  setError(null);
                  loadArticle();
                }}
                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg block w-full"
              >
                Review My Annotations
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('annotator');
                  window.location.reload();
                }}
                className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg block w-full"
              >
                Logout & Switch User
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!article || article.triples.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🎉</div>
          <div className="text-2xl font-bold mb-2 dark:text-white">No More Articles!</div>
          <div className="text-gray-600 dark:text-gray-300">Completed all annotations.</div>
        </div>
      </div>
    );
  }

  const currentTriple = article.triples[currentTripleIndex];

  // ============ MAIN RENDER ============
  return (
    <Routes>
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/" element={
        !annotator ? (
          <Login onLogin={(name) => {
            localStorage.setItem('annotator', name);
            setAnnotator(name);
          }} />
        ) : (
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {showCompletionModal && (
              <CompletionModal
                onContinue={handleContinueToNextArticle}
                onReview={handleReviewArticle}
              />
            )}
            <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
              <div className="max-w-7xl mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                  <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
                    🔬 RELATE Annotation Interface
                  </h1>
                  <div className="flex items-center gap-4">
                    {mode !== 'normal' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={exitReviewMode}
                          className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg dark:text-gray-200"
                        >
                          ← Exit Review Mode
                        </button>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
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
                      className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg dark:text-gray-200"
                    >
                      Refresh
                    </button>
                    
                    <button
                      onClick={toggleTheme}
                      className="p-2 text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                      title="Toggle theme"
                    >
                      {theme === 'light' ? '🌙' : '☀️'}
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-300">👤 {annotator}</span>
                      <button
                        onClick={() => {
                          localStorage.removeItem('annotator');
                          window.location.reload();
                        }}
                        className="px-3 py-1 text-xs bg-red-50 text-red-600 hover:bg-red-100 rounded"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 py-4">
              {progress && stats && <ProgressBar progress={progress} stats={stats} />}
            </div>
            
            {showCompletionBanner && article && (
              <div className="max-w-7xl mx-auto px-4 mb-4">
                <div className="bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">🎉</div>
                    <div>
                      <div className="font-semibold text-green-800 dark:text-green-100">
                        All Assignments Completed!
                      </div>
                      <div className="text-sm text-green-600 dark:text-green-300">
                        You can review your work or contact admin for more articles
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      localStorage.removeItem('annotator');
                      window.location.reload();
                    }}
                    className="px-4 py-2 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm"
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}

            <div className="max-w-7xl mx-auto px-4 mb-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">PMID: {article.pmid}</div>
                    <div className="font-semibold text-gray-800 dark:text-white">{article.title}</div>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Year: {article.year} | {article.target_entity_count} target entities
                  </div>
                </div>
              </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 pb-8">
              <div className="grid grid-cols-2 gap-2" style={{ height: 'calc(100vh - 280px)' }}>
                <AbstractView
                  abstract={article.abstract}
                  highlightedEntities={[currentTriple.subject, currentTriple.object]}
                  currentTriple={currentTriple}
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
        )
      } />
    </Routes>
  );
}

export default App;