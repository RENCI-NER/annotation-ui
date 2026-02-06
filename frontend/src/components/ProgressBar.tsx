// frontend/src/components/ProgressBar.tsx
import React from 'react';
import { Progress, Stats } from '../types';

interface Props {
  progress: Progress;
  stats: Stats;
}

export const ProgressBar: React.FC<Props> = ({ progress }) => {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="mb-2">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
          <span>Overall Progress</span>
          <span>{progress.completion_percentage.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-500 rounded-full"
            style={{ width: `${progress.completion_percentage}%` }}
          />
        </div>
      </div>

      {/* Detailed Status Breakdown */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="text-center p-2 bg-green-50 rounded">
          <div className="text-xs text-gray-600">Annotated</div>
          <div className="text-lg font-bold text-green-600">
            {progress.annotated_triples}
          </div>
        </div>
        <div className="text-center p-2 bg-yellow-50 rounded">
          <div className="text-xs text-gray-600">Skipped</div>
          <div className="text-lg font-bold text-yellow-600">
            {progress.skipped_triples}
          </div>
        </div>
        <div className="text-center p-2 bg-orange-50 rounded">
          <div className="text-xs text-gray-600">Flagged</div>
          <div className="text-lg font-bold text-orange-600">
            {progress.flagged_triples}
          </div>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded">
          <div className="text-xs text-gray-600">Remaining</div>
          <div className="text-lg font-bold text-gray-600">
            {progress.unannotated_triples}
          </div>
        </div>
      </div>

      <div className="flex gap-4 text-sm text-gray-600">
        <div>
          <span className="font-medium">{progress.annotated_articles}</span>
          <span className="text-gray-400"> / {progress.total_articles} articles</span>
        </div>
        <div className="text-gray-400">|</div>
        <div>
          <span className="font-medium">{progress.total_triples}</span>
          <span className="text-gray-400"> total triples</span>
        </div>
      </div>
    </div>
  );
};