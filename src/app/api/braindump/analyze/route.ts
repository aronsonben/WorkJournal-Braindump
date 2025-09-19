import { NextRequest, NextResponse } from 'next/server';
import { Braindump, BraindumpAnalysisResult, CategorizedTaskSuggestion } from '@/lib/supabase';

// Placeholder Gemini-like categorization heuristics (replace with real API call later)
function simpleCategorize(line: string): { category: string; priority: number } {
  const l = line.toLowerCase();
  if (/(bug|fix|error|issue)/.test(l)) return { category: 'bug', priority: 5 } as const;
  if (/(email|reply|respond|follow up)/.test(l)) return { category: 'communication', priority: 3 } as const;
  if (/(plan|strategy|roadmap)/.test(l)) return { category: 'planning', priority: 4 } as const;
  if (/(learn|read|study|research)/.test(l)) return { category: 'learning', priority: 2 } as const;
  if (/(deploy|monitor|infrastructure|server|ops)/.test(l)) return { category: 'ops', priority: 4 } as const;
  if (l.split(/\s+/).length <= 3) return { category: 'quick_win', priority: 2 } as const;
  return { category: 'uncategorized', priority: 3 };
}

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();

    if (!content.trim() || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required and must be a string' },
        { status: 400 }
      );
    }

    const lines = content.split(/\r?\n/).map((l: string) => l.trim()).filter((l: string) => l.length > 0);

    /**
     * At this point we have each of the lines the user input in the `lines` object.
     * From here, we either want to:
     *  1. Use Gemini to provide helpful analysis
     *  2. Skip the analysis and either:
     *    a. Save the tasks as-is with no categorization, prioritization, etc.
     *    b. Still allow the user to categorize, prioritize, etc. but just don't do analysis
     */

    try {
      // Use LLM to generate comprehensive analysis
      const analysis = await generateComprehensiveAnalysis(content);
      return NextResponse.json(analysis);
    } catch (llmError) {
      console.error('LLM error, using fallback:', llmError);
    }

  // If LLM path failed above, fall back to heuristic analysis consistent with interface
  const fallback = generateFallbackAnalysis(content);
  return new NextResponse(JSON.stringify(fallback), { status: 200 });
  } catch (e: any) {
    return new NextResponse(JSON.stringify({ error: e.message || 'Internal error'}), { status: 500 });
  }
}

// Rate limiting state
let lastApiCall = 0;
const MIN_API_INTERVAL = 2000; // 2 seconds between API calls


