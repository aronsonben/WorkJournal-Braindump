export function parseBraindump(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);
}

export interface DuplicatePair { aIndex: number; bIndex: number; score: number }

// Extremely lightweight similarity heuristic (token overlap Jaccard)
export function detectDuplicates(lines: string[], threshold = 0.75): DuplicatePair[] {
  const results: DuplicatePair[] = [];
  const tokenized = lines.map(l => new Set(l.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)));
  for (let i=0;i<lines.length;i++) {
    for (let j=i+1;j<lines.length;j++) {
      const a = tokenized[i];
      const b = tokenized[j];
      let intersect = 0;
      a.forEach(t => { if (b.has(t)) intersect++; });
      const union = a.size + b.size - intersect;
      const score = union === 0 ? 0 : intersect / union;
      if (score >= threshold) results.push({ aIndex: i, bIndex: j, score });
    }
  }
  return results;
}

export function normalizeTaskLine(line: string): string {
  return line
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.!?;:,]+$/, '');
}
