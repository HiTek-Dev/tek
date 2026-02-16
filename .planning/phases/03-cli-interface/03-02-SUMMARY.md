---
phase: 03-cli-interface
plan: 02
subsystem: cli
tags: [ink, react, markdown, marked, marked-terminal, slash-commands, streaming, status-bar]

# Dependency graph
requires:
  - phase: 03-cli-interface
    plan: 01
    provides: "WebSocket hooks, useChat, gateway-client, Chat shell, discovery"
  - phase: 02-gateway-core
    provides: "WebSocket protocol types, ServerMessage discriminated union"
provides:
  - "Discriminated ChatMessage union (text, tool_call, bash_command, reasoning) for forward compatibility"
  - "Markdown rendering with syntax-highlighted code blocks via marked + marked-terminal"
  - "MessageBubble with role-based styling (user=cyan, assistant=markdown, system=yellow)"
  - "MessageList using Ink Static for efficient append-only rendering"
  - "StreamingResponse with spinner and plain-text streaming (no partial markdown)"
  - "StatusBar showing connection, session, model, token count, cost"
  - "8 slash commands: /help, /model, /session, /context, /usage, /clear, /quit, /exit"
  - "InputBar with streaming-aware disable"
  - "Auto-launch chat from agentspace (no args) when configured and gateway running"
affects: [04-agent-tools, 06-tool-use-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [discriminated-union-message-types, slash-command-dispatch, streaming-then-markdown-render]

key-files:
  created:
    - packages/cli/src/lib/markdown.ts
    - packages/cli/src/components/MarkdownRenderer.tsx
    - packages/cli/src/components/MessageBubble.tsx
    - packages/cli/src/components/MessageList.tsx
    - packages/cli/src/components/StreamingResponse.tsx
    - packages/cli/src/components/StatusBar.tsx
    - packages/cli/src/components/InputBar.tsx
    - packages/cli/src/hooks/useSlashCommands.ts
    - packages/cli/src/types/marked-terminal.d.ts
  modified:
    - packages/cli/src/lib/gateway-client.ts
    - packages/cli/src/hooks/useChat.ts
    - packages/cli/src/components/Chat.tsx
    - packages/cli/src/index.ts

key-decisions:
  - "ChatMessage refactored to discriminated union on type field for forward-compatible tool_call/bash_command/reasoning types"
  - "Plain text during streaming, markdown only on completion (avoids partial-parse artifacts per research)"
  - "InputBar renders plain text 'streaming...' instead of disabled TextInput to avoid focus issues"
  - "Used markedTerminal() extension API (not setOptions/renderer) for marked v15 compatibility"
  - "Added custom type declarations for marked-terminal (no @types package available)"

patterns-established:
  - "Discriminated union pattern: switch on message.type then narrow to access role-specific fields"
  - "Slash command dispatch: useSlashCommands returns result object with action/message/wsMessage"
  - "Streaming → markdown transition: plain text while streaming, re-render as markdown on completion"

# Metrics
duration: 4min
completed: 2026-02-16
---

# Phase 3 Plan 2: CLI UI Components Summary

**Polished terminal chat with markdown rendering, role-based message styling, 8 slash commands, status bar, and auto-launch from bare `agentspace` command**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-16T21:03:53Z
- **Completed:** 2026-02-16T21:07:38Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Full markdown rendering with syntax-highlighted code blocks using marked + marked-terminal
- MessageBubble renders messages by type: user (cyan prompt), assistant (markdown), system (yellow), tool_call (blue), bash_command (green), reasoning (dimmed italic)
- ChatMessage refactored to discriminated union supporting text, tool_call, bash_command, reasoning types
- 8 slash commands wired through useSlashCommands hook with session.list/context.inspection/usage.report server message handling
- StatusBar displays connection indicator, session ID, shortened model name, token count, and cost
- StreamingResponse shows spinner while waiting, plain text during streaming
- `agentspace` (no args) auto-launches chat when configured and gateway is running

## Task Commits

Each task was committed atomically:

1. **Task 1: Create markdown renderer, UI components, and StatusBar** - `abb5029` (feat)
2. **Task 2: Create slash commands, InputBar, wire Chat, and auto-launch** - `d3b309c` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `packages/cli/src/lib/markdown.ts` - marked + marked-terminal configuration and renderMarkdown function
- `packages/cli/src/components/MarkdownRenderer.tsx` - Ink component wrapping renderMarkdown output
- `packages/cli/src/components/MessageBubble.tsx` - Type-based message styling with discriminated union switch
- `packages/cli/src/components/MessageList.tsx` - Static append-only message list
- `packages/cli/src/components/StreamingResponse.tsx` - Plain-text streaming with spinner
- `packages/cli/src/components/StatusBar.tsx` - Connection, session, model, usage status display
- `packages/cli/src/components/InputBar.tsx` - Text input with streaming disable
- `packages/cli/src/hooks/useSlashCommands.ts` - Slash command parsing and dispatch
- `packages/cli/src/types/marked-terminal.d.ts` - Type declarations for marked-terminal
- `packages/cli/src/lib/gateway-client.ts` - Refactored ChatMessage to discriminated union
- `packages/cli/src/hooks/useChat.ts` - Added isStreaming, addMessage, clearMessages, setModel, setSessionId; handle session.list/context.inspection/usage.report
- `packages/cli/src/components/Chat.tsx` - Full rewrite wiring all UI components and slash commands
- `packages/cli/src/index.ts` - Auto-launch chat from default command when gateway available

## Decisions Made
- ChatMessage refactored to discriminated union on `type` field (text, tool_call, bash_command, reasoning) -- tool_call and bash_command types defined now but only populated in Phase 6
- Plain text during streaming, full markdown on completion -- avoids partial-parse artifacts identified in 03-RESEARCH.md
- InputBar shows "streaming..." text instead of disabled TextInput to avoid Ink focus complexity
- Used `markedTerminal()` extension function with `marked.use()` instead of deprecated `setOptions` renderer approach
- Created custom `.d.ts` for marked-terminal since no @types package exists

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added marked-terminal type declarations**
- **Found during:** Task 1 (build verification)
- **Issue:** marked-terminal has no TypeScript declarations, causing TS7016 error
- **Fix:** Created `packages/cli/src/types/marked-terminal.d.ts` with markedTerminal function and Renderer class types
- **Files modified:** packages/cli/src/types/marked-terminal.d.ts
- **Verification:** Build passes without errors
- **Committed in:** abb5029 (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed Chat.tsx compile error from ChatMessage type change**
- **Found during:** Task 1 (build verification)
- **Issue:** Chat.tsx accessed `msg.role` and `msg.content` directly on ChatMessage, which is no longer valid after discriminated union refactor
- **Fix:** Updated Chat.tsx with type-narrowing via `msg.type === "text"` check (minimal fix; full rewrite in Task 2)
- **Files modified:** packages/cli/src/components/Chat.tsx
- **Verification:** Build passes
- **Committed in:** abb5029 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both necessary for compilation. No scope creep.

## Issues Encountered
None beyond the blocking issues addressed as deviations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 3 CLI interface is complete: communication layer (03-01) + polished UI (03-02)
- All Phase 3 success criteria satisfied: role-based message styling, markdown rendering, slash commands, status bar, auto-launch
- Phase 4 (agent tools) and Phase 6 (tool use integration) can populate tool_call and bash_command message types
- Streaming -> markdown pattern established for any future message rendering needs

## Self-Check: PASSED

All 9 created files verified on disk. Both task commits (abb5029, d3b309c) verified in git log.

---
*Phase: 03-cli-interface*
*Completed: 2026-02-16*
