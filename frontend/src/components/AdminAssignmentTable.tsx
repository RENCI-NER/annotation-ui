import React, { useState, useEffect } from 'react';
import { api } from '../api';

interface ArticleAssignment {
  pmid: string;
  title: string;
  triple_count: number;
  annotators: {
    [key: string]: {
      assigned: boolean;
      completed: boolean;
      progress: number;
    };
  };
}

export const AdminAssignmentTable: React.FC = () => {
  const [articles, setArticles] = useState<ArticleAssignment[]>([]);
  const [sortBy, setSortBy] = useState<'pmid' | 'title' | 'triples' | 'assigned'>('pmid');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [allAnnotators, setAllAnnotators] = useState<string[]>([]);
  const [newAnnotator, setNewAnnotator] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadAssignments();
  }, []);



  const loadAssignments = async () => {
    try {
      const data = await api.getAssignmentMatrix();
      setArticles(data.articles);
      setAllAnnotators(data.annotators);
    } catch (err) {
      console.error('Failed to load assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  const sortedArticles = [...articles].sort((a, b) => {
    let compareA, compareB;
    
    switch (sortBy) {
      case 'pmid':
        compareA = a.pmid;
        compareB = b.pmid;
        break;
      case 'title':
        compareA = a.title.toLowerCase();
        compareB = b.title.toLowerCase();
        break;
      case 'triples':
        compareA = a.triple_count;
        compareB = b.triple_count;
        break;
      case 'assigned':
        compareA = Object.values(a.annotators).filter(ann => ann.assigned).length;
        compareB = Object.values(b.annotators).filter(ann => ann.assigned).length;
        break;
      default:
        return 0;
    }
    
    if (compareA < compareB) return sortOrder === 'asc' ? -1 : 1;
    if (compareA > compareB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const handleAddAnnotator = () => {
    const normalized = newAnnotator.trim().toLowerCase();
    if (!normalized) return;
    
    if (allAnnotators.includes(normalized)) {
      setMessage('❌ Annotator already exists');
      return;
    }
    
    setAllAnnotators([...allAnnotators, normalized]);
    setNewAnnotator('');
    setMessage(`✅ Added annotator: ${normalized}`);
  };

  const handleRemoveAnnotator = async (annotator: string) => {
    if (!confirm(`Remove ${annotator}? This will delete all their assignments.`)) return;
    
    try {
      await api.deleteAnnotatorAssignments(annotator);
      setAllAnnotators(allAnnotators.filter(a => a !== annotator));
      await loadAssignments();
      setMessage(`✅ Removed ${annotator}`);
    } catch (err: any) {
      setMessage(`❌ Failed to remove: ${err.message}`);
    }
  };

  const handleAssign = async (pmid: string, annotator: string) => {
    try {
      await api.assignSpecificArticle(pmid, annotator);
      await loadAssignments();
      setMessage(`✅ Assigned PMID ${pmid} to ${annotator}`);
    } catch (err: any) {
      setMessage(`❌ ${err.message}`);
    }
  };

  const handleUnassign = async (pmid: string, annotator: string) => {
    if (!confirm(`Remove ${annotator}'s assignment for PMID ${pmid}?`)) return;
    
    try {
      await api.unassignArticle(pmid, annotator);
      await loadAssignments();
      setMessage(`✅ Removed assignment`);
    } catch (err: any) {
      setMessage(`❌ ${err.message}`);
    }
  };

  const getAssignmentCounts = (pmid: string) => {
    const article = articles.find(a => a.pmid === pmid);
    if (!article) return { assigned: 0, completed: 0 };
    
    let assigned = 0;
    let completed = 0;
    
    Object.values(article.annotators).forEach(status => {
      if (status.assigned) assigned++;
      if (status.completed) completed++;
    });
    
    return { assigned, completed };
  };

  const getAnnotatorCounts = (annotator: string) => {
    let assigned = 0;
    let completed = 0;
    
    articles.forEach(article => {
      const status = article.annotators[annotator];
      if (status?.assigned) assigned++;
      if (status?.completed) completed++;
    });
    
    return { assigned, completed };
  };

  if (loading) return <div className="p-6 dark:text-white">Loading assignments...</div>;

  return (
    <div className="space-y-6">
      {/* Annotator Management */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 dark:text-white">Manage Annotators</h3>
        
        {message && (
          <div className={`mb-4 p-3 rounded text-sm ${
            message.startsWith('✅') ? 'bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-200' : 'bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-200'
          }`}>
            {message}
          </div>
        )}

        <div className="flex gap-4 mb-4">
          <input
            type="text"
            value={newAnnotator}
            onChange={(e) => setNewAnnotator(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddAnnotator()}
            placeholder="Add new annotator (e.g., alice)"
            className="flex-1 p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
          <button
            onClick={handleAddAnnotator}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
          >
            ➕ Add Annotator
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {allAnnotators.map(annotator => {
            const counts = getAnnotatorCounts(annotator);
            return (
              <div key={annotator} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg">
                <span className="font-medium dark:text-white">{annotator}</span>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  ({counts.assigned} assigned, {counts.completed} done)
                </span>
                <button
                  onClick={() => handleRemoveAnnotator(annotator)}
                  className="text-red-600 hover:text-red-800 dark:text-red-400 text-sm ml-2"
                >
                  ✕
                </button>
              </div>
            );
          })}
          {allAnnotators.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No annotators added yet. Add annotators above to start assigning articles.
            </p>
          )}
        </div>
      </div>

      {/* Assignment Matrix */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold dark:text-white">Article Assignment Matrix</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {articles.length} articles × {allAnnotators.length} annotators
            <span className="ml-4 text-blue-600 dark:text-blue-400">
              💡 Click column headers to sort
            </span>
          </p>
        </div>

        {allAnnotators.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            Add annotators above to start assigning articles
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300 w-16">
                    S/N
                  </th>
                  <th 
                    className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300 w-32 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort('pmid')}
                  >
                    PMID {sortBy === 'pmid' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300 min-w-[300px] cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort('title')}
                  >
                    Article Title {sortBy === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300 w-20 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort('triples')}
                  >
                    Triples {sortBy === 'triples' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300 w-24 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort('assigned')}
                  >
                    Assigned {sortBy === 'assigned' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  {allAnnotators.map(annotator => (
                    <th key={annotator} className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300 w-32">
                      {annotator}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedArticles.map((article, idx) => {
                  const counts = getAssignmentCounts(article.pmid);
                  const needsSecond = counts.assigned === 1;
                  const isFullyAssigned = counts.assigned >= 2;
                  
                  return (
                    <tr key={article.pmid} className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      needsSecond ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
                    }`}>
                      <td className="px-4 py-3 dark:text-gray-300">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs dark:text-gray-300">
                        {article.pmid}
                      </td>
                      <td className="px-4 py-3 dark:text-gray-300">
                        <div className="line-clamp-2">{article.title}</div>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                        {article.triple_count}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                          counts.assigned === 0 ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300' :
                          counts.assigned === 1 ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200' :
                          'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200'
                        }`}>
                          {counts.assigned}/2
                        </span>
                      </td>
                      {allAnnotators.map(annotator => {
                        const assignment = article.annotators[annotator];
                        
                        if (!assignment || !assignment.assigned) {
                          return (
                            <td key={annotator} className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleAssign(article.pmid, annotator)}
                                className="px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800 rounded transition-colors"
                              >
                                Assign
                              </button>
                            </td>
                          );
                        }
                        
                        if (assignment.completed) {
                          return (
                            <td key={annotator} className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                                <span className="text-green-600 dark:text-green-400 text-lg font-bold">✓</span>
                                <button
                                  onClick={() => handleUnassign(article.pmid, annotator)}
                                  className="text-xs text-red-600 hover:text-red-800 dark:text-red-400"
                                  title="Remove assignment"
                                >
                                  ✕
                                </button>
                              </div>
                            </td>
                          );
                        }
                        
                        return (
                          <td key={annotator} className="px-4 py-3">
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">
                                  {assignment.progress}%
                                </span>
                                <button
                                  onClick={() => handleUnassign(article.pmid, annotator)}
                                  className="text-xs text-red-600 hover:text-red-800 dark:text-red-400"
                                  title="Remove assignment"
                                >
                                  ✕
                                </button>
                              </div>
                              <div className="w-full h-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-yellow-500"
                                  style={{ width: `${assignment.progress}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};