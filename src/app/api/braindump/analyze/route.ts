import { NextRequest, NextResponse } from 'next/server';
import { BraindumpAnalysisResult, CategorizedTaskSuggestion } from '@/lib/supabase';
import { normalizeTaskLine } from '@/lib/braindump-utils';
import { GoogleGenAI, Type } from "@google/genai";

// Re-working the large prompt into smaller steps with better structure:
//  a. input prompt (passed to 'contents' param of flash-2.5 model)
//  b. system instructions 
//    a. role
//    b. goals
//    c. rules
//  c. strucutred output (but why? think through it)

/**
 * Reminder for what the purpose of this prompt is:
 * 
 * User has input list of task to do today as tasks on each line, already pre-processed.
 *    (So, "task1 \n task 2 \n ..." should now be ["task1", "task2"])
 * 
 * Model should first classify (aka categorize) each of the tasks.
 *    Model should refer to user's existing classification schema (categories) afterwards 
 * 
 * Model should analyze what tasks seem important or urgent based on language (few-shot prompt)
 *    Model should also make judgement on what tasks would be considered 'quick'
 *    Example: ["pay rent today", "call mom", "make new song"] 
 *      - model should recognize that "pay rent today" is urgent and ought to be prioritized
 *      - ...whereas "make new song" should be low priority
 *      - model might suggest that "call mom" would be considered 'quick'
 * 
 * Model should refer to user's existing tasks for analysis (step 3?)
 *    model should check for duplicates that would indicate the task is still ongoing
 *    model should attempt to classify new tasks with old ones
 * 
 * Scoring tasks (idea - step 4)
 *    Using my own method (longevity, urgency, quickness, shininess), model should score all
 *    tasks upon each braindump
 *    This is an opportunity to explore structured output
 *    More on this later...
 */

/** Considering UX Flow:
 * 1. User braindumps into input box then submits
 * 2. [AI-1] Model performs classification analysis and provides user with tasks broken into new & existing categories
 * 3. [UX] user given option to move tasks around into categories via drag & drop
 * 4. User submits final categorization
 * 5. [AI-2] Model analyzes tasks for prioritization, urgency, importance & quickness
 * 6. User given option to move tasks around in priorities
 * 7. [AI-3] Model incorporates existing tasks & computes score based on longevity, urgency, quickness, shininess
 */

const SAMPLE_INPUT_SIMPLE = ["pay rent today", "call mom", "post new music video", "finish coding synthesia for fun"];
const SAMPLE_INPUT_FULL = ["kimia bday gift", "compost filter", "cancel prime", "STOLIMPICO edits on soundcloud", "Waxxx footage, tiktok posts & more", "Subaru..yikes", "clear storage on Mac", "Fb marketplace", "re-set cjai meeting for tomorrow at 8am", "kimia bday trip: book palce for friday night", "let roslindale porchfest know that i can’t make it", "respond to Eli", "stolimpico domain name", "whistler book place in town", "reschedule optha", "make plan go to costoco to get prescription glasses", "braindump - super super MVP", "synthesia - fix UI", "cjai - all kinds of fixes & important deadline tomorrow at 8am", "bo rice exposed - fix home & music pages (& deavhon page)", "concourse codes - spruce up", "sto45 - film media post", "AI development - some small dev project utilizing an AI stack", "are.na gallery development idea", "blog on revenue spot", "find way to publicize “personal-copilot” for braindump", "find way to post waxxx visual", "prep for roundtabel video", "think of consistent visual style while other viz get executed", "respond to IG DMs", "post bossyboi clips on tiktok", "post bossyboi clips on YT", "respond to soudncloud people", "The concourse newsletter + sign-up"];
const SAMPLE_EXISTING_CATEGORIES = ["coding", "work"];

// Step 1: Classify input list
const prompt1 = "Classify the user's input into task categories. User Input: ";
const instructions1 = `
  You are an ADHD coach and personal assistant who excels at planning. 
  You are analyzing a "braindump" of tasks on behalf of the user to help them organize their tasks, thoughts, and ideas.

  GOAL: classify user input into task categories

  EXISTING CATEGORIES: {existing_categories}

  BEHAVIOR:
  Try to use existing user categories first, when possible
  If you identify new classification clusters, recommend a new category group to the user
  Keep new category titles simple and concise
  Don't be afraid to break categories into smaller topics
  
  TONE:
  Be practical, but never judgemental.
  Guide the user towards remaining calm and collected when approaching their tasks
  Be direct in your responses, the user needs direct advice
  Keep responses lightweight and concise
  Encourage without patronizing. No toxic positivity. Avoid exclamation unless genuinely celebrating completion clusters.

  OUTPUT: 
  Clusters of the input tasks into categories in list format

  EXAMPLES:
  Task: re-set cjai meeting for tomorrow at 8am
  Category: Work

  Task: pay rent today
  Category: Home

  Task: cancel prime
  Category: Personal

  Task: post waxxx music video
  Category: Music

  OUTPUT STRUCTURE:
`;
const output_schema1 = {
  "existing_categories": [
    "existing-user-category-1",
  ],
  "recommended_categories": [
    "recommended-category-1",
  ],
  "tasks": [
    {
      "task": "original exact task text",
      "normalized": "normalized form",
      "suggested_category": "string",
    }
  ],
  "summary": "motivating summary",
  "stats": {
    "total_tasks": 1,
  }
}

