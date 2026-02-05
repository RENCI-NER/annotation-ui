import React from 'react';
import { Entity, Triple } from '../types';

interface Props {
  abstract: string;
  highlightedEntities: [Entity, Entity];
  currentTriple?: Triple;
}

export const AbstractView: React.FC<Props> = ({ abstract, highlightedEntities, currentTriple }) => {
  const [subject, object] = highlightedEntities;

  const renderHighlightedText = () => {
    const segments: Array<{ text: string; type?: 'subject' | 'object' | 'relationship' }> = [];
    
    // Explicitly type the highlights array
    const highlights: Array<{ start: number; end: number; type: 'subject' | 'object' | 'relationship' }> = [
      { start: subject.start_pos, end: subject.end_pos, type: 'subject' as const },
      { start: object.start_pos, end: object.end_pos, type: 'object' as const }
    ];
    
    if (currentTriple?.llm_suggestion) {
      const relationshipText = currentTriple.llm_suggestion.toLowerCase();
      const abstractLower = abstract.toLowerCase();
      
      // Find relationship text between subject and object
      const searchStart = Math.min(subject.end_pos, object.end_pos);
      const searchEnd = Math.max(subject.start_pos, object.start_pos);
      const searchRegion = abstractLower.slice(searchStart, searchEnd);
      
      const relIndex = searchRegion.indexOf(relationshipText);
      if (relIndex !== -1) {
        const actualStart = searchStart + relIndex;
        const actualEnd = actualStart + relationshipText.length;
        highlights.push({
          start: actualStart,
          end: actualEnd,
          type: 'relationship'  // Now this works
        });
      }
    }
  
    highlights.sort((a, b) => a.start - b.start);
  
    let lastPos = 0;
    highlights.forEach(highlight => {
      // Add text before highlight
      if (highlight.start > lastPos) {
        segments.push({
          text: abstract.slice(lastPos, highlight.start)
        });
      }
      // Add highlighted text
      segments.push({
        text: abstract.slice(highlight.start, highlight.end),
        type: highlight.type
      });
      lastPos = highlight.end;
    });
  
    // Add remaining text
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