import React from 'react';
import { Entity, Triple } from '../types';

interface Props {
  abstract: string;
  highlightedEntities: [Entity, Entity];
  currentTriple?: Triple;
}

export const AbstractView: React.FC<Props> = ({ abstract, highlightedEntities, currentTriple }) => {
  const [subject, object] = highlightedEntities;

  // Stopwords to ignore in relationship matching
  const STOPWORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
    'to', 'was', 'will', 'with'
  ]);

  const hasTriplePositions = (): boolean => {
    return !!(
      currentTriple &&
      currentTriple.subject_start !== undefined && 
      currentTriple.subject_end !== undefined &&
      currentTriple.object_start !== undefined && 
      currentTriple.object_end !== undefined
    );
  };

  // Get word stem (simple stemming for verb forms)
  const getStem = (word: string): string => {
    const w = word.toLowerCase();
    const endings = ['ing', 'ed', 's', 'es', 'd'];
    for (const ending of endings) {
      if (w.endsWith(ending) && w.length > ending.length + 2) {
        return w.slice(0, -ending.length);
      }
    }
    return w;
  };

  // Check if two words match (exact or stem match)
  const wordsMatch = (word1: string, word2: string): boolean => {
    const w1 = word1.toLowerCase();
    const w2 = word2.toLowerCase();
    
    // Skip very short words
    if (w1.length <= 2 || w2.length <= 2) return false;
    
    // Skip stopwords
    if (STOPWORDS.has(w1) || STOPWORDS.has(w2)) return false;
    
    // Exact match
    if (w1 === w2) return true;
    
    // One contains the other (for partial matches)
    if (w1.includes(w2) || w2.includes(w1)) return true;
    
    // Stem match
    if (getStem(w1) === getStem(w2)) return true;
    
    return false;
  };

    // Find relationship occurrences with fuzzy matching
  const findRelationshipOccurrences = (text: string): Array<{start: number, end: number}> => {
    const occurrences: Array<{start: number, end: number}> = [];  // ✅ Add explicit type
    const abstractWords = abstract.toLowerCase().split(/\b/);
    
    // Extract meaningful words from relationship (filter stopwords and short words)
    const words = text.toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOPWORDS.has(w));
    
    if (words.length === 0) return occurrences;
    
    for (let i = 0; i < abstractWords.length; i++) {
      const word = abstractWords[i];
      
      // Skip short words and stopwords
      if (word.length <= 2 || STOPWORDS.has(word)) continue;
      
      for (const relWord of words) {
        if (wordsMatch(word, relWord)) {
          const beforeText = abstractWords.slice(0, i).join('');
          const start = beforeText.length;
          const end = start + word.length;
          
          // Avoid duplicates
          if (!occurrences.some(occ => occ.start === start)) {
            occurrences.push({ start, end });
          }
        }
      }
    }
    
    return occurrences;
  };

  const renderHighlightedText = () => {
    const segments: Array<{ text: string; type?: 'subject' | 'object' | 'relationship' }> = [];
    
    const highlights: Array<{ start: number; end: number; type: 'subject' | 'object' | 'relationship' }> = [];
    
    if (hasTriplePositions() && currentTriple) {
      //  Use exact positions from triple
      highlights.push(
        { start: currentTriple.subject_start!, end: currentTriple.subject_end!, type: 'subject' as const },
        { start: currentTriple.object_start!, end: currentTriple.object_end!, type: 'object' as const }
      );
      
      if (currentTriple.relationship_start !== undefined && 
          currentTriple.relationship_end !== undefined) {
        highlights.push({
          start: currentTriple.relationship_start,
          end: currentTriple.relationship_end,
          type: 'relationship' as const
        });
      }
    } else {
      // FALLBACK: Search for entities in abstract (single occurrence each)
      const abstractLower = abstract.toLowerCase();
      
      // Find subject (first occurrence)
      const subjectText = subject.text.toLowerCase();
      const subjectPos = abstractLower.indexOf(subjectText);
      if (subjectPos !== -1) {
        highlights.push({ 
          start: subjectPos, 
          end: subjectPos + subject.text.length, 
          type: 'subject' as const 
        });
      }
      
      // Find object (first occurrence)
      const objectText = object.text.toLowerCase();
      const objectPos = abstractLower.indexOf(objectText);
      if (objectPos !== -1) {
        highlights.push({ 
          start: objectPos, 
          end: objectPos + object.text.length, 
          type: 'object' as const 
        });
      }
      
      // Relationship uses fuzzy matching with stopword filtering
      if (currentTriple?.llm_suggestion) {
        const relationshipOccurrences = findRelationshipOccurrences(currentTriple.llm_suggestion);
        relationshipOccurrences.forEach(occ => {
          highlights.push({ ...occ, type: 'relationship' as const });
        });
      }
    }
  
    // Sort by start position
    highlights.sort((a, b) => a.start - b.start);
    
    // Merge overlapping highlights
    const mergedHighlights: typeof highlights = [];
    highlights.forEach(highlight => {
      const lastMerged = mergedHighlights[mergedHighlights.length - 1];
      
      if (lastMerged && highlight.start < lastMerged.end) {
        if (highlight.end > lastMerged.end) {
          lastMerged.end = highlight.end;
        }
      } else {
        mergedHighlights.push(highlight);
      }
    });
    
    if (mergedHighlights.length === 0) {
      return <span>{abstract}</span>;
    }
  
    let lastPos = 0;
    mergedHighlights.forEach(highlight => {
      if (highlight.start > lastPos) {
        segments.push({
          text: abstract.slice(lastPos, highlight.start)
        });
      }
      segments.push({
        text: abstract.slice(highlight.start, highlight.end),
        type: highlight.type
      });
      lastPos = highlight.end;
    });
  
    if (lastPos < abstract.length) {
      segments.push({
        text: abstract.slice(lastPos)
      });
    }
  
    return segments.map((segment, i) => {
      if (segment.type === 'subject') {
        return (
          <mark key={i} className="bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 px-1 py-0.5 rounded font-semibold">
            {segment.text}
          </mark>
        );
      } else if (segment.type === 'object') {
        return (
          <mark key={i} className="bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100 px-1 py-0.5 rounded font-semibold">
            {segment.text}
          </mark>
        );
      } else if (segment.type === 'relationship') {
        return (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-700 text-yellow-900 dark:text-yellow-100 px-1 py-0.5 rounded font-semibold">
            {segment.text}
          </mark>
        );
      }
      return <span key={i}>{segment.text}</span>;
    });
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">📄 Abstract & Entities</h3>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="text-gray-800 dark:text-gray-200 leading-relaxed text-sm">
          {renderHighlightedText()}
        </div>
      </div>
    </div>
  );
};