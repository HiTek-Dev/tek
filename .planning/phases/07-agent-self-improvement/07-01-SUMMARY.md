---
phase: 07-agent-self-improvement
plan: 01
subsystem: agent
tags: [failure-detection, websocket, ai-sdk, pattern-classification]

# Dependency graph
requires:
  - phase: 06-agent-capabilities
    provides: "Agent tool loop with streamText, approval gate, WS protocol"
provides:
  - "Failure pattern classification from agent step history"
  - "failure.detected WS server message for client notification"
  - "Step history tracking in agent tool loop via onStepFinish"
affects: [07-02, 07-03, 07-04, agent-self-correction, client-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Pure function pattern classifier with priority-ordered detection", "onStepFinish hook for step history accumulation"]

key-files:
  created:
    - packages/gateway/src/agent/failure-detector.ts
  modified:
    - packages/gateway/src/agent/tool-loop.ts
    - packages/gateway/src/ws/protocol.ts
    - packages/gateway/src/agent/index.ts

key-decisions:
  - "StepRecord adapts AI SDK StepResult via mapping in onStepFinish (SDK has no stepType field)"
  - "Used logger.info instead of logger.debug since createLogger has no debug level"
  - "Failure detection is informational only -- does not stop or interrupt the agent loop"

patterns-established:
  - "Priority-ordered pattern classification: pure function returns highest-priority match"
  - "Step history accumulation via onStepFinish callback alongside existing fullStream iteration"

# Metrics
duration: 3min
completed: 2026-02-17
---

# Phase 7 Plan 1: Failure Pattern Detection Summary

**Pure failure-pattern classifier detecting repeated-tool-error, tool-rejection-loop, no-progress, and max-steps-approaching from agent step history with WS notification**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-17T01:48:01Z
- **Completed:** 2026-02-17T01:51:04Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created failure-detector.ts with StepRecord/FailurePattern types and classifyFailurePattern pure function
- Wired step history tracking into runAgentLoop via AI SDK's onStepFinish callback
- Added failure.detected server message to WS protocol schema
- Exported failure-detector from agent barrel index

## Task Commits

Each task was committed atomically:

1. **Task 1: Create failure-detector.ts with pattern classification** - `188f3ff` (feat)
2. **Task 2: Wire failure detection into tool-loop and add WS protocol message** - `c55fe36` (feat)

## Files Created/Modified
- `packages/gateway/src/agent/failure-detector.ts` - Pure function classifier for 4 failure patterns from step history
- `packages/gateway/src/agent/tool-loop.ts` - Added stepHistory accumulation and onStepFinish with failure classification
- `packages/gateway/src/ws/protocol.ts` - Added FailureDetectedSchema to server message discriminated union
- `packages/gateway/src/agent/index.ts` - Barrel export for classifyFailurePattern, StepRecord, FailurePattern

## Decisions Made
- AI SDK v6 StepResult has no `stepType` field -- adapted by inferring "initial" for first step and "continue" for subsequent steps
- Used `logger.info` for detection logging since the core Logger interface has no `debug` level
- Failure detection is purely informational (emits WS message) and does not interrupt the agent loop

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Changed logger.debug to logger.info**
- **Found during:** Task 1 (failure-detector.ts creation)
- **Issue:** Plan specified `createLogger("failure-detector")` for debug logging, but Logger interface only has info/warn/error
- **Fix:** Used `logger.info` for pattern detection messages
- **Files modified:** packages/gateway/src/agent/failure-detector.ts
- **Verification:** tsc --noEmit passes cleanly
- **Committed in:** 188f3ff (Task 1 commit)

**2. [Rule 1 - Bug] Adapted onStepFinish callback to StepResult shape**
- **Found during:** Task 2 (tool-loop wiring)
- **Issue:** Plan destructured `{ stepType, finishReason, toolCalls, toolResults, text }` but AI SDK v6 StepResult has no `stepType` property and toolCalls/toolResults have different shapes
- **Fix:** Accept full `stepResult` object, map to StepRecord with inferred stepType and adapted tool call/result arrays
- **Files modified:** packages/gateway/src/agent/tool-loop.ts
- **Verification:** tsc --noEmit passes cleanly
- **Committed in:** c55fe36 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes were necessary for type compatibility with AI SDK v6. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Failure detection infrastructure is in place for agent self-correction (07-02)
- Client can now receive failure.detected messages and display them to users
- Pattern classifier is a pure function, easily testable and extensible with new patterns

---
*Phase: 07-agent-self-improvement*
*Completed: 2026-02-17*