async function generateComprehensiveAnalysis(content: string): Promise<BraindumpAnalysisResult> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY not found, using fallback analysis');
    return generateFallbackAnalysis(content);
  }

  // Rate limiting check
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCall;
  
  if (timeSinceLastCall < MIN_API_INTERVAL) {
    const waitTime = MIN_API_INTERVAL - timeSinceLastCall;
    console.log(`Rate limiting: waiting ${waitTime}ms before API call`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastApiCall = Date.now();

  if (!GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY not found, using fallback analysis');
    return generateFallbackAnalysis(content);
  }

  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  const prompt = `You are analyzing a user's raw "braindump" of tasks (each line is one item) to help them clarify, categorize, and gently prioritize their work. 
  Act like a blend of ADHD coach, executive assistant, and encouraging planner. Be practical, never judgmental. Recognize effort at any level.
  
  Braindump input (each line is a separate raw item; preserve wording exactly in the "line" field):
  "${lines.join('\n')}"

  GOALS:
  Normalize and structure the list while preserving the user's intent and wording.
  Encourage momentum: surface quick wins and a realistic starting point.
  Reduce overwhelm: collapse true duplicates, highlight batching opportunities, and propose only a SMALL actionable focus.
  Avoid over-engineering: keep suggestions lightweight and optional.
  
  DEFINITIONS / RULES:
  Treat every non-empty line as a potential task even if vague.
  Do NOT invent tasks not present.
  If a line is purely a heading (e.g. "Frontend", "Marketing") mark action: "clarify".
  Merge only when two lines express the same concrete outcome (not just same domain). If uncertain: keep both.
  Normalization: lowercase, trim, collapse internal whitespace, strip trailing punctuation (.,!).
  suggested_priority scale: 5 = urgent / high leverage / unblocking others 4 = important soon 3 = standard 2 = improvement / nice progression 1 = optional / nice-to-have / speculative
  quick_win: true if (a) likely < 15 min OR (b) extremely low ambiguity.
  energy_level: estimate cognitive demand: low | medium | high (avoid "very" variants).
  blocking: true if task explicitly prevents progress on others OR clearly prerequisite.
  subtasks: only add if the original line clearly implies ≥2 sequential steps; max 3; each phrased as an actionable verb phrase; otherwise empty array.
  time_estimate_minutes: rough whole number (5–240). If impossible to guess (very vague), use null.
  categories: SMALL controlled set derived from content (examples: "bug", "ops", "planning", "learning", "communication", "research", "refactor", "design", "deployment", "admin", "personal"). If none fit: "uncategorized". Do not invent niche tags.
  action field: keep = fine as-is merge = should be combined with another (list duplicate relation in detected_duplicates) clarify = needs user clarification before scheduling drop = non-actionable / note / redundant after merge
  Do NOT overuse "drop"—prefer "clarify" unless clearly non-actionable.
  
  DUPLICATE / SIMILARITY HANDLING:
  Compute simple semantic similarity (conceptual equivalence; ignore trivial tense changes).
  Only mark as duplicate if same concrete deliverable. Don't collapse broad vs specific (e.g. "marketing plan" vs "write Q1 marketing plan outline" → keep).
  Provide similarity 0-1 (rounded to 2 decimals). Only include relations ≥ 0.85.
  FOCUS COACHING:

  today_top_3: indices (0-based) of three tasks that: (a) unblocks others, (b) mix of one quick win, one meaningful, one foundational. If fewer tasks exist, return as many as available.
  batching_groups: group tasks that can be done in one focused context (e.g., "communication", "backend cleanup"). 0–3 groups max. Each group must have ≥2 tasks.
  first_next_action: choose exactly one task that is (a) small enough to start immediately, (b) creates momentum. Provide why.
  
  TONE / STYLE:
  Output JSON only. No prose outside JSON. No markdown fences.
  Encourage without patronizing. No toxic positivity. Avoid exclamation unless genuinely celebrating completion clusters.
  summary: 1-2 motivating sentences highlighting momentum and reduced overwhelm.
  
  OUTPUT SCHEMA (return EXACTLY this shape; all fields required unless noted): 
  {
    "categories": [
      "distinct-category-1"
    ],
    "tasks": [
      {
        "line": "original exact line text",
        "normalized": "normalized form",
        "suggested_category": "string",
        "suggested_priority": 3,
        "action": "keep",
        "rationale": "brief reason (<=120 chars, positive tone)",
        "subtasks": [
          "optional"
        ],
        "time_estimate_minutes": null,
        "energy_level": "medium",
        "quick_win": false,
        "blocking": false,
        "dependencies": []
      }
    ],
    "summary": "motivating summary",
    "detected_duplicates": [
      {
        "existing_task_index": 0,
        "new_task_index": 0,
        "similarity": 0
      }
    ],
    "focus_suggestion": {
      "today_top_3": [
        0
      ],
      "batching_groups": [
        {
          "label": "context label",
          "task_indices": [
            0
          ]
        }
      ],
      "first_next_action": {
        "task_index": 0,
        "why": "short why"
      }
    ],
    "stats": {
      "total_tasks": 1,
      "categorized": 1,
      "uncategorized": 0,
      "quick_wins": 0,
      "estimated_total_minutes": 0
    }
  }

  VALIDATION REQUIREMENTS:
  tasks array index order must match original line order after filtering out empty lines.
  All indices in today_top_3, batching_groups, first_next_action must exist in tasks.
  No nulls except allowed time_estimate_minutes.
  If no duplicates, detected_duplicates = [].
  If fewer than 3 actionable tasks, today_top_3 length reflects that. Don't pad.
  Return ONLY the JSON. No commentary. If input is empty or only whitespace, return a minimal JSON with empty arrays and zeros.
  `;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
    
    // This is the actual call to the Gemini API. There could be room here for improvement.
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.4, // Slightly higher for more creative tags
          maxOutputTokens: 400,
        }
      })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 429) {
        console.log('Rate limited, using fallback analysis');
        return generateFallbackAnalysis(content);
      }
      throw new Error(`Gemini API error: ${response.status}`);
    }

    // May need to modify the way the response data is handled for braindump case
    const data = await response.json();
    let generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
      throw new Error('No content generated from Gemini');
    }

    // Clean the JSON response
    generatedText = generatedText.trim();
    if (generatedText.startsWith('```json')) {
      generatedText = generatedText.slice(7);
    }
    if (generatedText.endsWith('```')) {
      generatedText = generatedText.slice(0, -3);
    }

    // This is where the actual analysis begins
    try {
      const analysis: BraindumpAnalysisResult = JSON.parse(generatedText);

      analysis.categories = (analysis.categories || [])
        .map(category => category.toLowerCase().trim().replace(/\s+/g, '-'))
        .filter(category => category.length > 1 && category.length < 20)
        .slice(0, 4);

      // [TODO] More opportunities for analysis here...

      return analysis;
    } catch (parseError) {
      console.error('Error parsing Gemini JSON response:', parseError);
      console.error('Raw response:', generatedText);
      return generateFallbackAnalysis(content);
    }

  } catch (error) {
    console.error('Error calling Gemini API:', error);
    // If it's a rate limit or timeout, gracefully fall back
    if (error instanceof Error && (error.message.includes('429') || error.name === 'AbortError')) {
      console.log('Using fallback due to rate limit or timeout');
    }
    return generateFallbackAnalysis(content);
  }
}

