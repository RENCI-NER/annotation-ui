import React, { useState, useEffect } from 'react';
import { api } from '../api';

interface AnnotationComparison {
  pmid: string;
  title: string;
  abstract: string;
  annotators: {
    annotator: string;
    annotations: {
      triple_id: number;
      subject: string;
      object: string;
      predicate: string;
      confidence: string;
      notes: string;
      timestamp: string;
    }[];
  }[];
}

export const AdminComparisonView: React.FC = () => {
  const [articles, setArticles] = useState<string[]>([]);
  const [selectedPmid, setSelectedPmid] = useState<string | null>(null);
  const [comparison, setComparison] = useState<AnnotationComparison | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMultiAnnotatedArticles();
  }, []);

  const loadMultiAnnotatedArticles = async () => {
    try {
      const data = await api.getMultiAnnotatedArticles();
      setArticles(data);
    } catch (err) {
      console.error('Failed to load:', err);
    }
  };

  const loadComparison = async (pmid: string) => {
    setLoading(true);
    try {
      const data = await api.getAnnotationComparison(pmid);
      setComparison(data);
      setSelectedPmid(pmid);
    } catch (err) {
      console.error('Failed to load:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateAgreement = () => {
    if (!comparison || comparison.annotators.length < 2) return null;
    
    const a1 = comparison.annotators[0];
    const a2 = comparison.annotators[1];
    
    const matches = a1.annotations.filter(ann1 => {
      return a2.annotations.some(
        ann2 => ann2.triple_id === ann1.triple_id && ann2.predicate === ann1.predicate
      );
    });
    
    const total = Math.max(a1.annotations.length, a2.annotations.length);
    const agreement = total > 0 ? (matches.length / total * 100).toFixed(1) : 0;
    
    return { matches: matches.length, total, agreement };
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="mb-4">
        <h2 className="text-2xl font-bold dark:text-white mb-2">
          Inter-Annotator Agreement Checker
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Compare annotations from multiple annotators on the same article to measure agreement. 
          Only articles assigned to 2+ annotators appear here.
        </p>
      </div>

      {articles.length === 0 ? (
        <div className="p-8 text-center bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <div className="text-4xl mb-2">📊</div>
          <div className="text-gray-700 dark:text-gray-300 font-semibold mb-2">
            No Multi-Annotator Articles Yet
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Assign the same article to 2 annotators in the Assignment Matrix tab to enable comparison.
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2 dark:text-gray-300">
              Select Article ({articles.length} articles with multiple annotators)
            </label>
            <select
              value={selectedPmid || ''}
              onChange={(e) => loadComparison(e.target.value)}
              className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">-- Select Article --</option>
              {articles.map(pmid => (
                <option key={pmid} value={pmid}>PMID: {pmid}</option>
              ))}
            </select>
          </div>

          {loading && <div className="text-center py-4">Loading...</div>}

          {comparison && !loading && (
            <div>
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400">PMID: {comparison.pmid}</div>
                <div className="font-semibold dark:text-white">{comparison.title}</div>
              </div>

              {(() => {
                const stats = calculateAgreement();
                return stats && (
                  <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
                    <div className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                      Agreement: {stats.agreement}%
                    </div>
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                      {stats.matches} exact matches out of {stats.total} annotations
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-4">
                {comparison.annotators.map((annotatorData, idx) => (
                  <div key={idx} className="border rounded-lg p-4 dark:border-gray-600">
                    <h3 className="text-lg font-semibold mb-4 dark:text-white">
                      {annotatorData.annotator}
                    </h3>
                    
                    <div className="space-y-3">
                      {annotatorData.annotations.map((ann, annIdx) => (
                        <div key={annIdx} className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                          <div className="text-sm mb-2">
                            <span className="font-semibold text-blue-700 dark:text-blue-300">
                              {ann.subject}
                            </span>
                            {' → '}
                            <span className="font-semibold text-red-700 dark:text-red-300">
                              {ann.object}
                            </span>
                          </div>
                          <div className="text-sm dark:text-gray-300">
                            <span className="font-semibold">Predicate:</span> {ann.predicate}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Confidence: {ann.confidence}
                          </div>
                          {ann.notes && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic">
                              Notes: {ann.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};