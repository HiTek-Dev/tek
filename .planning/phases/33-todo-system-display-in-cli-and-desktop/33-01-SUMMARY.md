---
phase: 33-todo-system-display-in-cli-and-desktop
plan: 01
subsystem: api
tags: [websocket, tool-system, zod, ai-sdk, todo-tracking]

# Dependency graph
requires: []
provides:
  - todo_write tool (createTodoWriteTool factory)
  - TodoItem type definition
  - todo.update WS server message type
  - activeTodos field on ConnectionState
  - System prompt instruction for todo_write usage
affects: [33-02-PLAN, 33-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [onUpdate callback pattern for tool-to-WS relay, auto-approval informational tool]

key-files:
  created:
    - packages/gateway/src/tools/todo.ts
  modified:
    - packages/gateway/src/tools/index.ts
    - packages/gateway/src/ws/protocol.ts
    - packages/gateway/src/ws/connection.ts
    - packages/gateway/src/agent/tool-registry.ts
    - packages/gateway/src/ws/handlers.ts
    - packages/gateway/src/context/assembler.ts
    - packages/gateway/src/agent/tool-loop.test.ts

key-decisions:
  - "Used inputSchema (not parameters) to match existing AI SDK v6 tool() pattern in codebase"
  - "Todo tool uses auto approval via perTool policy, not wrapToolWithApproval wrapper"
  - "activeTodos cleared in both handleChatSend and handlePreflightApproval stream start paths"

patterns-established:
  - "onUpdate callback: tool factory accepts callback, handler wires it to transport.send"
  - "Auto-approved informational tools: set perTool policy to auto without wrapping"

requirements-completed: [TODO-01, TODO-02, TODO-03, TODO-04, TODO-07]

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 33 Plan 01: Gateway Todo System Summary

**todo_write tool with WS protocol relay, auto-approval registration, connection state tracking, and system prompt instruction**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T05:51:58Z
- **Completed:** 2026-02-22T05:55:28Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Created todo_write tool that agents call to track multi-step task progress
- Extended WS protocol with todo.update server message for real-time client updates
- Wired tool into registry with auto-approval and handler relay to transport
- Added connection state tracking with proper clearing on each new stream

## Task Commits

Each task was committed atomically:

1. **Task 1: Create todo_write tool and extend WS protocol** - `bd8f12c` (feat)
2. **Task 2: Wire todo tool into registry, handlers, and system prompt** - `87ac525` (feat)

## Files Created/Modified
- `packages/gateway/src/tools/todo.ts` - TodoItem schema, createTodoWriteTool factory
- `packages/gateway/src/tools/index.ts` - Re-exports for todo tool and type
- `packages/gateway/src/ws/protocol.ts` - TodoUpdate schema in ServerMessageSchema union
- `packages/gateway/src/ws/connection.ts` - activeTodos field on ConnectionState
- `packages/gateway/src/agent/tool-registry.ts` - todo_write registration with auto policy
- `packages/gateway/src/ws/handlers.ts` - onTodoUpdate relay and activeTodos clearing
- `packages/gateway/src/context/assembler.ts` - System prompt todo_write instruction
- `packages/gateway/src/agent/tool-loop.test.ts` - Test mock updated with activeTodos field

## Decisions Made
- Used `inputSchema` (not `parameters`) to match existing AI SDK v6 `tool()` pattern used throughout the codebase
- Todo tool uses auto approval via `perTool` policy rather than `wrapToolWithApproval` wrapper, avoiding overhead for an informational tool
- `activeTodos` cleared in both `handleChatSend` and `handlePreflightApproval` stream start paths to ensure no stale state

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used inputSchema instead of parameters for AI SDK v6 compatibility**
- **Found during:** Task 1
- **Issue:** Plan specified `parameters` field in tool() call but the codebase AI SDK v6 uses `inputSchema`
- **Fix:** Changed `parameters` to `inputSchema` matching existing tool patterns (shell.ts, memory.ts)
- **Files modified:** packages/gateway/src/tools/todo.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** bd8f12c (Task 1 commit)

**2. [Rule 3 - Blocking] Updated test mock with new ConnectionState field**
- **Found during:** Task 1
- **Issue:** tool-loop.test.ts mock ConnectionState missing new activeTodos field, causing TS error
- **Fix:** Added `activeTodos: []` to the mock ConnectionState in createMockConnState()
- **Files modified:** packages/gateway/src/agent/tool-loop.test.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** bd8f12c (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary for compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Gateway todo system complete, ready for CLI (33-02) and Desktop (33-03) display plans
- todo.update WS messages flow from agent tool calls to connected clients
- TodoItem type exported for consumption by client packages

---
*Phase: 33-todo-system-display-in-cli-and-desktop*
*Completed: 2026-02-22*
