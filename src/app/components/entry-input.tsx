'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export function EntryInput({ onSave }: { onSave: () => void }) {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState(false);
  const [generatingTags, setGeneratingTags] = useState(false);
  const [previewTags, setPreviewTags] = useState<string[]>([]);

  // Generate tags preview as user types - using useEffect directly to avoid callback dependency issues
  useEffect(() => {
    const debounceTimeout = setTimeout(async () => {
      if (content.trim().length > 20 && !generatingTags) {
        setGeneratingTags(true);
        try {
          const response = await fetch('/api/generate-tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
          });
          
          if (response.ok) {
            const { tags } = await response.json();
            setPreviewTags(tags || []);
          }
        } catch (error) {
          console.error('Failed to generate tags preview:', error);
        }
        setGeneratingTags(false);
      } else if (content.trim().length <= 20) {
        setPreviewTags([]);
      }
    }, 1500); // Increased debounce to 1.5 seconds to reduce API calls

    return () => clearTimeout(debounceTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]); // Only depend on content to prevent infinite loops

  async function saveEntry() {
    if (!content.trim()) return;
    
    setSaving(true);
    
    try {
      // Generate final tags for saving
      let finalTags = previewTags;
      if (finalTags.length === 0 && content.trim().length > 10) {
        const response = await fetch('/api/generate-tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
        
        if (response.ok) {
          const { tags } = await response.json();
          finalTags = tags || [];
        }
      }

      const { error } = await supabase
        .from('entries')
        .insert({
          content,
          word_count: content.split(/\s+/).length,
          ...(finalTags.length > 0 && { tags: finalTags }),
        });

      if (!error) {
        setContent('');
        setPreviewTags([]);
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
        
        {/* Tags Preview */}
        {(previewTags.length > 0 || generatingTags) && (
          <div className="px-6 py-3 bg-gray-700 border-t border-gray-600">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-400">AI Tags:</span>
              {generatingTags ? (
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-gray-500 border-t-[#15c460] rounded-full animate-spin" />
                  <span className="text-gray-400">Generating...</span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {previewTags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-[#15c460]/20 text-[#15c460] rounded-md text-xs font-medium border border-[#15c460]/30"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        
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