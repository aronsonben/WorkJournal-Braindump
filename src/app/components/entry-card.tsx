'use client';

import { useState } from 'react';
import { Entry } from '../../lib/supabase';

export function EntryCard({ entry }: { entry: Entry }) {
  const [insights, setInsights] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function analyzeEntry() {
    setLoading(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: entry.content }),
      });
      
      const data = await response.json();
      setInsights(data.insights);
    } catch (error) {
      console.error('Failed to analyze:', error);
    }
    setLoading(false);
  }

  return (
    <div className="p-6 bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 border border-gray-700 hover:border-gray-600">
      <p className="text-gray-100 leading-relaxed mb-4 text-sm">{entry.content}</p>
      
      {/* Tags */}
      {entry.tags && entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {entry.tags.map((tag, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-[#15c460]/10 text-[#15c460] rounded-md text-xs font-medium border border-[#15c460]/20"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
      
      <div className="flex justify-between items-center">
        <div className="flex gap-4 text-sm text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-[#15c460] rounded-full"></span>
            {new Date(entry.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-gray-500 rounded-full"></span>
            {entry.word_count} words
          </span>
        </div>

        {!insights && (
          <button
            onClick={analyzeEntry}
            disabled={loading}
            className="px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-600 hover:border-gray-500"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-gray-500 border-t-[#15c460] rounded-full animate-spin" />
                Analyzing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span>✨</span>
                Analyze
              </span>
            )}
          </button>
        )}
      </div>

      {insights && (
        <div className="mt-4 p-4 bg-gradient-to-r from-[#15c460]/10 to-emerald-500/10 rounded-xl border border-[#15c460]/30">
          <p className="text-sm font-semibold text-[#15c460] mb-2 flex items-center gap-2">
            <span className="w-5 h-5 bg-[#15c460] rounded-full flex items-center justify-center text-white text-xs">✓</span>
            AI Insights
          </p>
          <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
            {insights}
          </div>
        </div>
      )}
    </div>
  );
}