# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** Every interaction with your AI agent is transparent, secure, and under your control -- you see exactly what's being sent, what tools are running, and can approve or skip permissions at any granularity.
**Current focus:** Phase 27 — Desktop UI Overhaul (v0.1 Product Polish)

## Current Position

Phase: 27 of 28 (Desktop UI Overhaul)
Plan: 6 of 6
Status: Phase 27 complete
Last activity: 2026-02-21 — Completed 27-06 (Color Token Migration)

Progress: [############################] 100% (28/28 phases)

## Performance Metrics

**Velocity:**
- Total plans completed: 50 (36 v0.0 + 14 v0.1)
- Average duration: 3min
- Total execution time: 1.43 hours

**By Phase (v0.1):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 25 | 4/4 | 9min | 2.3min |
| 26 | 4/4 | 7min | 1.8min |
| 27 | 6/6 | 11min | 1.8min |
| 28 | 3/3 | 5min | 1.7min |

**Recent Trend:**
- Last 5 plans: 1min, 1min, 3min, 3min, 2min
- Trend: Stable (~2min avg)

*Updated after each plan completion*
| Phase 27 P02 | 2min | 2 tasks | 4 files |
| Phase 27 P03 | 2min | 2 tasks | 4 files |
| Phase 27 P06 | 2min | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v0.1 Roadmap]: 4 phases (25-28) covering 29 requirements; comprehensive depth
- [v0.1 Roadmap]: Phase 25 first (blockers), then 26/27/28 in parallel
- [v0.1 Roadmap]: shiki as unified syntax highlighter for CLI and desktop
- [v0.1 Roadmap]: react-markdown (not raw marked) for desktop XSS safety
- [v0.1 Roadmap]: Vault extraction from @tek/cli to @tek/core to break circular dep
- [25-02]: ErrorBoundary inside Layout so sidebar stays visible during page errors
- [25-02]: Vitest projects glob targets packages/* only; apps excluded from test scope
- [25-03]: Identical getReconnectDelay in both hooks (no shared package to avoid coupling)
- [25-03]: Unlimited retries with 30s cap — gateway will eventually return
- [25-01]: Vault as @tek/core/vault sub-export (separate from main to avoid native module in desktop)
- [25-01]: Audit logging moved from vault functions to CLI call sites
- [25-04]: Dynamic string variable import to bypass TS static resolution for optional workspace deps
- [26-03]: ToolPanel uses useState/useInput for live region only; MessageBubble stays stateless for Static
- [26-03]: Timestamps use local time HH:MM format via Date constructor
- [26-02]: useRef for history+cursor with tick state for re-renders (avoids stale closures in useInput)
- [26-02]: Append-only input (no mid-text cursor) covers 90%+ of chat use cases
- [26-01]: Top-level await to pre-resolve async grammar loaders for createHighlighterCoreSync
- [26-01]: FontStyle constants inline rather than importing @shikijs/vscode-textmate transitive dep
- [26-04]: StatusBar borderless single-line; session ID removed (available via /session command)
- [26-04]: WelcomeScreen fully static, disappears on first message or streaming start
- [28-01]: ServerMessage union has 33 variants (not 27 as plan estimated) -- tested all actual variants
- [28-01]: HeartbeatConfigure fixtures explicitly provide default fields for round-trip equality
- [28-02]: Budget tier unreachable with DEFAULT_RULES (standard priority 2 catches before budget priority 3); tested with custom rules
- [28-02]: Mock only registry.js for routeMessage; classifyComplexity and approval-gate are pure functions
- [28-03]: AI SDK v6 doStream text-delta uses `delta` field not `textDelta` at model layer
- [28-03]: vi.hoisted + class syntax for mocking constructors (MemoryManager/ThreadManager)
- [28-03]: Tool-call streaming tests deferred pending source refactoring (too coupled to AI SDK internals)
- [27-01]: Indigo palette for brand colors (brand-400 through brand-600)
- [27-01]: Dark surface scale: #0f0f0f -> #1a1a1a -> #252525 -> #2a2a2a
- [27-04]: Session resume via store-mediated resumeSessionId (set in sidebar, consumed in ChatPage)
- [27-04]: Expose setSessionId from useChat for external session resume control
- [27-05]: Dashboard WebSocket connection inline (same pattern as ChatPage) for usage/session queries
- [27-05]: Memory status indicator based on gateway running state (no dedicated memory endpoint)
- [27-05]: Settings footer (Save/Reload) placed outside tabs for persistent visibility
- [Phase 27]: react-shiki for syntax highlighting (lazy-loads grammars, matches CLI shiki choice)
- [Phase 27]: Streaming text stays plain whitespace-pre-wrap (no markdown parsing mid-stream)
- [27-03]: FIFO queue for pendingApprovals (array, not single value) to handle concurrent tool approvals
- [27-03]: Chevron toggle with max-h-0/max-h-96 transition for expandable tool calls
- [27-06]: Semantic status colors (green/red/yellow) preserved as intentional hardcoded values during token migration

### Pending Todos

- **Daemon mode for gateway** — launchd service for background gateway
- **Verify update process end-to-end** — update.sh with daemon, config migration

### Blockers/Concerns

- ~~Circular dependency (@tek/cli <-> @tek/gateway via vault)~~ RESOLVED in 25-01: vault extracted to @tek/core
- ~~Circular dependency (@tek/gateway <-> @tek/telegram)~~ RESOLVED in 25-04: removed @tek/telegram from gateway package.json
- handlers.ts (1,422 lines, zero tests) — characterization tests before any extraction

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed 27-06-PLAN.md (Phase 27 complete)
Resume file: None
