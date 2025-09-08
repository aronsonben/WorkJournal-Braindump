'use client';

import { useState, useEffect } from 'react';

interface MorningSummaryCardProps {
  onClose?: () => void;
}

interface MorningSummary {
  summary: string;
  main_themes: string[];
  past_accomplishments: string[];
  way_ahead: string[];
  pattern_insight: string;
  gentle_nudge: string | null;
}

interface MorningSummaryCardProps {
  onClose?: () => void;
}

export function MorningSummaryCard({ onClose }: MorningSummaryCardProps) {
  const [summary, setSummary] = useState<MorningSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [daysToAnalyze, setDaysToAnalyze] = useState(7);

  const fetchSummary = async (days: number = 7) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/morning-summary?days=${days}`);
      if (!response.ok) {
        throw new Error('Failed to fetch morning summary');
      }
      
      const data = await response.json();
      // Normalize in case API returned legacy field names (defensive)
      const normalized: MorningSummary = {
        summary: data.summary || '',
        main_themes: Array.isArray(data.main_themes) ? data.main_themes : [],
        past_accomplishments: Array.isArray(data.past_accomplishments)
          ? data.past_accomplishments
          : (Array.isArray(data.momentum_items) ? data.momentum_items : []),
        way_ahead: Array.isArray(data.way_ahead)
          ? data.way_ahead
          : (Array.isArray(data.attention_needed) ? data.attention_needed : []),
        pattern_insight: typeof data.pattern_insight === 'string' ? data.pattern_insight : '',
        gentle_nudge: typeof data.gentle_nudge === 'string' ? data.gentle_nudge : null,
      };
      setSummary(normalized);
    } catch (err) {
      console.error('Error fetching morning summary:', err);
      setError('Unable to generate your morning summary. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary(daysToAnalyze);
  }, [daysToAnalyze]);

  const formatTime = () => {
    const now = new Date();
    const hour = now.getHours();
    
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-[#15c460]/5 to-green-400/5 border border-[#15c460]/20 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#15c460]/20 rounded-lg flex items-center justify-center">
              <span className="text-[#15c460]">☀️</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-100">{formatTime()}!</h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-300 transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-[#15c460]/50 border-t-[#15c460] rounded-full animate-spin" />
            <span className="text-gray-400">Analyzing your recent work patterns...</span>
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-700/50 rounded animate-pulse w-full" />
            <div className="h-4 bg-gray-700/50 rounded animate-pulse w-3/4" />
            <div className="h-4 bg-gray-700/50 rounded animate-pulse w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="bg-gradient-to-br from-red-500/5 to-red-400/5 border border-red-500/20 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
              <span className="text-red-400">⚠️</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-100">Oops!</h2>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-300 transition-colors p-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        
        <p className="text-gray-300 mb-4">{error}</p>
        <button
          onClick={() => fetchSummary(daysToAnalyze)}
          className="px-4 py-2 bg-[#15c460] text-white rounded-lg hover:bg-[#12a855] transition-colors text-sm font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-[#15c460]/5 to-green-400/5 border border-[#15c460]/20 rounded-xl p-6 mb-6 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#15c460]/20 rounded-lg flex items-center justify-center">
            <span className="text-[#15c460]">☀️</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-100">{formatTime()}!</h2>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Days selector */}
          <select
            value={daysToAnalyze}
            onChange={(e) => setDaysToAnalyze(Number(e.target.value))}
            className="px-3 py-1 bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#15c460]/50"
          >
            <option value={3}>Last 3 days</option>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 2 weeks</option>
            <option value={30}>Last month</option>
          </select>
          
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-300 transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Main Summary */}
      <div className="mb-6">
        <p className="text-gray-200 text-lg leading-relaxed">{summary.summary}</p>
      </div>

      {/* Key Themes - Simple tags above boxes */}
      {summary.main_themes.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">Key Themes</h3>
          <div className="flex flex-wrap gap-2">
            {summary.main_themes.map((theme, index) => (
              <span key={index} className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm">
                {theme}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Two-Box Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Past History Box */}
        {summary.past_accomplishments.length > 0 && (
          <div className="bg-[#15c460]/10 border border-[#15c460]/20 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-[#15c460] mb-3 flex items-center gap-2">
              <span>�</span> Past History
            </h3>
            <ul className="space-y-2">
              {summary.past_accomplishments.map((item, index) => (
                <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                  <span className="text-[#15c460] mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Way Ahead Box */}
        {summary.way_ahead.length > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-yellow-400 mb-3 flex items-center gap-2">
              <span>🎯</span> Way Ahead
            </h3>
            <ul className="space-y-2">
              {summary.way_ahead.map((item, index) => (
                <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                  <span className="text-yellow-400 mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Gentle Nudge */}
      {summary.gentle_nudge && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-2">
            <span>🌱</span> Gentle reminder
          </h3>
          <p className="text-sm text-gray-300">{summary.gentle_nudge}</p>
        </div>
      )}
    </div>
  );
}
