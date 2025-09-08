import { NextRequest, NextResponse } from 'next/server';
import { supabase, Entry } from '../../../lib/supabase';

// Configure route segment
export const maxDuration = 15; // 15 seconds timeout for analysis

interface MorningSummaryResponse {
  summary: string;
  main_themes: string[];
  past_accomplishments: string[];
  way_ahead: string[];
  pattern_insight: string;
  gentle_nudge: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    
    // Fetch recent entries
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const { data: entries, error } = await supabase
      .from('entries')
      .select('*')
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching entries:', error);
      return NextResponse.json(
        { error: 'Failed to fetch entries' },
        { status: 500 }
      );
    }

    if (!entries || entries.length === 0) {
      return NextResponse.json({
        summary: "Welcome to a fresh start! No recent entries to analyze, but every great journey begins with a single step.",
        main_themes: [],
        momentum_items: [],
        attention_needed: ["Start documenting your work journey"],
        pattern_insight: "New beginnings are opportunities to establish great habits.",
        gentle_nudge: "Consider adding your first entry to capture today's focus."
      });
    }

    // Generate analysis using LLM
    const analysis = await generateMorningSummary(entries, days);
    return NextResponse.json(analysis);

  } catch (error) {
    console.error('Error generating morning summary:', error);
    return NextResponse.json(
      { error: 'Failed to generate morning summary' },
      { status: 500 }
    );
  }
}

// Rate limiting state
let lastApiCall = 0;
const MIN_API_INTERVAL = 3000; // 3 seconds between API calls

