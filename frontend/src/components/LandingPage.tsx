import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 h-14 bg-slate-900 border-b border-slate-700/60
        shadow-[0_1px_12px_rgba(0,0,0,0.3)]">
        <div className="h-full max-w-[1200px] mx-auto px-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-400 to-cyan-600
              flex items-center justify-center shadow-lg shadow-teal-900/40">
              <span className="text-white text-xs font-bold">R</span>
            </div>
            <span className="font-semibold text-white tracking-tight text-sm">
              RENCI <span className="text-teal-400">Annotation Platform</span>
            </span>
          </div>
          <button
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center text-slate-400
              hover:text-white hover:bg-slate-700/70 rounded-md transition-all text-base"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-5 py-16">
        <div className="max-w-[900px] w-full">
          {/* Title */}
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
              Biomedical Relation Annotation
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-lg mx-auto leading-relaxed">
              Choose an annotation task below. RELATE builds a controlled corpus for predicate mapping.
              TMKP Verification fact-checks existing text-mined knowledge graph edges.
            </p>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* RELATE Card */}
            <button
              onClick={() => navigate('/relate-triples')}
              className="group text-left p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-700
                bg-white dark:bg-slate-800 hover:border-teal-400 dark:hover:border-teal-500
                hover:shadow-lg hover:shadow-teal-500/10 transition-all duration-200"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-600
                  flex items-center justify-center shadow-md shadow-teal-900/20
                  group-hover:scale-110 transition-transform">
                  <span className="text-white text-sm font-bold">R</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">RELATE Triples</h2>
                  <span className="text-xs text-teal-600 dark:text-teal-400 font-medium">Predicate Annotation</span>
                </div>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                Annotate biomedical entity pairs from PubMed abstracts with Biolink predicates.
                Builds a controlled corpus for the RELATE predicate mapping project.
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded-md bg-teal-50 dark:bg-teal-900/30
                  text-teal-700 dark:text-teal-300 font-medium">PubMed Abstracts</span>
                <span className="text-xs px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700
                  text-slate-600 dark:text-slate-300 font-medium">Predicate Selection</span>
              </div>
              <div className="mt-4 text-xs text-teal-600 dark:text-teal-400 font-medium
                group-hover:translate-x-1 transition-transform">
                Open RELATE →
              </div>
            </button>

            {/* TMKP Card */}
            <button
              onClick={() => navigate('/tmkp-triples')}
              className="group text-left p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-700
                bg-white dark:bg-slate-800 hover:border-violet-400 dark:hover:border-violet-500
                hover:shadow-lg hover:shadow-violet-500/10 transition-all duration-200"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-purple-600
                  flex items-center justify-center shadow-md shadow-violet-900/20
                  group-hover:scale-110 transition-transform">
                  <span className="text-white text-sm font-bold">T</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">TMKP Verification</h2>
                  <span className="text-xs text-violet-600 dark:text-violet-400 font-medium">Edge Fact-Checking</span>
                </div>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                Verify text-mined knowledge graph edges from the Text Mining Knowledge Provider.
                Confirm, correct, swap, or reject extracted assertions against supporting text.
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded-md bg-violet-50 dark:bg-violet-900/30
                  text-violet-700 dark:text-violet-300 font-medium">TMKP Edges</span>
                <span className="text-xs px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700
                  text-slate-600 dark:text-slate-300 font-medium">Fact Verification</span>
              </div>
              <div className="mt-4 text-xs text-violet-600 dark:text-violet-400 font-medium
                group-hover:translate-x-1 transition-transform">
                Open TMKP →
              </div>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex-shrink-0 bg-gradient-to-r from-slate-900 to-slate-950 text-white">
        <div className="h-0.5 bg-gradient-to-r from-teal-500 via-cyan-400 to-teal-500" />
        <div className="max-w-[1200px] mx-auto px-5 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 bg-gradient-to-br from-teal-400 to-cyan-600
                rounded-md flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">R</span>
              </div>
              <span className="text-xs text-slate-500">RENCI Annotation Platform</span>
            </div>
            <p className="text-xs text-slate-500">
              Funded by NIH LitCoin (#75N95023C00032) · © {new Date().getFullYear()} RENCI
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
