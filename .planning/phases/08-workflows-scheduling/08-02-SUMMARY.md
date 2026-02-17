---
phase: 08-workflows-scheduling
plan: 02
subsystem: api, agent
tags: [workflow-engine, template-resolver, step-executor, branching, approval-gates, sqlite, drizzle]

# Dependency graph
requires:
  - phase: 08-workflows-scheduling
    provides: "Workflow/execution DB tables, WorkflowDefinition/StepDefinition Zod schemas, yaml/croner deps"
  - phase: 01-foundation
    provides: "DB singleton, Drizzle schema patterns"
provides:
  - "WorkflowEngine class with execute, resume, and approval gate pauses"
  - "Step executor with tool/model/noop actions and branch evaluation"
  - "Template resolver for {{steps.X.result}}, {{steps | json}}, {{error}}"
  - "Workflow loader for YAML and .workflow.ts definitions"
  - "Workflow execution state persistence to SQLite"
affects: [08-03-scheduler-heartbeat, 08-04-workflow-protocol]

# Tech tracking
tech-stack:
  added: []
  patterns: [workflow-engine-pattern, step-executor-pattern, template-resolver, durable-execution]

key-files:
  created:
    - packages/gateway/src/workflow/templates.ts
    - packages/gateway/src/workflow/loader.ts
    - packages/gateway/src/workflow/state.ts
    - packages/gateway/src/workflow/executor.ts
    - packages/gateway/src/workflow/engine.ts
  modified:
    - packages/gateway/src/workflow/index.ts
    - packages/db/src/index.ts
    - packages/db/src/connection.ts

key-decisions:
  - "Condition evaluation via new Function with restricted scope (only result variable accessible)"
  - "Durable execution: state persisted to SQLite after every step transition"
  - "Approval gates pause execution and store paused status in stepResults for resume"
  - "Template resolver only processes prompt/args fields (prevents template injection)"

patterns-established:
  - "WorkflowEngine singleton pattern with execute/resume lifecycle"
  - "Step executor dispatches by action type (tool/model/noop) with timeout support"
  - "Template resolution via {{}} syntax with restricted context"
  - "Branch evaluation: branches array > onSuccess/onFailure > next-by-index fallback"

# Metrics
duration: 3min
completed: 2026-02-17
---

# Phase 8 Plan 2: Workflow Engine Summary

**Workflow engine with YAML/TS loader, step executor (tool/model/noop), branch evaluation, template chaining, durable SQLite state, and approval gate pauses**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-17T02:25:42Z
- **Completed:** 2026-02-17T02:28:15Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- WorkflowEngine class orchestrates full workflow lifecycle: load, execute steps, persist state, pause at gates, resume
- Step executor supports tool (calls tool.execute), model (AI SDK generateText), and noop action types with timeout
- Branch evaluation via condition/goto pairs using new Function with restricted scope
- Template resolver chains step results via {{steps.stepId.result}}, {{steps | json}}, {{error}} syntax
- Workflow loader parses YAML and dynamically imports .workflow.ts definitions
- State persistence layer with save/load/list executions and workflow registration

## Task Commits

Each task was committed atomically:

1. **Task 1: Template resolver, workflow loader, and state persistence** - `3bd2000` (feat)
2. **Task 2: Step executor, workflow engine, and barrel exports** - `46f5604` (feat)

## Files Created/Modified
- `packages/gateway/src/workflow/templates.ts` - resolveTemplates for {{}} syntax in prompts/args
- `packages/gateway/src/workflow/loader.ts` - loadWorkflowDefinition and discoverWorkflows for YAML/TS
- `packages/gateway/src/workflow/state.ts` - saveExecution, loadExecution, listExecutions, registerWorkflow
- `packages/gateway/src/workflow/executor.ts` - executeStep, resolveNextStep, evaluateCondition
- `packages/gateway/src/workflow/engine.ts` - WorkflowEngine class with execute/resume/runSteps
- `packages/gateway/src/workflow/index.ts` - barrel exports for full workflow module
- `packages/db/src/index.ts` - added workflows/workflowExecutions exports
- `packages/db/src/connection.ts` - added CREATE TABLE for workflows and workflow_executions

## Decisions Made
- Condition evaluation via new Function with restricted scope (only result variable accessible)
- Durable execution: state persisted to SQLite after every step transition
- Approval gates pause execution and store paused status in stepResults for resume
- Template resolver only processes prompt/args fields to prevent template injection
- Dirent cast for Node.js v24 type compat (same pattern as 06-02)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added workflows/workflowExecutions exports from @agentspace/db**
- **Found during:** Task 1 (state persistence)
- **Issue:** workflows and workflowExecutions tables were defined in schema but not re-exported from @agentspace/db index
- **Fix:** Added exports to packages/db/src/index.ts
- **Files modified:** packages/db/src/index.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** 3bd2000 (Task 1 commit)

**2. [Rule 3 - Blocking] Added CREATE TABLE statements for workflow tables**
- **Found during:** Task 1 (state persistence)
- **Issue:** Drizzle schema existed but SQLite CREATE TABLE statements missing from connection.ts
- **Fix:** Added CREATE TABLE IF NOT EXISTS for workflows and workflow_executions
- **Files modified:** packages/db/src/connection.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** 3bd2000 (Task 1 commit)

**3. [Rule 1 - Bug] Fixed Dirent type incompatibility in loader.ts**
- **Found during:** Task 1 (workflow loader)
- **Issue:** Node.js v24 Dirent<NonSharedBuffer> type mismatch with readdirSync
- **Fix:** Cast entries to simplified type (same pattern as 06-02)
- **Files modified:** packages/gateway/src/workflow/loader.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** 3bd2000 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All auto-fixes necessary for compilation and correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Workflow engine ready for scheduler/heartbeat integration (08-03)
- Full workflow module exported from barrel for protocol wiring (08-04)
- All TypeScript compiles cleanly

---
*Phase: 08-workflows-scheduling*
*Completed: 2026-02-17*
