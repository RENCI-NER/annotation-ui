import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';
import { tmkpApi, adminAuth } from '../api';
import { Login } from './Login';
import { Footer } from './RelateApp';
import { TmkpAnnotationItem, TmkpProgress, TmkpVerdict } from '../types';
import { useBiolinkPredicates, useSmartPredicateSearch } from '../hooks/useBiolinkPredicates';

// ── Entity link helper ──────────────��───────────────────────────���───────────
const getEntityLinks = (normalizedId: string) => {
  const links: { label: string; url: string }[] = [];
  const colonIdx = normalizedId.indexOf(':');
  if (colonIdx === -1) return links;

  const prefix = normalizedId.slice(0, colonIdx);
  const id = normalizedId.slice(colonIdx + 1);

  if (prefix === 'CHEBI') {
    links.push({ label: 'ChEBI', url: `https://www.ebi.ac.uk/chebi/searchId.do?chebiId=${normalizedId}` });
  } else if (prefix === 'DRUGBANK') {
    links.push({ label: 'DrugBank', url: `https://go.drugbank.com/drugs/${id}` });
  } else if (prefix === 'UniProtKB') {
    links.push({ label: 'UniProt', url: `https://www.uniprot.org/uniprotkb/${id}` });
  } else if (prefix === 'HGNC' || prefix === 'NCBIGene') {
    links.push({ label: 'NCBI Gene', url: `https://www.ncbi.nlm.nih.gov/gene/${id}` });
  } else if (prefix === 'MONDO') {
    links.push({ label: 'Mondo', url: `https://monarchinitiative.org/disease/${normalizedId}` });
  } else if (prefix === 'HP') {
    links.push({ label: 'HPO', url: `https://hpo.jax.org/browse/term/${normalizedId}` });
  } else if (prefix === 'MESH') {
    links.push({ label: 'MeSH', url: `https://meshb.nlm.nih.gov/record/ui?ui=${id}` });
  } else if (prefix === 'GTOPDB') {
    links.push({ label: 'GtoPdb', url: `https://www.guidetopharmacology.org/GRAC/LigandDisplayForward?ligandId=${id}` });
  }

  const identifiersPrefix = prefix === 'UniProtKB' ? 'uniprot' : prefix.toLowerCase();
  links.unshift({ label: 'Identifiers.org', url: `https://identifiers.org/${identifiersPrefix}:${id}` });
  return links;
};

const formatPredicate = (p: string) => p.replace('biolink:', '').replace(/_/g, ' ');
const formatQualifier = (q: string) => q.replace(/_/g, ' ');

const VERDICT_CONFIG: Record<TmkpVerdict, { label: string; icon: string; color: string; hoverColor: string; activeColor: string; shortcut: string }> = {
  correct:         { label: 'Correct',         icon: '✓',  color: 'text-emerald-600 dark:text-emerald-400', hoverColor: 'hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:border-emerald-300 dark:hover:border-emerald-700', activeColor: 'bg-emerald-500 text-white border-emerald-500', shortcut: 'C' },
  swap_so:         { label: 'Swap S/O',        icon: '⇄',  color: 'text-blue-600 dark:text-blue-400',    hoverColor: 'hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-300 dark:hover:border-blue-700',       activeColor: 'bg-blue-500 text-white border-blue-500',    shortcut: 'S' },
  wrong_predicate: { label: 'Wrong Pred.',     icon: '✎',  color: 'text-amber-600 dark:text-amber-400',  hoverColor: 'hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:border-amber-300 dark:hover:border-amber-700',     activeColor: 'bg-amber-500 text-white border-amber-500',  shortcut: 'W' },
  wrong_subject:   { label: 'Wrong Subj.',     icon: '⚑',  color: 'text-cyan-600 dark:text-cyan-400',    hoverColor: 'hover:bg-cyan-50 dark:hover:bg-cyan-900/30 hover:border-cyan-300 dark:hover:border-cyan-700',         activeColor: 'bg-cyan-500 text-white border-cyan-500',    shortcut: 'U' },
  wrong_object:    { label: 'Wrong Obj.',      icon: '⚐',  color: 'text-orange-600 dark:text-orange-400', hoverColor: 'hover:bg-orange-50 dark:hover:bg-orange-900/30 hover:border-orange-300 dark:hover:border-orange-700', activeColor: 'bg-orange-500 text-white border-orange-500', shortcut: 'O' },
  reject:          { label: 'Reject',          icon: '✕',  color: 'text-red-600 dark:text-red-400',      hoverColor: 'hover:bg-red-50 dark:hover:bg-red-900/30 hover:border-red-300 dark:hover:border-red-700',             activeColor: 'bg-red-500 text-white border-red-500',      shortcut: 'R' },
  skip:            { label: 'Skip',            icon: '→',  color: 'text-slate-500 dark:text-slate-400',  hoverColor: 'hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600',    activeColor: 'bg-slate-500 text-white border-slate-500',  shortcut: '→' },
};

