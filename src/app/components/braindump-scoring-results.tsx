"use client";
import React from 'react';

interface ScoringResultProps {
  result: {
    braindump_id: string;
    top3: string[];
    ranking: Array<{
      id: string;
      content: string;
      score: number;
      category: string | null;
      priority_group: number | null;
      longevity: number | null;
      urgency_rank: number | null;
      shininess_rank: number | null;
      quick_win: boolean | null;
    }>;
    summary: string;
  } | null;
  onClose?: () => void;
}

export const BraindumpScoringResults: React.FC<ScoringResultProps> = ({ result, onClose }) => {
  if (!result) return null;
  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">🏁 Focus Ranking</h3>
        {onClose && <button onClick={onClose} className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200">Close</button>}
      </div>
      <p className="text-sm text-gray-400">Top suggested focus tasks plus full ranked list using priority, longevity & quick win boosts.</p>
      <div className="grid gap-2">
        <div className="rounded border border-gray-700 bg-gray-900/50 p-3">
          <h4 className="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wide">Top 3 Focus</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-200">
            {result.ranking.filter(r => result.top3.includes(r.id)).map(r => (
              <li key={r.id} className="flex items-center gap-2">
                <span>{r.content}</span>
                <span className="text-[10px] text-gray-500">({r.score.toFixed(2)})</span>
                {r.quick_win && <span className="text-[10px] px-1 py-0.5 rounded bg-emerald-600/20 text-emerald-300 border border-emerald-600/40">quick</span>}
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded border border-gray-700 bg-gray-900/40 p-3">
          <h4 className="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wide">All Ranked</h4>
          <div className="space-y-1 text-xs">
            {result.ranking.map((r, idx) => (
              <div key={r.id} className="flex items-center gap-3 rounded px-2 py-1 bg-gray-800/60">
                <span className="w-5 text-gray-500">{idx+1}</span>
                <span className="flex-1 text-gray-200 truncate">{r.content}</span>
                <span className="text-[10px] text-gray-400">{r.category || '–'}</span>
                {r.quick_win && <span className="text-[10px] text-emerald-400">QW</span>}
                <span className="text-[10px] text-gray-500">{r.score.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="text-[11px] text-gray-500 italic">{result.summary}</div>
      </div>
    </div>
  );
};
