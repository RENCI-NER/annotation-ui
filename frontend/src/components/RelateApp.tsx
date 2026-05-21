import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AbstractView } from './AbstractView';
import { AnnotationPanel } from './AnnotationPanel';
import { AdminDashboard } from './AdminDashboard';
import { Login } from './Login';
import { useTheme } from '../contexts/ThemeContext';
import { api, adminAuth } from '../api';
import { CompletionModal } from './CompletionModal';
import { Article, Progress, Stats } from '../types';
import { InfoTip } from './InfoTip';

type Mode = 'normal' | 'review-skipped' | 'review-flagged';

// ─── Reusable Fixed Header ───────────────────────────────────────────────────
interface NavbarProps {
  annotator: string;
  mode: Mode;
  reviewIndex: number;
  reviewPmids: string[];
  theme: string;
  onToggleTheme: () => void;
  onLogout: () => void;
  onEnterReview: (mode: 'review-skipped' | 'review-flagged') => void;
  onExitReview: () => void;
  onNavigateAdmin: () => void;
  onNavigateHome: () => void;
}

const Navbar: React.FC<NavbarProps> = ({
  annotator, mode, reviewIndex, reviewPmids,
  theme, onToggleTheme, onLogout,
  onEnterReview, onExitReview, onNavigateAdmin, onNavigateHome
}) => (
  <header className="
    flex-shrink-0 h-14 z-50
    bg-slate-900 border-b border-slate-700/60
    shadow-[0_1px_12px_rgba(0,0,0,0.3)]
  ">
    <div className="h-full max-w-[1600px] mx-auto px-5 flex items-center justify-between gap-4">

      {/* Logo */}
      <div className="flex items-center gap-2.5 shrink-0 cursor-pointer" onClick={onNavigateHome}>
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-400 to-cyan-600
        flex items-center justify-center shadow-lg shadow-teal-900/40">
        <span className="text-white text-xs font-bold tracking-tight">R</span>
      </div>
        <span className="font-semibold text-white tracking-tight text-sm">
          RELATE <span className="text-teal-400">Annotation</span>
        </span>
      </div>

      {/* Mode indicator */}
      {mode !== 'normal' && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10
          border border-amber-500/30 rounded-lg">
          <span className="text-xs text-amber-400 font-medium">
            {mode === 'review-skipped' ? '⏭ Reviewing Skipped' : '🚩 Reviewing Flagged'}
          </span>
          <span className="text-xs text-amber-300/60">
            {reviewIndex + 1}/{reviewPmids.length}
          </span>
        </div>
      )}

      {/* Right actions */}
      <div className="flex items-center gap-1.5 ml-auto">
        {mode === 'normal' ? (
          <>
            <button
              onClick={() => onEnterReview('review-skipped')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                text-slate-300 hover:text-white hover:bg-slate-700/70
                rounded-md transition-all duration-150"
            >
              ⏭ Review Skipped
            </button>
            <button
              onClick={() => onEnterReview('review-flagged')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                text-slate-300 hover:text-white hover:bg-slate-700/70
                rounded-md transition-all duration-150"
            >
              🚩 Review Flagged
            </button>
          </>
        ) : (
          <button
            onClick={onExitReview}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
              text-slate-300 hover:text-white hover:bg-slate-700/70
              rounded-md transition-all duration-150"
          >
            ← Exit Review
          </button>
        )}

        <div className="w-px h-4 bg-slate-600 mx-1" />

        <button
          onClick={onNavigateAdmin}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
            bg-teal-500/10 hover:bg-teal-500/20 text-teal-400
            border border-teal-500/30 rounded-md transition-all duration-150"
        >
          ⚙️ Admin
        </button>

        <button
          onClick={onToggleTheme}
          className="w-8 h-8 flex items-center justify-center text-slate-400
            hover:text-white hover:bg-slate-700/70 rounded-md transition-all duration-150 text-base"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>

        <div className="w-px h-4 bg-slate-600 mx-1" />

        {/* User pill */}
        <div className="flex items-center gap-2 pl-1">
          <div className="w-6 h-6 rounded-full bg-teal-500/20 border border-teal-500/40
            flex items-center justify-center text-xs text-teal-400 font-bold uppercase">
            {annotator?.[0]}
          </div>
          <span className="text-xs text-slate-300 font-medium">{annotator}</span>
          <button
            onClick={onLogout}
            className="text-xs text-slate-500 hover:text-red-400 transition-colors ml-1"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  </header>
);

// ─── Admin Navbar (simpler) ───────────────────────────────────────────────────
const AdminNavbar: React.FC<{
  theme: string;
  onToggleTheme: () => void;
  onBack: () => void;
}> = ({ theme, onToggleTheme, onBack }) => (
  <header className="
    flex-shrink-0 h-14 z-50
    bg-slate-900 border-b border-slate-700/60
    shadow-[0_1px_12px_rgba(0,0,0,0.3)]
  ">
    <div className="h-full max-w-[1600px] mx-auto px-5 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-400 to-cyan-600
        flex items-center justify-center shadow-lg shadow-teal-900/40">
        <span className="text-white text-xs font-bold">R</span>
      </div>
        <span className="font-semibold text-white tracking-tight text-sm">
          RELATE <span className="text-teal-400">Admin</span>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
            text-slate-300 hover:text-white hover:bg-slate-700/70
            rounded-md transition-all duration-150"
        >
          ← Annotation View
        </button>
        <button
          onClick={onToggleTheme}
          className="w-8 h-8 flex items-center justify-center text-slate-400
            hover:text-white hover:bg-slate-700/70 rounded-md transition-all text-base"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>
    </div>
  </header>
);

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard: React.FC<{
  label: string;
  value: number;
  color: 'teal' | 'amber' | 'orange' | 'slate';
}> = ({ label, value, color }) => {
  const styles = {
    teal:   'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400',
    amber:  'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400',
    slate:  'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300',
  };
  return (
    <div className={`rounded-xl border p-3 text-center ${styles[color]}`}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">{label}</div>
    </div>
  );
};

// ─── Full-screen loading / error states ──────────────────────────────────────
const FullScreen: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="h-screen flex flex-col items-center justify-center
    bg-slate-50 dark:bg-slate-900">
    {children}
  </div>
);

