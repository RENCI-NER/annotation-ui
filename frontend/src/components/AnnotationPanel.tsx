import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Triple } from '../types';
import { useBiolinkPredicates, useSmartPredicateSearch } from '../hooks/useBiolinkPredicates';

interface Props {
  triple: Triple;
  tripleIndex: number;
  totalTriples: number;
  onAnnotate: (predicate: string, confidence: string, notes?: string) => void;
  onSkip: () => void;
  onFlag: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

const getEntityLinks = (normalizedId: string, biolinkType: string) => {
  const links: { label: string; url: string }[] = [];
  const [prefix, id] = normalizedId.split(':');
  
  if (prefix === 'CHEBI') {
    links.push({ label: 'ChEBI', url: `https://www.ebi.ac.uk/chebi/searchId.do?chebiId=${normalizedId}` });
    links.push({ label: 'PubChem', url: `https://pubchem.ncbi.nlm.nih.gov/compound/${id}` });
  } else if (prefix === 'HGNC' || biolinkType?.includes('Gene')) {
    links.push({ label: 'NCBI Gene', url: `https://www.ncbi.nlm.nih.gov/gene/?term=${id}` });
  } else if (prefix === 'MONDO') {
    links.push({ label: 'Mondo', url: `https://monarchinitiative.org/disease/${normalizedId}` });
  } else if (prefix === 'HP') {
    links.push({ label: 'HPO', url: `https://hpo.jax.org/browse/term/${normalizedId}` });
  } else if (prefix === 'UniProtKB') {
    links.push({ label: 'UniProt', url: `https://www.uniprot.org/uniprotkb/${id}` });
  }
  const identifiersPrefix = prefix === 'UniProtKB' ? 'uniprot' : prefix.toUpperCase();
  links.unshift({label: 'Identifiers.org',  url: `http://identifiers.org/${identifiersPrefix}:${id}`});
  return links;
};

export const AnnotationPanel: React.FC<Props> = ({
  triple,
  tripleIndex,
  totalTriples,
  onAnnotate,
  onSkip,
  onFlag,
  onPrevious,
  onNext
}) => {
  const { predicates, loading, error } = useBiolinkPredicates();
  const [selectedPredicate, setSelectedPredicate] = useState<string | null>(
    triple.predicate || null
  );
  const [confidence, setConfidence] = useState(triple.confidence || 'medium');
  const [notes, setNotes] = useState(triple.notes || '');
  const [showSaved, setShowSaved] = useState(false);
  const [autoAdvancing, setAutoAdvancing] = useState(false); 
  const [searchTerm, setSearchTerm] = useState('');

  // Smart search with LLM suggestion prioritization
  const smartPredicates = useSmartPredicateSearch(
    predicates,
    searchTerm,
    triple.llm_suggestion || undefined
  );

  const selectedPredicateInfo = predicates.find(p => p.id === selectedPredicate);

  useEffect(() => {
    setSelectedPredicate(triple.predicate || null);
    setConfidence(triple.confidence || 'medium');
    setNotes(triple.notes || '');
    setSearchTerm('');
  }, [triple]);

  const handlePredicateSelect = async (predicate: string) => {
    setSelectedPredicate(predicate);
    onAnnotate(predicate, confidence, notes);
    setShowSaved(true);
    setAutoAdvancing(true);
    
    setTimeout(() => {
      setShowSaved(false);
      setAutoAdvancing(false);
    }, 1000);
  };

  const handleConfidenceChange = (conf: string) => {
    setConfidence(conf);
    if (selectedPredicate) {
      onAnnotate(selectedPredicate, conf, notes);
    }
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    // Ignore keyboard shortcuts when typing in input/textarea
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' || 
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return;
    }
  
    if (e.key === ' ') {
      e.preventDefault();
      onSkip();
    } else if (e.key === 'ArrowRight') {
      onNext();
    } else if (e.key === 'ArrowLeft') {
      onPrevious();
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      onFlag();
    }
  };
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedPredicate, confidence, notes]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500">Loading predicates...</div>
      </div>
    );
  }


  
  return (
    <div className="h-full flex flex-col p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">✍️ Annotation</h3>
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {showSaved && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="text-green-600 font-medium text-sm"
              >
                ✓ Saved
              </motion.div>
            )}
            {autoAdvancing && tripleIndex < totalTriples - 1 && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="text-blue-600 font-medium text-sm"
              >
                → Next
              </motion.div>
            )}
          </AnimatePresence>
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {tripleIndex + 1} / {totalTriples}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
          ⚠️ {error}
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto">
        <motion.div
          key={triple.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Compact Triple Info */}
          <div className="mb-4 space-y-2 text-sm">
            {/* Compact Entity Info */}
            {/* <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2 bg-blue-50 dark:bg-blue-900 rounded border border-blue-200 dark:border-blue-700">
                  <div className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    Subject: {triple.subject.text}
                  </div>
                  <div className="text-blue-700 dark:text-blue-300">{triple.subject.normalized_id}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {triple.subject.biolink_types?.[0]}
                  </div>
                </div>
                
                <div className="p-2 bg-red-50 dark:bg-red-900 rounded border border-red-200 dark:border-red-700">
                  <div className="font-semibold text-red-900 dark:text-red-100 mb-1">
                    Object: {triple.object.text}
                  </div>
                  <div className="text-red-700 dark:text-red-300">{triple.object.normalized_id}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {triple.object.biolink_types?.[0]}
                  </div>
                </div>
              </div>
            </div> */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* Subject Entity */}
                <div className="p-3 bg-blue-50 dark:bg-blue-900 rounded border border-blue-200 dark:border-blue-700">
                  <div className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    Subject: {triple.subject.text}
                  </div>
                  <div className="text-blue-700 dark:text-blue-300 mb-1">
                    {triple.subject.normalized_id}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {triple.subject.biolink_types?.[0]}
                  </div>
                  
                  {/* Clickable Links */}
                  <div className="flex flex-wrap gap-1"> {getEntityLinks(triple.subject.normalized_id, triple.subject.biolink_types?.[0] || '').map((link, idx) => (
                      <a  key={idx}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-800 hover:bg-blue-200 dark:hover:bg-blue-700 text-blue-800 dark:text-blue-200 rounded"
                      >
                        {link.label} ↗
                      </a>
                    )
                    )}
                  </div>
                </div>
                
                {/* Object Entity */}
                <div className="p-3 bg-red-50 dark:bg-red-900 rounded border border-red-200 dark:border-red-700">
                  <div className="font-semibold text-red-900 dark:text-red-100 mb-1">
                    Object: {triple.object.text}
                  </div>
                  <div className="text-red-700 dark:text-red-300 mb-1">
                    {triple.object.normalized_id}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {triple.object.biolink_types?.[0]}
                  </div>
                  
                  {/* Clickable Links */}
                  <div className="flex flex-wrap gap-1">
                    {getEntityLinks(triple.object.normalized_id, triple.object.biolink_types?.[0] || '').map((link, idx) => (
                      <a
                        key={idx}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-2 py-1 bg-red-100 dark:bg-red-800 hover:bg-red-200 dark:hover:bg-red-700 text-red-800 dark:text-red-200 rounded"
                      >
                        {link.label} ↗
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {triple.llm_suggestion && (
              <div className="flex items-start gap-2 bg-yellow-50 p-2 rounded border border-yellow-200">
                <span className="font-semibold text-yellow-800 shrink-0">Relationship Text:</span>
                <span className="text-yellow-900">{triple.llm_suggestion}</span>
              </div>
            )}
          </div>

          {/* Predicate Selection */}
          <div className="mb-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">
              Select Biolink Predicate:
              {triple.llm_suggestion && !searchTerm && (
                <span className="ml-2 text-xs text-yellow-600 font-normal">
                  replacement for relationship text
                </span>
              )}
            </div>
            
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search predicates..."
              className="w-full p-2 mb-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {selectedPredicateInfo && (
              <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-xs text-green-600 mb-1">Selected:</div>
                <div className="font-medium text-sm text-green-800">
                  {selectedPredicateInfo.name}
                </div>
                {selectedPredicateInfo.description && (
                  <div className="text-xs text-green-700 italic mt-1">
                    {selectedPredicateInfo.description}
                  </div>
                )}
              </div>
            )}

            <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg">
              {smartPredicates.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  No predicates available
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {smartPredicates.map((predInfo, index) => {
                    const isTopMatch = index < 3 && !searchTerm && triple.llm_suggestion;
                    const isSelected = selectedPredicate === predInfo.id;
                    
                    return (
                      <button
                        key={predInfo.id}
                        onClick={() => handlePredicateSelect(predInfo.id)}
                        className={`w-full text-left p-2 transition-all ${
                          isSelected
                            ? 'bg-blue-500 text-white'
                            : isTopMatch
                            ? 'bg-yellow-50 hover:bg-yellow-100'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isTopMatch && (
                            <span className="text-xs"></span>
                          )}
                          <div className="flex-1">
                            <div className="text-sm font-medium">{predInfo.name}</div>
                            {predInfo.description && (
                              <div className={`text-xs mt-1 ${
                                isSelected
                                  ? 'text-blue-100'
                                  : 'text-gray-500'
                              }`}>
                                {predInfo.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t border-gray-200">
            <button
              onClick={onPrevious}
              disabled={tripleIndex === 0}
              className="flex-1 py-2 text-sm bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded-lg transition-colors"
            >
              ◀ Prev
            </button>
            <button
              onClick={onSkip}
              className="flex-1 py-2 text-sm bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-lg transition-colors"
            >
              Skip
            </button>
            <button
              onClick={onFlag}
              className="flex-1 py-2 text-sm bg-orange-100 hover:bg-orange-200 text-orange-800 rounded-lg transition-colors"
            >
              🚩 Flag
            </button>
            <button
              onClick={onNext}
              disabled={tripleIndex === totalTriples - 1}
              className="flex-1 py-2 text-sm bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-lg transition-colors"
            >
              Next ▶
            </button>
          </div>

          {/* Keyboard Hints */}
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
            <div>Space: Skip | F: Flag | ← →: Navigate</div>
            <div className="mt-1 text-green-600 dark:text-green-400">
              ✓ Auto-advances after annotation
            </div>
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label className="text-sm font-semibold text-gray-700 mb-2 block">
              Notes (optional):
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                if (selectedPredicate) {
                  onAnnotate(selectedPredicate, confidence, notes);
                }
              }}
              className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Optional notes..."
            />
          </div>
          
          {/* Confidence */}
          <div className="mb-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">Confidence:</div>
            <div className="flex gap-2">
              {['low', 'medium', 'high'].map((conf) => (
                <button
                  key={conf}
                  onClick={() => handleConfidenceChange(conf)}
                  className={`flex-1 py-2 px-3 text-sm rounded-lg border-2 transition-all ${
                    confidence === conf
                      ? 'border-purple-500 bg-purple-50 text-purple-700 font-medium'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {conf.charAt(0).toUpperCase() + conf.slice(1)}
                </button>
              ))}
            </div>
          </div>

        </motion.div>
      </div>
    </div>
  );
};