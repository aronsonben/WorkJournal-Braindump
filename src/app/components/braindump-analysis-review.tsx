"use client";
import React, { useState } from 'react';
import { BraindumpAnalysisResult, CategorizedTaskSuggestion } from '../../lib/supabase';
import { supabase } from '../../lib/supabase';

interface Props {
  analysis: BraindumpAnalysisResult | null;
  rawText: string;
  onReset: () => void;
  onCommitted: () => void;
}

type EditableSuggestion = CategorizedTaskSuggestion & { id: number };

export const BraindumpAnalysisReview: React.FC<Props> = ({ analysis, rawText, onReset, onCommitted }) => {
  const [items, setItems] = useState<EditableSuggestion[]>(() => (analysis?.tasks || []).map((t, i) => ({ ...t, id: i })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!analysis) return null;

  function update(id: number, patch: Partial<EditableSuggestion>) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  }

  async function handleCommit() {
    setSaving(true); setError(null); setSuccess(false);
    try {
      const payload = {
        raw_text: rawText,
        tasks: items.map(i => ({
          line: i.line,
          category: i.suggested_category,
          priority: i.suggested_priority,
          action: i.action
        }))
      };
      const res = await fetch('/api/braindump/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Finalize failed');
      setSuccess(true);
      onCommitted();
    } catch (e: any) {
      setError(e.message || 'Unexpected error');
    } finally {
      setSaving(false);
    }
  }

  const kept = items.filter(i => i.action !== 'drop');

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">🧠 Braindump Analysis</h3>
        <div className="flex gap-2">
          <button onClick={onReset} className="px-3 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-200">Start Over</button>
          <button onClick={handleCommit} disabled={saving || kept.length === 0} className="px-4 py-1.5 rounded bg-[#15c460] hover:bg-[#11a652] disabled:opacity-50 text-black text-sm font-medium flex items-center gap-2">
            {saving && <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"/>}
            Commit {kept.length}
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-400">Review AI suggestions. Adjust category, priority, or drop / merge tasks before committing.</p>
      {error && <div className="p-2 text-sm text-red-300 bg-red-900/30 border border-red-700 rounded">{error}</div>}
      {success && <div className="p-2 text-sm text-green-300 bg-green-900/30 border border-green-700 rounded">Saved!</div>}
      <div className="grid gap-3">
        {items.map(item => (
          <div key={item.id} className={`rounded border p-4 bg-gray-800/70 text-sm flex flex-col gap-2 ${item.action === 'drop' ? 'opacity-40' : ''}`}> 
            <div className="flex justify-between gap-4">
              <span className="text-gray-200 flex-1">{item.line}</span>
              <select
                value={item.action}
                onChange={e => update(item.id, { action: e.target.value as any })}
                className="bg-gray-700 text-gray-200 text-xs px-2 py-1 rounded border border-gray-600"
              >
                <option value="keep">Keep</option>
                <option value="merge">Merge</option>
                <option value="drop">Drop</option>
                <option value="ignore">Ignore</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={item.suggested_category || 'uncategorized'}
                onChange={e => update(item.id, { suggested_category: e.target.value })}
                className="bg-gray-700 text-gray-200 text-xs px-2 py-1 rounded border border-gray-600"
              >
                {['quick_win','deep_work','admin','communication','planning','learning','bug','feature','ops','uncategorized'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={5}
                value={item.suggested_priority || 3}
                onChange={e => update(item.id, { suggested_priority: Number(e.target.value) })}
                className="w-16 bg-gray-700 text-gray-200 text-xs px-2 py-1 rounded border border-gray-600"
              />
              <span className="text-[10px] text-gray-500">{item.normalized.slice(0,40)}</span>
            </div>
            {item.duplicate_of_task_id && (
              <div className="text-xs text-yellow-400">Possible duplicate of existing task {item.duplicate_of_task_id}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
