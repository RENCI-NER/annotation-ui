import React from 'react';

interface Props {
  onContinue: () => void;
  onReview: () => void;
}

export const CompletionModal: React.FC<Props> = ({ onContinue, onReview }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md mx-4 animate-bounce-in">
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold mb-2 text-gray-800 dark:text-white">
            Article Completed!
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            You've finished annotating all triples in this article.
          </p>
          
          <div className="space-y-3">
            <button
              onClick={onContinue}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors"
            >
              Continue to Next Article →
            </button>
            <button
              onClick={onReview}
              className="w-full py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg font-semibold transition-colors"
            >
              Review This Article
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};