// Step 2: Analyze for priority, urgency
const prompt2 = "Analyze the user's tasks for prioritization based on rules in system instructions"
const instructions2 = `
  You are an ADHD coach and personal assistant who excels at planning. 
  You are analyzing a "braindump" of tasks on behalf of the user to help them organize their tasks, thoughts, and ideas.

  GOAL: help the user prioritize the given tasks

  BEHAVIOR:
  Break the given tasks into priority groups
  Based your prioritization on what seems most important in general
  Limit the most important priority group to a maximum of 5 items
  Prioritize the tasks that must get done today
  If a category is supplied, consider the importance of the category (example: 'Work' is more important than 'Music')

  TONE:
  Be practical, but never judgemental.
  Guide the user towards remaining calm and collected when approaching their tasks
  Keep responses lightweight and concise
  Be encouraging and supportive, guide the user towards easy wins

  OUTPUT: 
  Clusters of the input tasks into categories in list format
  Start with priority groups: ["Must Do", "Need To Do", "Should Do", "Want To Do"]

  EXAMPLES:
  Task: re-set cjai meeting for tomorrow at 8am
  Prioritization: Need To Do

  Task: pay rent today
  Prioritization: Must Do

  Task: cancel prime
  Prioritization: Should Do

  Task: post waxxx music video
  Prioritization: Want To Do
`;
// sample structured output to generate scoring ratings
const task_output2 = [
  {
    "task": "original exact task text",
    "normalized": "normalized form",
    "suggested_category": "string",
    "suggested_priority": 3,
    "priority": 1,
    "urgency": 1,
    "time_estimate_minutes": 15,
    "shininess": 4,
    "longevity_in_days": 4
  }
]

// Step 3: Generate Score
const prompt3 = "Generate a score for each task based on the factors in your instructions."
const instructions3 = `
  You are an ADHD coach and personal assistant who excels at planning. 
  You are analyzing a "braindump" of tasks on behalf of the user to help them organize their tasks, thoughts, and ideas.

  GOAL: generate a score for each task based on priority, longevity, urgency, quickness, and shininess to help the user prioritize truly important tasks

  PARAMETER DEFINITIONS:
  Longevity - how many times a given task (or an extremely similar one) has appeared in past braindumps
  Quickness - how quick it will be for the user to complete a task, measured by estimated time in minutes
  Urgency - how soon this task must be completed by, usually relative to external factors instead of personal deadlines (example: 'pay rent today' is more urgent than 'write a poem today')
  Shininess - ADHD-related metric that measures how "new & shiny" a task appears, meaning the user has an impulsive drive to do this above all else
  Priority - how important a given task is as categorized by the user

  PARAMETER SCORING DEFINITIONS:
  Longevity (number) - # of times the task has appeared in past braindumps
  Quickness (number) - estimated time in minutes to complete task
  Urgency (number) - ranking of how urgent task is, with 1 being most urgent, 2 being next urgent, so on
  Shininess (number) - ranking of how shiny task is, with 1 being most shiny, 2 being next shiny, so on
  Priority (number) - ranking of priority group the task has been placed in

  SCORE GENERATION:
  Tasks are given points based on their position in the priority ranking (example: most important task - 1pt, second most important - 2pt, etc.)
  Tasks with low quickness ratings get a boost
  Tasks with the highest longevity score should be weighted about 2 times as much as the next factor
  Tasks with a high shininess score should be penalized
  Tasks with high urgency ratings get a boost

  OUTPUT:
  A "Top 3" list with rationale of why these are most important, explaning reasons for scoring, along with the scoring measurements for each task.
  A straight-forward ranking list of all tasks from the current braindump with a brief (max. 3 sentence) summary at bottom.
  A straight-forward ranking list of all in progress tasks from all braindumps, along with their current score, ranked in a list. Highlight new tasks in bold.
`;


const BRAINDUMP_PROMPT = `
  You are analyzing a user's raw "braindump" of tasks (each line is one item) to help them clarify, categorize, and gently prioritize their work. 
  Act like a blend of ADHD coach, executive assistant, and encouraging planner. Be practical, never judgmental. Recognize effort at any level.

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
  
  BRAINDUMP USER INPUT (each line is a separate raw item; preserve wording exactly in the "line" field):
  `;

