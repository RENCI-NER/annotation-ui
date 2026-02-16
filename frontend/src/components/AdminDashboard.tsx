import React, { useState, useEffect } from 'react';
import { api, AnnotatorInfo, AdminStats } from '../api';
import { AdminFlaggedReview } from './AdminFlaggedReview';
import { AdminComparisonView } from './AdminComparisonView';
import { AdminAssignmentTable } from './AdminAssignmentTable';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'assignments' | 'random' | 'upload'>('overview');
  const [annotators, setAnnotators] = useState<AnnotatorInfo[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [newAnnotator, setNewAnnotator] = useState('');
  const [numArticles, setNumArticles] = useState(100);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showFlaggedReview, setShowFlaggedReview] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

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

  const handleCorpusUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    setUploadMessage(null);

    // const formData = new FormData();
    // formData.append('file', uploadFile);

    try {
      // Fix: Use import.meta.env for Vite
      // const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const result = await api.uploadCorpus(uploadFile);
      // console.log('Uploading to:', `${apiBase}/admin/upload-corpus`);  // logging

      // const response = await fetch(`${apiBase}/admin/upload-corpus`, {
      //   method: 'POST',
      //   body: formData,
      // });

      // console.log('Response status:', response.status);
      // const result = await response.json();

      if (result) {
        setUploadMessage(`✅ ${result.message}: ${result.articles_added} articles, ${result.triples_added} triples added`);
        setUploadFile(null);
        await loadData();
      } else {
        setUploadMessage(`❌ ${result.detail}`);
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      const errorMsg = err.response?.data?.detail || err.message || 'Unknown error';
      setUploadMessage(`❌ Upload failed: ${errorMsg}`);
    } finally {
      setUploading(false);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = newAnnotator.trim().toLowerCase();
    if (!normalized || numArticles <= 0) return;

    setLoading(true);
    setMessage(null);

    try {
      const result = await api.assignArticles(normalized, numArticles);
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

  const handleReset = async (annotator: string) => {
    if (!confirm(`Reset all progress for ${annotator}? This will delete their annotations but keep their assignments.`)) return;
  
    try {
      await api.resetAnnotator(annotator);
      setMessage({
        type: 'success',
        text: `✓ Reset ${annotator} - they can start fresh`
      });
      await loadData();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: `✗ Failed to reset: ${err.message}`
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-[1600px] mx-auto">
        <h1 className="text-3xl font-bold mb-8 dark:text-white">Admin Dashboard</h1>

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-4 font-medium ${
                activeTab === 'overview'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              📊 Overview
            </button>
            <button
              onClick={() => setActiveTab('assignments')}
              className={`px-6 py-4 font-medium ${
                activeTab === 'assignments'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              📋 Manual Assignment
            </button>
            <button
              onClick={() => setActiveTab('random')}
              className={`px-6 py-4 font-medium ${
                activeTab === 'random'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              🎲 Random Assignment
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-6 py-4 font-medium ${
                activeTab === 'upload'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              📤 Upload Corpus
            </button>
          </div>
        </div>
        
        {/* ===== OVERVIEW TAB ===== */}
        {activeTab === 'overview' && (
          <div>
            {/* Overall Stats */}
            {stats && (
              <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.total_articles}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Articles</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.total_assigned}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Assigned</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.total_unassigned}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Unassigned</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.total_completed}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
                </div>
              </div>
            )}

            {/* Export, Flagged Review, Comparison */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {/* Export Section */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4 dark:text-white">Export Annotations</h3>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => api.exportAnnotations(undefined, 'all')}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                  >
                    📥 Export All
                  </button>
                  <button
                    onClick={() => api.exportAnnotations(undefined, 'completed')}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                  >
                    ✅ Export Completed Only
                  </button>
                  <button
                    onClick={() => api.exportAnnotations(undefined, 'partial')}
                    className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors"
                  >
                    ⏳ Export Partial
                  </button>
                </div>
              </div>

              {/* Flagged Review Section */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4 dark:text-white">Review Flagged Triples</h3>
                <button
                  onClick={() => setShowFlaggedReview(!showFlaggedReview)}
                  className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                >
                  {showFlaggedReview ? '✕ Close Review' : '🚩 Review All Flagged Triples'}
                </button>
              </div>

              {/* Comparison Section */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4 dark:text-white">Compare Annotators</h3>
                <button
                  onClick={() => setShowComparison(!showComparison)}
                  className="w-full px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
                >
                  {showComparison ? '✕ Close Comparison' : '👥 Compare Annotators'}
                </button>
              </div>
            </div>

            {/* Flagged Review Panel */}
            {showFlaggedReview && (
              <div className="mb-8">
                <AdminFlaggedReview />
              </div>
            )}

            {/* Comparison Panel */}
            {showComparison && (
              <div className="mb-8">
                <AdminComparisonView />
              </div>
            )}

            {/* Assign Articles Form */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-8">
              <h2 className="text-xl font-semibold mb-4 dark:text-white">Random Assignment</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Assign a specified number of random unassigned articles to an annotator
              </p>
              
              {message && (
                <div className={`mb-4 p-3 rounded ${
                  message.type === 'success' 
                    ? 'bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-200' 
                    : 'bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-200'
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
                  className="flex-1 p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
                <input
                  type="number"
                  value={numArticles}
                  onChange={(e) => setNumArticles(parseInt(e.target.value) || 0)}
                  placeholder="Number of articles"
                  min="1"
                  className="w-40 p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !newAnnotator.trim() || numArticles <= 0}
                  className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
                >
                  {loading ? 'Assigning...' : 'Assign'}
                </button>
              </form>
            </div>

            {/* Annotators List */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold dark:text-white">Annotators</h2>
              </div>
              
              {annotators.length === 0 ? (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  No annotators assigned yet
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Annotator
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Assigned
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Completed
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Pending
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Progress
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {annotators.map((annotator) => {
                        const progress = annotator.assigned_count > 0
                          ? (annotator.completed_count / annotator.assigned_count) * 100
                          : 0;

                        return (
                          <tr key={annotator.annotator} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-6 py-4 whitespace-nowrap font-medium dark:text-gray-200">
                              {annotator.annotator}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap dark:text-gray-300">
                              {annotator.assigned_count}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-green-600 dark:text-green-400">
                              {annotator.completed_count}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-orange-600 dark:text-orange-400">
                              {annotator.pending_count}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                  <div
                                    className="bg-blue-500 h-2 rounded-full transition-all"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                                <span className="text-sm text-gray-600 dark:text-gray-400">{progress.toFixed(0)}%</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button
                                onClick={() => handleReset(annotator.annotator)}
                                className="text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300 text-sm font-medium mr-3"
                              >
                                Reset
                              </button>
                              <button
                                onClick={() => handleDelete(annotator.annotator)}
                                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium"
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
        )}

        {/* ===== MANUAL ASSIGNMENT TAB ===== */}
        {activeTab === 'assignments' && (
          <AdminAssignmentTable />
        )}
        {/* ===== RANDOM ASSIGNMENT TAB ===== */}
        {activeTab === 'random' && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h2 className="text-2xl font-semibold mb-4 dark:text-white">Random Assignment</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Automatically assign a specified number of random unassigned articles to an annotator.
              For manual selection, use the <button onClick={() => setActiveTab('assignments')} className="text-blue-600 hover:underline">Manual Assignment</button> tab.
            </p>
            
            {message && (
              <div className={`mb-4 p-3 rounded ${
                message.type === 'success' 
                  ? 'bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-200' 
                  : 'bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-200'
              }`}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleAssign} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 dark:text-gray-300">
                    Annotator Name
                  </label>
                  <input
                    type="text"
                    value={newAnnotator}
                    onChange={(e) => setNewAnnotator(e.target.value)}
                    placeholder="e.g., alice"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 dark:text-gray-300">
                    Number of Articles
                  </label>
                  <input
                    type="number"
                    value={numArticles}
                    onChange={(e) => setNumArticles(parseInt(e.target.value) || 0)}
                    placeholder="100"
                    min="1"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                  />
                </div>
              </div>
              
              <button
                type="submit"
                disabled={loading || !newAnnotator.trim() || numArticles <= 0}
                className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
              >
                {loading ? 'Assigning...' : '🎲 Assign Random Articles'}
              </button>
            </form>
          </div>
        )}

        {/* ===== UPLOAD TAB ===== */}
        {activeTab === 'upload' && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4 dark:text-white">Upload New Corpus</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Upload a JSON file containing articles with triples for annotation
            </p>
            
            {uploadMessage && (
              <div className={`mb-4 p-3 rounded ${
                uploadMessage.startsWith('✅') 
                  ? 'bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-200' 
                  : 'bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-200'
              }`}>
                {uploadMessage}
              </div>
            )}

            <form onSubmit={handleCorpusUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Corpus JSON File
                </label>
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                  disabled={uploading}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Expected format: Array of articles with triples (PMID, title, abstract, triples)
                </p>
              </div>
              
              <button
                type="submit"
                disabled={uploading || !uploadFile}
                className="px-6 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
              >
                {uploading ? 'Uploading...' : '📤 Upload Corpus'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};