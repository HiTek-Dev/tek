---
phase: 03-cli-interface
plan: 01
subsystem: cli
tags: [websocket, ink, react-hooks, commander, ws, nanoid, marked]

# Dependency graph
requires:
  - phase: 02-gateway-core
    provides: "WebSocket protocol types (ClientMessage, ServerMessage), gateway server"
  - phase: 01-foundation
    provides: "RUNTIME_PATH, configExists, core config types"
provides:
  - "Gateway auto-discovery via runtime.json with PID liveness check"
  - "Typed WebSocket message factory functions (chat.send, context.inspect, usage.query, session.list)"
  - "useWebSocket React hook for connection lifecycle"
  - "useChat React hook for chat state management with streaming delta accumulation"
  - "Minimal Chat shell component with message history and text input"
  - "agentspace chat command with --model and --session options"
affects: [03-02-cli-ui, 04-agent-tools]

# Tech tracking
tech-stack:
  added: [marked, marked-terminal, cli-highlight, ws, nanoid, "@agentspace/gateway workspace dep"]
  patterns: [react-hooks-for-ws, typed-message-factories, gateway-discovery-pattern]

key-files:
  created:
    - packages/cli/src/lib/discovery.ts
    - packages/cli/src/lib/gateway-client.ts
    - packages/cli/src/hooks/useWebSocket.ts
    - packages/cli/src/hooks/useChat.ts
    - packages/cli/src/components/Chat.tsx
    - packages/cli/src/commands/chat.ts
  modified:
    - packages/cli/package.json
    - packages/cli/src/index.ts

key-decisions:
  - "Downgraded marked to ^15.0.0 to satisfy marked-terminal peer dep (marked 17 incompatible)"
  - "Stored WebSocket callbacks in refs to prevent stale closures in useEffect"
  - "Used setStreamingText callback form to promote streaming text to messages atomically"

patterns-established:
  - "Gateway discovery: read runtime.json + verify PID with signal 0"
  - "Message factories: typed helper functions wrapping nanoid() + ClientMessage shape"
  - "React hooks for WebSocket: refs for callbacks, effect cleanup for connection"

# Metrics
duration: 3min
completed: 2026-02-16
---

# Phase 3 Plan 1: CLI Communication Layer Summary

**Gateway discovery, typed WebSocket hooks, chat state management, and minimal Chat shell component connected via ws library**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-16T20:58:35Z
- **Completed:** 2026-02-16T21:01:27Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Gateway auto-discovery reads runtime.json and verifies PID liveness before connecting
- Typed message factory functions for all 4 WebSocket client message types
- useWebSocket hook manages connection lifecycle with typed send/receive
- useChat hook accumulates streaming deltas and promotes to completed messages on stream.end
- Minimal Chat component renders message history, streaming text, connection status, and text input
- `agentspace chat` command registered with --model and --session options

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create gateway discovery + client helpers** - `fdb1ea4` (feat)
2. **Task 2: Create useWebSocket hook, useChat hook, chat command, and Chat shell** - `faf6e1c` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `packages/cli/src/lib/discovery.ts` - Gateway auto-discovery via runtime.json with PID liveness check
- `packages/cli/src/lib/gateway-client.ts` - Typed WebSocket message factory functions and ChatMessage type
- `packages/cli/src/hooks/useWebSocket.ts` - React hook for WebSocket connection lifecycle
- `packages/cli/src/hooks/useChat.ts` - React hook for chat state with streaming delta accumulation
- `packages/cli/src/components/Chat.tsx` - Minimal Ink chat shell with message history and input
- `packages/cli/src/commands/chat.ts` - Commander chat subcommand with gateway discovery
- `packages/cli/src/index.ts` - Added chatCommand registration
- `packages/cli/package.json` - Added marked, marked-terminal, cli-highlight, ws, nanoid, @agentspace/gateway deps

## Decisions Made
- Downgraded marked to ^15.0.0 to satisfy marked-terminal peer dependency (marked 17 was incompatible)
- Stored WebSocket callbacks (onMessage, onError, onClose) in refs to prevent stale closures in useEffect
- Used setStreamingText callback form to atomically promote streaming text to completed messages

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Downgraded marked to ^15.0.0**
- **Found during:** Task 1 (dependency installation)
- **Issue:** marked 17.0.2 was installed but marked-terminal 7.3.0 requires marked >=1 <16
- **Fix:** Ran `pnpm --filter @agentspace/cli add 'marked@^15.0.0'` to install compatible version
- **Files modified:** packages/cli/package.json, pnpm-lock.yaml
- **Verification:** Peer dependency warning resolved, build passes
- **Committed in:** fdb1ea4 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor version pin to resolve peer dep incompatibility. No scope creep.

## Issues Encountered
None beyond the marked version incompatibility addressed above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Communication layer is solid: discovery, WebSocket, chat state all working
- Plan 03-02 can build rich UI components (MessageBubble, StatusBar, slash commands) on top of these hooks
- Chat component is intentionally minimal; designed to be replaced by Plan 03-02's full UI

## Self-Check: PASSED

All 6 created files verified on disk. Both task commits (fdb1ea4, faf6e1c) verified in git log.

---
*Phase: 03-cli-interface*
*Completed: 2026-02-16*
