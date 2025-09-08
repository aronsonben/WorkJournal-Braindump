'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { SmartTip } from './smart-tip';
import { AnalysisPopup } from './analysis-popup';

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
  const [showAnalysisPopup, setShowAnalysisPopup] = useState(false);
  const [analysis, setAnalysis] = useState<ComprehensiveAnalysis | null>(null);
  const [showTip, setShowTip] = useState(false);
  const [savedTip, setSavedTip] = useState<string | null>(null);

  // Word count calculation (local only, no API calls)
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const charCount = content.length;

  async function handleSaveClick() {
    if (!content.trim()) return;
    
    setSaving(true);
    
    try {
      // Generate analysis for the popup
      const response = await fetch('/api/generate-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      
      if (response.ok) {
        const analysisData: ComprehensiveAnalysis = await response.json();
        setAnalysis(analysisData);
        setShowAnalysisPopup(true);
      } else {
        // If analysis fails, save directly
        await saveEntryDirectly();
      }
    } catch (error) {
      console.error('Failed to generate analysis:', error);
      // If analysis fails, save directly
      await saveEntryDirectly();
    }
    
    setSaving(false);
  }

  async function saveEntryDirectly(finalAnalysis?: ComprehensiveAnalysis) {
    try {
      const { error } = await supabase
        .from('entries')
        .insert({
          content,
          word_count: wordCount,
          tags: finalAnalysis?.tags || []
        });

      if (error) throw error;

      // Show tip if analysis provided one
      if (finalAnalysis?.suggested_tip) {
        setSavedTip(finalAnalysis.suggested_tip);
        setShowTip(true);
        setTimeout(() => setShowTip(false), 5000);
      }

      setContent('');
      setAnalysis(null);
      setShowAnalysisPopup(false);
      onSave();
    } catch (error) {
      console.error('Error saving entry:', error);
    }
  }

  function handleEnhanceEntry() {
    // Keep analysis and close popup, return to editing
    setShowAnalysisPopup(false);
  }

  function handleSaveAsIs() {
    // Save with current analysis
    saveEntryDirectly(analysis || undefined);
  }

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

      {/* Story Elements removed - now shown in analysis popup on save */}

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
              onClick={handleSaveClick}
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

      {/* Analysis Popup */}
      <AnalysisPopup
        analysis={analysis}
        show={showAnalysisPopup}
        onEnhance={handleEnhanceEntry}
        onSaveAsIs={handleSaveAsIs}
        onClose={() => setShowAnalysisPopup(false)}
        wordCount={wordCount}
      />
    </div>
  );
}