export const Footer: React.FC = () => (
  <footer className="flex-shrink-0 bg-gradient-to-r from-slate-900 to-slate-950 text-white">
    <div className="h-0.5 bg-gradient-to-r from-teal-500 via-cyan-400 to-teal-500" />

    <div className="max-w-[1600px] mx-auto px-5 py-2.5">
      <div className="flex items-center justify-between gap-4">

        {/* Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 bg-gradient-to-br from-teal-400 to-cyan-600
            rounded-lg flex items-center justify-center shadow-lg shadow-teal-900/40">
            <span className="text-white text-xs font-bold">R</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-white">RELATE</span>
            <span className="text-xs text-slate-500">v1.0.0</span>
          </div>
        </div>

        {/* Links */}
        <div className="flex items-center gap-5">
          <a href="https://arxiv.org/abs/2509.19057"
            target="_blank" rel="noopener noreferrer"
            className="text-xs text-slate-400 hover:text-teal-400 transition-colors flex items-center gap-1">
            RELATE Paper
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <a href="https://github.com/RENCI-NER/pred-mapping"
            target="_blank" rel="noopener noreferrer"
            className="text-xs text-slate-400 hover:text-teal-400 transition-colors flex items-center gap-1">
             Source Code
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <a href="https://renci.org"
            target="_blank" rel="noopener noreferrer"
            className="text-xs text-slate-400 hover:text-teal-400 transition-colors flex items-center gap-1">
            RENCI
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <a href="https://ncats.nih.gov/translator"
            target="_blank" rel="noopener noreferrer"
            className="text-xs text-slate-400 hover:text-teal-400 transition-colors flex items-center gap-1">
            NCATS Translator
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>

        {/* Copyright */}
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-500">
            Funded by NIH LitCoin (#75N95023C00032) · © {new Date().getFullYear()} RENCI
          </p>
        </div>
      </div>
    </div>
  </footer>
);

// ─── RelateApp ──────────────────────────────────────────────────────────────
export const RelateApp: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [annotator, setAnnotator] = useState<string | null>(() => localStorage.getItem('annotator'));
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
  const [reviewTripleIds, setReviewTripleIds] = useState<number[]>([]);
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');

  const isAdminPage = location.pathname.endsWith('/admin');

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthError('');
    const ok = await adminAuth(adminPassword);
    if (ok) {
      setAdminAuthenticated(true);
    } else {
      setAdminAuthError('Invalid password');
    }
  };

  // ── Data loaders ────────────────────────────────────────────────────────────
  const loadArticle = async () => {
    if (!annotator) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.getNextArticle(annotator);
      setArticle(data);
      setCurrentTripleIndex(0);
      setShowCompletionBanner(false);
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to load article';
      if (errorMsg.includes('No articles assigned')) {
        setError(errorMsg);
        setArticle(null);
      } else {
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
      if (mode === 'review-skipped') firstIndex = data.triples.findIndex(t => t.skipped);
      else if (mode === 'review-flagged') firstIndex = data.triples.findIndex(t => t.flagged);
      setCurrentTripleIndex(firstIndex >= 0 ? firstIndex : 0);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load article');
    } finally {
      setLoading(false);
    }
  };

  const loadSpecificArticleInMode = async (
    pmid: string,
    reviewMode: Mode,
    targetTripleId?: number
  ) => {
    if (!annotator) return;
    try {
      setLoading(true);
      const data = await api.getArticle(pmid, annotator);
      setArticle(data);

      let firstIndex = 0;
      if (targetTripleId) {
        firstIndex = data.triples.findIndex((t: any) => t.id === targetTripleId);
      } else if (reviewMode === 'review-skipped') {
        firstIndex = data.triples.findIndex((t: any) => t.skipped === true);
      } else if (reviewMode === 'review-flagged') {
        firstIndex = data.triples.findIndex((t: any) => t.flagged === true);
      }

      setCurrentTripleIndex(firstIndex >= 0 ? firstIndex : 0);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load article');
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    if (!annotator) return;
    try { setProgress(await api.getProgress(annotator)); }
    catch (err) { console.error('Failed to load progress:', err); }
  };

  const loadStats = async () => {
    if (!annotator) return;
    try { setStats(await api.getStats(annotator)); }
    catch (err) { console.error('Failed to load stats:', err); }
  };

  // ── Review mode ─────────────────────────────────────────────────────────────
  const enterReviewMode = async (reviewMode: 'review-skipped' | 'review-flagged') => {
    if (!annotator) return;
    try {
      setLoading(true);
      const items = reviewMode === 'review-flagged'
      ? await api.getFlaggedTriples(annotator)
      : await api.getSkippedTriples(annotator);

      if (!items || items.length === 0) {
        alert(`No ${reviewMode === 'review-skipped' ? 'skipped' : 'flagged'} items!`);
        return;
      }

      const pmids = items.map((i: any) => i.pmid);
      const tripleIds = items.map((i: any) => i.triple_id);

      setMode(reviewMode);
      setReviewPmids(pmids);
      setReviewTripleIds(tripleIds);
      setReviewIndex(0);
      await loadSpecificArticleInMode(pmids[0], reviewMode, tripleIds[0]);
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
      const next = reviewIndex + 1;
      setReviewIndex(next);
      loadSpecificArticle(reviewPmids[next]);
    } else {
      exitReviewMode();
    }
  };

  // ── Annotation handlers ─────────────────────────────────────────────────────
  const handleAnnotate = async (predicate: string, confidence: string, notes?: string) => {
    if (!article || !annotator) return;
    const triple = article.triples[currentTripleIndex];
    try {
      await api.saveAnnotation({ triple_id: triple.id, predicate, confidence, notes, skipped: false, flagged: false, annotator });
      const updatedTriples = [...article.triples];
      updatedTriples[currentTripleIndex] = { ...triple, predicate, confidence, notes, skipped: false, flagged: false };
      setArticle({ ...article, triples: updatedTriples });
      loadProgress();
      loadStats();
      if (currentTripleIndex === article.triples.length - 1) {
        setShowCompletionModal(true);
      } else {
        setTimeout(() => setCurrentTripleIndex(currentTripleIndex + 1), 500);
      }
    } catch (err) { console.error('Failed to save annotation:', err); }
  };

  const handleSkip = async () => {
    if (!article || !annotator) return;
    const triple = article.triples[currentTripleIndex];
    try {
      await api.saveAnnotation({ triple_id: triple.id, confidence: 'medium', skipped: true, flagged: false, annotator });
      await loadProgress();
      await loadStats();
      if (currentTripleIndex === article.triples.length - 1) setShowCompletionModal(true);
      else setTimeout(() => setCurrentTripleIndex(currentTripleIndex + 1), 300);
    } catch (err) { console.error('Failed to skip:', err); }
  };

  const handleFlag = async () => {
    if (!article || !annotator) return;
    const triple = article.triples[currentTripleIndex];
    try {
      await api.saveAnnotation({ triple_id: triple.id, confidence: 'medium', skipped: false, flagged: true, annotator });
      await loadProgress();
      await loadStats();
      if (currentTripleIndex === article.triples.length - 1) setShowCompletionModal(true);
      else setTimeout(() => setCurrentTripleIndex(currentTripleIndex + 1), 300);
    } catch (err) { console.error('Failed to flag:', err); }
  };

  const handlePrevious = () => { if (currentTripleIndex > 0) setCurrentTripleIndex(currentTripleIndex - 1); };
  const handleNext = () => {
    if (!article) return;
    if (currentTripleIndex < article.triples.length - 1) setCurrentTripleIndex(currentTripleIndex + 1);
    else mode.startsWith('review-') ? nextReviewArticle() : loadArticle();
  };

  const handleLogout = () => { localStorage.removeItem('annotator'); window.location.reload(); };

  useEffect(() => {
    if (annotator && !isAdminPage) {
      loadArticle();
      loadProgress();
      loadStats();
    }
  }, [annotator]);

  // ── Admin route ─────────────────────────────────────────────────────────────
  if (isAdminPage) {
    if (!adminAuthenticated) {
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
          <div className="w-full max-w-sm p-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl">
            <div className="flex items-center justify-center gap-2.5 mb-6">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-blue-600
                flex items-center justify-center shadow-lg shadow-blue-900/40">
                <span className="text-white text-sm font-bold">R</span>
              </div>
              <span className="font-semibold text-slate-800 dark:text-white tracking-tight">
                RELATE <span className="text-sky-500">Admin</span>
              </span>
            </div>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Admin Password
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter password"
                  autoFocus
                  className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200
                    dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500
                    text-slate-800 dark:text-white placeholder:text-slate-400"
                />
              </div>
              {adminAuthError && (
                <div className="text-xs text-red-500 font-medium">{adminAuthError}</div>
              )}
              <button type="submit"
                className="w-full py-2.5 text-sm font-medium bg-sky-500 hover:bg-sky-600
                  text-white rounded-lg transition-colors shadow-sm">
                Sign In
              </button>
            </form>
            <button onClick={() => navigate('/relate-triples')}
              className="mt-4 w-full text-center text-xs text-slate-400 hover:text-slate-600
                dark:hover:text-slate-300 transition-colors">
              ← Back to Annotation View
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
        <AdminNavbar
          theme={theme}
          onToggleTheme={toggleTheme}
          onBack={() => navigate('/relate-triples')}
        />
        <main className="flex-1 overflow-y-auto">
          <AdminDashboard />
        </main>
        <Footer />
      </div>
    );
  }

  // ── Login ───────────────────────────────────────────────────────────────────
  if (!annotator) {
    return <Login onLogin={(name) => { localStorage.setItem('annotator', name); setAnnotator(name); }} />;
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <FullScreen>
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-teal-400 border-t-transparent
            rounded-full animate-spin mx-auto mb-4" />
          <div className="text-sm text-slate-500 dark:text-slate-400">Loading article...</div>
        </div>
      </FullScreen>
    );
  }

  // ── Error / No assignment ────────────────────────────────────────────────────
  if (error) {
    const noAssignments = error.includes('No articles assigned');
    const isCompleted = error.includes('completed');
    return (
      <FullScreen>
        <div className="text-center max-w-md px-6">
          <div className="text-5xl mb-5">{noAssignments ? '📋' : '🎉'}</div>
          <div className="text-2xl font-bold mb-2 dark:text-white">
            {noAssignments ? 'No Assignments Yet' : isCompleted ? 'All Done!' : 'Complete!'}
          </div>
          <div className="text-slate-500 dark:text-slate-400 mb-8 text-sm">{error}</div>
          <div className="space-y-3">
            {isCompleted && (
              <button
                onClick={() => { setError(null); loadArticle(); }}
                className="w-full px-5 py-2.5 bg-teal-500 hover:bg-teal-600 text-white
                  rounded-lg text-sm font-medium transition-colors"
              >
                Review My Annotations
              </button>
            )}
            <button
              onClick={handleLogout}
              className="w-full px-5 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300
                dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200
                rounded-lg text-sm font-medium transition-colors"
            >
              Logout & Switch User
            </button>
          </div>
        </div>
      </FullScreen>
    );
  }

  // ── No article ───────────────────────────────────────────────────────────────
  if (!article || article.triples.length === 0) {
    return (
      <FullScreen>
        <div className="text-5xl mb-4">🎉</div>
        <div className="text-2xl font-bold dark:text-white mb-2">No More Articles!</div>
        <div className="text-slate-500 dark:text-slate-400 text-sm">All annotations completed.</div>
      </FullScreen>
    );
  }

  const currentTriple = article.triples[currentTripleIndex];

  // ── Main annotation view ────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">

      {showCompletionModal && (
        <CompletionModal
          onContinue={() => {
            setShowCompletionModal(false);
            mode.startsWith('review-') ? nextReviewArticle() : loadArticle();
          }}
          onReview={() => { setShowCompletionModal(false); setCurrentTripleIndex(0); }}
        />
      )}

      {/* HEADER */}
      <Navbar
        annotator={annotator}
        mode={mode}
        reviewIndex={reviewIndex}
        reviewPmids={reviewPmids}
        theme={theme}
        onToggleTheme={toggleTheme}
        onLogout={handleLogout}
        onEnterReview={enterReviewMode}
        onExitReview={exitReviewMode}
        onNavigateAdmin={() => navigate('/relate-triples/admin')}
        onNavigateHome={() => navigate('/')}
      />

      {/* SUBHEADER - progress + article info */}
      <div className="flex-shrink-0 bg-white dark:bg-slate-800
        border-b border-slate-200 dark:border-slate-700 px-5 py-3">
        <div className="max-w-[1600px] mx-auto space-y-2">

          {/* Stats row */}
          {progress && (
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Progress</span>
              <InfoTip text="Annotated = triples with a predicate selected. Skipped = deferred for later. Flagged = marked as problematic. Remaining = not yet reviewed. Use 'Review Skipped/Flagged' in the header to revisit." align="right" />
            </div>
          )}
          {progress && (
            <div className="grid grid-cols-4 gap-2">
              <StatCard label="Annotated" value={progress.annotated_triples ?? 0} color="teal" />
              <StatCard label="Skipped"   value={progress.skipped_triples   ?? 0} color="amber" />
              <StatCard label="Flagged"   value={progress.flagged_triples   ?? 0} color="orange" />
              <StatCard label="Remaining" value={progress.unannotated_triples ?? 0} color="slate" />
            </div>
          )}

          {/* Progress bar */}
          {progress && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-teal-400 to-cyan-500
                    transition-all duration-700 ease-out rounded-full"
                  style={{ width: `${progress.completion_percentage ?? 0}%` }}
                />
              </div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                {progress.completion_percentage ?? 0}%
              </span>
            </div>
          )}

          {/* Article info row */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="text-xs font-mono text-slate-400 mr-2">
                PMID {article.pmid}
              </span>
              <span className="text-sm font-semibold text-slate-800 dark:text-white line-clamp-1">
                {article.title}
              </span>
            </div>
            <div className="text-xs text-slate-400 shrink-0 tabular-nums flex items-center gap-3">
              <span>{article.year} · {article.target_entity_count} entities</span>
              {progress && (
                <span className="text-slate-500 dark:text-slate-400">
                  Article {progress.annotated_articles + 1} of {progress.total_articles}
                </span>
              )}
            </div>
          </div>

          {/* Completion banner inline */}
          {showCompletionBanner && (
            <div className="flex items-center justify-between
              bg-teal-50 dark:bg-teal-900/30
              border border-teal-200 dark:border-teal-700
              rounded-lg px-4 py-2.5">
              <div className="flex items-center gap-2 text-sm">
                <span>🎉</span>
                <span className="font-semibold text-teal-800 dark:text-teal-100">
                  All assignments completed!
                </span>
                <span className="text-teal-600 dark:text-teal-300 text-xs">
                  Contact admin for more articles.
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="text-xs px-3 py-1 bg-white dark:bg-slate-700
                  text-slate-600 dark:text-slate-200 rounded-md hover:bg-slate-50
                  dark:hover:bg-slate-600 transition-colors"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SCROLLABLE BODY - two panels, each scrolls independently */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full max-w-[1600px] mx-auto flex">

          {/* Left panel: Abstract */}
          <div className="w-[45%] h-full overflow-y-auto
            border-r border-slate-200 dark:border-slate-700
            bg-white dark:bg-slate-800">
            <div className="p-5">
              <div className="flex items-center gap-1.5 mb-3">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Abstract</span>
                <InfoTip text="The abstract with highlighted entities: subject in blue, object in red, and relationship context in yellow. Read this to understand the relationship before selecting a predicate." align="right" />
              </div>
              <AbstractView
                abstract={article.abstract}
                highlightedEntities={[currentTriple.subject, currentTriple.object]}
                currentTriple={currentTriple}
              />
            </div>
          </div>

          {/* Right panel: Annotation */}
          <div className="flex-1 h-full overflow-y-auto
            bg-slate-50 dark:bg-slate-900">
            <div className="p-5">
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
      </div>
      <Footer />
    </div>
  );
};