async function generateMorningSummary(entries: Entry[], days: number): Promise<MorningSummaryResponse> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  
  if (!GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY not found, using fallback summary');
    return generateFallbackSummary(entries, days);
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

  const currentDateTime = new Date().toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  // Format entries for analysis with more detailed content analysis
  const formattedEntries = entries.map((entry, index) => {
    const entryDate = new Date(entry.created_at);
    return {
      entry_number: index + 1,
      date: entryDate.toLocaleDateString(),
      day: entryDate.toLocaleDateString('en-US', { weekday: 'long' }),
      time_ago: `${Math.floor((Date.now() - entryDate.getTime()) / (1000 * 60 * 60 * 24))} days ago`,
      content: entry.content, // This is the key field with their actual documented work
      tags: entry.tags || [],
      word_count: entry.word_count,
      content_preview: entry.content.substring(0, 200) + (entry.content.length > 200 ? '...' : '')
    };
  });

  const totalWords = entries.reduce((sum, e) => sum + (e.word_count || 0), 0);

  const prompt = `
You are analyzing work journal entries to create a personalized morning momentum summary. Be encouraging, insightful, and conversational.

CONTEXT:
- Current day and time: ${currentDateTime}
- Analysis period: ${days} days
- Total entries: ${entries.length}
- Total words documented: ${totalWords}

USER'S ACTUAL WORK JOURNAL ENTRIES (MOST RECENT FIRST):
${formattedEntries.map(entry => `
Entry ${entry.entry_number} (${entry.day}, ${entry.date} - ${entry.time_ago}):
"${entry.content}"
Tags: [${entry.tags.join(', ')}]
Word count: ${entry.word_count}
`).join('\n')}

COMPREHENSIVE ANALYSIS REQUIRED:

Read through ALL the actual content above. These are their real documented work experiences, challenges, and progress. Your analysis must be based on what they actually wrote, not generic assumptions.

1. WORK CONTINUITY ANALYSIS:
- What specific projects/systems/technologies do they mention across multiple entries?
- Which work items show clear progression vs those that seem stalled?
- What challenges did they document that don't have follow-up resolutions?
- What work threads started but haven't been mentioned recently?

2. MOMENTUM & ENERGY PATTERNS:
- Where do they express satisfaction, breakthrough moments, or flow states?
- What types of work seem to energize them vs drain them?
- Are there patterns in their problem-solving approaches?
- What accomplishments are they proud of?

3. FORWARD-LOOKING ACTION ITEMS (Way Ahead):
- Based on their current work, what are 3-5 specific tasks they should tackle today?
- What immediate next steps would move their projects forward?
- What decisions need to be made to unblock progress?
- What specific problems need solutions today?
- What follow-ups or communications are needed?
- Focus on TODAY'S actionable items, not general future goals

4. WORK-LIFE BALANCE SIGNALS:
- Do they mention breaks, rest, or non-work activities?
- What stress indicators appear in their language?
- Are they working sustainable hours based on their entries?
- Do they mention health, exercise, or personal interests?

5. LEARNING & GROWTH:
- What new technologies, concepts, or skills did they encounter?
- What mistakes or failures did they document and learn from?
- What expertise are they building?

GENERATE PERSONALIZED OUTPUT:

Create a natural, conversational summary that:
1. References their SPECIFIC work (exact project names, technologies, features they mentioned)
2. Acknowledges concrete progress and accomplishments they documented
3. Identifies 3-5 SPECIFIC action items for today based on their actual entries
4. Provides actionable suggestions based on patterns in their work
5. Offers specific wellness/balance advice if stress indicators are present

TONE: Write as a knowledgeable colleague who has been closely following their work and wants to help them succeed.

CRITICAL REQUIREMENTS:
- Every insight must reference specific content from their entries
- Action items should be concrete and immediately actionable
- No generic advice - everything should be personalized to their actual work
- Include specific project names, technologies, features they mentioned
- Reference exact challenges, todos, or dependencies they documented

OUTPUT FORMAT (return ONLY valid JSON):
{
  "summary": "2-3 sentences referencing their specific projects, technologies, and recent accomplishments by name",
  "main_themes": ["specific project names", "exact technologies used", "particular features or systems worked on"],
  "momentum_items": ["specific ongoing projects showing progress", "particular technologies they're mastering", "exact features or improvements they're building"],
  "attention_needed": ["actionable next steps for today", "specific problems to solve", "particular decisions to make", "exact tasks to complete", "follow-ups to pursue"],
  "pattern_insight": "One specific insight about their work patterns, productivity rhythms, or approach based on their actual entries",
  "gentle_nudge": "Specific wellness advice based on stress indicators, work hours, or balance issues observed in their entries, or null if balance seems good"
}

Example of GOOD specificity:
- Bad: "Continue working on frontend development"  
- Good: "Continue building the React dashboard component you started, especially the data visualization feature you mentioned struggling with"

- Bad: "Address technical challenges"
- Good: "Debug the API authentication issue you mentioned yesterday that's blocking the user login flow"

Remember: If you can't be specific because their entries lack detail, acknowledge that limitation rather than making assumptions.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 second timeout
    
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
          temperature: 0.7, // Slightly higher for more conversational tone
          maxOutputTokens: 800,
        }
      })
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 429) {
        console.log('Rate limited, using fallback summary');
        return generateFallbackSummary(entries, days);
      }
      throw new Error(`Gemini API error: ${response.status}`);
    }

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

    try {
      const analysis: MorningSummaryResponse = JSON.parse(generatedText);
      
      // Validate structure
      if (!analysis.summary || !Array.isArray(analysis.main_themes)) {
        throw new Error('Invalid response structure');
      }

      return analysis;
      
    } catch (parseError) {
      console.error('Error parsing Gemini JSON response:', parseError);
      console.error('Raw response:', generatedText);
      return generateFallbackSummary(entries, days);
    }
    
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    // If it's a rate limit or timeout, gracefully fall back
    if (error instanceof Error && (error.message.includes('429') || error.name === 'AbortError')) {
      console.log('Using fallback due to rate limit or timeout');
    }
    return generateFallbackSummary(entries, days);
  }
}

function generateFallbackSummary(entries: Entry[], days: number): MorningSummaryResponse {
  const totalEntries = entries.length;
  const recentTags = [...new Set(entries.flatMap(e => e.tags || []))];
  const averageWordCount = Math.round(entries.reduce((sum, e) => sum + (e.word_count || 0), 0) / totalEntries);
  const totalWords = entries.reduce((sum, e) => sum + (e.word_count || 0), 0);
  
  // Extract specific details from recent entries
  const recentEntries = entries.slice(0, Math.min(5, entries.length));
  const specificInsights = extractSpecificInsights(recentEntries);
  
  // Analyze actual content patterns
  const allContent = entries.map(e => e.content.toLowerCase()).join(' ');
  const contentAnalysis = analyzeContentPatterns(allContent);
  
  // Time-based analysis
  const entriesByDay = groupEntriesByDay(entries);
  const hasConsistentActivity = totalEntries >= days * 0.4; // At least 40% coverage
  const isVerbose = averageWordCount > 30;
  
  // Generate specific insights based on content
  const themes = specificInsights.themes.length > 0 ? specificInsights.themes : contentAnalysis.themes.slice(0, 3);
  const momentum = specificInsights.momentum.length > 0 ? specificInsights.momentum : contentAnalysis.momentum;
  const wayAhead = specificInsights.wayAhead.length > 0 ? specificInsights.wayAhead : [
    'Review recent progress and identify next priorities',
    'Continue building on established momentum', 
    'Plan specific tasks for immediate execution'
  ];
  
  let summary = `You've documented ${totalEntries} entries over the past ${days} days (${totalWords} words total), `;
  if (hasConsistentActivity) {
    summary += `showing strong consistency in capturing your work journey. `;
  } else {
    summary += `with opportunities to build more regular documentation habits. `;
  }
  
  if (specificInsights.specificWork.length > 0) {
    summary += `Recent focus includes ${specificInsights.specificWork.slice(0, 2).join(' and ')}.`;
  } else if (contentAnalysis.specificWork.length > 0) {
    summary += `Your focus areas include ${contentAnalysis.specificWork.slice(0, 2).join(' and ')}.`;
  } else if (isVerbose) {
    summary += `Your detailed entries show thoughtful reflection on your work.`;
  } else {
    summary += `Consider adding more detail to capture the full story of your progress.`;
  }
  
  return {
    summary,
    main_themes: themes.length > 0 ? themes : recentTags.slice(0, 3),
    past_accomplishments: momentum.length > 0 ? momentum : (hasConsistentActivity ? ['Consistent documentation habit'] : []),
    way_ahead: wayAhead.length > 0 ? wayAhead : ['Review recent work and plan next steps'],
    pattern_insight: generatePatternInsight(entries, entriesByDay, contentAnalysis),
    gentle_nudge: generateGentleNudge(entries, hasConsistentActivity, contentAnalysis)
  };
}