// ── Supporting Text View (single evidence) ─────────────��───────────────────
const SupportingTextView: React.FC<{ item: TmkpAnnotationItem }> = ({ item }) => {
  const ev = item.evidence;
  const text = ev.supporting_text;
  const highlights: { start: number; end: number; type: 'subject' | 'object' }[] = [];

  if (ev.subject_start >= 0 && ev.subject_end > ev.subject_start) {
    highlights.push({ start: ev.subject_start, end: ev.subject_end, type: 'subject' });
  }
  if (ev.object_start >= 0 && ev.object_end > ev.object_start) {
    highlights.push({ start: ev.object_start, end: ev.object_end, type: 'object' });
  }
  highlights.sort((a, b) => a.start - b.start);

  const segments: React.ReactNode[] = [];
  let pos = 0;
  highlights.forEach((h, i) => {
    if (h.start > pos) {
      segments.push(<span key={`t${i}`}>{text.slice(pos, h.start)}</span>);
    }
    const cls = h.type === 'subject'
      ? 'underline decoration-2 decoration-blue-400 dark:decoration-blue-500 underline-offset-2 font-semibold text-blue-700 dark:text-blue-300'
      : 'underline decoration-2 decoration-red-400 dark:decoration-red-500 underline-offset-2 font-semibold text-red-700 dark:text-red-300';
    segments.push(<span key={`h${i}`} className={cls}>{text.slice(h.start, h.end)}</span>);
    pos = h.end;
  });
  if (pos < text.length) {
    segments.push(<span key="end">{text.slice(pos)}</span>);
  }

  const confPct = ev.extraction_confidence * 100;
  const confColor = confPct >= 80 ? 'text-emerald-600 dark:text-emerald-400'
    : confPct >= 50 ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700
      shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
      {/* Evidence header */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-slate-50 to-slate-100/50
        dark:from-slate-800 dark:to-slate-800/50 border-b border-slate-200 dark:border-slate-700
        flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300">
            <span className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-[10px] text-violet-600 dark:text-violet-400 font-bold">
              {item.item_index}
            </span>
            <span className="text-slate-400 dark:text-slate-500">/ {item.total_items}</span>
          </span>
          {ev.section_type && (
            <span className="px-1.5 py-0.5 rounded-md bg-slate-200/60 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">
              {ev.section_type}
            </span>
          )}
          {ev.document_year && (
            <span className="text-slate-400 dark:text-slate-500">{ev.document_year}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-mono font-semibold ${confColor}`}>
            {confPct.toFixed(0)}%
          </span>
          {ev.publication && (
            <a
              href={`https://www.ncbi.nlm.nih.gov/pmc/articles/${ev.publication}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400
                hover:text-violet-700 dark:hover:text-violet-300 font-medium
                px-2 py-0.5 rounded-md hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors"
            >
              {ev.publication}
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
      </div>
      {/* Text */}
      <div className="px-5 py-4 text-[13.5px] text-slate-700 dark:text-slate-200 leading-[1.75] font-[system-ui]">
        <span className="text-slate-300 dark:text-slate-600 select-none">&ldquo;</span>
        {segments}
        <span className="text-slate-300 dark:text-slate-600 select-none">&rdquo;</span>
      </div>
    </div>
  );
};

// ── Edge Card ───────────────���───────────────────────────────────────────────
const ConfidenceBadge: React.FC<{ score: number }> = ({ score }) => {
  const pct = score * 100;
  const color = pct >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800' :
                pct >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ring-amber-200 dark:ring-amber-800' :
                'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 ring-red-200 dark:ring-red-800';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ring-1 ${color}`}>
      {pct.toFixed(0)}%
    </span>
  );
};

const EdgeCard: React.FC<{ item: TmkpAnnotationItem }> = ({ item }) => (
  <div className="rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden
    bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50">
    {/* Assertion row */}
    <div className="px-5 py-5">
      <div className="flex items-stretch gap-4">
        {/* Subject */}
        <div className="flex-1 min-w-0">
          <div className="inline-flex items-center gap-1.5 mb-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 dark:bg-blue-500" />
            <span className="text-[10px] uppercase tracking-widest text-blue-500 dark:text-blue-400 font-bold">Subject</span>
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
            {item.subject_name || item.subject_id}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-1 truncate">{item.subject_id}</div>
          <div className="flex flex-wrap gap-1 mt-2">
            {getEntityLinks(item.subject_id).map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                className="text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100
                  dark:hover:bg-blue-800/50 text-blue-600 dark:text-blue-300 rounded-md transition-colors
                  ring-1 ring-blue-100 dark:ring-blue-800/50">
                {link.label}
              </a>
            ))}
          </div>
        </div>

        {/* Predicate arrow */}
        <div className="flex flex-col items-center justify-center gap-1.5 px-4 shrink-0">
          <div className="px-3 py-1.5 rounded-lg bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-800/60">
            <div className="text-xs font-bold text-violet-700 dark:text-violet-300 text-center whitespace-nowrap">
              {formatPredicate(item.predicate)}
            </div>
          </div>
          <svg className="w-6 h-3 text-violet-300 dark:text-violet-600" viewBox="0 0 24 12" fill="none">
            <path d="M0 6h20m0 0l-4-4m4 4l-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {item.qualified_predicate && (
            <div className="text-[10px] text-violet-500/70 dark:text-violet-400/50 font-medium">
              via {formatPredicate(item.qualified_predicate)}
            </div>
          )}
        </div>

        {/* Object */}
        <div className="flex-1 min-w-0 text-right">
          <div className="inline-flex items-center gap-1.5 mb-2 justify-end">
            <span className="text-[10px] uppercase tracking-widest text-red-500 dark:text-red-400 font-bold">Object</span>
            <span className="w-2 h-2 rounded-full bg-red-400 dark:bg-red-500" />
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
            {item.object_name || item.object_id}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-1 truncate">{item.object_id}</div>
          <div className="flex flex-wrap gap-1 mt-2 justify-end">
            {getEntityLinks(item.object_id).map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                className="text-[10px] px-1.5 py-0.5 bg-red-50 dark:bg-red-900/30 hover:bg-red-100
                  dark:hover:bg-red-800/50 text-red-600 dark:text-red-300 rounded-md transition-colors
                  ring-1 ring-red-100 dark:ring-red-800/50">
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* Meta bar */}
    <div className="px-5 py-2.5 bg-slate-50/80 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-700/60
      flex items-center gap-2 flex-wrap">
      <ConfidenceBadge score={item.confidence_score} />
      <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
        {item.evidence_count} evidence{item.evidence_count !== 1 ? 's' : ''}
      </span>
      <span className="flex-1" />
      {item.object_direction_qualifier && (
        <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300
          text-[11px] font-medium ring-1 ring-amber-200/60 dark:ring-amber-800/40">
          {formatQualifier(item.object_direction_qualifier)}
        </span>
      )}
      {item.object_aspect_qualifier && (
        <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300
          text-[11px] font-medium ring-1 ring-purple-200/60 dark:ring-purple-800/40">
          {formatQualifier(item.object_aspect_qualifier)}
        </span>
      )}
      {item.category && (
        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400
          text-[11px] font-medium">
          {item.category.replace('biolink:', '')}
        </span>
      )}
    </div>
  </div>
);

// ── Verdict Panel ──────────────────��────────────────────────────────────────
const VerdictPanel: React.FC<{
  item: TmkpAnnotationItem;
  onVerdict: (verdict: TmkpVerdict, extra?: { correctedPredicate?: string; correctedSubject?: string; correctedObject?: string; notes?: string }) => void;
}> = ({ item, onVerdict }) => {
  const [selectedVerdict, setSelectedVerdict] = useState<TmkpVerdict | null>(item.verdict || null);
  const [showPredicatePicker, setShowPredicatePicker] = useState(item.verdict === 'wrong_predicate');
  const [showSubjectInput, setShowSubjectInput] = useState(item.verdict === 'wrong_subject');
  const [showObjectInput, setShowObjectInput] = useState(item.verdict === 'wrong_object');
  const [correctedPredicate, setCorrectedPredicate] = useState('');
  const [correctedSubject, setCorrectedSubject] = useState('');
  const [correctedObject, setCorrectedObject] = useState('');
  const [notes, setNotes] = useState(item.verdict_notes || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [showSaved, setShowSaved] = useState(false);

  const { predicates, loading: predicatesLoading } = useBiolinkPredicates();
  const filteredPredicates = useSmartPredicateSearch(predicates, searchTerm);

  useEffect(() => {
    setSelectedVerdict(item.verdict || null);
    setShowPredicatePicker(item.verdict === 'wrong_predicate');
    setShowSubjectInput(item.verdict === 'wrong_subject');
    setShowObjectInput(item.verdict === 'wrong_object');
    setCorrectedPredicate('');
    setCorrectedSubject('');
    setCorrectedObject('');
    setNotes(item.verdict_notes || '');
    setSearchTerm('');
    setShowSaved(false);
  }, [item.evidence_id]);

  const needsConfirmation = (v: TmkpVerdict) =>
    v === 'reject' || v === 'skip' || v === 'wrong_predicate' || v === 'wrong_subject' || v === 'wrong_object';

  const handleVerdictClick = (verdict: TmkpVerdict) => {
    setSelectedVerdict(verdict);
    setShowPredicatePicker(verdict === 'wrong_predicate');
    setShowSubjectInput(verdict === 'wrong_subject');
    setShowObjectInput(verdict === 'wrong_object');
    if (!needsConfirmation(verdict)) {
      submitVerdict(verdict);
    }
  };

  const submitVerdict = (verdict: TmkpVerdict, extra?: { correctedPredicate?: string; correctedSubject?: string; correctedObject?: string }) => {
    onVerdict(verdict, { ...extra, notes: notes || undefined });
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 1200);
  };

  const handlePredicateSelect = (predicateId: string) => {
    setCorrectedPredicate(predicateId);
    submitVerdict('wrong_predicate', { correctedPredicate: predicateId });
  };

  const handleSubjectSubmit = () => {
    if (!correctedSubject.trim()) return;
    submitVerdict('wrong_subject', { correctedSubject: correctedSubject.trim() });
  };

  const handleObjectSubmit = () => {
    if (!correctedObject.trim()) return;
    submitVerdict('wrong_object', { correctedObject: correctedObject.trim() });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'c' || e.key === 'C') { e.preventDefault(); handleVerdictClick('correct'); }
      else if (e.key === 's' || e.key === 'S') { e.preventDefault(); handleVerdictClick('swap_so'); }
      else if (e.key === 'w' || e.key === 'W') { e.preventDefault(); handleVerdictClick('wrong_predicate'); }
      else if (e.key === 'u' || e.key === 'U') { e.preventDefault(); handleVerdictClick('wrong_subject'); }
      else if (e.key === 'o' || e.key === 'O') { e.preventDefault(); handleVerdictClick('wrong_object'); }
      else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); handleVerdictClick('reject'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); handleVerdictClick('skip'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [item.evidence_id, notes]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden
      bg-white dark:bg-slate-800">
      {/* Header */}
      <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800
        border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 tracking-tight">Your Verdict</h3>
        <AnimatePresence>
          {showSaved && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400
                bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Saved
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Verdict buttons */}
      <div className="px-5 py-5">
        <div className="grid grid-cols-4 gap-2">
          {(Object.entries(VERDICT_CONFIG) as [TmkpVerdict, typeof VERDICT_CONFIG['correct']][]).map(([key, cfg]) => {
            const isActive = selectedVerdict === key;
            return (
              <button
                key={key}
                onClick={() => handleVerdictClick(key)}
                className={`group flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2
                  transition-all duration-150 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-violet-500
                  ${isActive
                    ? `${cfg.activeColor} shadow-md scale-[1.02]`
                    : `border-slate-200 dark:border-slate-600 ${cfg.hoverColor} hover:scale-[1.02] active:scale-[0.98]`
                  }`}
              >
                <span className={`text-xl transition-transform group-hover:scale-110 ${isActive ? '' : cfg.color}`}>{cfg.icon}</span>
                <span className="text-[11px] font-bold leading-tight">{cfg.label}</span>
                <kbd className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                  isActive ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                }`}>{cfg.shortcut}</kbd>
              </button>
            );
          })}
        </div>

        {/* Predicate correction picker */}
        <AnimatePresence>
          {showPredicatePicker && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-amber-500">&#9888;</span>
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-300">Select the correct predicate</span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Type to search predicates..."
                    autoFocus
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 dark:border-slate-600
                      dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400
                      focus:border-amber-400 placeholder:text-slate-400"
                  />
                  <svg className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                {correctedPredicate && (
                  <div className="mt-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200
                    dark:border-amber-700/50 rounded-lg flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">{correctedPredicate}</span>
                  </div>
                )}
                <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600
                  divide-y divide-slate-100 dark:divide-slate-700">
                  {predicatesLoading ? (
                    <div className="p-4 text-center text-xs text-slate-400">Loading predicates...</div>
                  ) : filteredPredicates.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">No matches found</div>
                  ) : (
                    filteredPredicates.slice(0, 30).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handlePredicateSelect(p.id)}
                        className={`w-full text-left px-3 py-2.5 transition-colors
                          ${correctedPredicate === p.id
                            ? 'bg-amber-500 text-white'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
                          }`}
                      >
                        <div className="text-sm font-medium">{p.name}</div>
                        {p.description && (
                          <div className={`text-xs mt-0.5 leading-snug ${
                            correctedPredicate === p.id
                              ? 'text-amber-100'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}>
                            {p.description}
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wrong subject input */}
        <AnimatePresence>
          {showSubjectInput && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-cyan-500">⚑</span>
                  <span className="text-xs font-bold text-cyan-700 dark:text-cyan-300">What should the subject be?</span>
                </div>
                <div className="text-xs text-slate-400 mb-2">
                  Current: <span className="font-semibold text-slate-600 dark:text-slate-300">{item.subject_name || item.subject_id}</span>
                </div>
                <input
                  type="text"
                  value={correctedSubject}
                  onChange={(e) => setCorrectedSubject(e.target.value)}
                  placeholder="Enter correct subject..."
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSubjectSubmit()}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 dark:border-slate-600
                    dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400
                    focus:border-cyan-400 placeholder:text-slate-400"
                />
                <button
                  onClick={handleSubjectSubmit}
                  disabled={!correctedSubject.trim()}
                  className="mt-3 w-full px-4 py-2.5 text-sm font-semibold bg-cyan-500 hover:bg-cyan-600
                    active:bg-cyan-700 text-white rounded-lg transition-colors shadow-sm
                    disabled:opacity-40 disabled:cursor-not-allowed
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-cyan-500"
                >
                  Submit Correction
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wrong object input */}
        <AnimatePresence>
          {showObjectInput && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-orange-500">⚐</span>
                  <span className="text-xs font-bold text-orange-700 dark:text-orange-300">What should the object be?</span>
                </div>
                <div className="text-xs text-slate-400 mb-2">
                  Current: <span className="font-semibold text-slate-600 dark:text-slate-300">{item.object_name || item.object_id}</span>
                </div>
                <input
                  type="text"
                  value={correctedObject}
                  onChange={(e) => setCorrectedObject(e.target.value)}
                  placeholder="Enter correct object..."
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleObjectSubmit()}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 dark:border-slate-600
                    dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400
                    focus:border-orange-400 placeholder:text-slate-400"
                />
                <button
                  onClick={handleObjectSubmit}
                  disabled={!correctedObject.trim()}
                  className="mt-3 w-full px-4 py-2.5 text-sm font-semibold bg-orange-500 hover:bg-orange-600
                    active:bg-orange-700 text-white rounded-lg transition-colors shadow-sm
                    disabled:opacity-40 disabled:cursor-not-allowed
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500"
                >
                  Submit Correction
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notes — shown for reject/skip */}
        <AnimatePresence>
          {(selectedVerdict === 'reject' || selectedVerdict === 'skip') && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 block">
                  Notes <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  autoFocus
                  className="w-full p-3 text-sm border border-slate-300 dark:border-slate-600
                    dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:ring-2
                    focus:ring-violet-400 focus:border-violet-400 placeholder:text-slate-400 resize-none"
                  rows={2}
                  placeholder={selectedVerdict === 'reject' ? 'Why reject this edge?' : 'Why skip?'}
                />
                <button
                  onClick={() => submitVerdict(selectedVerdict)}
                  className="mt-3 w-full px-4 py-2.5 text-sm font-semibold bg-violet-500 hover:bg-violet-600
                    active:bg-violet-700 text-white rounded-lg transition-colors shadow-sm
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-violet-500"
                >
                  Submit {selectedVerdict === 'reject' ? 'Rejection' : 'Skip'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Keyboard hint */}
      <div className="px-5 py-2.5 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/30">
        <div className="flex items-center justify-center gap-3 text-[10px] text-slate-400 flex-wrap">
          {Object.entries(VERDICT_CONFIG).map(([, cfg]) => (
            <span key={cfg.shortcut} className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono font-semibold text-slate-500 dark:text-slate-400">
                {cfg.shortcut}
              </kbd>
              <span>{cfg.label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Item Progress Strip ──────────────────────────────────────────────────────
const BATCH_SIZE = 100;

const verdictDotColor = (verdict: TmkpVerdict | null): string => {
  if (!verdict) return 'bg-slate-300 dark:bg-slate-600';
  switch (verdict) {
    case 'correct': return 'bg-emerald-400';
    case 'swap_so': return 'bg-blue-400';
    case 'wrong_predicate': return 'bg-amber-400';
    case 'wrong_subject': return 'bg-cyan-400';
    case 'wrong_object': return 'bg-orange-400';
    case 'reject': return 'bg-red-400';
    case 'skip': return 'bg-slate-400';
    default: return 'bg-slate-300 dark:bg-slate-600';
  }
};

const ProgressStrip: React.FC<{
  items: TmkpAnnotationItem[];
  currentIndex: number;
  onJump: (idx: number) => void;
}> = ({ items, currentIndex, onJump }) => {
  const answeredCount = items.filter(i => i.verdict).length;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          Batch Progress
        </span>
        <span className="text-[11px] font-bold tabular-nums text-slate-600 dark:text-slate-300">
          {answeredCount} / {items.length} done
        </span>
      </div>
      <div className="px-3 py-2.5 flex flex-wrap gap-[3px]">
        {items.map((it, idx) => (
          <button
            key={it.evidence_id}
            onClick={() => onJump(idx)}
            title={`#${idx + 1}${it.verdict ? ` — ${it.verdict.replace('_', ' ')}` : ' — unanswered'}`}
            className={`w-[10px] h-[10px] rounded-sm transition-all duration-100
              ${verdictDotColor(it.verdict)}
              ${idx === currentIndex ? 'ring-2 ring-violet-500 ring-offset-1 dark:ring-offset-slate-800 scale-150' : 'hover:scale-150 hover:ring-1 hover:ring-slate-400'}
            `}
          />
        ))}
      </div>
    </div>
  );
};

