import { createClient } from '@supabase/supabase-js';
import { normalizeTaskLine } from '@/lib/braindump-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ScoreResult {
  braindump_id: string;
  top3: string[]; // task ids
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
}

// Basic deterministic scoring formula with placeholder urgency/shininess (not yet collected) fallback
export async function scoreBraindump(braindumpId: string): Promise<ScoreResult> {
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, content, category, priority_group, longevity, quick_win, urgency_rank, shininess_rank, created_at')
    .eq('braindump_id', braindumpId)
    .in('action', ['keep', 'merge'])
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!tasks || tasks.length === 0) {
    return { braindump_id: braindumpId, top3: [], ranking: [], summary: 'No tasks available for scoring.' };
  }

  const maxLongevity = Math.max(1, ...tasks.map(t => t.longevity || 0));

  const scored = tasks.map(t => {
    const priorityWeight = mapPriorityGroupWeight(t.priority_group);
    const longevityFactor = ((t.longevity || 0) / maxLongevity) * 2.0; // longevity weight 2x
    const quickWinBoost = t.quick_win ? 1.25 : 1.0;
    const urgencyComponent = t.urgency_rank ? 1 + (1 / t.urgency_rank) : 1; // rank 1 => 2.0, 2 => 1.5, etc.
    const shininessPenalty = t.shininess_rank ? (1 - Math.min(0.5, (t.shininess_rank - 1) * 0.05)) : 1; // small decay
    const rawScore = (priorityWeight + longevityFactor) * quickWinBoost * urgencyComponent * shininessPenalty;
    return { ...t, score: Number(rawScore.toFixed(4)) };
  });

  scored.sort((a, b) => b.score - a.score);
  const top3 = scored.slice(0, 3).map(s => s.id);
  const summary = buildSummary(scored);

  // Persist scores back (best-effort sequential for simplicity)
  for (let rank = 0; rank < scored.length; rank++) {
    const t = scored[rank];
    await supabase.from('tasks').update({ score: t.score, overall_rank: rank + 1 }).eq('id', t.id);
  }

  // Store summary in braindump metadata (merge)
  const { data: bdData, error: bdErr } = await supabase.from('braindumps').select('metadata').eq('id', braindumpId).single();
  const existingMeta = bdData?.metadata || {};
  existingMeta.scoring_summary = summary;
  existingMeta.top3 = top3;
  await supabase.from('braindumps').update({ metadata: existingMeta }).eq('id', braindumpId);

  return {
    braindump_id: braindumpId,
    top3,
    ranking: scored.map(s => ({
      id: s.id,
      content: s.content,
      score: s.score,
      category: s.category,
      priority_group: s.priority_group,
      longevity: s.longevity,
      urgency_rank: s.urgency_rank,
      shininess_rank: s.shininess_rank,
      quick_win: s.quick_win
    })),
    summary
  };
}

function mapPriorityGroupWeight(pg: number | null | undefined) {
  switch (pg) {
    case 1: return 5; // Must Do
    case 2: return 3.5; // Need To Do
    case 3: return 2; // Should Do
    case 4: return 1; // Want To Do
    default: return 2; // neutral fallback
  }
}

function buildSummary(list: { content: string; score: number; quick_win: boolean | null; longevity: number | null }[]): string {
  if (list.length === 0) return 'No tasks to summarize';
  const top = list.slice(0,3);
  const quickWins = list.filter(t => t.quick_win).length;
  const avgScore = (list.reduce((s,t)=>s+t.score,0)/list.length).toFixed(2);
  return `Top focus: ${top.map(t=>`"${truncate(t.content,40)}"`).join(', ')}. ${quickWins} quick wins. Avg score ${avgScore}.`;
}

function truncate(s: string, n: number) { return s.length > n ? s.slice(0,n-1)+'…' : s; }
