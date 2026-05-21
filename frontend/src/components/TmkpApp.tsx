import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';
import { tmkpApi, adminAuth } from '../api';
import { Login } from './Login';
import { Footer } from './RelateApp';
import { InfoTip } from './InfoTip';
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


const VERDICT_CONFIG: Record<TmkpVerdict, { label: string; icon: string; color: string; hoverColor: string; activeColor: string; shortcut: string; tip: string }> = {
  correct:         { label: 'Correct',         icon: '✓',  color: 'text-emerald-600 dark:text-emerald-400', hoverColor: 'hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:border-emerald-300 dark:hover:border-emerald-700', activeColor: 'bg-emerald-500 text-white border-emerald-500', shortcut: 'C', tip: 'The triple accurately reflects what the text says' },
  swap_so:         { label: 'Swap S/O',        icon: '⇄',  color: 'text-cyan-600 dark:text-cyan-400',    hoverColor: 'hover:bg-cyan-50 dark:hover:bg-cyan-900/30 hover:border-cyan-300 dark:hover:border-cyan-700',       activeColor: 'bg-cyan-500 text-white border-cyan-500',    shortcut: 'S', tip: 'Subject and object are swapped — the text says the opposite direction' },
  wrong_subject:   { label: 'Wrong Subject',     icon: '⚑',  color: 'text-blue-600 dark:text-blue-400',    hoverColor: 'hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-300 dark:hover:border-blue-700',         activeColor: 'bg-blue-500 text-white border-blue-500',    shortcut: 'U', tip: 'The subject entity is wrong — the CURIE doesn\'t match what the text refers to' },
  wrong_predicate: { label: 'Wrong Predicate',     icon: '✎',  color: 'text-purple-600 dark:text-purple-400',  hoverColor: 'hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:border-purple-300 dark:hover:border-purple-700',     activeColor: 'bg-purple-500 text-white border-purple-500',  shortcut: 'W', tip: 'The relationship type is wrong — the text describes a different predicate' },
  wrong_object:    { label: 'Wrong Object',      icon: '⚐',  color: 'text-orange-600 dark:text-orange-400', hoverColor: 'hover:bg-orange-50 dark:hover:bg-orange-900/30 hover:border-orange-300 dark:hover:border-orange-700', activeColor: 'bg-orange-500 text-white border-orange-500', shortcut: 'O', tip: 'The object entity is wrong — the CURIE doesn\'t match what the text refers to' },
};