function extractSpecificInsights(entries: Entry[]) {
  const themes: string[] = [];
  const momentum: string[] = [];
  const attention: string[] = [];
  const specificWork: string[] = [];
  const todos: string[] = [];
  const wayAhead: string[] = [];
  
  // Extract specific mentions from recent entries
  entries.forEach(entry => {
    const content = entry.content.toLowerCase();
    const originalContent = entry.content;
    
    // Extract specific project/feature mentions (look for capitalized words, specific terms)
    const projectMatches = originalContent.match(/\b[A-Z][a-zA-Z]*(?:\s[A-Z][a-zA-Z]*)*\b/g) || [];
    projectMatches.forEach(match => {
      if (match.length > 2 && !['I', 'The', 'This', 'That', 'Today', 'Yesterday'].includes(match)) {
        if (!themes.includes(match.toLowerCase()) && themes.length < 5) {
          themes.push(match);
        }
      }
    });
    
    // Extract specific technologies
    const techTerms = ['react', 'vue', 'angular', 'node', 'python', 'javascript', 'typescript', 'api', 'database', 'sql', 'mongodb', 'postgres', 'docker', 'kubernetes', 'aws', 'azure', 'git'];
    techTerms.forEach(tech => {
      if (content.includes(tech) && !themes.includes(tech)) {
        themes.push(tech);
      }
    });
    
    // Extract TODO items and forward-looking actions
    const todoPatterns = [
      /need to ([^.!?]+)/gi,
      /should ([^.!?]+)/gi,
      /will ([^.!?]+)/gi,
      /todo:?\s*([^.!?\n]+)/gi,
      /next:?\s*([^.!?\n]+)/gi,
      /plan to ([^.!?]+)/gi,
      /going to ([^.!?]+)/gi
    ];
    
    todoPatterns.forEach(pattern => {
      const matches = originalContent.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const cleanTodo = match.replace(/^(need to|should|will|todo:?|next:?|plan to|going to)\s*/i, '').trim();
          if (cleanTodo.length > 5) {
            if (todos.length < 5) todos.push(cleanTodo);
            if (wayAhead.length < 5) wayAhead.push(`Follow up on: ${cleanTodo}`);
          }
        });
      }
    });

    // Generate actionable next steps based on recent work
    if (content.includes('debug') || content.includes('bug') || content.includes('error')) {
      wayAhead.push('Continue debugging and testing fixes');
    }
    if (content.includes('implement') || content.includes('build') || content.includes('develop')) {
      wayAhead.push('Complete current implementation tasks');
    }
    if (content.includes('review') || content.includes('pr') || content.includes('pull request')) {
      wayAhead.push('Address any review feedback and merge changes');
    }
    
    // Extract momentum items (positive progress indicators)
    const progressWords = ['completed', 'finished', 'deployed', 'launched', 'fixed', 'resolved', 'implemented', 'built', 'created', 'successful'];
    progressWords.forEach(word => {
      if (content.includes(word)) {
        // Try to extract what was completed
        const sentence = originalContent.split(/[.!?]/).find(s => s.toLowerCase().includes(word));
        if (sentence && momentum.length < 3) {
          momentum.push(sentence.trim());
        }
      }
    });
    
    // Extract attention items (problems, blockers) - past issues
    const problemWords = ['stuck', 'blocked', 'issue', 'problem', 'error', 'bug', 'failing', 'broken'];
    problemWords.forEach(word => {
      if (content.includes(word)) {
        const sentence = originalContent.split(/[.!?]/).find(s => s.toLowerCase().includes(word));
        if (sentence && attention.length < 3) {
          attention.push(sentence.trim());
        }
      }
    });
  });
  
  // Add general next steps if no specific todos found
  if (wayAhead.length === 0) {
    if (themes.includes('api') || themes.includes('backend')) {
      wayAhead.push('Continue API development and testing');
    }
    if (themes.includes('frontend') || themes.includes('react') || themes.includes('ui')) {
      wayAhead.push('Enhance user interface and user experience');
    }
    if (momentum.length > 0) {
      wayAhead.push('Build on recent momentum and continue current projects');
    }
    if (wayAhead.length === 0) {
      wayAhead.push('Review recent work and plan next development steps');
    }
  }
  
  return {
    themes: [...new Set(themes)].slice(0, 5),
    momentum: [...new Set(momentum)].slice(0, 3),
    attention: [...new Set(attention)].slice(0, 5),
    wayAhead: [...new Set(wayAhead)].slice(0, 5),
    specificWork: [...new Set([...themes, ...specificWork])].slice(0, 3)
  };
}

