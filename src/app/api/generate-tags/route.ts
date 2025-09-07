import { NextRequest, NextResponse } from 'next/server';

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
      // Use LLM to generate personalized tags
      const tags = await generateTagsWithLLM(content);
      return NextResponse.json({ tags });
    } catch (llmError) {
      console.error('LLM error, using fallback:', llmError);
      // Fallback to simple keyword-based tags if LLM fails
      const fallbackTags = generateFallbackTags(content);
      return NextResponse.json({ tags: fallbackTags });
    }
  } catch (error) {
    console.error('Error generating tags:', error);
    return NextResponse.json(
      { error: 'Failed to generate tags' },
      { status: 500 }
    );
  }
}

async function generateTagsWithLLM(content: string): Promise<string[]> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  
  if (!GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY not found, using fallback tags');
    return generateFallbackTags(content);
  }

  const availableTags = [
    // Technology & Development
    'frontend', 'backend', 'mobile', 'devops', 'database', 'ai-ml', 'api', 'ui-ux',
    
    // Work Activities
    'coding', 'debugging', 'code-review', 'testing', 'planning', 'meeting', 'standup',
    'documentation', 'refactoring', 'deployment', 'research', 'learning',
    
    // Project & Management
    'feature-development', 'bug-fix', 'maintenance', 'optimization', 'architecture',
    'collaboration', 'client-work', 'deadline', 'milestone',
    
    // Productivity & Mood
    'productive', 'focused', 'challenging', 'breakthrough', 'blocked', 'frustrated',
    'motivated', 'creative', 'problem-solving', 'experimental',
    
    // Context & Priority
    'urgent', 'routine', 'strategic', 'innovative', 'critical', 'improvement',
    'analysis', 'decision-making', 'team-building'
  ];

  const prompt = `
Analyze this work journal entry and categorize it with 3-4 most relevant tags from the provided list.

Work Journal Entry:
"${content}"

Available Tags:
${availableTags.join(', ')}

Rules:
- Select 3-4 tags that best describe the content, activities, technologies, and mood
- Prioritize specific technical tags over general ones
- Consider the emotional tone and productivity level
- Focus on actionable work activities
- Return only the tag names, separated by commas
- Do not add any extra text or explanations

Tags:`;

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
          temperature: 0.3,
          maxOutputTokens: 100,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
      throw new Error('No content generated from Gemini');
    }

    // Parse the generated tags
    const tags = generatedText
      .trim()
      .split(',')
      .map((tag: string) => tag.trim().toLowerCase())
      .filter((tag: string) => availableTags.includes(tag))
      .slice(0, 4);

    return tags.length > 0 ? tags : generateFallbackTags(content);
    
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return generateFallbackTags(content);
  }
}

function generateFallbackTags(content: string): string[] {
  const text = content.toLowerCase();
  const tags: string[] = [];

  // Simple keyword matching as fallback
  const keywordMap = {
    'frontend': ['react', 'vue', 'angular', 'html', 'css', 'javascript', 'ui'],
    'backend': ['api', 'server', 'database', 'node', 'python', 'backend'],
    'debugging': ['debug', 'bug', 'error', 'fix', 'issue'],
    'meeting': ['meeting', 'call', 'standup', 'sync'],
    'productive': ['completed', 'finished', 'accomplished'],
    'challenging': ['difficult', 'hard', 'struggle', 'complex'],
    'learning': ['learned', 'research', 'study', 'new']
  };

  Object.entries(keywordMap).forEach(([tag, keywords]) => {
    if (keywords.some(keyword => text.includes(keyword))) {
      tags.push(tag);
    }
  });

  return tags.slice(0, 3);
}
