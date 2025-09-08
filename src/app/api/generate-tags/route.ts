import { NextRequest, NextResponse } from 'next/server';

// Configure route segment
export const maxDuration = 10; // 10 seconds timeout for Vercel

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required and must be a string' },
        { status: 400 }
      );
    }

    try {
      // Use LLM to generate comprehensive analysis
      const analysis = await generateComprehensiveAnalysis(content);
      return NextResponse.json(analysis);
    } catch (llmError) {
      console.error('LLM error, using fallback:', llmError);
      // Fallback to simple analysis if LLM fails
      const fallbackAnalysis = generateFallbackAnalysis(content);
      return NextResponse.json(fallbackAnalysis);
    }
  } catch (error) {
    console.error('Error generating analysis:', error);
    return NextResponse.json(
      { error: 'Failed to generate analysis' },
      { status: 500 }
    );
  }
}

interface ComprehensiveAnalysis {
  tags: string[];
  detected_elements: {
    context: boolean;
    challenge: boolean;
    action: boolean;
    impact: boolean;
  };
  entry_type: 'short' | 'problem' | 'achievement' | 'reflection' | 'routine';
  suggested_tip: string | null;
  depth_score: number;
}

async function generateComprehensiveAnalysis(content: string): Promise<ComprehensiveAnalysis> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  
  if (!GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY not found, using fallback analysis');
    return generateFallbackAnalysis(content);
  }

  const prompt = `
You are analyzing a work journal entry to help the user understand their documentation patterns. Be encouraging and recognize effort at any level.

Entry to analyze:
"${content}"

Analyze for these story elements:

CONTEXT (Setting/Background):
- Look for: WHERE this happened (project/system), WHO was involved, WHEN it occurred, WHAT situation led to this
- Examples: "working on the dashboard", "during sprint planning", "customer support ticket", "our React app"
- Be generous: Even mentioning a tool, meeting type, or general area counts

CHALLENGE (Problem/Need):
- Look for: WHY action was needed, WHAT needed solving, obstacles faced, goals to achieve
- Examples: "users complained", "needed to implement", "figured out how to", "requirement was"
- Be generous: Any mention of difficulty, need, or goal counts

ACTION (What was done):
- Look for: HOW they responded, WHAT steps they took, decisions made, work performed
- Examples: "I wrote", "debugged", "met with", "researched", "built", "helped"
- Be generous: Any verb describing work activity counts

IMPACT (Result/Outcome):
- Look for: WHAT changed, WHO benefited, lessons learned, progress made, feelings about outcome
- Examples: "it works now", "team was happy", "learned that", "finally done", "still broken"
- Be generous: Any outcome, even negative ones or reflections count

Entry Type Classification:
- short: Under 20 words or very brief
- problem: Focuses on challenges/issues without resolution
- achievement: Highlights success/completion
- reflection: Thoughts/feelings/learnings
- routine: Regular work update

Depth Score (0-100):
Consider: specificity, detail level, completeness, clarity
- 0-25: Very brief, minimal detail
- 26-50: Some context and detail
- 51-75: Good detail and clarity
- 76-100: Exceptional documentation with full story

Tags:
Generate 2-4 relevant tags based on the actual content, not generic categories.

Suggested Tip:
Provide ONE encouraging, specific tip based on what they wrote. Focus on:
- Celebrating what they DID capture
- Gently suggesting ONE thing that could add value
- Keep it conversational and optional

Return ONLY valid JSON:
{
  "tags": ["specific-tag-1", "specific-tag-2"],
  "detected_elements": {
    "context": true/false,
    "challenge": true/false,
    "action": true/false,
    "impact": true/false
  },
  "entry_type": "short|problem|achievement|reflection|routine",
  "suggested_tip": "encouraging message",
  "depth_score": 0-100
}

Remember: Be generous in detection. If something is even slightly present, mark it true. We want to encourage documentation, not critique it.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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

    if (!response.ok) {
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
      const analysis: ComprehensiveAnalysis = JSON.parse(generatedText);
      
      // Clean and validate tags (no hardcoded filtering, just format cleaning)
      analysis.tags = (analysis.tags || [])
        .map(tag => tag.toLowerCase().trim().replace(/\s+/g, '-'))
        .filter(tag => tag.length > 1 && tag.length < 20)
        .slice(0, 4);
      
      // Ensure all required fields exist
      if (!analysis.detected_elements) {
        analysis.detected_elements = { context: false, challenge: false, action: false, impact: false };
      }

      if (!analysis.entry_type) {
        analysis.entry_type = 'routine';
      }

      if (typeof analysis.depth_score !== 'number') {
        analysis.depth_score = Math.min(100, content.split(/\s+/).length * 1.2);
      }
      
      // If no tags generated, use semantic fallback
      if (analysis.tags.length === 0) {
        analysis.tags = generateSemanticFallbackTags(content);
      }

      return analysis;
      
    } catch (parseError) {
      console.error('Error parsing Gemini JSON response:', parseError);
      console.error('Raw response:', generatedText);
      return generateFallbackAnalysis(content);
    }
    
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return generateFallbackAnalysis(content);
  }
}

function generateFallbackAnalysis(content: string): ComprehensiveAnalysis {
  const text = content.toLowerCase();
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  
  // Generate semantic fallback tags
  const tags = generateSemanticFallbackTags(content);
  
  // Simple word-based detection without complex patterns - be generous!
  const detected_elements = {
    context: wordCount > 5, // Assume any decent entry has some context
    challenge: wordCount > 15, // Longer entries likely mention challenges/needs
    action: wordCount > 3, // Most entries describe some action
    impact: wordCount > 25 // Longer entries might include outcomes
  };
  
  // Determine entry type with more nuanced detection
  let entry_type: ComprehensiveAnalysis['entry_type'] = 'routine';
  if (wordCount < 50) {
    entry_type = 'short';
  } else if (detected_elements.challenge && !detected_elements.impact) {
    entry_type = 'problem';
  } else if (detected_elements.impact || /accomplished|finished|success|great|good|shipped|launched|released/.test(text)) {
    entry_type = 'achievement';
  } else if (/think|thought|feel|reflect|consider|realize|learn|understand|insight|perspective|wonder/.test(text)) {
    entry_type = 'reflection';
  }
  
  // Generate contextual tips based on content analysis
  let suggested_tip: string | null = null;
  const elementsCount = Object.values(detected_elements).filter(Boolean).length;
  
  if (elementsCount === 4) {
    suggested_tip = "⭐ Perfect! You've captured a complete STAR story - this is career portfolio material";
  } else if (entry_type === 'short' && !detected_elements.context) {
    suggested_tip = "💡 Consider adding which project or technology this relates to";
  } else if (detected_elements.challenge && !detected_elements.action) {
    suggested_tip = "� You've identified the challenge - what approach are you taking to solve it?";
  } else if (detected_elements.action && !detected_elements.impact) {
    suggested_tip = "📈 Great work! Consider noting the outcome or what this achievement unlocks";
  } else if (detected_elements.context && detected_elements.action && !detected_elements.challenge && !detected_elements.impact) {
    suggested_tip = "🎯 Nice progress update! Adding challenges faced or results achieved could make this shine";
  } else if (entry_type === 'problem' && !detected_elements.action) {
    suggested_tip = "🚀 Challenge noted! What steps are you taking to tackle this?";
  } else if (entry_type === 'achievement') {
    suggested_tip = "🏆 Excellent achievement! This demonstrates real impact and growth";
  } else if (entry_type === 'reflection') {
    suggested_tip = "🧠 Thoughtful reflection - these insights are valuable for your development";
  } else if (elementsCount >= 2) {
    suggested_tip = "✨ Good detail level! Your future self will appreciate this context";
  }
  
  return {
    tags,
    detected_elements,
    entry_type,
    suggested_tip,
    depth_score: Math.min(100, wordCount * 2)
  };
}

function generateSemanticFallbackTags(content: string): string[] {
  const text = content.toLowerCase();
  const tags: string[] = [];
  
  // Semantic analysis without hardcoded lists
  // Technical activities
  if (/debug|bug|error|fix|broken/.test(text)) tags.push('debugging');
  if (/test|testing|spec|unit|integration/.test(text)) tags.push('testing');
  if (/code|coding|implement|develop|write|program/.test(text)) tags.push('coding');
  if (/review|pr|pull.?request|merge/.test(text)) tags.push('code-review');
  if (/deploy|deployment|release|ship|launch/.test(text)) tags.push('deployment');
  if (/refactor|clean|organize|restructure/.test(text)) tags.push('refactoring');
  
  // Work context
  if (/meeting|call|standup|sync|discuss/.test(text)) tags.push('meeting');
  if (/plan|planning|design|architect/.test(text)) tags.push('planning');
  if (/research|investigate|explore|learn/.test(text)) tags.push('research');
  if (/document|doc|documentation|write.?up/.test(text)) tags.push('documentation');
  
  // Technology detection
  if (/react|vue|angular|frontend|ui|interface/.test(text)) tags.push('frontend');
  if (/api|server|backend|database|db/.test(text)) tags.push('backend');
  if (/mobile|ios|android|app/.test(text)) tags.push('mobile');
  if (/ai|ml|machine.?learning|neural/.test(text)) tags.push('ai-ml');
  
  // Emotional/productivity state
  if (/difficult|hard|struggle|complex|challenging/.test(text)) tags.push('challenging');
  if (/productive|efficient|focused|flow/.test(text)) tags.push('productive');
  if (/frustrated|stuck|blocked|slow/.test(text)) tags.push('blocked');
  if (/breakthrough|solved|success|accomplished/.test(text)) tags.push('breakthrough');
  if (/creative|innovative|idea|experiment/.test(text)) tags.push('creative');
  
  // Project phases
  if (/new.?feature|feature|build|develop/.test(text)) tags.push('feature-development');
  if (/bug.?fix|fix.?bug|repair/.test(text)) tags.push('bug-fix');
  if (/optimize|performance|improve|faster/.test(text)) tags.push('optimization');
  if (/maintain|update|upgrade|patch/.test(text)) tags.push('maintenance');
  
  // If no specific tags found, add some general semantic ones
  if (tags.length === 0) {
    const wordCount = content.split(/\s+/).length;
    if (wordCount > 100) tags.push('detailed-entry');
    if (/team|colleague|pair|together/.test(text)) tags.push('collaboration');
    if (/client|user|customer/.test(text)) tags.push('user-focused');
    if (tags.length === 0) tags.push('work-update');
  }
  
  return [...new Set(tags)].slice(0, 4); // Remove duplicates and limit to 4
}
