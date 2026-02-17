---
phase: 06-agent-capabilities
plan: 03
subsystem: agent
tags: [agent-loop, fullStream, tool-calling, approval-gate, websocket, skills, context-assembler]

# Dependency graph
requires:
  - phase: 06-agent-capabilities
    provides: MCP client manager, tool registry, approval gate, skills loader
affects: [06-04, cli-tool-ui, preflight-system]

provides:
  - Tool-aware streaming via AI SDK fullStream with multi-step agent loop
  - 6 new WS protocol messages (tool.call, tool.result, tool.approval.request/response, preflight.checklist/approval)
  - Agent tool loop with configurable step limit and 60s approval timeout
  - Context assembler populating skills from SKILL.md discovery and tool descriptions from registry
  - ConnectionState extended with pendingApprovals, tools cache, and approval policy

# Tech tracking
tech-stack:
  added: []
  patterns: ["AI SDK fullStream for tool-call/tool-result event relay", "Promise-based approval wait with timeout auto-deny", "Lazy-init tool registry cached on ConnectionState"]

key-files:
  created:
    - packages/gateway/src/agent/tool-loop.ts
  modified:
    - packages/gateway/src/ws/protocol.ts
    - packages/gateway/src/ws/server.ts
    - packages/gateway/src/ws/handlers.ts
    - packages/gateway/src/ws/connection.ts
    - packages/gateway/src/ws/index.ts
    - packages/gateway/src/llm/types.ts
    - packages/gateway/src/llm/index.ts
    - packages/gateway/src/context/assembler.ts
    - packages/gateway/src/agent/index.ts

key-decisions:
  - "AI SDK tool-result uses 'output' property not 'result' (discovered during build)"
  - "Tool registry lazily built on first chat.send and cached on ConnectionState"
  - "Approval timeout auto-denies after 60s to prevent indefinite blocking"
  - "ConnectionState extended with pendingApprovals/tools/approvalPolicy in Task 1 (needed for tool-loop compilation)"

patterns-established:
  - "Agent loop pattern: fullStream iteration with switch on part.type for tool-call/tool-result/text-delta"
  - "Approval flow: send tool.approval.request, await Promise from pendingApprovals Map, resolve on client response"
  - "Fallback pattern: if tool registry build fails, fall back to text-only streamToClient"

# Metrics
duration: 6min
completed: 2026-02-16
---

# Phase 6 Plan 03: Agent Tool Loop and Context Wiring Summary

**Tool-aware agent loop using AI SDK fullStream with multi-step tool calling, WS protocol extensions for tool/approval relay, and skills injection into context assembler**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-17T00:37:11Z
- **Completed:** 2026-02-17T00:43:10Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Created agent tool loop (runAgentLoop) using AI SDK streamText with fullStream for tool-call, tool-result, and tool-approval-request event relay
- Extended WS protocol with 6 new message types: tool.call, tool.result, tool.approval.request, tool.approval.response, preflight.checklist, preflight.approval
- Wired handleChatSend to delegate to runAgentLoop when tools are available, with text-only fallback
- Context assembler now discovers and injects skills from SKILL.md files and accepts tool descriptions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add WS protocol messages and create agent tool loop** - `8ac4750` (feat)
2. **Task 2: Wire agent loop into handlers and fill context assembler stubs** - `33f0555` (feat)

## Files Created/Modified
- `packages/gateway/src/agent/tool-loop.ts` - runAgentLoop using fullStream with approval wait
- `packages/gateway/src/ws/protocol.ts` - 6 new message schemas (3 client, 3 server) + preflight
- `packages/gateway/src/ws/server.ts` - Dispatch cases for tool.approval.response and preflight.approval
- `packages/gateway/src/ws/handlers.ts` - handleChatSend agent mode, handleToolApprovalResponse
- `packages/gateway/src/ws/connection.ts` - ConnectionState with pendingApprovals, tools, approvalPolicy
- `packages/gateway/src/ws/index.ts` - Barrel exports for new protocol types
- `packages/gateway/src/llm/types.ts` - StreamToolCall, StreamToolResult types
- `packages/gateway/src/llm/index.ts` - Re-export new stream types
- `packages/gateway/src/context/assembler.ts` - Skills discovery + toolDescriptions parameter
- `packages/gateway/src/agent/index.ts` - Re-export runAgentLoop and AgentLoopOptions

## Decisions Made
- AI SDK v6 tool-result parts use `output` property (not `result`) -- discovered during build verification
- Tool registry is lazily built on the first `chat.send` and cached on `ConnectionState.tools` for the connection lifetime
- ConnectionState fields for agent loop (pendingApprovals, tools, approvalPolicy) added in Task 1 since tool-loop.ts requires them to compile
- Approval timeout of 60 seconds with auto-deny prevents the agent loop from blocking indefinitely
- Skills loading is best-effort: if loadConfig returns null or discoverSkills fails, assembler continues with empty skills

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed AI SDK tool-result using 'output' not 'result'**
- **Found during:** Task 1 (tool-loop.ts build)
- **Issue:** AI SDK v6 `tool-result` stream parts use `part.output` not `part.result`
- **Fix:** Changed `part.result` to `part.output` in tool-result handler
- **Files modified:** packages/gateway/src/agent/tool-loop.ts
- **Verification:** `pnpm --filter @agentspace/gateway build` passes
- **Committed in:** 8ac4750 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed logger.debug not existing on Logger interface**
- **Found during:** Task 1 (tool-loop.ts build)
- **Issue:** createLogger returns Logger with info/warn/error only, no debug method
- **Fix:** Changed `logger.debug()` to `logger.info()` for step finish logging
- **Files modified:** packages/gateway/src/agent/tool-loop.ts
- **Verification:** Build passes
- **Committed in:** 8ac4750 (Task 1 commit)

**3. [Rule 3 - Blocking] Moved ConnectionState extension to Task 1**
- **Found during:** Task 1 (tool-loop.ts references connState.pendingApprovals)
- **Issue:** tool-loop.ts requires pendingApprovals on ConnectionState, but plan scheduled this for Task 2
- **Fix:** Added pendingApprovals, tools, approvalPolicy to ConnectionState in Task 1
- **Files modified:** packages/gateway/src/ws/connection.ts
- **Verification:** Build passes, all references resolve
- **Committed in:** 8ac4750 (Task 1 commit)

**4. [Rule 1 - Bug] Fixed loadConfig() null return handling**
- **Found during:** Task 2 (handlers.ts and assembler.ts build)
- **Issue:** loadConfig() returns `AppConfig | null`, but code accessed properties without null check
- **Fix:** Added null guards before using config in both handlers.ts and assembler.ts
- **Files modified:** packages/gateway/src/ws/handlers.ts, packages/gateway/src/context/assembler.ts
- **Verification:** Build passes
- **Committed in:** 33f0555 (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (3 bugs, 1 blocking)
**Impact on plan:** All auto-fixes necessary for TypeScript compilation. No scope creep.

## Issues Encountered
- Pre-existing cyclic dependency between @agentspace/gateway and @agentspace/cli prevents full monorepo `pnpm build`. Individual package builds succeed. Out of scope.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Agent tool loop complete and wired into chat.send handler
- Ready for preflight system (06-04) which will use the preflight.checklist/preflight.approval protocol stubs
- Skills and tools injected into every LLM context call
- Approval flow functional: request -> client response -> resolve promise -> continue loop

---
*Phase: 06-agent-capabilities*
*Completed: 2026-02-16*