/**
 * This does some fallback analysis of the user input so there is a fairly
 * similar experience to the LLM version in case the user can't connect. 
 * @param content braindump input
 */
function generateFallbackAnalysis(content: string): BraindumpAnalysisResult {
  if (!content.trim()) {
    return {
      categories: [],
      tasks: [],
      summary: 'No tasks provided',
      detected_duplicates: [],
      focus_suggestion: {
        today_top_3: [],
        batching_groups: [],
        first_next_action: { task_index: 0, why: '' }
      },
      stats: {
        total_tasks: 0,
        categorized: 0,
        uncategorized: 0,
        quick_wins: 0,
        estimated_total_minutes: 0
      }
    };
  }

  const rawLines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const normalizedMap = new Map<string, number>();
  const detected_duplicates: BraindumpAnalysisResult['detected_duplicates'] = [];

  const tasks: CategorizedTaskSuggestion[] = rawLines.map((line, index) => {
    const normalized = line.toLowerCase();
    const prior = normalizedMap.get(normalized);
    const { category, priority } = simpleCategorize(line);
    if (prior !== undefined) {
      detected_duplicates.push({
        existing_task_index: prior,
        new_task_index: index,
        similarity: 1
      });
    } else {
      normalizedMap.set(normalized, index);
    }

    // Heuristic estimates
    const wordCount = line.split(/\s+/).filter(Boolean).length;
    const quick_win = wordCount <= 3;
    const blocking = /block|waiting|unblock|depends/i.test(line);
    const energy_level: 'low' | 'medium' | 'high' = quick_win ? 'low' : (wordCount <= 8 ? 'medium' : 'high');
    const time_estimate_minutes = quick_win ? 5 : Math.min(240, Math.max(5, wordCount * 5));
    const rationale = quick_win ? 'Short task - fast momentum' : blocking ? 'Prerequisite that unlocks other work' : 'Typical task derived from braindump';

    return {
      line,
      normalized,
      suggested_category: category,
      suggested_priority: priority,
      action: prior !== undefined ? 'merge' : (/^([A-Z][a-z]+:?|[a-z]+)$/.test(line) && wordCount === 1 ? 'clarify' : 'keep'),
      rationale: rationale.slice(0, 120),
      subtasks: [],
      time_estimate_minutes,
      energy_level,
      quick_win,
      blocking,
      dependencies: []
    };
  });

  const categories = Array.from(new Set(tasks.map(t => t.suggested_category).filter(Boolean))) as string[];

  // Focus suggestion heuristics
  const quickWinIndices = tasks.map((t, i) => t.quick_win ? i : -1).filter(i => i !== -1);
  const highPriorityIndices = tasks
    .map((t, i) => ({ i, p: t.suggested_priority || 0 }))
    .sort((a, b) => b.p - a.p)
    .map(o => o.i);
  const blockingIndices = tasks.map((t, i) => t.blocking ? i : -1).filter(i => i !== -1);

  const today_top_3: number[] = [];
  const addUnique = (i: number) => { if (!today_top_3.includes(i) && today_top_3.length < 3) today_top_3.push(i); };
  // Ensure one quick win
  if (quickWinIndices.length) addUnique(quickWinIndices[0]);
  // Ensure one blocking/high priority
  if (blockingIndices.length) addUnique(blockingIndices[0]);
  if (highPriorityIndices.length) {
    for (const idx of highPriorityIndices) { addUnique(idx); if (today_top_3.length >= 3) break; }
  }
  // Fill from remaining if needed
  for (let i = 0; i < tasks.length && today_top_3.length < 3; i++) addUnique(i);

  // Batching groups (categories with >=2 tasks)
  const batching_groups = categories
    .map(cat => ({
      label: cat,
      task_indices: tasks.map((t, i) => t.suggested_category === cat ? i : -1).filter(i => i !== -1)
    }))
    .filter(g => g.task_indices.length >= 2)
    .slice(0, 3);

  const first_next_action = (() => {
    if (quickWinIndices.length) return { task_index: quickWinIndices[0], why: 'Fast win to build momentum' };
    if (blockingIndices.length) return { task_index: blockingIndices[0], why: 'Unblocks other work' };
    return { task_index: 0, why: 'Earliest high-priority item' };
  })();

  // Stats
  const total_tasks = tasks.length;
  const categorized = tasks.filter(t => t.suggested_category && t.suggested_category !== 'uncategorized').length;
  const uncategorized = total_tasks - categorized;
  const quick_wins = tasks.filter(t => t.quick_win).length;
  const estimated_total_minutes = tasks.reduce((sum, t) => sum + (t.time_estimate_minutes || 0), 0);

  const summary = `Identified ${total_tasks} tasks (${quick_wins} quick wins, ${categorized} categorized).`; 

  return {
    categories,
    tasks,
    summary,
    detected_duplicates,
    focus_suggestion: {
      today_top_3,
      batching_groups,
      first_next_action
    },
    stats: {
      total_tasks,
      categorized,
      uncategorized,
      quick_wins,
      estimated_total_minutes
    }
  };
}
