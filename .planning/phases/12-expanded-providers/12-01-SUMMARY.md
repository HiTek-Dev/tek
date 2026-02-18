---
phase: 12-expanded-providers
plan: 01
subsystem: llm
tags: [venice-ai, google-gemini, ollama, provider-registry, ai-sdk, pricing]

# Dependency graph
requires:
  - phase: 04-multi-provider-intelligence
    provides: "Provider registry pattern, pricing lookup, router rules"
provides:
  - "Venice AI provider registration via OpenAI-compatible adapter"
  - "Google Gemini provider registration via @ai-sdk/google"
  - "Configurable Ollama remote endpoints via ollamaEndpoints config"
  - "Venice and Gemini model pricing with wildcard fallbacks"
  - "Extended PROVIDERS array with venice and google"
affects: [12-02, gateway, cli]

# Tech tracking
tech-stack:
  added: ["@ai-sdk/google@^3"]
  patterns: ["Configurable multi-endpoint Ollama registration", "Venice via OpenAI-compatible adapter"]

key-files:
  created: []
  modified:
    - packages/gateway/src/llm/registry.ts
    - packages/gateway/src/usage/pricing.ts
    - packages/cli/src/vault/providers.ts
    - packages/gateway/src/llm/types.ts
    - packages/core/src/config/schema.ts
    - packages/core/src/config/index.ts
    - packages/gateway/package.json

key-decisions:
  - "Venice AI uses OpenAI-compatible adapter (same pattern as Ollama) with bearer token auth"
  - "Google Gemini uses dedicated @ai-sdk/google package for native support"
  - "Ollama endpoints configurable via ollamaEndpoints array in AppConfig; first endpoint keeps 'ollama' name for backward compat"
  - "Venice wildcard pricing defaults to $0.50/MTok (conservative estimate for unknown models)"

patterns-established:
  - "Multi-endpoint provider naming: first=base name, rest=base-{name} for backward compatibility"
  - "Provider-specific wildcard pricing in getModelPricing with fallthrough ordering"

requirements-completed:
  - "Venice API integration"
  - "Google AI Studio/Gemini integration"
  - "Ollama remote host configuration"
  - "Extended provider registry"

# Metrics
duration: 3min
completed: 2026-02-18
---

# Phase 12 Plan 01: Expanded Provider Registry Summary

**Venice AI, Google Gemini, and configurable Ollama endpoints added to provider registry with pricing and vault support**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-18T07:50:21Z
- **Completed:** 2026-02-18T07:53:21Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Extended provider registry with Venice AI (OpenAI-compatible), Google Gemini (@ai-sdk/google), and configurable Ollama endpoints
- Added vault provider support for venice and google API keys with validation
- Added OllamaEndpoint config schema for remote/cloud Ollama hosts beyond localhost
- Added Venice and Gemini model pricing entries with wildcard fallbacks

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend provider types, vault, and config schema** - `91b921f` (feat)
2. **Task 2: Extend provider registry, pricing, and routing tiers** - `729e93b` (feat)

## Files Created/Modified
- `packages/cli/src/vault/providers.ts` - Added venice and google to PROVIDERS array and key prefixes
- `packages/gateway/src/llm/types.ts` - Extended ProviderName union with venice and google
- `packages/core/src/config/schema.ts` - Added OllamaEndpointSchema and ollamaEndpoints to AppConfig
- `packages/core/src/config/index.ts` - Exported OllamaEndpointSchema and OllamaEndpoint type
- `packages/gateway/src/llm/registry.ts` - Venice, Google, and multi-endpoint Ollama registration
- `packages/gateway/src/usage/pricing.ts` - Venice and Gemini pricing entries with wildcards
- `packages/gateway/package.json` - Added @ai-sdk/google dependency

## Decisions Made
- Venice AI uses OpenAI-compatible adapter with bearer token auth (no dedicated SDK needed)
- Google Gemini uses dedicated @ai-sdk/google for native Gemini API support
- Ollama endpoints configurable via ollamaEndpoints array; first endpoint keeps "ollama" name for backward compat, additional endpoints use "ollama-{name}"
- Venice wildcard pricing defaults to $0.50/MTok input and output
- PROVIDER_KEY_PREFIXES for venice and google set to null (variable key formats)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Rebuilt core and cli packages before gateway type-check**
- **Found during:** Task 2 (gateway type-check)
- **Issue:** Gateway tsconfig references core/cli dist outputs; ollamaEndpoints and new Provider values not in dist
- **Fix:** Ran tsc build for core and cli packages before gateway noEmit check
- **Files modified:** None (build artifacts only)
- **Verification:** Gateway type-check passed after rebuild
- **Committed in:** 729e93b (part of Task 2 commit)

**2. [Rule 3 - Blocking] Exported OllamaEndpointSchema and OllamaEndpoint from core config index**
- **Found during:** Task 1 (not in plan but required for downstream use)
- **Issue:** New schema and type would not be accessible without re-export from index
- **Fix:** Added exports to packages/core/src/config/index.ts
- **Files modified:** packages/core/src/config/index.ts
- **Verification:** Type-check passed
- **Committed in:** 91b921f (part of Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary for compilation. No scope creep.

## Issues Encountered
- pnpm required instead of npm for dependency installation (workspace: protocol in package.json)
- Gateway depends on built dist of core/cli, requiring build before type-check

## User Setup Required
None - no external service configuration required. Venice and Google keys can be configured via existing `agent vault set` CLI command.

## Next Phase Readiness
- Provider registry supports 5 providers (anthropic, openai, ollama, venice, google)
- Ready for Plan 02: runtime validation, health checks, and provider hot-swap
- All existing Anthropic and OpenAI providers unaffected

---
*Phase: 12-expanded-providers*
*Completed: 2026-02-18*