// ── Supporting Text View (single evidence) ─────────────��───────────────────
const SupportingTextView: React.FC<{ item: TmkpAnnotationItem }> = ({ item }) => {
  const ev = item.evidence;
  const text = ev.supporting_text;
  const [copied, setCopied] = React.useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
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

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700
      shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
      {/* Evidence header */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-slate-50 to-slate-100/50
        dark:from-slate-800 dark:to-slate-800/50 border-b border-slate-200 dark:border-slate-700
        flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300">
            <p>Section in Paper: </p>          
          </span> 
          {ev.section_type && (
            <span className="px-1.5 py-0.5 rounded-md bg-slate-200/60 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">
              {ev.section_type}
            </span>
          )} |
          <span className="inline-flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300">
            <p>Year: </p>          
          </span>
          {ev.document_year && (
            <span className="text-slate-400 dark:text-slate-500">{ev.document_year}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {ev.publication && (() => {
            const snippet = text.length > 20 ? text.slice(0, 80).trim() : text.trim();
            const fragment = snippet ? `#:~:text=${encodeURIComponent(snippet)}` : '';
            return (
              <a
                href={`https://www.ncbi.nlm.nih.gov/pmc/articles/${ev.publication}/${fragment}`}
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
            );
          })()}
        </div>
      </div>
      {/* Text */}
      <div className="relative group/text px-5 py-4 text-[13.5px] text-slate-700 dark:text-slate-200 leading-[1.75] font-[system-ui]">
        <button
          onClick={handleCopy}
          title="Copy text"
          className="absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover/text:opacity-100
            bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600
            text-slate-400 hover:text-slate-600 dark:hover:text-slate-300
            transition-all duration-150 focus:outline-none focus:opacity-100"
        >
          {copied ? (
            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
        <span className="text-slate-300 dark:text-slate-600 select-none">&ldquo;</span>
        {segments}
        <span className="text-slate-300 dark:text-slate-600 select-none">&rdquo;</span>
      </div>
    </div>
  );
};

// ── Node Normalizer Modal ───────────────────────────────────────────────────

// Strip all non-alphanumeric, collapse spaces, lowercase
const normStrip = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
// Fully collapsed (no spaces at all) for tight matching
const normCollapse = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
// Tokenize into unique words (>= 2 chars)
const normTokens = (s: string) => new Set(normStrip(s).split(' ').filter(t => t.length >= 2));

type MatchLevel = 'exact' | 'reorder' | null;

function findBestMatch(inText: string, labels: string[]): { match: string | null; level: MatchLevel } {
  const aNorm = normCollapse(inText);
  const aTokens = normTokens(inText);
  if (aNorm.length < 2) return { match: null, level: null };

  // Pass 1: exact after stripping all special chars
  for (const label of labels) {
    if (normCollapse(label) === aNorm) return { match: label, level: 'exact' };
  }

  // Pass 2: same tokens, different order (e.g. "sphingomyelinase acid" vs "acid sphingomyelinase")
  if (aTokens.size >= 2) {
    for (const label of labels) {
      const bTokens = normTokens(label);
      if (bTokens.size !== aTokens.size) continue;
      let allMatch = true;
      aTokens.forEach(t => { if (!bTokens.has(t)) allMatch = false; });
      if (allMatch) return { match: label, level: 'reorder' };
    }
  }

  return { match: null, level: null };
}

function labelMatchLevel(inText: string, label: string): MatchLevel {
  const aNorm = normCollapse(inText);
  const bNorm = normCollapse(label);
  if (aNorm.length < 2 || bNorm.length < 2) return null;
  if (aNorm === bNorm) return 'exact';
  const aTokens = normTokens(inText);
  const bTokens = normTokens(label);
  if (aTokens.size >= 2 && aTokens.size === bTokens.size) {
    let allMatch = true;
    aTokens.forEach(t => { if (!bTokens.has(t)) allMatch = false; });
    if (allMatch) return 'reorder';
  }
  return null;
}

const NodeNormModal: React.FC<{
  curie: string; inTextName?: string; source: 'nn' | 'nr'; onClose: () => void;
}> = ({ curie, inTextName, source, onClose }) => {
  const [nnData, setNnData] = React.useState<any>(null);
  const [nrData, setNrData] = React.useState<{ curie: string; preferred_name: string; names: string[]; types: string[] } | null>(null);
  const [nrResults, setNrResults] = React.useState<{ curie: string; label: string; types: string[] }[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    const sig = controller.signal;
    (async () => {
      try {
        if (source === 'nn') {
          const res = await fetch(`https://nodenormalization-sri.renci.org/get_normalized_nodes?curie=${encodeURIComponent(curie)}`, { signal: sig });
          const json = await res.json();
          setNnData(json[curie] || null);
        } else {
          const queries = generateSearchQueries(inTextName || curie);
          let foundMatch = false;
          const allResults: { curie: string; label: string; types: string[] }[] = [];
          const seenCuries = new Set<string>();

          for (const q of queries) {
            if (foundMatch) break;
            const lookupRes = await fetch(
              `https://name-resolution-sri.renci.org/lookup?string=${encodeURIComponent(q)}&autocomplete=true&limit=10`,
              { signal: sig },
            );
            if (!lookupRes.ok) continue;
            const results: { curie: string; label: string; synonyms?: string[]; types?: string[] }[] = await lookupRes.json();

            for (const r of results) {
              if (!seenCuries.has(r.curie)) {
                seenCuries.add(r.curie);
                allResults.push({ curie: r.curie, label: r.label, types: r.types || [] });
              }
            }

            const match = results.find(r => r.curie === curie)
              || (inTextName && results.find(r => {
                if (normCollapse(r.label) === normCollapse(inTextName)) return true;
                return r.synonyms?.some(s => normCollapse(s) === normCollapse(inTextName));
              }));
            if (match) {
              setNrData({
                curie: match.curie,
                preferred_name: match.label,
                names: [match.label, ...(match.synonyms || [])],
                types: match.types || [],
              });
              foundMatch = true;
            }
          }
          setNrResults(allResults.slice(0, 8));
        }
        setLoading(false);
      } catch (e: any) {
        if (e.name !== 'AbortError') { setError(e.message); setLoading(false); }
      }
    })();
    return () => controller.abort();
  }, [curie, source]);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // ── Derived data depending on source ──
  const primaryLabel = source === 'nn' ? (nnData?.id?.label || curie)
    : source === 'nr' ? (nrData?.preferred_name || curie)
    : curie;

  const allLabels: string[] = source === 'nn'
    ? (nnData?.equivalent_identifiers || []).map((e: any) => e.label || '').filter(Boolean)
    : source === 'nr' ? (nrData?.names || []) : [];

  const types: string[] = source === 'nn' ? (nnData?.type || [])
    : source === 'nr' ? (nrData?.types || []) : [];

  const bestMatch = inTextName ? findBestMatch(inTextName, allLabels) : { match: null, level: null };

  const grouped: Record<string, { id: string; label: string }[]> = {};
  if (source === 'nn') {
    (nnData?.equivalent_identifiers || []).forEach((entry: any) => {
      const id = entry.identifier || '';
      const prefix = id.split(':')[0] || 'Other';
      if (!grouped[prefix]) grouped[prefix] = [];
      grouped[prefix].push({ id, label: entry.label || '' });
    });
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700
          w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                {source === 'nn' ? 'Normalized Node' : source === 'nr' ? 'Name Resolver' : 'Lookup'}
              </span>
              {source && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                  source === 'nn' ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
                    : 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400'
                }`}>{source === 'nn' ? 'Node Normalizer' : 'Name Resolution'}</span>
              )}
            </div>
            <div className="text-base font-bold text-slate-900 dark:text-white">{primaryLabel}</div>
            <div className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-0.5">{curie}</div>
            {inTextName && !loading && (
              <div className="mt-2 text-xs px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5
                bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 ring-1 ring-yellow-200 dark:ring-yellow-800/50">
                <span>
                  In-text: &ldquo;<strong>{inTextName}</strong>&rdquo;
                  {bestMatch.level && (
                    <span className="text-emerald-600 dark:text-emerald-400 ml-1.5">
                      — matches &ldquo;{bestMatch.match}&rdquo;{bestMatch.level === 'reorder' && ' (reordered)'}
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
          <button onClick={onClose}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg
              hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-sm text-red-500 py-4">{error}</div>
          ) : (source === 'nn' && !nnData) || (source === 'nr' && !nrData && nrResults.length === 0) ? (
            <div className="text-sm text-slate-400 py-4">No data found for this CURIE.</div>
          ) : source === 'nr' && !nrData && nrResults.length > 0 ? (
            <div className="space-y-3">
              <div className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700/50 text-xs text-slate-500 dark:text-slate-400">
                No exact match for <span className="font-mono font-semibold text-slate-600 dark:text-slate-300">{curie}</span>, but the Name Resolver returned these results for &ldquo;{inTextName || curie}&rdquo;:
              </div>
              <div className="space-y-1">
                {nrResults.map((r) => (
                  <div key={r.curie} className="flex items-baseline gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700/40 text-xs">
                    <span className="font-mono font-semibold text-violet-600 dark:text-violet-400 shrink-0">{r.curie}</span>
                    <span className="text-slate-600 dark:text-slate-300 truncate">{r.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : source === 'nn' ? (
            <div className="space-y-4">
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">Equivalent Identifiers and Labels</div>
              {Object.entries(grouped).map(([prefix, entries]) => (
                <div key={prefix}>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5">{prefix}</div>
                  <div className="space-y-0.5">
                    {entries.map((entry) => {
                      const ml = inTextName && entry.label ? labelMatchLevel(inTextName, entry.label) : null;
                      return (
                        <div key={entry.id} className={`flex items-baseline gap-2 py-0.5 text-xs ${ml ? 'bg-emerald-50 dark:bg-emerald-900/20 px-2 -mx-2 rounded-md' : ''}`}>
                          <span className="font-mono text-slate-400 dark:text-slate-500 shrink-0 text-[11px]">{entry.id}</span>
                          {entry.label && (
                            <span className={`font-medium ${ml ? 'text-emerald-700 dark:text-emerald-300 font-bold' : 'text-slate-700 dark:text-slate-300'}`}>
                              {entry.label}{ml === 'exact' && ' ← in text'}{ml === 'reorder' && ' ← in text (reordered)'}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {types.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">Types</div>
                  <div className="flex flex-wrap gap-1.5">
                    {types.map((t: string) => (
                      <span key={t} className="text-[11px] px-2 py-0.5 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300
                        rounded-md font-medium ring-1 ring-violet-200/60 dark:ring-violet-800/40">
                        {t.replace('biolink:', '')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {nrData && nrData.curie && nrData.curie !== curie && (
                <div className="px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200/60 dark:ring-amber-800/40">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-amber-600 dark:text-amber-400 mb-1">Suggested CURIE</div>
                  <div className="text-sm font-mono font-bold text-amber-700 dark:text-amber-300">{nrData.curie}</div>
                  {nrData.preferred_name && (
                    <div className="text-xs text-amber-600/80 dark:text-amber-400/70 mt-0.5">{nrData.preferred_name}</div>
                  )}
                </div>
              )}
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">Known Names</div>
                <div className="space-y-0.5">
                  {(nrData?.names || []).map((name, i) => {
                    const ml = inTextName ? labelMatchLevel(inTextName, name) : null;
                    return (
                      <div key={i} className={`text-xs py-0.5 ${ml ? 'bg-emerald-50 dark:bg-emerald-900/20 px-2 -mx-2 rounded-md' : ''}`}>
                        <span className={ml ? 'text-emerald-700 dark:text-emerald-300 font-bold' : 'text-slate-700 dark:text-slate-300'}>
                          {name}{ml === 'exact' && ' ← in text'}{ml === 'reorder' && ' ← in text (reordered)'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {types.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">Types</div>
                  <div className="flex flex-wrap gap-1.5">
                    {types.map((t: string) => (
                      <span key={t} className="text-[11px] px-2 py-0.5 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300
                        rounded-md font-medium ring-1 ring-violet-200/60 dark:ring-violet-800/40">
                        {t.replace('biolink:', '')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="text-[10px] text-slate-400 text-center">
            Press <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono font-semibold">Esc</kbd> to close
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ── Edge Card ───────────────────────────────────────────────────────────────
const greekToLatin: [RegExp, string][] = [
  [/[αΑ]/g, 'alpha'], [/[βΒ]/g, 'beta'], [/[γΓ]/g, 'gamma'], [/[δΔ]/g, 'delta'],
  [/[εΕ]/g, 'epsilon'], [/[ζΖ]/g, 'zeta'], [/[ηΗ]/g, 'eta'], [/[θΘ]/g, 'theta'],
  [/[κΚ]/g, 'kappa'], [/[λΛ]/g, 'lambda'], [/[μΜ]/g, 'mu'], [/[νΝ]/g, 'nu'],
  [/[ξΞ]/g, 'xi'], [/[πΠ]/g, 'pi'], [/[ρΡ]/g, 'rho'], [/[σΣ]/g, 'sigma'],
  [/[τΤ]/g, 'tau'], [/[φΦ]/g, 'phi'], [/[χΧ]/g, 'chi'], [/[ψΨ]/g, 'psi'], [/[ωΩ]/g, 'omega'],
];

const latinToGreek: [RegExp, string][] = [
  [/\balpha\b/gi, 'α'], [/\bbeta\b/gi, 'β'], [/\bgamma\b/gi, 'γ'], [/\bdelta\b/gi, 'δ'],
  [/\bepsilon\b/gi, 'ε'], [/\bzeta\b/gi, 'ζ'], [/\beta\b/gi, 'η'], [/\btheta\b/gi, 'θ'],
  [/\bkappa\b/gi, 'κ'], [/\blambda\b/gi, 'λ'], [/\bmu\b/gi, 'μ'], [/\bnu\b/gi, 'ν'],
  [/\bxi\b/gi, 'ξ'], [/\bpi\b/gi, 'π'], [/\brho\b/gi, 'ρ'], [/\bsigma\b/gi, 'σ'],
  [/\btau\b/gi, 'τ'], [/\bphi\b/gi, 'φ'], [/\bchi\b/gi, 'χ'], [/\bpsi\b/gi, 'ψ'], [/\bomega\b/gi, 'ω'],
];

const generateVariations = (name: string): string[] => {
  const out = new Set<string>();
  const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

  out.add(name);

  const spaced = clean(name.replace(/[-_.,;:()[\]{}/\\+]+/g, ' '));
  if (spaced) out.add(spaced);

  const collapsed = name.replace(/\s+/g, '');
  if (collapsed !== name) out.add(collapsed);

  let g2l = name;
  for (const [re, lat] of greekToLatin) g2l = g2l.replace(re, lat);
  if (g2l !== name) {
    out.add(clean(g2l));
    out.add(clean(g2l.replace(/[-_.,;:()[\]{}/\\+]+/g, ' ')));
  }

  let l2g = name;
  for (const [re, gr] of latinToGreek) l2g = l2g.replace(re, gr);
  if (l2g !== name) {
    out.add(clean(l2g));
    out.add(clean(l2g.replace(/[-_.,;:()[\]{}/\\+]+/g, ' ')));
  }

  out.delete('');
  return Array.from(out);
};

const generateSearchQueries = (name: string): string[] => {
  const seen = new Set<string>();
  const queries: string[] = [];
  for (const v of generateVariations(name)) {
    const q = v.replace(/\s+/g, ' ').trim();
    const key = q.toLowerCase();
    if (q.length >= 2 && !seen.has(key)) {
      seen.add(key);
      queries.push(q);
    }
  }
  return queries;
};

const variationsMatch = (variations: string[], label: string): boolean =>
  variations.some(v => normCollapse(v) === normCollapse(label));


const resolveTaxonLabels = async (taxonIds: string[]): Promise<Record<string, string>> => {
  const unique = [...new Set(taxonIds.filter(Boolean))];
  if (unique.length === 0) return {};
  try {
    const params = unique.map(id => `curie=${encodeURIComponent(id)}`).join('&');
    const res = await fetch(`https://nodenormalization-sri.renci.org/get_normalized_nodes?${params}`);
    if (!res.ok) return {};
    const data = await res.json();
    const labels: Record<string, string> = {};
    for (const id of unique) {
      const node = data[id];
      if (node?.id?.label) labels[id] = node.id.label;
    }
    return labels;
  } catch {
    return {};
  }
};

const CATEGORY_ROLE_TYPES: Record<string, { subject: string; object: string }> = {
  'biolink:ChemicalAffectsGeneAssociation': { subject: 'ChemicalEntity', object: 'Gene' },
  'biolink:ChemicalEntityToDiseaseOrPhenotypicFeatureAssociation': { subject: 'ChemicalEntity', object: 'Disease' },
  'biolink:CorrelatedGeneToDiseaseAssociation': { subject: 'Gene', object: 'Disease' },
  'biolink:GeneRegulatesGeneAssociation': { subject: 'Gene', object: 'Gene' },
};

const categoryBiolinkType = (category: string, role: 'subject' | 'object'): string | null => {
  const entry = CATEGORY_ROLE_TYPES[category];
  if (entry) return entry[role];
  // Fallback for unknown categories: try splitting on "To"
  const raw = category.replace(/^biolink:/, '').replace(/Association$/, '');
  const toMatch = raw.match(/^(.+?)To([A-Z].+)$/);
  if (!toMatch) return null;
  let part = role === 'subject' ? toMatch[1] : toMatch[2];
  part = part.replace(/^(Correlated|Causal|Druggable|Contributing)/, '');
  const orMatch = part.match(/^(.+?)Or[A-Z]/);
  if (orMatch) part = orMatch[1];
  return part || null;
};

const typeFitsCategory = (types: string[], expectedType: string | null): boolean => {
  if (!expectedType) return true;
  const exact = `biolink:${expectedType}`;
  return types.includes(exact);
};

type SuggestionCandidate = { curie: string; label: string; taxon: string | null };

const resolveInTextName = async (
  inTextName: string,
  edgeCurie: string,
  category: string,
  role: 'subject' | 'object',
): Promise<SuggestionCandidate[]> => {
  if (inTextName.trim().length < 2) return [];
  const variations = generateVariations(inTextName);
  const biolinkType = categoryBiolinkType(category, role);

  try {
    // Check if in-text name already matches a Node Normalizer label/synonym for the edge CURIE
    const nnRes = await fetch(
      `https://nodenormalization-sri.renci.org/get_normalized_nodes?curie=${encodeURIComponent(edgeCurie)}`,
    );
    if (nnRes.ok) {
      const nnData = await nnRes.json();
      const node = nnData[edgeCurie];
      if (node) {
        const allLabels = [
          node.id?.label,
          ...(node.equivalent_identifiers || []).map((eq: any) => eq.label),
        ].filter(Boolean);
        if (allLabels.some((label: string) => variationsMatch(variations, label))) return [];
      }
    }

    // No NN match — query Name Resolver for alternatives
    const queries = generateSearchQueries(inTextName);
    const typeParam = biolinkType ? `&biolink_type=${encodeURIComponent(biolinkType)}` : '';
    const seenCuries = new Set<string>();
    const allCandidates: { curie: string; label: string; taxonId: string | null }[] = [];

    for (const q of queries) {
      const nameRes = await fetch(
        `https://name-resolution-sri.renci.org/lookup?string=${encodeURIComponent(q)}&autocomplete=true&limit=10${typeParam}`,
      );
      if (!nameRes.ok) continue;
      const results: { curie: string; label: string; synonyms?: string[]; types?: string[]; taxa?: string[]; clique_identifier_count?: number }[] =
        await nameRes.json();

      for (const r of results) {
        if (seenCuries.has(r.curie) || r.curie === edgeCurie) continue;
        const labelMatch = variationsMatch(variations, r.label);
        const synMatch = r.synonyms?.some(s => variationsMatch(variations, s));
        if (!labelMatch && !synMatch) continue;
        if (!r.types || r.types.length === 0 || !typeFitsCategory(r.types, biolinkType)) continue;
        seenCuries.add(r.curie);
        allCandidates.push({ curie: r.curie, label: r.label, taxonId: r.taxa?.[0] || null });
      }
      if (allCandidates.length >= 5) break;
    }

    if (allCandidates.length === 0) return [];

    const taxonIds = allCandidates.map(c => c.taxonId).filter(Boolean) as string[];
    const taxonLabels = await resolveTaxonLabels(taxonIds);

    return allCandidates.map(c => ({
      curie: c.curie,
      label: c.label,
      taxon: c.taxonId ? (taxonLabels[c.taxonId] || c.taxonId) : null,
    }));
  } catch {
    return [];
  }
};

const EdgeCard: React.FC<{ item: TmkpAnnotationItem }> = ({ item }) => {
  const [normTarget, setNormTarget] = React.useState<{ curie: string; inTextName?: string; source: 'nn' | 'nr' } | null>(null);
  const [subjectNnLabel, setSubjectNnLabel] = React.useState<string | null>(null);
  const [objectNnLabel, setObjectNnLabel] = React.useState<string | null>(null);
  const [showPredicateDesc, setShowPredicateDesc] = React.useState(false);
  const [showSubjectLinks, setShowSubjectLinks] = React.useState(false);
  const [showObjectLinks, setShowObjectLinks] = React.useState(false);
  const { predicates } = useBiolinkPredicates();

  const predicateDesc = React.useMemo(() => {
    const normalized = item.predicate.replace('biolink:', '').replace(/_/g, ' ');
    const match = predicates.find(p => p.name === normalized || p.name === item.predicate.replace('biolink:', ''));
    return match?.description || null;
  }, [item.predicate, predicates]);

  const ev = item.evidence;
  const text = ev.supporting_text;
  const subjectInText = (ev.subject_start >= 0 && ev.subject_end > ev.subject_start && ev.subject_end <= text.length)
    ? text.slice(ev.subject_start, ev.subject_end) : null;
  const objectInText = (ev.object_start >= 0 && ev.object_end > ev.object_start && ev.object_end <= text.length)
    ? text.slice(ev.object_start, ev.object_end) : null;

  React.useEffect(() => {
    setSubjectNnLabel(null);
    setObjectNnLabel(null);

    const curies = new Set([item.subject_id, item.object_id]);
    const curieParam = Array.from(curies).map(c => `curie=${encodeURIComponent(c)}`).join('&');
    fetch(`https://nodenormalization-sri.renci.org/get_normalized_nodes?${curieParam}`)
      .then(r => r.json())
      .then(data => {
        const sNode = data[item.subject_id];
        if (sNode?.id?.label) setSubjectNnLabel(sNode.id.label);
        const oNode = data[item.object_id];
        if (oNode?.id?.label) setObjectNnLabel(oNode.id.label);
      })
      .catch(() => {});
  }, [item.evidence_id]);

  return (
    <>
      <AnimatePresence>
        {normTarget && <NodeNormModal curie={normTarget.curie} inTextName={normTarget.inTextName} source={normTarget.source} onClose={() => setNormTarget(null)} />}
      </AnimatePresence>
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden
        bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50">
        {/* Assertion row */}
        <div className="px-5 py-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold">Edge Assertion</span>
            <InfoTip align="left" text="This shows the extracted triple: Subject → Predicate → Object. Click entity names or CURIEs to view Node Normalizer data. Click the predicate to see its Biolink definition." />
          </div>
          <div className="flex items-stretch gap-4">
            {/* Subject */}
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-1.5 mb-2 justify-end">
                <span className="w-2 h-2 rounded-full bg-blue-400 dark:bg-blue-500" />
                <span className="text-[10px] uppercase tracking-widest text-blue-500 dark:text-blue-400 font-bold">Subject</span>
              </div>
              <button
                onClick={() => setNormTarget({ curie: item.subject_id, inTextName: subjectInText || undefined, source: 'nn' })}
                className="text-sm font-bold text-slate-900 dark:text-white leading-snug text-left w-full
                  hover:text-blue-600 dark:hover:text-blue-300 cursor-pointer transition-colors"
              >
                {subjectNnLabel || item.subject_name || item.subject_id}
              </button>
              <button
                onClick={() => setNormTarget({ curie: item.subject_id, inTextName: subjectInText || undefined, source: 'nn' })}
                className="text-[11px] text-blue-500 dark:text-blue-400 font-mono mt-1 truncate block
                  hover:underline hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer transition-colors"
              >
                {item.subject_id}
              </button>
              <div className="relative mt-2 inline-block">
                <button onClick={() => setShowSubjectLinks(v => !v)}
                  className="p-1 rounded-md text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                  title="External links">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
                <AnimatePresence>
                  {showSubjectLinks && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-wrap gap-1 mt-1">
                        {getEntityLinks(item.subject_id).map((link, i) => (
                          <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                            className="text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100
                              dark:hover:bg-blue-800/50 text-blue-600 dark:text-blue-300 rounded-md transition-colors
                              ring-1 ring-blue-100 dark:ring-blue-800/50">
                            {link.label}
                          </a>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Predicate arrow */}
            <div className="flex flex-col items-center justify-center gap-1.5 px-4 shrink-0">
              <div className="inline-flex items-center gap-1.5 mb-2 justify-end">
                <span className="w-2 h-2 rounded-full bg-purple-400 dark:bg-purple-500" />
                <span className="text-[10px] uppercase tracking-widest text-purple-500 dark:text-purple-400 font-bold">Predicate</span>
              </div>
              <button
                onClick={() => setShowPredicateDesc(v => !v)}
                className="px-3 py-1.5 rounded-lg bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-800/60
                  cursor-pointer hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors"
              >
                <div className="text-xs font-bold text-violet-700 dark:text-violet-300 text-center whitespace-nowrap">
                  {formatPredicate(item.predicate)}
                </div>
              </button>
              <AnimatePresence>
                {showPredicateDesc && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden w-48"
                  >
                    <div className="px-2.5 py-2 rounded-lg bg-violet-100/80 dark:bg-violet-900/40 border border-violet-200/60
                      dark:border-violet-700/50 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed text-center">
                      {predicateDesc || 'No description available for this predicate.'}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <svg className="w-6 h-3 text-violet-300 dark:text-violet-600" viewBox="0 0 24 12" fill="none">
                <path d="M0 6h20m0 0l-4-4m4 4l-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {item.qualified_predicate && (
                <div className="text-[10px] text-violet-500/70 dark:text-violet-400/50 font-medium">
                  via {formatPredicate(item.qualified_predicate)}
                </div>
              )}
              {(item.object_direction_qualifier || item.object_aspect_qualifier) && (
                <div className="flex flex-wrap items-center justify-center gap-1 mt-1">
                  {item.object_direction_qualifier && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300
                      text-[10px] font-medium ring-1 ring-amber-200/60 dark:ring-amber-800/40">
                      {formatQualifier(item.object_direction_qualifier)}
                    </span>
                  )}
                  {item.object_aspect_qualifier && (
                    <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300
                      text-[10px] font-medium ring-1 ring-purple-200/60 dark:ring-purple-800/40">
                      {formatQualifier(item.object_aspect_qualifier)}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Object */}
            <div className="flex-1 min-w-0 text-right">
              <div className="inline-flex items-center gap-1.5 mb-2 justify-end">
                <span className="w-2 h-2 rounded-full bg-red-400 dark:bg-red-500" />
                <span className="text-[10px] uppercase tracking-widest text-red-500 dark:text-red-400 font-bold">Object</span>
              </div>
              <button
                onClick={() => setNormTarget({ curie: item.object_id, inTextName: objectInText || undefined, source: 'nn' })}
                className="text-sm font-bold text-slate-900 dark:text-white leading-snug text-right w-full
                  hover:text-red-600 dark:hover:text-red-300 cursor-pointer transition-colors"
              >
                {objectNnLabel || item.object_name || item.object_id}
              </button>
              <button
                onClick={() => setNormTarget({ curie: item.object_id, inTextName: objectInText || undefined, source: 'nn' })}
                className="text-[11px] text-red-500 dark:text-red-400 font-mono mt-1 truncate block ml-auto
                  hover:underline hover:text-red-700 dark:hover:text-red-300 cursor-pointer transition-colors"
              >
                {item.object_id}
              </button>
              <div className="relative mt-2 inline-block ml-auto">
                <button onClick={() => setShowObjectLinks(v => !v)}
                  className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors ml-auto block"
                  title="External links">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
                <AnimatePresence>
                  {showObjectLinks && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-wrap gap-1 mt-1 justify-end">
                        {getEntityLinks(item.object_id).map((link, i) => (
                          <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                            className="text-[10px] px-1.5 py-0.5 bg-red-50 dark:bg-red-900/30 hover:bg-red-100
                              dark:hover:bg-red-800/50 text-red-600 dark:text-red-300 rounded-md transition-colors
                              ring-1 ring-red-100 dark:ring-red-800/50">
                            {link.label}
                          </a>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Meta bar */}
        <div className="px-5 py-2.5 bg-slate-50/80 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-700/60
          flex items-center gap-2 flex-wrap">
          {item.category && (
            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400
              text-[11px] font-medium">
              {item.category.replace('biolink:', '')}
            </span>
          )}
        </div>
      </div>
    </>
  );
};

// ── LLM Config Modal ──────────────────────────────────────────────────────
const LlmConfigModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [provider, setProvider] = React.useState('');
  const [baseUrl, setBaseUrl] = React.useState('');
  const [model, setModel] = React.useState('');
  const [apiKey, setApiKey] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    tmkpApi.getLlmConfig().then(cfg => {
      setProvider(cfg.provider || '');
      setBaseUrl(cfg.base_url || '');
      setModel(cfg.model || '');
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const save = async () => {
    if (!provider) { setSaveError('Select a provider or preset'); return; }
    if (!model) { setSaveError('Model is required'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      await tmkpApi.setLlmConfig({ provider, base_url: baseUrl, model, api_key: apiKey });
      onClose();
    } catch (err: any) {
      setSaveError(err?.response?.data?.detail || err?.message || 'Save failed');
      setSaving(false);
    }
  };

  const presets = [
    { label: 'Anthropic (Claude)', provider: 'anthropic', base_url: '', model: 'claude-sonnet-4-20250514', needsKey: true },
    { label: 'OpenAI', provider: 'openai', base_url: 'https://api.openai.com/v1', model: 'gpt-4o-mini', needsKey: true },
    { label: 'Ollama (local)', provider: 'openai', base_url: 'http://localhost:11434/v1', model: 'llama3.2', needsKey: false },
    { label: 'LM Studio (local)', provider: 'openai', base_url: 'http://localhost:1234/v1', model: 'default', needsKey: false },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">LLM Configuration</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-lg cursor-pointer">&times;</button>
        </div>
        {!loaded ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading...</div>
        ) : (
          <div className="px-5 py-4 space-y-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 block">Quick Presets</label>
              <div className="flex flex-wrap gap-1.5">
                {presets.map(p => (
                  <button key={p.label} onClick={() => { setProvider(p.provider); setBaseUrl(p.base_url); setModel(p.model); }}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      provider === p.provider && baseUrl === p.base_url
                        ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-300 dark:ring-indigo-700'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}>{p.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">Base URL</label>
              <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="e.g. http://localhost:11434/v1"
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700
                  text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono" />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">Model</label>
              <input value={model} onChange={e => setModel(e.target.value)} placeholder="e.g. llama3.2, gpt-4o-mini"
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700
                  text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono" />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
                API Key <span className="normal-case font-normal">(leave empty for local models)</span>
              </label>
              <input value={apiKey} onChange={e => setApiKey(e.target.value)} type="password" placeholder="sk-..."
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700
                  text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono" />
            </div>
            {saveError && (
              <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{saveError}</div>
            )}
            <button onClick={save} disabled={saving}
              className="w-full py-2 text-xs font-bold text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50
                rounded-lg transition-colors cursor-pointer">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

// ── Verdict Panel ─────────────────────────────────────────────────────────
export interface VerdictPanelHandle {
  flush: () => void;
}

const VerdictPanel = React.forwardRef<VerdictPanelHandle, {
  item: TmkpAnnotationItem;
  onVerdict: (verdict: string, extra?: { correctedPredicate?: string; correctedSubject?: string; correctedObject?: string; notes?: string }) => void;
  onClear: () => void;
}>(({ item, onVerdict, onClear }, ref) => {
  const parseVerdicts = (v: string | null): Set<TmkpVerdict> => {
    if (!v) return new Set();
    return new Set(v.split(',').filter(Boolean) as TmkpVerdict[]);
  };

  const [selected, setSelected] = useState<Set<TmkpVerdict>>(parseVerdicts(item.verdict));
  const [correctedPredicate, setCorrectedPredicate] = useState('');
  const [correctedSubject, setCorrectedSubject] = useState('');
  const [correctedObject, setCorrectedObject] = useState('');
  const [notes, setNotes] = useState(item.verdict_notes || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [subjectSuggestions, setSubjectSuggestions] = useState<SuggestionCandidate[]>([]);
  const [objectSuggestions, setObjectSuggestions] = useState<SuggestionCandidate[]>([]);
  const [normTarget, setNormTarget] = useState<{ curie: string; inTextName?: string; source: 'nn' | 'nr' } | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  const { predicates, loading: predicatesLoading } = useBiolinkPredicates();
  const filteredPredicates = useSmartPredicateSearch(predicates, searchTerm);

  const ev = item.evidence;
  const text = ev.supporting_text;
  const subjectInText = (ev.subject_start >= 0 && ev.subject_end > ev.subject_start && ev.subject_end <= text.length)
    ? text.slice(ev.subject_start, ev.subject_end) : null;
  const objectInText = (ev.object_start >= 0 && ev.object_end > ev.object_start && ev.object_end <= text.length)
    ? text.slice(ev.object_start, ev.object_end) : null;

  useEffect(() => {
    setSelected(parseVerdicts(item.verdict));
    setCorrectedPredicate('');
    setCorrectedSubject('');
    setCorrectedObject('');
    setNotes(item.verdict_notes || '');
    setSearchTerm('');
    setShowSaved(false);
    setSubjectSuggestions([]);
    setObjectSuggestions([]);
    setNormTarget(null);

    const cat = item.category || '';
    if (subjectInText) {
      resolveInTextName(subjectInText, item.subject_id, cat, 'subject').then(setSubjectSuggestions);
    }
    if (objectInText) {
      resolveInTextName(objectInText, item.object_id, cat, 'object').then(setObjectSuggestions);
    }
  }, [item.evidence_id]);

  const onVerdictRef = React.useRef(onVerdict);
  onVerdictRef.current = onVerdict;
  const onClearRef = React.useRef(onClear);
  onClearRef.current = onClear;
  const selectedRef = React.useRef(selected);
  selectedRef.current = selected;
  const correctedPredicateRef = React.useRef(correctedPredicate);
  correctedPredicateRef.current = correctedPredicate;
  const correctedSubjectRef = React.useRef(correctedSubject);
  correctedSubjectRef.current = correctedSubject;
  const correctedObjectRef = React.useRef(correctedObject);
  correctedObjectRef.current = correctedObject;
  const notesRef = React.useRef(notes);
  notesRef.current = notes;
  const savedVerdictRef = React.useRef(item.verdict);
  savedVerdictRef.current = item.verdict;

  const doSubmit = React.useCallback((sel: Set<TmkpVerdict>) => {
    if (sel.size === 0) {
      if (savedVerdictRef.current) {
        onClearRef.current();
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 1200);
      }
      return;
    }
    const verdictStr = Array.from(sel).join(',');
    onVerdictRef.current(verdictStr, {
      correctedPredicate: sel.has('wrong_predicate') ? correctedPredicateRef.current || undefined : undefined,
      correctedSubject: sel.has('wrong_subject') ? correctedSubjectRef.current.trim() || undefined : undefined,
      correctedObject: sel.has('wrong_object') ? correctedObjectRef.current.trim() || undefined : undefined,
      notes: notesRef.current || undefined,
    });
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 1200);
  }, []);

  React.useImperativeHandle(ref, () => ({
    flush: () => {
      const sel = selectedRef.current;
      const verdictStr = Array.from(sel).join(',');
      if (verdictStr !== (savedVerdictRef.current || '')) {
        doSubmit(sel);
      }
    },
  }), [doSubmit]);

  const pendingSubmitRef = React.useRef(false);
  const userToggledRef = React.useRef(false);
  const toggleVerdict = React.useCallback((verdict: TmkpVerdict) => {
    userToggledRef.current = true;
    setSelected(prev => {
      if (verdict === 'correct') {
        if (prev.has('correct')) return new Set();
        pendingSubmitRef.current = true;
        return new Set<TmkpVerdict>(['correct']);
      }
      const next = new Set(prev);
      next.delete('correct');
      if (next.has(verdict)) next.delete(verdict);
      else next.add(verdict);
      return next;
    });
  }, []);

  useEffect(() => {
    if (pendingSubmitRef.current && selected.has('correct')) {
      pendingSubmitRef.current = false;
      doSubmit(selected);
      return;
    }
    if (userToggledRef.current && selected.size === 0 && savedVerdictRef.current) {
      userToggledRef.current = false;
      doSubmit(selected);
      return;
    }
    userToggledRef.current = false;
  }, [selected, doSubmit]);

  const handleClickSubmit = React.useCallback(() => {
    const sel = selectedRef.current;
    if (sel.size === 0 || sel.has('correct')) return;
    doSubmit(sel);
  }, [doSubmit]);

  const handlePredicateSelect = (predicateId: string) => {
    setCorrectedPredicate(predicateId);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) {
        if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); doSubmit(selectedRef.current); }
        return;
      }

      if (e.key === 'C') { e.preventDefault(); toggleVerdict('correct'); }
      else if (e.key === 'S') { e.preventDefault(); toggleVerdict('swap_so'); }
      else if (e.key === 'W') { e.preventDefault(); toggleVerdict('wrong_predicate'); }
      else if (e.key === 'U') { e.preventDefault(); toggleVerdict('wrong_subject'); }
      else if (e.key === 'O') { e.preventDefault(); toggleVerdict('wrong_object'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [doSubmit, toggleVerdict]);

  return (
    <>
    <AnimatePresence>
      {normTarget && <NodeNormModal curie={normTarget.curie} inTextName={normTarget.inTextName} source={normTarget.source} onClose={() => setNormTarget(null)} />}
    </AnimatePresence>
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden
      bg-white dark:bg-slate-800">
      {/* Header */}
      <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800
        border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 tracking-tight">Your Verdict</h3>
          <InfoTip text="Pick your verdict for this triple. Shift+C = Correct (auto-submits). Other verdicts can be combined freely — press Enter to submit. Picking Wrong Pred/Subj/Obj lets you optionally suggest a correction." />
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      {/* Verdict buttons */}
      <div className="px-5 py-5">
        <div className="grid grid-cols-5 gap-2">
          {(Object.entries(VERDICT_CONFIG) as [TmkpVerdict, typeof VERDICT_CONFIG['correct']][]).map(([key, cfg]) => {
            const isActive = selected.has(key);
            return (
              <button
                key={key}
                onClick={() => toggleVerdict(key)}
                title={cfg.tip}
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
                }`}>SHIFT+{cfg.shortcut}</kbd>
              </button>
            );
          })}
        </div>

        {/* Predicate correction picker */}
        <AnimatePresence>
          {selected.has('wrong_predicate') && (
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
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-300">Correct predicate <span className="font-normal text-slate-400">(optional)</span></span>
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
          {selected.has('wrong_subject') && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="text-xs mb-3 space-y-1.5">
                  <span className="text-slate-400">Current: <span className="font-semibold text-slate-600 dark:text-slate-300">{item.subject_name || item.subject_id}</span></span>
                  {subjectSuggestions.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-amber-600 dark:text-amber-400">Suggestions:</span>
                      {subjectSuggestions.map(s => (
                        <div key={s.curie} className="flex items-center gap-1.5 pl-1">
                          <button
                            onClick={() => setNormTarget({ curie: s.curie, inTextName: subjectInText || undefined, source: 'nr' })}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/20
                              border border-amber-200 dark:border-amber-700/50 group cursor-pointer
                              hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                          >
                            <span className="font-mono font-semibold text-amber-700 dark:text-amber-300 group-hover:underline">{s.curie}</span>
                            <span className="text-slate-500 dark:text-slate-400">{s.label}</span>
                            {s.taxon && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">{s.taxon}</span>}
                          </button>
                          <button
                            onClick={() => setCorrectedSubject(s.curie)}
                            title="Accept this suggestion"
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold text-emerald-600 dark:text-emerald-400
                              bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/50
                              hover:bg-emerald-100 dark:hover:bg-emerald-800/30 transition-colors"
                          >
                            Accept
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-blue-500">⚑</span>
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Correct subject <span className="font-normal text-slate-400">(optional)</span></span>
                </div>
                <input
                  type="text"
                  value={correctedSubject}
                  onChange={(e) => setCorrectedSubject(e.target.value)}
                  placeholder="Leave blank if unsure..."
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 dark:border-slate-600
                    dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400
                    focus:border-blue-400 placeholder:text-slate-400"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wrong object input */}
        <AnimatePresence>
          {selected.has('wrong_object') && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="text-xs mb-3 space-y-1.5">
                  <span className="text-slate-400">Current: <span className="font-semibold text-slate-600 dark:text-slate-300">{item.object_name || item.object_id}</span></span>
                  {objectSuggestions.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-amber-600 dark:text-amber-400">Suggestions:</span>
                      {objectSuggestions.map(s => (
                        <div key={s.curie} className="flex items-center gap-1.5 pl-1">
                          <button
                            onClick={() => setNormTarget({ curie: s.curie, inTextName: objectInText || undefined, source: 'nr' })}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/20
                              border border-amber-200 dark:border-amber-700/50 group cursor-pointer
                              hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                          >
                            <span className="font-mono font-semibold text-amber-700 dark:text-amber-300 group-hover:underline">{s.curie}</span>
                            <span className="text-slate-500 dark:text-slate-400">{s.label}</span>
                            {s.taxon && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">{s.taxon}</span>}
                          </button>
                          <button
                            onClick={() => setCorrectedObject(s.curie)}
                            title="Accept this suggestion"
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold text-emerald-600 dark:text-emerald-400
                              bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/50
                              hover:bg-emerald-100 dark:hover:bg-emerald-800/30 transition-colors"
                          >
                            Accept
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-orange-500">⚐</span>
                  <span className="text-xs font-bold text-orange-700 dark:text-orange-300">Correct object <span className="font-normal text-slate-400">(optional)</span></span>
                </div>
                <input
                  type="text"
                  value={correctedObject}
                  onChange={(e) => setCorrectedObject(e.target.value)}
                  placeholder="Leave blank if unsure..."
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 dark:border-slate-600
                    dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400
                    focus:border-orange-400 placeholder:text-slate-400"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notes */}
        <AnimatePresence>
          {selected.size > 0 && !selected.has('correct') && (
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
                  className="w-full p-3 text-sm border border-slate-300 dark:border-slate-600
                    dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:ring-2
                    focus:ring-violet-400 focus:border-violet-400 placeholder:text-slate-400 resize-none"
                  rows={2}
                  placeholder="Additional notes..."
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit button for non-correct verdicts */}
        <AnimatePresence>
          {selected.size > 0 && !selected.has('correct') && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              {/* <button
                onClick={handleClickSubmit}
                className="mt-4 w-full px-4 py-2.5 text-sm font-semibold bg-violet-500 hover:bg-violet-600
                  active:bg-violet-700 text-white rounded-lg transition-colors shadow-sm
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-violet-500"
              >
                Submit ({Array.from(selected).map(v => v.replace(/_/g, ' ')).join(' + ')})
              </button> */}
              {/* <div className="mt-1.5 text-center text-[10px] text-slate-400">
                or press <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono font-semibold text-slate-500 dark:text-slate-400">Enter</kbd>
              </div> */}
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
                SHIFT+{cfg.shortcut}
              </kbd>
              <span>{cfg.label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
    </>
  );
});

// ── Item Progress Strip ──────────────────────────────────────────────────────
const BATCH_SIZE = 100;

const verdictDotColor = (verdict: string | null): string => {
  if (!verdict) return 'bg-slate-300 dark:bg-slate-600';
  const first = verdict.split(',')[0] as TmkpVerdict;
  const hasMultiple = verdict.includes(',');
  if (hasMultiple) return 'bg-violet-400';
  switch (first) {
    case 'correct': return 'bg-emerald-400';
    case 'swap_so': return 'bg-cyan-400';
    case 'wrong_subject': return 'bg-blue-400';
    case 'wrong_predicate': return 'bg-amber-400';
    case 'wrong_object': return 'bg-orange-400';
    default: return 'bg-slate-300 dark:bg-slate-600';
  }
};

const ProgressStrip: React.FC<{
  items: TmkpAnnotationItem[];
  currentIndex: number;
  onJump: (idx: number) => void;
  overall?: TmkpProgress | null;
}> = ({ items, currentIndex, onJump, overall }) => {
  const answeredCount = items.filter(i => i.verdict).length;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Batch Progress
          </span>
          <InfoTip text="Each dot is one item in your batch. Colors show verdict type: green = correct, cyan = swapped, blue = wrong subject, purple = wrong predicate, orange = wrong object, purple = combo. Click any dot to jump to that item." />
        </div>
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
      {overall && (
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700/60">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Overall</span>
            <span className="text-[10px] font-bold tabular-nums text-violet-600 dark:text-violet-400">
              {overall.completion_percentage.toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden mb-2">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-500"
              style={{ width: `${Math.min(100, overall.completion_percentage)}%` }} />
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] tabular-nums">
            <span className="text-emerald-600 dark:text-emerald-400" title="Correct">{overall.correct_count} correct</span>
            <span className="text-cyan-600 dark:text-cyan-400" title="Swapped">{overall.swapped_count} swapped</span>
            <span className="text-blue-600 dark:text-blue-400" title="Wrong subject">{overall.wrong_subject_count} wrong subj</span>
            <span className="text-purple-600 dark:text-purple-400" title="Wrong predicate">{overall.wrong_predicate_count} wrong pred</span>
            <span className="text-orange-600 dark:text-orange-400" title="Wrong object">{overall.wrong_object_count} wrong obj</span>
            <span className="text-pink-600 dark:text-pink-400" title="Multi-verdict combos">{overall.combo_count} combo</span>
            <span className="text-slate-400 dark:text-slate-500">{overall.remaining} remaining</span>
          </div>
        </div>
      )}
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

  const batchRef = React.useRef(batch);
  batchRef.current = batch;
  const verdictPanelRef = React.useRef<VerdictPanelHandle>(null);


  const isAdminPage = location.pathname.endsWith('/admin');
  const item = batch[batchIndex] || null;
  const itemRef = React.useRef(item);
  itemRef.current = item;

  const loadBatch = useCallback(async () => {
    if (!annotator) return;
    try {
      setLoading(true);
      setError(null);
      const items = await tmkpApi.getBatch(annotator, BATCH_SIZE);
      setBatch(items);
      const firstUnverified = items.findIndex(it => !it.verdict);
      setBatchIndex(firstUnverified >= 0 ? firstUnverified : 0);
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

  const handleVerdict = useCallback(async (verdict: string, extra?: { correctedPredicate?: string; correctedSubject?: string; correctedObject?: string; notes?: string }) => {
    const currentItem = itemRef.current;
    if (!currentItem || !annotator) return;
    const evidenceId = currentItem.evidence_id;
    try {
      await tmkpApi.saveVerification({
        edge_db_id: currentItem.edge_db_id,
        evidence_id: evidenceId,
        verdict,
        corrected_predicate: extra?.correctedPredicate,
        corrected_subject: extra?.correctedSubject,
        corrected_object: extra?.correctedObject,
        notes: extra?.notes,
        annotator,
      });
      setBatch(prev => prev.map(it =>
        it.evidence_id === evidenceId ? { ...it, verdict, verdict_notes: extra?.notes || null } : it
      ));
      setTimeout(() => {
        const current = batchRef.current;
        setBatchIndex(currIdx => {
          const nextUnanswered = current.findIndex((it, i) => i > currIdx && !it.verdict);
          if (nextUnanswered !== -1) return nextUnanswered;
          const firstUnanswered = current.findIndex(it => !it.verdict);
          if (firstUnanswered !== -1) return firstUnanswered;
          return currIdx;
        });
      }, 400);
      loadProgress();
    } catch (err: any) {
      console.error('Failed to save verification:', err?.response?.data || err);
    }
  }, [annotator, loadProgress]);

  const handleClearVerdict = useCallback(async () => {
    const currentItem = itemRef.current;
    if (!currentItem || !annotator) return;
    const evidenceId = currentItem.evidence_id;
    try {
      await tmkpApi.deleteVerification(currentItem.edge_db_id, annotator, evidenceId);
      setBatch(prev => prev.map(it =>
        it.evidence_id === evidenceId ? { ...it, verdict: null, verdict_notes: null } : it
      ));
      loadProgress();
    } catch (err: any) {
      console.error('Failed to clear verification:', err?.response?.data || err);
    }
  }, [annotator, loadProgress]);

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
                  <InfoTip text="The original text from which the triple was extracted. The subject is highlighted in blue and the object in red. Click the publication ID (top-right) to view the source paper in PubMed Central." />
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
              <ProgressStrip items={batch} currentIndex={batchIndex} onJump={(idx) => { verdictPanelRef.current?.flush(); setBatchIndex(idx); }} overall={progress} />

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => { verdictPanelRef.current?.flush(); setBatchIndex(Math.max(0, batchIndex - 1)); }}
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
                  onClick={() => { verdictPanelRef.current?.flush(); setBatchIndex(Math.min(batch.length - 1, batchIndex + 1)); }}
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
                <VerdictPanel ref={verdictPanelRef} item={item} onVerdict={handleVerdict} onClear={handleClearVerdict} />
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
                { label: 'Verified once', value: stats.total_verified, color: 'text-violet-600 dark:text-violet-400' },
                { label: 'Needs 2nd', value: stats.needs_second, color: 'text-amber-600 dark:text-amber-400' },
                { label: 'Dual-Reviewed', value: stats.dual_reviewed, color: 'text-emerald-600 dark:text-emerald-400' },
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
