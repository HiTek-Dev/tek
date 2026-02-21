# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** Every interaction with your AI agent is transparent, secure, and under your control -- you see exactly what's being sent, what tools are running, and can approve or skip permissions at any granularity.
**Current focus:** Phase 28 — Testing Foundation (v0.1 Product Polish)

## Current Position

Phase: 28 of 28 (Testing Foundation)
Plan: 2 of 3 (LLM Router & Approval Gate Tests)
Status: Executing phase 28
Last activity: 2026-02-21 — Completed 28-02 (LLM Router & Approval Gate Tests)

Progress: [########################..] 86% (24/28 phases)

## Performance Metrics

**Velocity:**
- Total plans completed: 45 (36 v0.0 + 9 v0.1)
- Average duration: 3min
- Total execution time: 1.38 hours

**By Phase (v0.1):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 25 | 4/4 | 9min | 2.3min |
| 26 | 4/4 | 7min | 1.8min |
| 27 | 0/TBD | - | - |
| 28 | 2/3 | 2min | 1min |

**Recent Trend:**
- Last 5 plans: 2min, 1min, 1min, 1min, 1min
- Trend: Stable (~2min avg)

*Updated after each plan completion*

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
- [28-02]: Budget tier unreachable with DEFAULT_RULES (standard priority 2 catches before budget priority 3); tested with custom rules
- [28-02]: Mock only registry.js for routeMessage; classifyComplexity and approval-gate are pure functions

### Pending Todos

- **Daemon mode for gateway** — launchd service for background gateway
- **Verify update process end-to-end** — update.sh with daemon, config migration

### Blockers/Concerns

- ~~Circular dependency (@tek/cli <-> @tek/gateway via vault)~~ RESOLVED in 25-01: vault extracted to @tek/core
- ~~Circular dependency (@tek/gateway <-> @tek/telegram)~~ RESOLVED in 25-04: removed @tek/telegram from gateway package.json
- handlers.ts (1,422 lines, zero tests) — characterization tests before any extraction

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed 28-02-PLAN.md
Resume file: None