interface ContentAnalysis {
  themes: string[];
  momentum: string[];
  attention: string[];
  specificWork: string[];
}

function analyzeContentPatterns(allContent: string): ContentAnalysis {
  const themes: string[] = [];
  const momentum: string[] = [];
  const attention: string[] = [];
  const specificWork: string[] = [];
  
  // Technical themes
  if (/debug|bug|error|fix/.test(allContent)) themes.push('debugging');
  if (/test|testing|spec/.test(allContent)) themes.push('testing');
  if (/code|coding|develop|implement/.test(allContent)) themes.push('development');
  if (/review|pr|pull.?request/.test(allContent)) themes.push('code-review');
  if (/meeting|call|discuss/.test(allContent)) themes.push('collaboration');
  if (/deploy|release|ship/.test(allContent)) themes.push('deployment');
  if (/research|learn|explore/.test(allContent)) themes.push('learning');
  
  // Momentum indicators
  if (/accomplish|complete|finish|done|success/.test(allContent)) momentum.push('completing tasks');
  if (/progress|advance|improve/.test(allContent)) momentum.push('making steady progress');
  if (/flow|productive|focused/.test(allContent)) momentum.push('high productivity states');
  
  // Attention needed
  if (/stuck|blocked|difficult|challenge/.test(allContent)) attention.push('overcoming current blockers');
  if (/todo|need.?to|should|planning/.test(allContent)) attention.push('following up on planned items');
  if (/problem|issue|concern/.test(allContent)) attention.push('addressing documented issues');
  
  // Specific work areas
  if (/react|vue|angular|frontend/.test(allContent)) specificWork.push('frontend development');
  if (/api|server|backend|database/.test(allContent)) specificWork.push('backend systems');
  if (/mobile|ios|android/.test(allContent)) specificWork.push('mobile development');
  if (/ai|ml|machine.?learning/.test(allContent)) specificWork.push('AI/ML work');
  
  return { themes, momentum, attention, specificWork };
}

