---
phase: 23-agent-tools-error-recovery
plan: 03
subsystem: tools
tags: [brave-search, tavily, web-search, vault, onboarding]

requires:
  - phase: 10-agent-tools
    provides: tool registry with conditional API key registration
  - phase: 15-init-onboarding-polish
    provides: onboarding wizard step flow
provides:
  - Brave Search API skill for web search
  - brave and tavily as valid vault providers
  - API key wiring for tavily and brave to tool registry
  - Brave Search setup step in tek init wizard
affects: [agent-tools, onboarding, web-search]

tech-stack:
  added: [brave-search-api]
  patterns: [conditional-tool-registration, onboarding-step-insertion]

key-files:
  created:
    - packages/gateway/src/skills/brave-search.ts
  modified:
    - packages/gateway/src/skills/index.ts
    - packages/cli/src/vault/providers.ts
    - packages/gateway/src/agent/tool-registry.ts
    - packages/gateway/src/ws/handlers.ts
    - packages/cli/src/components/Onboarding.tsx

key-decisions:
  - "Brave Search uses inputSchema pattern consistent with existing Tavily web search tool"
  - "brave and tavily vault providers use null and tvly- key prefixes respectively"
  - "Brave Search uses auto approval tier (read-only, no user prompt needed)"
  - "Brave Search init step placed between Telegram and model selection in wizard flow"

patterns-established:
  - "Web search tools: conditional registration with auto approval tier for read-only operations"

requirements-completed: [TOOLS-BRAVE, TOOLS-KEYWIRING, TOOLS-INIT]

duration: 4min
completed: 2026-02-20
---

# Phase 23 Plan 03: Brave Search & API Key Wiring Summary

**Brave Search API skill with vault provider registration, tavily/brave key wiring to tool registry, and init wizard setup step**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-20T07:24:55Z
- **Completed:** 2026-02-20T07:28:37Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Brave Search tool makes proper API calls to Brave Search API with X-Subscription-Token header
- Both brave and tavily recognized as valid vault providers for `tek keys add`
- Tavily and Brave API keys wired from vault to tool registry (tavily was previously missing)
- Brave Search setup step added to tek init wizard between Telegram and model selection

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Brave Search skill and add brave/tavily as vault providers** - `1b46af0` (feat)
2. **Task 2: Wire Brave/Tavily API keys to tool registry and add Brave Search to tek init wizard** - `913e4ff` (feat)

## Files Created/Modified
- `packages/gateway/src/skills/brave-search.ts` - Brave Search API tool with GET request, error handling, result formatting
- `packages/gateway/src/skills/index.ts` - Export createBraveSearchTool
- `packages/cli/src/vault/providers.ts` - Added brave and tavily to PROVIDERS array and PROVIDER_KEY_PREFIXES
- `packages/gateway/src/agent/tool-registry.ts` - braveApiKey option, import, and conditional brave_search registration
- `packages/gateway/src/ws/handlers.ts` - Wire tavilyApiKey and braveApiKey from vault to buildToolRegistry
- `packages/cli/src/components/Onboarding.tsx` - brave-ask and brave-input steps, summary display

## Decisions Made
- Used inputSchema (AI SDK v6) instead of parameters, matching existing web-search.ts pattern
- Brave Search uses auto approval tier (read-only, consistent with Tavily web_search)
- Brave key prefix set to null (no standard prefix), Tavily prefix set to "tvly-"
- Brave Search init wizard step placed after Telegram, before model selection

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed inputSchema vs parameters for AI SDK v6**
- **Found during:** Task 1
- **Issue:** Plan specified `parameters` but AI SDK v6 uses `inputSchema` for tool definitions
- **Fix:** Changed to `inputSchema` matching existing web-search.ts pattern
- **Files modified:** packages/gateway/src/skills/brave-search.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** 1b46af0

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for AI SDK v6 compatibility. No scope creep.

## Issues Encountered
- CLI package needed rebuilding before gateway type-check would pass (gateway references CLI dist types for Provider union)

## User Setup Required

Brave Search API key required for web search functionality:
- Get a free API key at https://brave.com/search/api/ (2000 queries/month free tier)
- Run `tek keys add brave` to store the key

## Next Phase Readiness
- All web search tools now properly wired (both Tavily and Brave Search)
- Agent has working web search capability when either API key is configured
- Init wizard guides users through Brave Search setup

---
*Phase: 23-agent-tools-error-recovery*
*Completed: 2026-02-20*