// PLACEHOLDER RESPONSE SCHEMA FOR CLASSIFICATION
  // responseMimeType: "application/json",
  // responseSchema: {
  //   type: Type.OBJECT,
  //   properties: {
  //     type: Type.OBJECT,
  //     properties: {
  //       existingCategories: {
  //         type: Type.STRING,
  //       },
  //       recommendedCategories: {
  //         type: Type.STRING,
  //       },
  //       tasks: {
  //         type: Type.ARRAY,
  //         items: {
  //           type: Type.OBJECT,
  //           properties: {
  //             task: {
  //               type: Type.STRING,
  //             },
  //             suggestedCategory: {
  //               type: Type.STRING
  //             }
  //           },
  //           propertyOrdering: ["task", "suggestedCategory"],
  //         },
  //       },
  //       summary: {
  //         type: Type.STRING
  //       },
  //       stats: {
  //         type: Type.OBJECT,
  //         properties: {
  //           totalTasks: {
  //             type: Type.NUMBER
  //           }
  //         }
  //       }
  //     },
  //     propertyOrdering: ["existingCategories", "recommendedCategories", "tasks", "summary", "stats"],
  //   },
  // }

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

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Content is required and must be a non-empty string' }, { status: 400 });
    }

    const rawLines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (rawLines.length === 0) {
      return NextResponse.json({ response: JSON.stringify(generateFallbackAnalysis(content)) });
    }

    // Placeholder: fetch existing categories for user (stub user context)
    const existingCategories = await getExistingCategories();

    let analysis: BraindumpAnalysisResult | null = null;
    try {
      analysis = await generateComprehensiveAnalysis(content);
    } catch (err) {
      console.error('Primary Gemini analysis failed, using fallback:', err);
    }

    if (!analysis) {
      analysis = generateFallbackAnalysis(content);
    }

    // Ensure normalization and index integrity post-model
    analysis.tasks = rawLines.map((original, idx) => {
      const modelTask = analysis!.tasks[idx];
      if (!modelTask || modelTask.line !== original) {
        // Reconstruct if model drifted or misaligned
        const normalized = normalizeTaskLine(original);
        const heur = simpleCategorize(original);
        return {
          line: original,
          normalized,
            suggested_category: heur.category,
            suggested_priority: heur.priority,
            action: 'keep',
            rationale: 'Recovered task (alignment fix)',
            subtasks: [],
            time_estimate_minutes: null,
            energy_level: 'medium',
            quick_win: false,
            blocking: false,
            dependencies: []
        } as CategorizedTaskSuggestion;
      } else {
        // Patch normalization safety & clamp priority range
        const normalized = normalizeTaskLine(modelTask.line);
        let p = modelTask.suggested_priority ?? 3;
        if (p < 1) p = 1; if (p > 5) p = 5;
        return {
          ...modelTask,
          normalized,
          suggested_priority: p
        };
      }
    });

    // Rebuild categories set (limit to 8 distinct, lowercase)
    const categories = Array.from(new Set(analysis.tasks.map(t => t.suggested_category || 'uncategorized')
      .map(c => c.toLowerCase().trim().slice(0,30)))).slice(0, 8);
    analysis.categories = categories;

    // Adjust stats
    analysis.stats.total_tasks = analysis.tasks.length;
    const categorized = analysis.tasks.filter(t => t.suggested_category && t.suggested_category !== 'uncategorized').length;
    analysis.stats.categorized = categorized;
    analysis.stats.uncategorized = analysis.stats.total_tasks - categorized;
    analysis.stats.quick_wins = analysis.tasks.filter(t => t.quick_win).length;
    analysis.stats.estimated_total_minutes = analysis.tasks.reduce((s, t) => s + (t.time_estimate_minutes || 0), 0);

    // Minimal focus suggestion fallback if model omitted
    if (!analysis.focus_suggestion) {
      analysis.focus_suggestion = generateFallbackAnalysis(content).focus_suggestion;
    }

    // Wrap inside SimpleBraindumpAnalysisResult style (string response for now, to avoid frontend refactor)
    return NextResponse.json({ response: JSON.stringify(analysis) });
  } catch (e: any) {
    console.error('Analyze endpoint error:', e);
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}

async function getExistingCategories(): Promise<string[]> {
  // TODO: fetch distinct categories from tasks table once user auth integrated
  return ['work', 'personal', 'admin'];
}

// Rate limiting state
let lastApiCall = 0;
const MIN_API_INTERVAL = 2000; // 2 seconds between API calls


/**
 * Ben-created (no AI) version of braindump analysis using newer model of Google Gemini AI
 * @param content user input
 * @returns analysis result
 */
async function generateBraindumpAnalysis(content: string) {
  const ai = new GoogleGenAI({});

  // Combine prompt instructions with parsed user content
  let current_prompt = prompt1 + content;

  // Provide user-specific context in instructions
  let current_instructions = instructions1.replace("{existing_categories}", "['Music', 'Work', 'Personal', 'Home']");

  // (Optional) Provide output schema via system instructions
  // current_instructions.concat(JSON.stringify(output_schema1))

  // Step 1: classify input list.
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: current_prompt,
    config: {
      systemInstruction: current_instructions,
      thinkingConfig: {
        thinkingBudget: 0, // Disables thinking
      },
    }
  });

  // TODO: this response should be sent back to the front end to be displayed in an interactive format for the user to drag & drop
  console.log(response.text);

  return response.text;
}





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
    console.log(data);
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
