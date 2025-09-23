"use client";
import React, { useEffect, useState, useMemo } from 'react';
import { BraindumpAnalysisResult, CategorizedTaskSuggestion, SimpleBraindumpAnalysisResult } from '../../lib/supabase';

interface Props {
  analysis: SimpleBraindumpAnalysisResult | null;
  rawText: string;
  onReset: () => void;
  onCommitted: () => void;
  onScoringResult?: (result: any) => void;
}

type EditableSuggestion = CategorizedTaskSuggestion & { id: number };
export const BraindumpAnalysisReview: React.FC<Props> = ({ analysis, rawText, onReset, onCommitted, onScoringResult }) => {
  const [items, setItems] = useState<EditableSuggestion[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [parsed, setParsed] = useState<BraindumpAnalysisResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!analysis) return;
    try {
      const obj: BraindumpAnalysisResult = JSON.parse(analysis.response);
      setParsed(obj);
      const initialCats = (obj.categories || []).map(c => c.toLowerCase());
      setCategories(initialCats.length ? initialCats : ['uncategorized']);
      setItems((obj.tasks || []).map((t, i) => ({ ...t, id: i })));
    } catch (e) {
      console.error('Failed to parse analysis JSON', e);
      setError('Failed to parse AI response');
    }
  }, [analysis]);

  function update(id: number, patch: Partial<EditableSuggestion>) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  }

  const kept = useMemo(() => items.filter(i => i.action !== 'drop'), [items]);

  const bucketed = useMemo(() => {
    const map: Record<string, EditableSuggestion[]> = {};
    categories.forEach(c => { map[c] = []; });
    items.forEach(it => {
      const cat = (it.suggested_category || 'uncategorized').toLowerCase();
      if (!map[cat]) map[cat] = [];
      map[cat].push(it);
    });
    return map;
  }, [items, categories]);

  async function handleCommit() {
    setSaving(true); setError(null); setSuccess(false);
    try {
      const payload = {
        raw_text: rawText,
        tasks: kept.map(i => ({
          line: i.line,
          category: (i.suggested_category || 'uncategorized').toLowerCase(),
          priority: i.suggested_priority || 3,
          action: i.action || 'keep'
        }))
      };
      const res = await fetch('/api/braindump/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Finalize failed');
      const json = await res.json();
      setSuccess(true);
      if (json?.scoring_result && onScoringResult) onScoringResult(json.scoring_result);
      onCommitted();
    } catch (e: any) {
      setError(e.message || 'Unexpected error');
    } finally {
      setSaving(false);
    }
  }

  if (!analysis || !parsed) return null;

  const sortedCategories = Object.keys(bucketed).sort((a,b) => a.localeCompare(b));

  function addCategory() {
    const name = prompt('New category name');
    if (!name) return;
    const slug = name.trim().toLowerCase();
    if (!slug) return;
    setCategories(prev => prev.includes(slug) ? prev : [...prev, slug]);
  }

  return (
    <div className="mt-8 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">🧠 Braindump Analysis</h3>
        <div className="flex items-center gap-2">
          <button onClick={onReset} className="px-3 py-1.5 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-200">Start Over</button>
          <button onClick={addCategory} className="px-3 py-1.5 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-200">+ Category</button>
          <button onClick={handleCommit} disabled={saving || kept.length===0} className="px-4 py-1.5 rounded bg-[#15c460] hover:bg-[#11a652] disabled:opacity-50 text-black text-sm font-medium flex items-center gap-2">
            {saving && <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"/>}
            Commit {kept.length}
          </button>
        </div>
      </div>
      <p className="text-xs md:text-sm text-gray-400">Compact table view. Adjust fields inline. Categories now stack vertically.</p>
      {error && <div className="p-2 text-xs rounded bg-red-900/40 border border-red-700 text-red-300">{error}</div>}
      {success && <div className="p-2 text-xs rounded bg-emerald-900/30 border border-emerald-600/40 text-emerald-300">Saved!</div>}

      <div className="space-y-6">
        {sortedCategories.map(cat => {
          const tasks = bucketed[cat] || [];
          return (
            <div key={cat} className="border border-gray-800 rounded-lg bg-gray-900/40 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50 border-b border-gray-800">
                <div className="flex items-center gap-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-300">{cat}</h4>
                  <span className="text-[10px] text-gray-500">{tasks.length} task{tasks.length!==1 && 's'}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[720px]">
                  <div className="grid grid-cols-[34px_1fr_90px_72px_56px_70px_54px] text-[10px] uppercase tracking-wide text-gray-500 px-4 pt-2 pb-1 gap-2">
                    <div>#</div>
                    <div>Task</div>
                    <div className="text-center">Category</div>
                    <div className="text-center">Priority</div>
                    <div className="text-center">Energy</div>
                    <div className="text-center">Quick Win</div>
                    <div className="text-center">Action</div>
                  </div>
                  <ul className="divide-y divide-gray-800">
                    {tasks.map((item, idx) => (
                      <li key={item.id} className="text-xs hover:bg-gray-800/40">
                        <div className="grid grid-cols-[34px_1fr_90px_72px_56px_70px_54px] items-center gap-2 px-4 py-1.5">
                          <div className="text-[10px] text-gray-500">{idx+1}</div>
                          <div className="flex items-center min-w-0">
                            <input
                              value={item.line}
                              onChange={e => update(item.id, { line: e.target.value })}
                              className="bg-transparent border-none focus:outline-none text-gray-200 text-xs w-full truncate"
                            />
                          </div>
                          <div className="flex items-center justify-center">
                            <select
                              value={(item.suggested_category || cat)}
                              onChange={e => {
                                const val = e.target.value;
                                if (val === '__new__') {
                                  const name = prompt('New category name');
                                  if (name) {
                                    const slug = name.trim().toLowerCase();
                                    if (slug && !categories.includes(slug)) setCategories(prev => [...prev, slug]);
                                    update(item.id, { suggested_category: slug });
                                  }
                                } else {
                                  update(item.id, { suggested_category: val });
                                }
                              }}
                              className="bg-gray-800/60 border border-gray-700 rounded px-1 py-0.5 text-[11px] text-gray-200 focus:outline-none"
                            >
                              {categories.map(c => <option key={c} value={c}>{c}</option>)}
                              <option value="__new__">+ new</option>
                            </select>
                          </div>
                          <div className="flex items-center justify-center">
                            <select
                              value={item.suggested_priority || ''}
                              onChange={e => update(item.id, { suggested_priority: Number(e.target.value) })}
                              className="bg-gray-800/60 border border-gray-700 rounded px-1 py-0.5 text-[11px] text-gray-200 focus:outline-none"
                            >
                              <option value="">-</option>
                              {[1,2,3,4,5].map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                          </div>
                          <div className="flex items-center justify-center">
                            <select
                              value={item.energy_level || ''}
                              onChange={e => update(item.id, { energy_level: e.target.value as any })}
                              className="bg-gray-800/60 border border-gray-700 rounded px-1 py-0.5 text-[11px] text-gray-200 focus:outline-none"
                            >
                              <option value="">-</option>
                              <option value="low">Low</option>
                              <option value="medium">Med</option>
                              <option value="high">High</option>
                            </select>
                          </div>
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => update(item.id, { quick_win: !item.quick_win })}
                              className={`text-[10px] px-1.5 py-0.5 rounded border ${item.quick_win ? 'bg-emerald-600/20 border-emerald-600/40 text-emerald-300' : 'bg-gray-800/40 border-gray-700 text-gray-400'}`}
                            >{item.quick_win ? 'Yes' : 'No'}</button>
                          </div>
                          <div className="flex items-center justify-center">
                            <select
                              value={item.action}
                              onChange={e => update(item.id, { action: e.target.value as any })}
                              className="bg-gray-800/60 border border-gray-700 rounded px-1 py-0.5 text-[11px] text-gray-200 focus:outline-none"
                            >
                              {['keep','merge','clarify','drop'].map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                          </div>
                        </div>
                      </li>
                    ))}
                    {tasks.length === 0 && (
                      <li className="px-4 py-3 text-[11px] text-gray-500 italic">No tasks in this category</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-gray-500 leading-relaxed">
        Priority 1-5. Quick Win toggle boosts later scoring. Action=drop removes from save. Categories listed vertically for easier scanning.
      </div>
    </div>
  );
};
