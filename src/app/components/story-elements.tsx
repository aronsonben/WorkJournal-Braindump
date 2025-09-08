'use client';

interface StoryElementsProps {
  detected_elements: {
    context: boolean;
    challenge: boolean;
    action: boolean;
    impact: boolean;
  } | null;
  depth_score?: number | null;
  tags?: string[];
  loading?: boolean;
}

interface ElementBadge {
  key: 'context' | 'challenge' | 'action' | 'impact';
  icon: string;
  label: string;
}

const STORY_ELEMENTS: ElementBadge[] = [
  {
    key: 'context',
    icon: '📍',
    label: 'Context'
  },
  {
    key: 'challenge',
    icon: '🎯',
    label: 'Challenge'
  },
  {
    key: 'action',
    icon: '⚡',
    label: 'Action'
  },
  {
    key: 'impact',
    icon: '✨',
    label: 'Impact'
  }
];

export function StoryElements({ detected_elements, depth_score, tags, loading }: StoryElementsProps) {
  if (loading) {
    return (
      <div className="mb-4 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Analyzing entry...</span>
          <div className="w-3 h-3 border-2 border-gray-500 border-t-[#15c460] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!detected_elements && !depth_score && (!tags || tags.length === 0)) {
    return null;
  }

  const detectedCount = detected_elements ? Object.values(detected_elements).filter(Boolean).length : 0;
  const progressPercent = depth_score ? Math.max(5, depth_score) : 0;

  return (
    <div className="mb-4 space-y-2">
      {/* Tags Row */}
      {tags && tags.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {tags.map((tag: string, index: number) => (
              <span
                key={index}
                className="px-2 py-1 bg-[#15c460]/20 text-[#15c460] rounded-md text-xs font-medium border border-[#15c460]/30"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Story Elements Row */}
      {detected_elements && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {STORY_ELEMENTS.map((element) => {
              const isDetected = detected_elements[element.key];
              return (
                <div key={element.key} className="flex items-center gap-1">
                  <span className={isDetected ? 'text-[#15c460]' : 'text-gray-600'}>
                    {isDetected ? '✓' : '○'}
                  </span>
                  <span className={`text-xs ${isDetected ? 'text-[#15c460]' : 'text-gray-500'}`}>
                    {element.label}
                  </span>
                </div>
              );
            })}
          </div>
          <span className="text-xs text-gray-500">
            {detectedCount}/4 captured
          </span>
        </div>
      )}

      {/* Progress Indicator Row */}
      {depth_score !== null && depth_score !== undefined && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs text-gray-400">Depth:</span>
            <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  depth_score <= 25 ? 'bg-gradient-to-r from-green-500 to-green-400' :
                  depth_score <= 50 ? 'bg-gradient-to-r from-green-400 to-green-400' :
                  depth_score <= 75 ? 'bg-gradient-to-r from-[#15c460] to-green-400' :
                  'bg-gradient-to-r from-[#15c460] to-[#0ea44c]'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <span className="text-xs text-gray-500 ml-2">
            {depth_score <= 25 ? 'Building momentum' :
             depth_score <= 50 ? 'Growing stronger' :
             depth_score <= 75 ? 'Rich details' :
             'Full story captured'}
          </span>
        </div>
      )}
    </div>
  );
}
