'use client';

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { SmartTip } from './smart-tip';
import { AnalysisPopup } from './analysis-popup';
import { useWhisper } from './useWhisper';
import { Mic } from '@mui/icons-material';

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
  const [showAnalysisPopup, setShowAnalysisPopup] = useState(false);
  const [analysis, setAnalysis] = useState<ComprehensiveAnalysis | null>(null);
  const [showTip, setShowTip] = useState(false);
  const [savedTip, setSavedTip] = useState<string | null>(null);
  const [entryStatus, setEntryStatus] = useState<'in_progress' | 'completed'>('in_progress');

  // Whisper hook for live voice captioning
  const whisper = useWhisper();

  // Initialize Whisper on component mount
  useEffect(() => {
    if (!whisper.isModelReady && !whisper.isModelLoading && !whisper.error) {
      whisper.initializeModel();
    }
  }, [whisper]);

  const toggleRecording = useCallback(async () => {
    if (whisper.isRecording) {
      const transcript = await whisper.stopRecording();
      if (transcript) {
        setContent(prev => {
          const cleaned = transcript.trim();
          return prev + (prev ? ' ' : '') + cleaned;
        });
        whisper.clearTranscript();
      }
    } else {
      await whisper.startRecording();
    }
  }, [whisper]);

  // Word count calculation
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

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
          tags: finalAnalysis?.tags || [],
          status: entryStatus
        });

      if (error) throw error;

      // Show tip if analysis provided one
      if (finalAnalysis?.suggested_tip) {
        setSavedTip(finalAnalysis.suggested_tip);
        setShowTip(true);
        setTimeout(() => setShowTip(false), 5000);
      }

      setContent('');
      setEntryStatus('in_progress');
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

      <div className="relative bg-gray-800/90 overflow-hidden transition-all focus-within:ring-2 focus-within:ring-[#15c460]">
        <textarea
          className="w-full p-6 bg-transparent text-gray-100 resize-none focus:outline-none text-base md:text-lg leading-relaxed placeholder-gray-500 font-medium"
          rows={8}
          placeholder="Start writing about your work day..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        
        {/* Live transcript overlay - shows what's being captured */}
        {(whisper.isRecording || whisper.isTranscribing || whisper.transcript || whisper.error || whisper.isModelLoading) && (
          <div className="absolute bottom-16 left-0 right-0 px-6">
            <div className="bg-blue-900/80 backdrop-blur-sm rounded-lg p-3 border border-blue-600/50">
              <div className="text-xs text-blue-300 font-medium mb-1 flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full ${whisper.error ? 'bg-yellow-400 animate-ping' : whisper.isRecording ? 'bg-red-500 animate-pulse' : 'bg-blue-400'}`}></span>
                {whisper.error ? 'Whisper load failed' : 'Whisper AI Live Captioning'}
                {whisper.isTranscribing && ' - Processing...'}
              </div>
              {whisper.isModelLoading && (
                <div className="mb-2">
                  <div className="h-1.5 w-full bg-blue-950/60 rounded overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 transition-all" style={{ width: `${Math.round(whisper.loadingProgress * 100)}%` }} />
                  </div>
                  <div className="text-[10px] mt-1 text-blue-300 tracking-wide">Loading model {Math.round(whisper.loadingProgress * 100)}%</div>
                </div>
              )}
              {whisper.error && !whisper.isModelLoading && (
                <div className="text-xs text-yellow-300 flex items-center justify-between gap-3">
                  <span>{whisper.error}</span>
                  <button
                    onClick={() => whisper.initializeModel()}
                    className="px-2 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/40 rounded text-yellow-200 text-[10px] font-semibold"
                  >RETRY</button>
                </div>
              )}
              {!whisper.error && (
                <div className="text-sm text-blue-100 min-h-[1.25rem]">
                  {whisper.isTranscribing ? (
                    <span className="text-blue-300 italic">🔄 AI is processing audio...</span>
                  ) : whisper.transcript ? (
                    whisper.transcript
                  ) : whisper.isRecording ? (
                    <span className="text-blue-300/60 italic">Listening...</span>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="px-6 py-4 flex flex-col gap-3 md:flex-row md:justify-between md:items-center">
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>
              {whisper.error && !whisper.isModelLoading && '⚠️ Whisper failed'}
              {!whisper.error && (
                whisper.isModelReady ? (
                  whisper.isRecording ? '🔴 Recording…' : (whisper.isModelLoading ? '⏳ Loading Whisper…' : '')
                ) : whisper.isModelLoading ? '⏳ Loading Whisper…' : '🤖 Preparing…'
              )}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Status Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Status:</span>
              <select
                value={entryStatus}
                onChange={(e) => setEntryStatus(e.target.value as 'in_progress' | 'completed')}
                className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#15c460]/50"
              >
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            
            <button
              onClick={toggleRecording}
              disabled={whisper.isTranscribing || !whisper.isModelReady || !!whisper.error || whisper.isModelLoading}
              className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                whisper.isRecording
                  ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                  : whisper.isTranscribing
                  ? 'bg-yellow-600 text-white cursor-not-allowed'
                  : whisper.isModelLoading
                    ? 'bg-gray-700 text-gray-400 cursor-wait'
                    : whisper.error
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
              }`}
              title={
                whisper.isTranscribing ? 'AI is processing...' :
                whisper.isRecording ? 'Stop recording' : 
                'Start voice recording'
              }
            >
              {whisper.isTranscribing ? '⏳ AI' : 
               whisper.isRecording ? '⏹️ STOP' : 
               whisper.isModelLoading ? '⏳ INIT' : <Mic fontSize="small" />}
            </button>
            
            <button
              onClick={handleSaveClick}
              disabled={saving || !content.trim()}
              className="px-6 py-2 bg-[#15c460] hover:bg-[#11a652] text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  SAVING
                </span>
              ) : (
                <span className="flex items-center gap-2">✨ SAVE</span>
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