// ── TmkpApp ─────────────────────────────────────────────────────────────────
export const TmkpApp: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [annotator, setAnnotator] = useState<string | null>(() => localStorage.getItem('tmkp_annotator'));
  const [batch, setBatch] = useState<TmkpAnnotationItem[]>([]);
  const [batchIndex, setBatchIndex] = useState(0);
  const [progress, setProgress] = useState<TmkpProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewPage, setReviewPage] = useState(0);

  const isAdminPage = location.pathname.endsWith('/admin');
  const item = batch[batchIndex] || null;

  const loadBatch = useCallback(async () => {
    if (!annotator) return;
    try {
      setLoading(true);
      setError(null);
      const items = await tmkpApi.getBatch(annotator, BATCH_SIZE);
      setBatch(items);
      setBatchIndex(0);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to load items';
      setError(msg);
      setBatch([]);
    } finally {
      setLoading(false);
    }
  }, [annotator]);

  const loadProgress = useCallback(async () => {
    if (!annotator) return;
    try { setProgress(await tmkpApi.getProgress(annotator)); }
    catch { /* ignore */ }
  }, [annotator]);

  const initRef = React.useRef(false);
  useEffect(() => {
    if (isAdminPage) {
      initRef.current = false;
      return;
    }
    if (annotator && !initRef.current) {
      initRef.current = true;
      loadBatch();
      loadProgress();
    }
  }, [annotator, isAdminPage]);

  const handleVerdict = async (verdict: TmkpVerdict, extra?: { correctedPredicate?: string; correctedSubject?: string; correctedObject?: string; notes?: string }) => {
    if (!item || !annotator) return;
    try {
      await tmkpApi.saveVerification({
        edge_db_id: item.edge_db_id,
        evidence_id: item.evidence_id,
        verdict,
        corrected_predicate: extra?.correctedPredicate,
        corrected_subject: extra?.correctedSubject,
        corrected_object: extra?.correctedObject,
        notes: extra?.notes,
        annotator,
      });
      const updated = [...batch];
      updated[batchIndex] = { ...item, verdict, verdict_notes: extra?.notes || null };
      setBatch(updated);
      loadProgress();

      if (verdict !== 'wrong_predicate' && verdict !== 'wrong_subject' && verdict !== 'wrong_object') {
        setTimeout(() => {
          const nextUnanswered = updated.findIndex((it, i) => i > batchIndex && !it.verdict);
          if (nextUnanswered !== -1) {
            setBatchIndex(nextUnanswered);
          } else {
            const firstUnanswered = updated.findIndex(it => !it.verdict);
            if (firstUnanswered !== -1) {
              setBatchIndex(firstUnanswered);
            }
          }
        }, 500);
      }
    } catch {
      // silently fail
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tmkp_annotator');
    window.location.reload();
  };

  const enterReviewMode = async () => {
    if (!annotator) return;
    setLoading(true);
    setError(null);
    setReviewPage(0);
    try {
      const items = await tmkpApi.listItems(annotator, 0, BATCH_SIZE);
      setBatch(items);
      setBatchIndex(0);
      setReviewMode(true);
    } catch {
      setError('Failed to load review items');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreReview = async () => {
    if (!annotator) return;
    const nextPage = reviewPage + 1;
    setLoading(true);
    try {
      const items = await tmkpApi.listItems(annotator, nextPage * BATCH_SIZE, BATCH_SIZE);
      if (items.length === 0) {
        setError('No more items to review.');
        return;
      }
      setBatch(items);
      setBatchIndex(0);
      setReviewPage(nextPage);
    } catch {
      setError('Failed to load more review items');
    } finally {
      setLoading(false);
    }
  };

  const exitReviewMode = () => {
    setReviewMode(false);
    setBatch([]);
    setBatchIndex(0);
    setError(null);
    initRef.current = false;
    loadBatch();
    loadProgress();
  };

  // ── Admin page ────────────────────────────────────────────────────────────
  if (isAdminPage) {
    return <TmkpAdminPage />;
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  if (!annotator) {
    return (
      <Login onLogin={(name) => {
        localStorage.setItem('tmkp_annotator', name);
        setAnnotator(name);
      }} />
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="relative w-12 h-12 mb-4">
          <div className="absolute inset-0 rounded-full border-2 border-violet-200 dark:border-violet-900" />
          <div className="absolute inset-0 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
        </div>
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {reviewMode ? 'Loading review...' : 'Loading batch...'}
        </div>
      </div>
    );
  }

  // ── Error / batch complete ────────────────────────────────────────────────
  if (error || batch.length === 0) {
    const allDone = error?.includes('verified') || false;
    const batchDone = !error && batch.length === 0;
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="text-center max-w-sm px-6"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center
            bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30
            ring-4 ring-violet-200/50 dark:ring-violet-800/30">
            <span className="text-3xl">{allDone || batchDone ? '🎉' : '📋'}</span>
          </div>
          <h2 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">
            {allDone ? 'All Done!' : batchDone ? 'Batch Complete' : 'Notice'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm leading-relaxed">
            {error || 'Great work! Load more to continue.'}
          </p>
          <div className="space-y-2.5">
            {(allDone || batchDone) && (
              <button onClick={enterReviewMode}
                className="w-full px-5 py-3 bg-violet-500 hover:bg-violet-600 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-violet-500/20">
                Review My Verifications
              </button>
            )}
            {!allDone && (
              <button onClick={() => { initRef.current = false; loadBatch(); loadProgress(); }}
                className="w-full px-5 py-3 bg-violet-500 hover:bg-violet-600 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-violet-500/20">
                Load More Items
              </button>
            )}
            <button onClick={() => navigate('/')}
              className="w-full px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold transition-all shadow-sm">
              Back to Home
            </button>
            <button onClick={handleLogout}
              className="w-full px-5 py-2.5 text-sm font-medium text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
              Logout
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!item) return null;

  const batchAnsweredCount = batch.filter(i => i.verdict).length;
  const batchAllDone = batchAnsweredCount === batch.length;

  // ── Main UI ───────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="flex-shrink-0 h-14 z-50 bg-slate-900 border-b border-slate-700/60
        shadow-[0_1px_12px_rgba(0,0,0,0.3)]">
        <div className="h-full max-w-[1600px] mx-auto px-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-400 to-purple-600
              flex items-center justify-center shadow-lg shadow-violet-900/40">
              <span className="text-white text-xs font-bold">T</span>
            </div>
            <span className="font-semibold text-white tracking-tight text-sm">
              TMKP <span className="text-violet-400">Verification</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            {reviewMode ? (
              <button onClick={exitReviewMode}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                  bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400
                  border border-emerald-500/30 rounded-md transition-all duration-150">
                Back to Queue
              </button>
            ) : (
              <button onClick={enterReviewMode} title="Browse and edit your past verifications"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                  bg-slate-500/10 hover:bg-slate-500/20 text-slate-300
                  border border-slate-500/30 rounded-md transition-all duration-150">
                Review Past
              </button>
            )}
            <button onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center text-slate-400
                hover:text-white hover:bg-slate-700/70 rounded-md transition-all text-base">
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <div className="w-px h-4 bg-slate-600 mx-1" />
            <div className="flex items-center gap-2 pl-1">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/40
                flex items-center justify-center text-xs text-violet-400 font-bold uppercase">
                {annotator?.[0]}
              </div>
              <span className="text-xs text-slate-300 font-medium">{annotator}</span>
              <button onClick={handleLogout}
                className="text-xs text-slate-500 hover:text-red-400 transition-colors ml-1">
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Progress bar */}
      {progress && (
        <div className="flex-shrink-0 bg-white dark:bg-slate-800/80 backdrop-blur-sm
          border-b border-slate-200 dark:border-slate-700/60 px-5 py-2.5">
          <div className="max-w-[1600px] mx-auto">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
                {[
                  { label: 'Correct', value: progress.correct_count, dotColor: 'bg-emerald-400' },
                  { label: 'Swapped', value: progress.swapped_count, dotColor: 'bg-blue-400' },
                  { label: 'Pred.', value: progress.wrong_predicate_count, dotColor: 'bg-amber-400' },
                  { label: 'Subj.', value: progress.wrong_subject_count, dotColor: 'bg-cyan-400' },
                  { label: 'Obj.', value: progress.wrong_object_count, dotColor: 'bg-orange-400' },
                  { label: 'Rejected', value: progress.rejected_count, dotColor: 'bg-red-400' },
                  { label: 'Skipped', value: progress.skipped_count, dotColor: 'bg-slate-400' },
                  { label: 'Left', value: progress.remaining, dotColor: 'bg-slate-300 dark:bg-slate-600' },
                ].map(({ label, value, dotColor }) => (
                  <div key={label} className="flex items-center gap-1 px-2 py-1 rounded-md
                    hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" title={label}>
                    <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                    <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">{value}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 hidden sm:inline">{label}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="w-32 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-violet-400 to-purple-500 rounded-full"
                    initial={false}
                    animate={{ width: `${progress.completion_percentage}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
                <span className="text-xs font-bold text-violet-600 dark:text-violet-400 tabular-nums w-9 text-right">
                  {progress.completion_percentage}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full max-w-[1600px] mx-auto flex">
          {/* Left panel: Edge + Evidence */}
          <div className="w-[55%] h-full overflow-y-auto border-r border-slate-200 dark:border-slate-700/60
            bg-gradient-to-b from-white to-slate-50/30 dark:from-slate-800 dark:to-slate-900/30">
            <div className="p-6 space-y-5">
              <motion.div
                key={item.evidence_id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <EdgeCard item={item} />
              </motion.div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Supporting Evidence</h3>
                  <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">
                    {item.item_index} / {item.total_items}
                  </span>
                </div>
                <motion.div
                  key={item.evidence_id + '-ev'}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.08 }}
                >
                  <SupportingTextView item={item} />
                </motion.div>
              </div>
            </div>
          </div>

          {/* Right panel: Verdict + Progress strip */}
          <div className="flex-1 h-full overflow-y-auto bg-slate-50 dark:bg-slate-900/50">
            <div className="p-6 space-y-4">
              {/* Review mode banner */}
              {reviewMode && (
                <div className="flex items-center justify-between px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20
                  border border-amber-200 dark:border-amber-800/50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-xs text-amber-700 dark:text-amber-300 font-semibold">Review Mode</span>
                    <span className="text-xs text-amber-500 dark:text-amber-400 tabular-nums">
                      Page {reviewPage + 1}
                    </span>
                  </div>
                  <button onClick={loadMoreReview}
                    className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors">
                    Load Next {BATCH_SIZE} &rarr;
                  </button>
                </div>
              )}

              {/* Progress strip */}
              <ProgressStrip items={batch} currentIndex={batchIndex} onJump={setBatchIndex} />

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setBatchIndex(Math.max(0, batchIndex - 1))}
                  disabled={batchIndex <= 0}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold
                    bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
                    hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed
                    text-slate-600 dark:text-slate-300 rounded-lg transition-all shadow-sm
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Prev
                </button>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums font-medium">
                    {batchIndex + 1} / {batch.length}
                  </span>
                  <span className={`text-[10px] font-semibold tabular-nums ${item.verdict ? 'text-emerald-500' : 'text-slate-400'}`}>
                    {item.verdict ? item.verdict.replace(/_/g, ' ') : 'unanswered'}
                  </span>
                </div>
                <button
                  onClick={() => setBatchIndex(Math.min(batch.length - 1, batchIndex + 1))}
                  disabled={batchIndex >= batch.length - 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold
                    bg-violet-500 hover:bg-violet-600 active:bg-violet-700
                    disabled:opacity-30 disabled:cursor-not-allowed
                    text-white rounded-lg transition-all shadow-sm
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-violet-500"
                >
                  Next
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Batch complete banner */}
              {batchAllDone && !reviewMode && (
                <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20
                  border border-emerald-200 dark:border-emerald-800/50 rounded-xl">
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    Batch complete! All {batch.length} items answered.
                  </span>
                  <button onClick={() => { initRef.current = false; loadBatch(); loadProgress(); }}
                    className="px-3 py-1 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600
                      text-white rounded-lg transition-colors">
                    Load Next Batch
                  </button>
                </div>
              )}

              <motion.div
                key={item.evidence_id + '-verdict'}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                <VerdictPanel item={item} onVerdict={handleVerdict} />
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

// ── TMKP Admin Page ───────────────��────────────────────────────────────────
const TmkpAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [annotators, setAnnotators] = useState<any[]>([]);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [newAnnotator, setNewAnnotator] = useState('');
  const [newLimit, setNewLimit] = useState(500);
  const [uploadStatus, setUploadStatus] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const ok = await adminAuth(password);
    if (ok) {
      setAuthenticated(true);
    } else {
      setAuthError('Invalid password');
    }
  };

  const loadLimits = () => {
    tmkpApi.getAnnotatorLimits().then((data: any[]) => {
      const map: Record<string, number> = {};
      data.forEach((l: any) => { map[l.annotator] = l.max_items; });
      setLimits(map);
    }).catch(console.error);
  };

  useEffect(() => {
    if (!authenticated) return;
    tmkpApi.getAdminStats().then(setStats).catch(console.error);
    tmkpApi.getAnnotators().then(setAnnotators).catch(console.error);
    loadLimits();
  }, [authenticated]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus('Uploading...');
    try {
      const result = await tmkpApi.uploadJsonl(file);
      setUploadStatus(`Done: ${result.added} added, ${result.skipped} skipped`);
      tmkpApi.getAdminStats().then(setStats);
    } catch (err) {
      setUploadStatus('Upload failed');
    }
  };

  if (!authenticated) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="w-full max-w-sm p-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl">
          <div className="flex items-center justify-center gap-2.5 mb-6">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-400 to-purple-600
              flex items-center justify-center shadow-lg shadow-violet-900/40">
              <span className="text-white text-sm font-bold">T</span>
            </div>
            <span className="font-semibold text-slate-800 dark:text-white tracking-tight">
              TMKP <span className="text-violet-500">Admin</span>
            </span>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Admin Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoFocus
                className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200
                  dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500
                  text-slate-800 dark:text-white placeholder:text-slate-400"
              />
            </div>
            {authError && (
              <div className="text-xs text-red-500 font-medium">{authError}</div>
            )}
            <button type="submit"
              className="w-full py-2.5 text-sm font-medium bg-violet-500 hover:bg-violet-600
                text-white rounded-lg transition-colors shadow-sm">
              Sign In
            </button>
          </form>
          <button onClick={() => navigate('/tmkp-triples')}
            className="mt-4 w-full text-center text-xs text-slate-400 hover:text-slate-600
              dark:hover:text-slate-300 transition-colors">
            ← Back to Verification View
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
      <header className="flex-shrink-0 h-14 z-50 bg-slate-900 border-b border-slate-700/60
        shadow-[0_1px_12px_rgba(0,0,0,0.3)]">
        <div className="h-full max-w-[1200px] mx-auto px-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-400 to-purple-600
              flex items-center justify-center shadow-lg shadow-violet-900/40">
              <span className="text-white text-xs font-bold">T</span>
            </div>
            <span className="font-semibold text-white tracking-tight text-sm">
              TMKP <span className="text-violet-400">Admin</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/tmkp-triples')}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white
                hover:bg-slate-700/70 rounded-md transition-all">
              ← Verification View
            </button>
            <button onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center text-slate-400
                hover:text-white hover:bg-slate-700/70 rounded-md transition-all text-base">
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto p-6 space-y-6">
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {[
                { label: 'Total Edges', value: stats.total_edges, color: 'text-slate-700 dark:text-white' },
                { label: 'Total Items', value: stats.total_items, color: 'text-slate-600 dark:text-slate-300' },
                { label: 'Verified (1+)', value: stats.total_verified, color: 'text-violet-600 dark:text-violet-400' },
                { label: 'Dual-Reviewed', value: stats.dual_reviewed, color: 'text-emerald-600 dark:text-emerald-400' },
                { label: 'Needs 2nd', value: stats.needs_second, color: 'text-amber-600 dark:text-amber-400' },
                { label: 'Unreviewed', value: stats.unreviewed, color: 'text-slate-500 dark:text-slate-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                  <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
                  <div className="text-[11px] text-slate-500 mt-1 font-medium">{label}</div>
                </div>
              ))}
            </div>
          )}

{/* Upload */}
          <div className="p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">Upload TMKP JSONL</h3>
            <input type="file" accept=".jsonl" onChange={handleUpload}
              className="text-sm text-slate-600 dark:text-slate-300" />
            {uploadStatus && (
              <div className="mt-2 text-xs text-slate-500">{uploadStatus}</div>
            )}
          </div>

          {/* Annotators */}
          <div className="p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">Annotators</h3>
            {annotators.length === 0 ? (
              <div className="text-sm text-slate-400">No verifications yet. Annotators appear here once they start reviewing.</div>
            ) : (
              <div className="space-y-2">
                {annotators.map((a: any) => (
                  <div key={a.annotator}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-750
                      rounded-lg border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-violet-500/20 border border-violet-500/40
                        flex items-center justify-center text-xs text-violet-500 font-bold uppercase">
                        {a.annotator[0]}
                      </div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{a.annotator}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-500 tabular-nums">
                        {a.verified_count}{limits[a.annotator] ? ` / ${limits[a.annotator]}` : ''} verified
                      </span>
                      <input
                        type="number"
                        min={1}
                        placeholder="Limit"
                        defaultValue={limits[a.annotator] || ''}
                        onBlur={async (e) => {
                          const val = parseInt(e.target.value);
                          if (val > 0) {
                            await tmkpApi.setAnnotatorLimit(a.annotator, val);
                            loadLimits();
                          }
                        }}
                        className="w-20 px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200
                          dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-200 tabular-nums"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
              <div className="text-xs font-medium text-slate-500 mb-2">Set limit for new annotator</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="firstname.lastname"
                  value={newAnnotator}
                  onChange={(e) => setNewAnnotator(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200
                    dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200
                    placeholder:text-slate-400"
                />
                <input
                  type="number"
                  min={1}
                  value={newLimit}
                  onChange={(e) => setNewLimit(parseInt(e.target.value) || 500)}
                  className="w-20 px-2 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200
                    dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 tabular-nums"
                />
                <button
                  onClick={async () => {
                    const name = newAnnotator.trim().toLowerCase();
                    if (!name || newLimit < 1) return;
                    await tmkpApi.setAnnotatorLimit(name, newLimit);
                    setNewAnnotator('');
                    loadLimits();
                  }}
                  className="px-3 py-1.5 text-sm font-medium bg-violet-500 hover:bg-violet-600
                    text-white rounded-lg transition-colors"
                >
                  Set
                </button>
              </div>
            </div>
          </div>

          {/* Export */}
          <div className="p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">Export</h3>
            <div className="space-y-3">
              <div>
                <button
                  onClick={async () => {
                    const data = await tmkpApi.exportVerifications();
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'tmkp_curated_edges.json';
                    link.click();
                  }}
                  className="px-4 py-2 text-sm font-medium bg-violet-500 hover:bg-violet-600
                    text-white rounded-lg transition-colors shadow-sm"
                >
                  Export Curated Edges (JSON)
                </button>
                <p className="text-xs text-slate-400 mt-1.5">
                  Collated by edge. Rejected evidences removed. Edges with no surviving evidence dropped.
                  Includes consensus verdicts and corrections.
                </p>
              </div>
              <div>
                <button
                  onClick={async () => {
                    const data = await tmkpApi.exportRaw();
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'tmkp_raw_verifications.json';
                    link.click();
                  }}
                  className="px-4 py-2 text-sm font-medium bg-slate-500 hover:bg-slate-600
                    text-white rounded-lg transition-colors shadow-sm"
                >
                  Export Raw Verifications
                </button>
                <p className="text-xs text-slate-400 mt-1.5">
                  Flat list of every individual verification for IAA analysis.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};
