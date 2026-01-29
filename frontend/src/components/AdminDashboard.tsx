import React, { useState, useEffect } from 'react';
import { api, AnnotatorInfo, AdminStats } from '../api';

export const AdminDashboard: React.FC = () => {
  const [annotators, setAnnotators] = useState<AnnotatorInfo[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [newAnnotator, setNewAnnotator] = useState('');
  const [numArticles, setNumArticles] = useState(100);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [annotatorsData, statsData] = await Promise.all([
        api.getAnnotators(),
        api.getAdminStats()
      ]);
      setAnnotators(annotatorsData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnotator.trim() || numArticles <= 0) return;

    setLoading(true);
    setMessage(null);

    try {
      const result = await api.assignArticles(newAnnotator.trim().toLowerCase(), numArticles);
      setMessage({
        type: 'success',
        text: `✓ ${result.message}`
      });
      setNewAnnotator('');
      setNumArticles(100);
      await loadData();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: `✗ Failed to assign articles: ${err.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (annotator: string) => {
    if (!confirm(`Delete all assignments for ${annotator}?`)) return;

    try {
      await api.deleteAnnotatorAssignments(annotator);
      setMessage({
        type: 'success',
        text: `✓ Deleted assignments for ${annotator}`
      });
      await loadData();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: `✗ Failed to delete: ${err.message}`
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

        {/* Overall Stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-2xl font-bold text-blue-600">{stats.total_articles}</div>
              <div className="text-sm text-gray-600">Total Articles</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-2xl font-bold text-green-600">{stats.total_assigned}</div>
              <div className="text-sm text-gray-600">Assigned</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-2xl font-bold text-orange-600">{stats.total_unassigned}</div>
              <div className="text-sm text-gray-600">Unassigned</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-2xl font-bold text-purple-600">{stats.total_completed}</div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
          </div>
        )}

        {/* Assign Articles Form */}
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-semibold mb-4">Assign Articles</h2>
          
          {message && (
            <div className={`mb-4 p-3 rounded ${
              message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleAssign} className="flex gap-4">
            <input
              type="text"
              value={newAnnotator}
              onChange={(e) => setNewAnnotator(e.target.value)}
              placeholder="Annotator name (e.g., alice)"
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <input
              type="number"
              value={numArticles}
              onChange={(e) => setNumArticles(parseInt(e.target.value) || 0)}
              placeholder="Number of articles"
              min="1"
              className="w-40 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !newAnnotator.trim() || numArticles <= 0}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-lg font-medium"
            >
              {loading ? 'Assigning...' : 'Assign'}
            </button>
          </form>
        </div>

        {/* Annotators List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Annotators</h2>
          </div>
          
          {annotators.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No annotators assigned yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Annotator
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Assigned
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Completed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Pending
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Progress
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {annotators.map((annotator) => {
                    const progress = annotator.assigned_count > 0
                      ? (annotator.completed_count / annotator.assigned_count) * 100
                      : 0;

                    return (
                      <tr key={annotator.annotator}>
                        <td className="px-6 py-4 whitespace-nowrap font-medium">
                          {annotator.annotator}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {annotator.assigned_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-green-600">
                          {annotator.completed_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-orange-600">
                          {annotator.pending_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600">{progress.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleDelete(annotator.annotator)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};