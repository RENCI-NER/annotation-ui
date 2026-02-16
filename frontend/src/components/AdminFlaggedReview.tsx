import React, { useState, useEffect } from 'react';
import { api } from '../api';

interface FlaggedTriple {
  triple_id: number;
  pmid: string;
  article_title: string;
  subject_text: string;
  object_text: string;
  relationship: string;
  annotator: string;
  predicate: string;
  notes: string;
  flagged_at: string;
}

export const AdminFlaggedReview: React.FC = () => {
  const [flagged, setFlagged] = useState<FlaggedTriple[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadFlagged();
  }, []);

  const loadFlagged = async () => {
    try {
      const data = await api.getAllFlagged();
      setFlagged(data);
    } catch (err) {
      console.error('Failed to load flagged triples:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (tripleId: number) => {
    if (!confirm('Delete this triple? If it\'s the only triple in the article, the article will also be deleted.')) {
      return;
    }

    try {
      await api.deleteTriple(tripleId);
      setMessage({ type: 'success', text: 'Triple deleted' });
      loadFlagged();
    } catch (err: any) {
      setMessage({ type: 'error', text: `Failed: ${err.message}` });
    }
  };

  const handleReassign = async (tripleId: number) => {
    const newAnnotator = prompt('Reassign to which annotator?');
    if (!newAnnotator) return;

    try {
      await api.reassignTriple(tripleId, newAnnotator);
      setMessage({ type: 'success', text: `Reassigned to ${newAnnotator}` });
      loadFlagged();
    } catch (err: any) {
      setMessage({ type: 'error', text: `Failed: ${err.message}` });
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Flagged Triples Review</h2>

      {message && (
        <div className={`mb-4 p-4 rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {flagged.length === 0 ? (
        <div className="text-gray-500">No flagged triples</div>
      ) : (
        <div className="space-y-4">
          {flagged.map(item => (
            <div key={item.triple_id} className="bg-white p-4 rounded-lg shadow border">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="text-sm text-gray-500">PMID: {item.pmid}</div>
                  <div className="font-semibold">{item.article_title}</div>
                </div>
                <div className="text-sm text-gray-600">by {item.annotator}</div>
              </div>

              <div className="grid grid-cols-3 gap-4 my-3 text-sm">
                <div className="p-2 bg-blue-50 rounded">
                  <div className="font-semibold text-blue-900">Subject</div>
                  <div>{item.subject_text}</div>
                </div>
                <div className="p-2 bg-yellow-50 rounded">
                  <div className="font-semibold text-yellow-900">Relationship</div>
                  <div>{item.relationship}</div>
                </div>
                <div className="p-2 bg-red-50 rounded">
                  <div className="font-semibold text-red-900">Object</div>
                  <div>{item.object_text}</div>
                </div>
              </div>

              {item.predicate && (
                <div className="text-sm mb-2">
                  <span className="font-semibold">Annotated as:</span> {item.predicate}
                </div>
              )}

              {item.notes && (
                <div className="text-sm mb-3 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <span className="font-semibold">Notes:</span> {item.notes}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleDelete(item.triple_id)}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded text-sm"
                >
                  Delete Triple
                </button>
                <button
                  onClick={() => handleReassign(item.triple_id)}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm"
                >
                  Reassign
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};