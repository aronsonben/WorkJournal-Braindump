'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { StoryElements } from './story-elements';
import { SmartTip } from './smart-tip';

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

export function EntryInput({ onSave }: { onSave: () => void }) {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState(false);
  const [generatingAnalysis, setGeneratingAnalysis] = useState(false);
  const [analysis, setAnalysis] = useState<ComprehensiveAnalysis | null>(null);
  const [showTip, setShowTip] = useState(false);
  const [savedTip, setSavedTip] = useState<string | null>(null);

  // Generate comprehensive analysis as user types
  useEffect(() => {
    const debounceTimeout = setTimeout(async () => {
      if (content.trim().length > 20 && !generatingAnalysis) {
        setGeneratingAnalysis(true);
        try {
          const response = await fetch('/api/generate-tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
          });
          
          if (response.ok) {
            const analysisData: ComprehensiveAnalysis = await response.json();
            setAnalysis(analysisData);
          }
        } catch (error) {
          console.error('Failed to generate analysis:', error);
        }
        setGeneratingAnalysis(false);
      } else if (content.trim().length <= 20) {
        setAnalysis(null);
      }
    }, 1500);

    return () => clearTimeout(debounceTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]); // Only depend on content to prevent infinite loop with generatingAnalysis

  async function saveEntry() {
    if (!content.trim()) return;
    
    setSaving(true);
    
    try {
      // Use existing analysis or generate final one
      let finalAnalysis = analysis;
      if (!finalAnalysis && content.trim().length > 10) {
        const response = await fetch('/api/generate-tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
        
        if (response.ok) {
          finalAnalysis = await response.json();
        }
      }

      const { error } = await supabase
        .from('entries')
        .insert({
          content,
          word_count: content.split(/\s+/).length,
          ...(finalAnalysis?.tags && finalAnalysis.tags.length > 0 && { tags: finalAnalysis.tags }),
        });

      if (!error) {
        // Show smart tip after saving
        if (finalAnalysis?.suggested_tip) {
          setSavedTip(finalAnalysis.suggested_tip);
          setShowTip(true);
        }
        
        setContent('');
        setAnalysis(null);
        onSave();
      }
    } catch (error) {
      console.error('Failed to save entry:', error);
    }
    
    setSaving(false);
  }

  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const charCount = content.length;

  return (
    <div className="space-y-4">
      {/* Smart Tip - Shows after saving */}
      <SmartTip
        suggested_tip={savedTip}
        show={showTip}
        onDismiss={() => {
          setShowTip(false);
          setSavedTip(null);
        }}
      />

      {/* Story Elements & Depth Indicator - Combined minimal design */}
      {(content.trim().length > 20 || generatingAnalysis) && (
        <StoryElements
          detected_elements={analysis?.detected_elements || null}
          depth_score={analysis?.depth_score || null}
          tags={analysis?.tags || []}
          loading={generatingAnalysis}
        />
      )}

      <div className={`
        relative rounded-2xl border-2 transition-all duration-200 overflow-hidden
        ${focused ? 'border-[#15c460] shadow-xl shadow-[#15c460]/10' : 'border-gray-700'}
      `}>
        <textarea
          className="w-full p-6 bg-gray-800 text-gray-100 rounded-t-2xl resize-none focus:outline-none text-lg leading-relaxed placeholder-gray-400"
          rows={8}
          placeholder="Start writing about your work day..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        
        {/* Character count bar (Grammarly style) */}
        <div className="px-6 py-4 bg-gray-850 border-t border-gray-700">
          <div className="flex justify-between items-center">
            <div className="flex gap-4 text-sm text-gray-400">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#15c460] rounded-full"></span>
                {wordCount} words
              </span>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
                {charCount} characters
              </span>
            </div>
            <button
              onClick={saveEntry}
              disabled={saving || !content.trim()}
              className="px-6 py-3 bg-[#15c460] text-white rounded-xl hover:bg-[#12a855] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span>✨</span>
                  Save Entry
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}