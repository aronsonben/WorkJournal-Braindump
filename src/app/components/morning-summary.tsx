'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

interface MorningSummary {
  summary: string;
  main_themes: string[];
  way_ahead: string[];
  pattern_insight: string;
  gentle_nudge: string | null;
}

interface TaskCard {
  id?: string;
  content: string;
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  isNew?: boolean;
}

interface MorningSummaryCardProps {
  onClose?: () => void;
  /** ISO string of newest entry */
  lastEntryCreatedAt?: string | null;
  /** Total count of entries */
  entryCount?: number;
}

const CACHE_PREFIX = 'morningSummary:v2';

function buildCacheKey(days: number, lastEntryCreatedAt?: string | null, entryCount?: number) {
  return [
    CACHE_PREFIX,
    `days=${days}`,
    `last=${lastEntryCreatedAt || 'none'}`,
    `count=${entryCount ?? 0}`
  ].join(':');
}

export function MorningSummaryCard({ onClose, lastEntryCreatedAt, entryCount }: MorningSummaryCardProps) {
  const [summary, setSummary] = useState<MorningSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [daysToAnalyze, setDaysToAnalyze] = useState(7);
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState<TaskCard[]>([]);

  const fetchSummary = useCallback(async (days: number = 7, force = false) => {
    setLoading(true);
    setError(null);
    if (force) setRefreshing(true);
    
    try {
      const response = await fetch(`/api/morning-summary?days=${days}`);
      if (!response.ok) {
        throw new Error('Failed to fetch morning summary');
      }
      
      const data = await response.json();
      
      // Filter out completed items from way_ahead (only show incomplete tasks)
      const filteredWayAhead = Array.isArray(data.way_ahead) 
        ? data.way_ahead.filter((item: string) => item && item.trim())
        : [];
        
      const normalized: MorningSummary = {
        summary: data.summary || '',
        main_themes: Array.isArray(data.main_themes) ? data.main_themes : [],
        way_ahead: filteredWayAhead,
        pattern_insight: typeof data.pattern_insight === 'string' ? data.pattern_insight : '',
        gentle_nudge: typeof data.gentle_nudge === 'string' ? data.gentle_nudge : null,
      };
      setSummary(normalized);

      // Convert way_ahead items to task cards
      const taskCards: TaskCard[] = filteredWayAhead.map((item: string) => ({
        content: item,
        status: 'todo' as const,
        isNew: true
      }));
      setTasks(taskCards);

      // Persist to cache
      try {
        const cacheKey = buildCacheKey(days, lastEntryCreatedAt, entryCount);
        localStorage.setItem(cacheKey, JSON.stringify({
          savedAt: Date.now(),
          days,
          lastEntryCreatedAt,
          entryCount,
          summary: normalized,
          tasks: taskCards
        }));
      } catch {/* ignore quota errors */}
    } catch (err) {
      console.error('Error fetching morning summary:', err);
      setError('Unable to generate your morning summary. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [lastEntryCreatedAt, entryCount]);

  // Attempt to load from cache whenever dependencies change
  useEffect(() => {
    const key = buildCacheKey(daysToAnalyze, lastEntryCreatedAt, entryCount);
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.summary) {
          setSummary(parsed.summary as MorningSummary);
          setTasks(parsed.tasks || []);
          setLoading(false);
          return; // Skip fetch
        }
      }
    } catch {/* ignore parse errors */}
    fetchSummary(daysToAnalyze);
  }, [daysToAnalyze, lastEntryCreatedAt, entryCount, fetchSummary]);

  const handleTaskStatusChange = async (taskIndex: number, newStatus: TaskCard['status']) => {
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], status: newStatus };
    setTasks(updatedTasks);

    // If marking as completed, save as a new entry
    if (newStatus === 'completed' && updatedTasks[taskIndex].isNew) {
      try {
        const { error } = await supabase
          .from('entries')
          .insert({
            content: `✅ ${updatedTasks[taskIndex].content}`,
            status: 'completed',
            word_count: updatedTasks[taskIndex].content.split(/\s+/).length
          });
        
        if (error) {
          console.error('Error saving completed task as entry:', error);
        } else {
          updatedTasks[taskIndex].isNew = false;
        }
      } catch (err) {
        console.error('Error saving entry:', err);
      }
    }
  };

  const handleForceRefresh = () => {
    fetchSummary(daysToAnalyze, true);
  };

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
        <div className="flex gap-3">
          <button
            onClick={() => fetchSummary(daysToAnalyze)}
            className="px-4 py-2 bg-[#15c460] text-white rounded-lg hover:bg-[#12a855] transition-colors text-sm font-medium"
          >
            Try Again
          </button>
          <button
            onClick={handleForceRefresh}
            className="px-4 py-2 bg-gray-800 text-gray-200 rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            Force Refresh
          </button>
        </div>
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
          <button
            onClick={handleForceRefresh}
            title="Recompute summary"
            className="px-2 py-1 bg-gray-800 border border-gray-700 rounded-md text-gray-300 hover:bg-gray-700 text-xs flex items-center gap-1"
            disabled={refreshing}
          >
            {refreshing ? '…' : '↻'}
          </button>
          
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
        <p className="text-gray-400 text-sm leading-relaxed">{summary.summary}</p>
      </div>

      {/* Key Themes - Simple tags above boxes */}
      {summary.main_themes.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Key Themes</h3>
          <div className="flex flex-wrap gap-2">
            {summary.main_themes.map((theme, index) => (
              <span key={index} className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm">
                {theme}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Way Ahead - Interactive Task Cards */}
      {tasks.length > 0 && (
        <div className="mb-6">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-yellow-400 mb-4 flex items-center gap-2">
              <span>🎯</span> Way Ahead
            </h3>
            <div className="grid gap-3">
              {tasks.map((task, index) => (
                <div 
                  key={index}
                  className={`bg-gray-800/50 border rounded-lg p-4 transition-all ${
                    task.status === 'completed' 
                      ? 'border-green-500/30 bg-green-500/5' 
                      : task.status === 'in_progress'
                      ? 'border-blue-500/30 bg-blue-500/5'
                      : 'border-gray-600/30 hover:border-yellow-400/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => handleTaskStatusChange(index, 
                        task.status === 'completed' ? 'todo' : 
                        task.status === 'todo' ? 'in_progress' :
                        'completed'
                      )}
                      className={`flex-shrink-0 w-6 h-6 rounded border-2 transition-colors flex items-center justify-center text-xs ${
                        task.status === 'completed'
                          ? 'bg-green-500 border-green-500 text-white'
                          : task.status === 'in_progress'
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : 'border-gray-400 hover:border-yellow-400'
                      }`}
                      title={
                        task.status === 'completed' ? 'Mark as todo' :
                        task.status === 'todo' ? 'Mark as in progress' :
                        'Mark as completed'
                      }
                    >
                      {task.status === 'completed' && '✓'}
                      {task.status === 'in_progress' && '⋯'}
                    </button>
                    
                    <div className="flex-1">
                      <p className={`text-sm ${
                        task.status === 'completed' 
                          ? 'text-gray-400 line-through' 
                          : 'text-gray-300'
                      }`}>
                        {task.content}
                      </p>
                      
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          task.status === 'completed'
                            ? 'bg-green-500/20 text-green-300'
                            : task.status === 'in_progress'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {task.status === 'completed' ? 'Done' :
                           task.status === 'in_progress' ? 'In Progress' :
                           'To Do'}
                        </span>
                        
                        {task.isNew && task.status === 'completed' && (
                          <span className="text-xs text-green-400">✨ Added to completed list</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