function groupEntriesByDay(entries: Entry[]) {
  const groups: { [key: string]: Entry[] } = {};
  entries.forEach(entry => {
    const day = new Date(entry.created_at).toDateString();
    if (!groups[day]) groups[day] = [];
    groups[day].push(entry);
  });
  return groups;
}

function generatePatternInsight(entries: Entry[], entriesByDay: { [key: string]: Entry[] }, contentAnalysis: ContentAnalysis): string {
  const dayCount = Object.keys(entriesByDay).length;
  const avgEntriesPerDay = entries.length / dayCount;
  const avgWordCount = entries.reduce((sum, e) => sum + (e.word_count || 0), 0) / entries.length;
  
  if (avgEntriesPerDay > 1.5) {
    return `You tend to document multiple times per day, showing strong reflection habits.`;
  } else if (avgWordCount > 50) {
    return `You write detailed entries averaging ${Math.round(avgWordCount)} words, capturing rich context.`;
  } else if (contentAnalysis.themes.length > 3) {
    return `Your work spans multiple domains, showing diverse technical engagement.`;
  } else if (dayCount >= 5) {
    return `You maintain consistent documentation across multiple days, building valuable work history.`;
  } else {
    return `Your documentation style is developing - each entry adds valuable insight.`;
  }
}

function generateGentleNudge(entries: Entry[], hasConsistentActivity: boolean, contentAnalysis: ContentAnalysis): string | null {
  const recentEntry = entries[0];
  const daysSinceLastEntry = Math.floor((Date.now() - new Date(recentEntry.created_at).getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysSinceLastEntry > 2) {
    return `It's been ${daysSinceLastEntry} days since your last entry - consider capturing what you've been working on.`;
  }
  
  if (!hasConsistentActivity) {
    return `Try setting a daily reminder to capture your work progress, even if it's just a quick note.`;
  }
  
  if (contentAnalysis.attention.length > 2) {
    return `You've noted several challenges - remember to document when you make progress on these items.`;
  }
  
  if (/stress|tired|overwhelm/.test(entries.map(e => e.content).join(' ').toLowerCase())) {
    return `Your entries mention some stress - don't forget to capture wins and breaks too.`;
  }
  
  return null;
}
