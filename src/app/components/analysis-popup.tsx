'use client';

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

interface AnalysisPopupProps {
  analysis: ComprehensiveAnalysis | null;
  show: boolean;
  onEnhance: () => void;
  onSaveAsIs: () => void;
  onClose: () => void;
  wordCount: number;
}

export function AnalysisPopup({ 
  analysis, 
  show, 
  onEnhance, 
  onSaveAsIs, 
  onClose, 
  wordCount 
}: AnalysisPopupProps) {
  if (!show || !analysis) return null;

  const depthLevel = getDepthLevel(analysis.depth_score);
  const progressWidth = Math.min(100, (analysis.depth_score / 100) * 100);

  function getDepthLevel(score: number) {
    if (score >= 80) return { emoji: '🌳', label: 'Portfolio-Ready', color: 'text-emerald-400' };
    if (score >= 60) return { emoji: '🌿', label: 'Growing', color: 'text-green-400' };
    if (score >= 40) return { emoji: '🌱', label: 'Developing', color: 'text-yellow-400' };
    return { emoji: '🌰', label: 'Seed', color: 'text-orange-400' };
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl border border-gray-700 max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex justify-between items-start">
            <h3 className="text-xl font-semibold text-white">Entry Analysis</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Story Elements */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">Story Elements Captured:</h4>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(analysis.detected_elements).map(([element, detected]) => (
                <div key={element} className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                    detected ? 'bg-[#15c460] text-white' : 'bg-gray-600 text-gray-400'
                  }`}>
                    {detected ? '✓' : '○'}
                  </span>
                  <span className="text-sm text-gray-300 capitalize">
                    {element}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Entry Depth */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">Entry Depth:</h4>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl">{depthLevel.emoji}</span>
              <span className={`font-medium ${depthLevel.color}`}>
                {depthLevel.label}
              </span>
              <span className="text-sm text-gray-400">({wordCount} words)</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 mb-1">
              <div 
                className="bg-gradient-to-r from-[#15c460] to-emerald-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressWidth}%` }}
              />
            </div>
            <div className="text-xs text-gray-500">
              Score: {analysis.depth_score}/100
            </div>
          </div>

          {/* Tags */}
          {analysis.tags.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2">Generated Tags:</h4>
              <div className="flex flex-wrap gap-2">
                {analysis.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-[#15c460]/10 text-[#15c460] rounded-md text-xs font-medium border border-[#15c460]/20"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Enhancement Suggestion */}
          {analysis.suggested_tip && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <h4 className="text-sm font-medium text-blue-400 mb-2 flex items-center gap-2">
                💡 Optional Enhancement:
              </h4>
              <p className="text-sm text-gray-300 leading-relaxed">
                {analysis.suggested_tip}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-700 space-y-3">
          <div className="flex gap-3">
            <button
              onClick={onSaveAsIs}
              className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all duration-200 text-sm font-medium"
            >
              Save As Is
            </button>
            <button
              onClick={onEnhance}
              className="flex-1 px-4 py-3 bg-[#15c460] hover:bg-[#12a855] text-white rounded-lg transition-all duration-200 text-sm font-medium"
            >
              Enhance Entry
            </button>
          </div>
          
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input type="checkbox" className="rounded border-gray-600" />
            Skip analysis next time
          </label>
        </div>
      </div>
    </div>
  );
}
