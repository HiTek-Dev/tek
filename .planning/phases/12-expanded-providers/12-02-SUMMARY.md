---
phase: 12-expanded-providers
plan: 02
subsystem: llm
tags: [venice-ai, image-generation, video-generation, tool-registry, skills, ai-sdk]

# Dependency graph
requires:
  - phase: 12-expanded-providers
    plan: 01
    provides: "Venice provider registration, API key vault support"
  - phase: 10-skill-tools
    provides: "Skill tool pattern (raw-fetch tools with tool() from AI SDK)"
provides:
  - "Venice AI image generation tool (venice_image_generate)"
  - "Venice AI video generation tool (venice_video_generate)"
  - "API keys wired from vault to tool registry at runtime"
affects: [gateway]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Queue/poll async video generation pattern", "Vault-backed skill tool API key injection"]

key-files:
  created:
    - packages/gateway/src/skills/venice-image.ts
    - packages/gateway/src/skills/venice-video.ts
  modified:
    - packages/gateway/src/skills/index.ts
    - packages/gateway/src/agent/tool-registry.ts
    - packages/gateway/src/ws/handlers.ts

key-decisions:
  - "Venice image tool uses raw fetch POST to /image/generate with JSON body (same pattern as Stability AI)"
  - "Venice video tool uses two-step queue/poll pattern: POST /video/queue then poll /video/retrieve every 10s"
  - "API keys wired from vault via getKey() in handlers.ts for openai and venice (tavily/stability not vault providers)"
  - "Both Venice tools use session approval tier (paid API operations)"

patterns-established:
  - "Queue/poll pattern for async generation APIs (queue job, poll for result with timeout)"

requirements-completed:
  - "Venice API integration"
  - "Model switching verification"

# Metrics
duration: 3min
completed: 2026-02-18
---

# Phase 12 Plan 02: Venice Skills and Provider Integration Summary

**Venice AI image/video generation tools with queue/poll pattern, wired into tool registry with vault-backed API keys**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-18T07:55:58Z
- **Completed:** 2026-02-18T07:58:43Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created Venice AI image generation tool following established raw-fetch skill pattern
- Created Venice AI video generation tool with async queue/poll pattern (10s interval, 5min timeout)
- Wired Venice and OpenAI API keys from vault into tool registry via handlers.ts
- Verified hot-swap compatibility through existing resolveModelId/registry.languageModel pipeline

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Venice image and video generation tools** - `ccd77cd` (feat)
2. **Task 2: Wire Venice tools into tool registry and connect API keys** - `bd79bf1` (feat)

## Files Created/Modified
- `packages/gateway/src/skills/venice-image.ts` - Venice AI image generation tool via /image/generate
- `packages/gateway/src/skills/venice-video.ts` - Venice AI video generation tool via /video/queue and /video/retrieve
- `packages/gateway/src/skills/index.ts` - Added barrel exports for Venice tools
- `packages/gateway/src/agent/tool-registry.ts` - Conditional Venice tool registration with session approval tier
- `packages/gateway/src/ws/handlers.ts` - Wired openaiApiKey and veniceApiKey from vault into buildToolRegistry

## Decisions Made
- Venice image tool uses raw fetch POST with JSON body to /image/generate endpoint (consistent with Stability AI pattern)
- Venice video tool uses two-step queue/poll: POST to /video/queue returns queue_id, then POST to /video/retrieve every 10s with max 30 attempts (5 minutes)
- Both Venice tools use "session" approval tier since they consume paid API credits
- Only wired openai and venice API keys in handlers.ts (tavily and stability are not valid vault Provider types); this is a known limitation to be addressed when those services are added to the PROVIDERS array

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Tavily and Stability keys not valid Provider types**
- **Found during:** Task 2 (wiring API keys in handlers.ts)
- **Issue:** `getKey("tavily")` and `getKey("stability")` fail TypeScript -- these are not in the PROVIDERS array
- **Fix:** Only wired `getKey("openai")` and `getKey("venice")` which are valid providers; tavily/stability keys were never wired before either
- **Files modified:** packages/gateway/src/ws/handlers.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** bd79bf1 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor scope reduction -- tavily/stability key wiring deferred since they require PROVIDERS array expansion. No functional regression (they were never wired before).

## Issues Encountered
- getKey() only accepts Provider type values; tavily and stability are service-specific keys not in the provider list. This is a pre-existing architectural gap, not introduced by this plan.

## User Setup Required
None - Venice API keys can be configured via existing `agent vault set venice` CLI command.

## Next Phase Readiness
- All Phase 12 providers fully integrated: Anthropic, OpenAI, Ollama, Venice, Google
- Venice text streaming works via OpenAI-compatible adapter (Plan 01)
- Venice image and video generation available as skill tools (Plan 02)
- Hot-swap between any provider works through unified registry pipeline
- Phase 12 complete -- all expanded provider goals achieved

---
*Phase: 12-expanded-providers*
*Completed: 2026-02-18*
