import React from 'react';
import { Entity } from '../types';

interface Props {
  abstract: string;
  highlightedEntities: [Entity, Entity];
}

export const AbstractView: React.FC<Props> = ({ abstract, highlightedEntities }) => {
  const [subject, object] = highlightedEntities;

  const renderHighlightedText = () => {
    const segments: Array<{ text: string; type?: 'subject' | 'object' }> = [];
    const entities = [
      { ...subject, type: 'subject' as const },
      { ...object, type: 'object' as const }
    ].sort((a, b) => a.start_pos - b.start_pos);

    let lastPos = 0;

    entities.forEach(entity => {
      if (entity.start_pos > lastPos) {
        segments.push({
          text: abstract.slice(lastPos, entity.start_pos)
        });
      }
      segments.push({
        text: abstract.slice(entity.start_pos, entity.end_pos),
        type: entity.type
      });
      lastPos = entity.end_pos;
    });

    if (lastPos < abstract.length) {
      segments.push({
        text: abstract.slice(lastPos)
      });
    }

    return segments.map((segment, i) => {
      if (segment.type === 'subject') {
        return (
          <mark key={i} className="bg-blue-200 text-blue-900 px-1 py-0.5 rounded font-semibold">
            {segment.text}
          </mark>
        );
      } else if (segment.type === 'object') {
        return (
          <mark key={i} className="bg-red-200 text-red-900 px-1 py-0.5 rounded font-semibold">
            {segment.text}
          </mark>
        );
      }
      return <span key={i}>{segment.text}</span>;
    });
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-xl shadow-lg border-l-4 border-blue-500 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <span>📄</span>
          <span>Abstract & Entities</span>
        </h3>
      </div>
      

      {/* Abstract Text */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="text-gray-800 leading-relaxed text-[15px]">
          {renderHighlightedText()}
        </div>
      </div>

      {/* Entity Info Footer */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-white p-3 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 bg-blue-200 rounded"></div>
              <span className="text-xs font-semibold text-gray-500 uppercase">Subject</span>
            </div>
            <div className="font-semibold text-gray-800">{subject.text}</div>
            <div className="text-xs text-gray-500 mt-1">{subject.normalized_id}</div>
            <div className="text-xs text-gray-500 mt-1">{subject.biolink_types?.[0]}</div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-red-200">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 bg-red-200 rounded"></div>
              <span className="text-xs font-semibold text-gray-500 uppercase">Object</span>
            </div>
            <div className="font-semibold text-gray-800">{object.text}</div>
            <div className="text-xs text-gray-500 mt-1">{object.normalized_id}</div>
            <div className="text-xs text-gray-500 mt-1">{object.biolink_types?.[0]}</div>
          </div>
        </div>
      </div>
    </div>
  );
};