import { useState, useEffect } from 'react';
import { AbstractView } from './components/AbstractView';
import { AnnotationPanel } from './components/AnnotationPanel';
import { ProgressBar } from './components/ProgressBar';
import { Login } from './components/Login';
import { AdminDashboard } from './components/AdminDashboard';
import { api } from './api';
import { Article, Progress, Stats } from './types';

function App() {
  const [annotator, setAnnotator] = useState<string | null>(
    localStorage.getItem('annotator')
  );
  const [isAdmin, setIsAdmin] = useState(false);
  const [article, setArticle] = useState<Article | null>(null);
  const [currentTripleIndex, setCurrentTripleIndex] = useState(0);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for admin mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true') {
      setIsAdmin(true);
      setLoading(false);
    }
  }, []);

  const loadArticle = async () => {
    if (!annotator) return;
  
    try {
      setLoading(true);
      setError(null);
      const data = await api.getNextArticle(annotator);  // Pass annotator here
      setArticle(data);
      setCurrentTripleIndex(0);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load article');
    } finally {
      setLoading(false);
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

  useEffect(() => {
    if (annotator && !isAdmin) {
      loadArticle();
      loadProgress();
      loadStats();
    }
  }, [annotator, isAdmin]);

  const handleLogin = (name: string) => {
    setAnnotator(name);
    localStorage.setItem('annotator', name);
  };

  const handleLogout = () => {
    setAnnotator(null);
    localStorage.removeItem('annotator');
    setArticle(null);
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
        notes
      };
      setArticle({ ...article, triples: updatedTriples });

      loadProgress();
      loadStats();
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

      loadProgress();
      loadStats();

      if (currentTripleIndex < article.triples.length - 1) {
        setCurrentTripleIndex(currentTripleIndex + 1);
      } else {
        loadArticle();
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

      loadProgress();
      loadStats();

      if (currentTripleIndex < article.triples.length - 1) {
        setCurrentTripleIndex(currentTripleIndex + 1);
      } else {
        loadArticle();
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
      loadArticle();
    }
  };

  // Show admin dashboard
  if (isAdmin) {
    return <AdminDashboard />;
  }

  // Show login if no annotator
  if (!annotator) {
    return <Login onLogin={handleLogin} />;
  }

  // Show loading
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

  // Show error/completion
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🎉</div>
          <div className="text-2xl font-bold mb-2">All Done!</div>
          <div className="text-gray-600 mb-4">{error}</div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
          >
            Logout
          </button>
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
          <div className="text-gray-600 mb-4">You've completed all annotations.</div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  const currentTriple = article.triples[currentTripleIndex];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-800">
              🔬 RELATE Annotation Interface
            </h1>
            <div className="flex items-center gap-4">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Refresh
              </button>
              <div className="text-sm text-gray-600">
                👤 {annotator}
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded-lg"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header> */}
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🧬</div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  RELATE Annotation Platform
                </h1>
                <p className="text-blue-100 text-sm">Biomedical Knowledge Graph Construction</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-sm bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all backdrop-blur-sm"
              >
                🔄 Refresh
              </button>
              <div className="px-4 py-2 bg-white/20 text-white rounded-lg backdrop-blur-sm">
                <div className="text-xs text-blue-100">Annotator</div>
                <div className="font-semibold">{annotator}</div>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4">
        {progress && stats && <ProgressBar progress={progress} stats={stats} />}
      </div>
      
      <div className="max-w-7xl mx-auto px-4 mb-4">
        <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-blue-500">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                  PMID: {article.pmid}
                </span>
                <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
                  📅 {article.year}
                </span>
                <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                  🔗 {article.target_entity_count} entities
                </span>
              </div>
              <h2 className="text-lg font-semibold text-gray-800 leading-tight">
                {article.title}
              </h2>
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