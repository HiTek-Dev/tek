# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** Every interaction with your AI agent is transparent, secure, and under your control -- you see exactly what's being sent, what tools are running, and can approve or skip permissions at any granularity.
**Current focus:** v0.2 Chat Experience & Providers — Phases 30-34 (complete)

## Current Position

Phase: 34 of 34 (CLI Chat UX Overhaul)
Plan: 2 of 2
Status: Complete
Last activity: 2026-02-22 — Quick task 9: Fixed tool flow, agent personality, brave search timeout, and added gateway status

Progress: [##################################] 100% (34/34 phases)

## Performance Metrics

**Velocity:**
- Total plans completed: 64 (36 v0.0 + 14 v0.1 + 14 v0.2)
- Average duration: 3min
- Total execution time: 1.96 hours

**By Phase (v0.1):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 25 | 4/4 | 9min | 2.3min |
| 26 | 4/4 | 7min | 1.8min |
| 27 | 6/6 | 11min | 1.8min |
| 28 | 3/3 | 5min | 1.7min |

**By Phase (v0.2):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 30 | 1/1 | 3min | 3.0min |
| 31 | 5/5 | 14min | 2.8min |
| 32 | 3/3 | 11min | 3.7min |
| 33 | 3/3 | 9min | 3.0min |
| 34 | 2/2 | 7min | 3.5min |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
- [Phase 31]: Used @streamdown/code@^1.0.3 (research had outdated ^0.2.1)
- [Phase 31-02]: GatewayStatus compact mode for header, full mode for landing page
- [Phase 31-02]: Config loading uses local React state (read-once, not Zustand)
- [Phase 31-03]: Local TypeScript interfaces instead of importing @tek/gateway (Node.js won't work in webview)
- [Phase 31-03]: Ref-based streaming text accumulation to avoid stale closure issues in React
- [Phase 31-04]: Streamdown plugins instantiated at module level to avoid re-init per render
- [Phase 31-04]: Layout overflow changed to hidden for chat scroll containment
- [Phase 31-05]: ToolCallCard uses border-left accent colors for status indication
- [Phase 31-05]: Session sidebar 280px fixed width, collapsible via header toggle
- [Phase 31-05]: MessageCard delegates tool_call rendering to standalone ToolCallCard
- [Phase 32-01]: Used reasoning-delta (not reasoning) part type to match AI SDK v6 fullStream API
- [Phase 32-01]: Filter source parts by sourceType=url to handle document sources gracefully
- [Phase 32-01]: Extended thinking budget set to 8000 tokens as moderate starting point
- [Phase 32-02]: Reasoning message added before text message in array so it appears above response content
- [Phase 32-02]: StreamingMessage renders when reasoning OR text present to show early reasoning
- [Phase 32-03]: Functional state updater pattern for reasoning/sources promotion in stale-closure useCallback
- [Phase 32-03]: Sources displayed without emoji prefix for clean CLI aesthetic
- [Phase 33-01]: Used inputSchema (not parameters) to match existing AI SDK v6 tool() pattern in codebase
- [Phase 33-01]: Todo tool uses auto approval via perTool policy, not wrapToolWithApproval wrapper
- [Phase 33-01]: activeTodos cleared in both handleChatSend and handlePreflightApproval stream start paths
- [Phase 33-02]: TodoPanel placed after StreamingResponse and before ToolPanel for natural reading order
- [Phase 33-02]: Todos clear on stream start (not stream end) so they persist after completion until next request
- [Phase 33-03]: TodoPanel positioned between usage/cost footer and ChatInput in flex column
- [Phase 33-03]: Todos cleared on stream start and error, preserved on stream end until next request
- [Phase 34-01]: Manual alternate screen buffer escape codes instead of fullscreen-ink dependency
- [Phase 34-01]: Render prop pattern for FullScreenWrapper to pass terminal dimensions
- [Phase 34-01]: Heuristic message windowing (~3 lines/msg) with overflow hidden for ConversationScroll
- [Phase 34-01]: isActive prop pattern replaces isStreaming for InputBar (disabled during streaming OR approval)
- [Phase 34-02]: Unified InlineApproval replaces three separate approval components (ToolApprovalPrompt, SkillApprovalPrompt, PreflightChecklist)
- [Phase 34-02]: ToolPanel removed from Chat.tsx -- tool calls render inline via MessageBubble/InlineToolCall
- [Phase 34-02]: Diff heuristic: check first 10 lines for + and - prefixed lines to auto-render InlineDiff
- [Phase 34-02]: Auto-collapse threshold of 20 changed lines for InlineDiff, Enter key toggle for focused diff

### Roadmap Evolution

- Phase 29 (Sandbox Bug Fixes & Desktop Rebuild) removed — superseded by v0.2 phases
- Phase 30 added: Ollama Auto-Discovery and Remote Setup
- Phase 31 added: Desktop Chat App Rebuild (modeled on opcode)
- Phase 32 added: Structured Streaming and Chat Formatting
- Phase 33 added: Todo System Display in CLI and Desktop
- Phase 34 added: CLI Chat UX Overhaul (Claude Code / Kimicode style)
- v0.2 milestone created: Chat Experience & Providers

### Pending Todos

- **Daemon mode for gateway** — launchd service for background gateway
- **Verify update process end-to-end** — update.sh with daemon, config migration

### Blockers/Concerns

- handlers.ts (1,422 lines, zero tests) — characterization tests before any extraction

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 9 | Fix tool flow, agent personality/base training, telegram integration, brave search failures, and desktop chat UI | 2026-02-22 | 70ee6db | Complete | [9-fix-tool-flow-agent-personality-base-tra](./quick/9-fix-tool-flow-agent-personality-base-tra/) |

## Session Continuity

Last session: 2026-02-22
Stopped at: Completed 34-02-PLAN.md (Inline rendering)
Resume file: None
