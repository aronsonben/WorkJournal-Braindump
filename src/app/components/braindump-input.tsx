"use client";

import React, { useState, useMemo } from 'react';
import { CategorizedTaskSuggestion, BraindumpAnalysisResult, SimpleBraindumpAnalysisResult } from '../../lib/supabase';

interface BraindumpInputProps {
  onAnalyzed: (analysis: SimpleBraindumpAnalysisResult) => void;
  rawText: string;
  setRawText: (rawText: string) => void;
}

function parseLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);
}

export const BraindumpInput: React.FC<BraindumpInputProps> = ({ onAnalyzed, rawText, setRawText }) => {
  // const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lines = useMemo(() => parseLines(rawText), [rawText]);

  async function handleAnalyze() {
    if (!rawText.trim()) return;
    setLoading(true); 
    setError(null);
    try {
      const res = await fetch('/api/braindump/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: rawText })
      });
      if (res.ok) {
          // const data: BraindumpAnalysisResult = await res.json();
          const data: SimpleBraindumpAnalysisResult = await res.json();
          console.log("FOUND DATA:", data);
          onAnalyzed(data);
        } else {
          throw new Error('Analysis failed');
          // [TODO] If analysis fails, save directly
          // await saveEntryDirectly();
        }
    } catch (e: any) {
      setError(e.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-800/90 rounded-lg overflow-hidden border border-gray-700 focus-within:border-[#15c460] transition-colors">
        <textarea
          className="w-full p-6 bg-transparent text-gray-100 resize-none focus:outline-none text-base md:text-lg leading-relaxed placeholder-gray-500 font-medium"
          placeholder={"Braindump tasks – one per line.\nExample:\nFix onboarding bug\nDraft Q3 planning doc\nEmail Alex about API limits"}
          rows={10}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
        />
        <div className="px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-xs text-gray-400 flex items-center gap-3">
            <span>{lines.length} line{lines.length === 1 ? '' : 's'}</span>
            <span className="hidden sm:inline text-gray-600">|</span>
            <span className="max-w-[240px] truncate" title={rawText.length ? rawText : 'Empty'}>
              {rawText.length ? rawText.length + ' chars' : 'Empty'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setRawText(''); setError(null); }}
              disabled={!rawText}
              className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-sm text-gray-200"
            >Clear</button>
            <button
              onClick={handleAnalyze}
              disabled={loading || !lines.length}
              className="px-6 py-2 rounded-lg bg-[#15c460] hover:bg-[#11a652] disabled:opacity-50 text-sm font-semibold text-black flex items-center gap-2"
            >{loading ? (<><span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"/>Analyzing</>) : 'Analyze'}</button>
          </div>
        </div>
      </div>
      {error && (
        <div className="p-3 rounded bg-red-900/40 border border-red-700 text-sm text-red-300">{error}</div>
      )}
      {lines.length > 0 && (
        <div className="rounded-lg border border-gray-700 p-4 bg-gray-900/60">
          <h4 className="text-sm font-semibold text-gray-300 mb-2">Preview</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-400 max-h-48 overflow-auto pr-2">
            {lines.map((l, i) => <li key={i}>{l}</li>)}
          </ol>
        </div>
      )}
    </div>
  );
};
