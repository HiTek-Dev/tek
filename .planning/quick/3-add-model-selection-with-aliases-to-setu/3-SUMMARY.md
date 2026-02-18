---
phase: quick-3
plan: 01
subsystem: config, cli, gateway
tags: [model-selection, aliases, onboarding, slash-commands]

requires:
  - phase: 13-rebrand-to-tek
    provides: centralized constants, config schema, CLI framework
provides:
  - ModelAlias schema and config fields (defaultModel, modelAliases)
  - resolveAlias() and getDefaultModel() in @tek/core
  - Model selection and alias assignment in onboarding wizard
  - /swap slash command for alias-based model switching
affects: [config, onboarding, chat]

tech-stack:
  added: []
  patterns: [config-driven model defaults, alias resolution]

key-files:
  created: []
  modified:
    - packages/core/src/config/schema.ts
    - packages/core/src/config/loader.ts
    - packages/core/src/config/index.ts
    - packages/core/src/index.ts
    - packages/gateway/src/session/types.ts
    - packages/gateway/src/session/index.ts
    - packages/gateway/src/session/manager.ts
    - packages/gateway/src/ws/handlers.ts
    - packages/gateway/src/index.ts
    - packages/cli/src/hooks/useChat.ts
    - packages/cli/src/components/Onboarding.tsx
    - packages/cli/src/commands/init.ts
    - packages/cli/src/hooks/useSlashCommands.ts

key-decisions:
  - "getDefaultModel() reads config.defaultModel with fallback to anthropic:claude-sonnet-4-5-20250929"
  - "DEFAULT_MODEL renamed to FALLBACK_MODEL in session types (absolute fallback only)"
  - "Model alias resolution is case-insensitive"
  - "Onboarding shows models filtered to providers with configured keys"
  - "Alias step is sequential (one model at a time) with 'done' shortcut"

patterns-established:
  - "Config-driven defaults: use getDefaultModel() instead of hardcoded model constants"
  - "Alias resolution pattern: loadConfig -> find alias -> return provider:modelId"

requirements-completed: [model-selection-onboarding, model-aliases, swap-command, fix-default-model]

duration: 4min
completed: 2026-02-18
---

# Quick Task 3: Model Selection with Aliases Summary

**Config-driven default model with alias resolution, onboarding model picker, and /swap command**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-18T17:31:28Z
- **Completed:** 2026-02-18T17:35:52Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments
- Config schema extended with defaultModel and modelAliases (backward compatible, both optional)
- Gateway and CLI now use getDefaultModel() from config instead of hardcoded anthropic sonnet
- Onboarding wizard includes model selection step filtered to configured providers plus alias assignment
- /swap slash command resolves aliases to provider:model IDs for instant model switching

## Task Commits

Each task was committed atomically:

1. **Task 1: Add model aliases to config schema and fix default model resolution** - `d1700f4` (feat)
2. **Task 2: Add model selection step to onboarding wizard** - `bc4ae49` (feat)
3. **Task 3: Add /swap slash command for model switching by alias** - `0c8ba7c` (feat)

## Files Created/Modified
- `packages/core/src/config/schema.ts` - Added ModelAliasSchema, defaultModel and modelAliases fields to AppConfig
- `packages/core/src/config/loader.ts` - Added resolveAlias() and getDefaultModel() functions
- `packages/core/src/config/index.ts` - Re-exported new schema, type, and functions
- `packages/core/src/index.ts` - Re-exported new items from config module
- `packages/gateway/src/session/types.ts` - Renamed DEFAULT_MODEL to FALLBACK_MODEL
- `packages/gateway/src/session/index.ts` - Updated export to FALLBACK_MODEL
- `packages/gateway/src/session/manager.ts` - Uses getDefaultModel() from @tek/core
- `packages/gateway/src/ws/handlers.ts` - Uses getDefaultModel() instead of imported DEFAULT_MODEL
- `packages/gateway/src/index.ts` - Updated export to FALLBACK_MODEL
- `packages/cli/src/hooks/useChat.ts` - Uses getDefaultModel() from @tek/core
- `packages/cli/src/components/Onboarding.tsx` - Added model-select and model-alias steps
- `packages/cli/src/commands/init.ts` - Saves defaultModel and modelAliases to config
- `packages/cli/src/hooks/useSlashCommands.ts` - Added /swap command with alias resolution

## Decisions Made
- getDefaultModel() lives in @tek/core (not gateway) to avoid circular dependencies -- reads config.defaultModel directly
- DEFAULT_MODEL renamed to FALLBACK_MODEL in session/types.ts as it's now only an absolute fallback
- Model alias matching is case-insensitive for user convenience
- Well-known models per provider are hardcoded in Onboarding component (not fetched from API)
- Ollama excluded from model selection (users need to know their local model names)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Core package main index.ts missing new exports**
- **Found during:** Task 1 (config schema and loader changes)
- **Issue:** packages/core/src/index.ts did not re-export resolveAlias, getDefaultModel, ModelAliasSchema, or ModelAlias type -- gateway and CLI could not import them
- **Fix:** Added all new exports to packages/core/src/index.ts
- **Files modified:** packages/core/src/index.ts
- **Verification:** TypeScript compilation passes for all three packages
- **Committed in:** d1700f4 (Task 1 commit)

**2. [Rule 3 - Blocking] Gateway session manager and exports used old DEFAULT_MODEL name**
- **Found during:** Task 1 (fixing default model references)
- **Issue:** session/manager.ts, session/index.ts, and gateway/index.ts still referenced DEFAULT_MODEL after it was renamed to FALLBACK_MODEL
- **Fix:** Updated all references to use FALLBACK_MODEL and getDefaultModel()
- **Files modified:** packages/gateway/src/session/manager.ts, session/index.ts, gateway/src/index.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** d1700f4 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were necessary for compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Steps
- Users running `tek init` will now see model selection after provider key setup
- Users can `/swap` between models using short aliases in chat
- Config persists across restarts in ~/.config/tek/config.json

---
*Quick Task: 3-add-model-selection-with-aliases*
*Completed: 2026-02-18*
