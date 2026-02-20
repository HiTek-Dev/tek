---
phase: 21-init-agent-onboarding-rework
plan: 01
subsystem: cli
tags: [commander, ink, onboarding, agent-management, zod]

# Dependency graph
requires:
  - phase: 15-init-onboarding-polish
    provides: Personality presets, model alias flow, Telegram setup in init
  - phase: 16-agent-personality-system
    provides: Agent identity cascade resolution, per-agent directories
provides:
  - Slimmed tek init (app-level config only)
  - tek onboard command for creating named agents with full wizard
  - Extended AgentDefinitionSchema with workspaceDir, purpose, personalityPreset, createdAt
  - Per-agent ensureMemoryFile and applyPersonalityPreset via optional agentId parameter
affects: [21-02, 21-03, desktop-agents-page, gateway-identity]

# Tech tracking
tech-stack:
  added: []
  patterns: [per-agent identity file placement via agentId parameter, toAgentId slugification]

key-files:
  created:
    - packages/cli/src/commands/onboard.ts
    - packages/cli/src/components/AgentOnboarding.tsx
  modified:
    - packages/core/src/config/schema.ts
    - packages/core/src/index.ts
    - packages/cli/src/components/Onboarding.tsx
    - packages/cli/src/commands/init.ts
    - packages/cli/src/index.ts
    - packages/db/src/memory/ensure-memory.ts

key-decisions:
  - "ensureMemoryFile/applyPersonalityPreset extended with optional agentId for per-agent directories"
  - "AgentDefinition and AgentsConfig types exported from @tek/core for cross-package use"
  - "tek init done step prompts user to run tek onboard"

patterns-established:
  - "toAgentId: lowercase name, replace non-alphanumeric with hyphens, trim edges"
  - "AgentOnboarding 9-step state machine matching Onboarding.tsx UI patterns"

requirements-completed:
  - "Separate app-level init from agent onboarding"
  - "tek onboard creates named agent with model, workspace scope, purpose, personality"
  - "tek init handles keys and global config only"

# Metrics
duration: 6min
completed: 2026-02-19
---

# Phase 21 Plan 01: Init/Onboard Separation Summary

**Separated tek init from agent onboarding: slimmed init to app-level config, created tek onboard command with 9-step agent creation wizard and per-agent identity file placement**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-20T03:42:37Z
- **Completed:** 2026-02-20T03:48:44Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Stripped tek init of all agent-specific steps (personality preset, agent name, user display name, workspace directory)
- Created AgentOnboarding.tsx with full 9-step wizard: agent-name, user-display-name, personality-preset, model-override, workspace-scope, workspace-dir, purpose, summary, done
- Created tek onboard command that writes agent to config.agents.list, creates per-agent identity directory with personality files, and sets defaultAgentId
- Extended AgentDefinitionSchema with workspaceDir, purpose, personalityPreset, createdAt fields

## Task Commits

Each task was committed atomically:

1. **Task 1: Slim tek init and extend AgentDefinitionSchema** - `2844b28` (feat)
2. **Task 2: Create tek onboard command and AgentOnboarding component** - `54b424b` (feat)

## Files Created/Modified
- `packages/core/src/config/schema.ts` - Extended AgentDefinitionSchema with 4 new optional fields
- `packages/core/src/index.ts` - Added AgentDefinition and AgentsConfig type exports
- `packages/cli/src/components/Onboarding.tsx` - Removed hatch-ask, hatch-name, workspace steps; slimmed result/props interfaces
- `packages/cli/src/commands/init.ts` - Removed identity file writing, personality preset, agent-specific config persistence
- `packages/cli/src/commands/onboard.ts` - New command: agent creation with config persistence and identity files
- `packages/cli/src/components/AgentOnboarding.tsx` - New component: 9-step agent wizard
- `packages/cli/src/index.ts` - Registered onboardCommand
- `packages/db/src/memory/ensure-memory.ts` - Added optional agentId to ensureMemoryFile and applyPersonalityPreset

## Decisions Made
- Extended ensureMemoryFile and applyPersonalityPreset with optional agentId parameter (backward-compatible) instead of creating new agent-specific variants
- Exported AgentDefinition and AgentsConfig types from @tek/core index for use in CLI onboard command
- Init done step now shows "Run tek onboard to create your first agent" instead of generic help text

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added agentId parameter to ensureMemoryFile and applyPersonalityPreset**
- **Found during:** Task 2 (onboard command creation)
- **Issue:** Both functions only wrote to global memory directory, no way to target per-agent directories
- **Fix:** Added optional agentId parameter that routes to resolveAgentDir(agentId) when provided
- **Files modified:** packages/db/src/memory/ensure-memory.ts
- **Verification:** TypeScript compiles, backward-compatible (parameter is optional)
- **Committed in:** 54b424b (Task 2 commit)

**2. [Rule 3 - Blocking] Exported AgentDefinition type from @tek/core**
- **Found during:** Task 2 (onboard command creation)
- **Issue:** AgentDefinition type existed in schema.ts but was not exported from @tek/core index
- **Fix:** Added AgentDefinition and AgentsConfig to the type exports in core/src/index.ts
- **Files modified:** packages/core/src/index.ts
- **Verification:** CLI builds successfully with import type { AgentDefinition } from "@tek/core"
- **Committed in:** 54b424b (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for the onboard command to function. No scope creep.

## Issues Encountered
- CLI package uses compiled .d.ts from core/db (not source references), so core and db needed a full `tsc` build before CLI could type-check

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- tek onboard command is fully functional, ready for Plan 02 (agent selection in chat, gateway identity injection)
- All TypeScript packages compile cleanly

---
*Phase: 21-init-agent-onboarding-rework*
*Completed: 2026-02-19*
