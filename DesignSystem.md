## Braindump Mode Design Rationale

### Goals
Provide a frictionless capture surface optimized for rapid externalization of cognitive load (dump tasks) followed by structured refinement (categorize, prioritize, dedupe) without changing the broader layout.

### Core Principles
1. Capture First, Classify Second – raw text area defers structure until AI assist.
2. Minimal Mode Divergence – same layout; only input + analysis review differ.
3. Progressive Intelligence – heuristics now; Gemini-powered enrichment later.
4. Reversible Decisions – tasks only persist after explicit Commit.

### Data Model Additions
`braindumps` table + extended `tasks` columns (`braindump_id`, `category`, etc.) allow historical context and analytics (velocity, backlog shaping, duplicate ratios).

### UX Flow
1. User toggles to Braindump (header button)
2. Types/pastes tasks (newline separated)
3. Analyze → AI returns `BraindumpAnalysisResult`
4. Review grid: adjust category, priority, action (keep/merge/drop/ignore)
5. Commit → atomic insert of braindump + tasks

### Classification Heuristics (Current)
Regex-based keyword mapping (bug, communication, planning, learning, ops, quick_win) with fallback to `uncategorized`.

### Planned Enhancements
- Embedding similarity for fuzzy duplicate grouping
- Priority explanation generation (LLM)
- Merge UX for combining related tasks pre-insert
- Historical braindump comparison diff view

### Accessibility & Performance
- Plain textarea ensures native keyboard support
- Analysis done server-side; client only receives JSON payload
- Heuristic pass keeps latency low when Gemini unavailable
