---
phase: 10-claude-code-system-skills
plan: 04
subsystem: agent
tags: [googleapis, google-workspace, gmail, drive, calendar, docs, oauth2, ai-sdk]

# Dependency graph
requires:
  - phase: 06-tool-system
    provides: "Tool registry, approval gate, MCP client manager"
  - phase: 10-claude-code-system-skills
    provides: "System skills barrel exports and conditional registration pattern (10-03)"
provides:
  - "Google OAuth2 auth helper for personal accounts"
  - "8 Google Workspace AI SDK tools (Gmail, Drive, Calendar, Docs)"
  - "Conditional Google Workspace tool registration in tool registry"
affects: []

# Tech tracking
tech-stack:
  added: [googleapis]
  patterns: [oauth2-personal-account-auth, google-api-tool-factory, read-auto-write-session-approval]

key-files:
  created:
    - packages/gateway/src/skills/google-auth.ts
    - packages/gateway/src/skills/google-workspace.ts
  modified:
    - packages/gateway/src/skills/index.ts
    - packages/gateway/src/agent/tool-registry.ts
    - packages/gateway/src/index.ts

key-decisions:
  - "OAuth 2.0 for personal accounts via googleapis built-in token refresh"
  - "inputSchema (AI SDK v6) not parameters for tool definitions"
  - "Conditional registration: tools only added when googleAuth config provided"
  - "Read ops use auto approval tier; write ops use session approval tier"

patterns-established:
  - "Google API tool factory: createGoogleWorkspaceTools(auth) returns tool map"
  - "Auth.OAuth2Client explicit return type to avoid non-portable inferred types"

# Metrics
duration: 3min
completed: 2026-02-16
---

# Phase 10 Plan 04: Google Workspace Integration Summary

**Gmail, Drive, Calendar, and Docs AI SDK tools with OAuth 2.0 personal account auth via googleapis**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-17T05:09:05Z
- **Completed:** 2026-02-17T05:12:15Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- OAuth 2.0 auth helper using googleapis with automatic token refresh for personal accounts
- 8 Google Workspace tools: gmail_search, gmail_read, drive_search, drive_read, calendar_list, calendar_create, docs_read, docs_create
- Conditional tool registration in tool registry with read=auto/write=session approval tiers
- Gateway barrel exports updated with all Google Workspace modules

## Task Commits

Each task was committed atomically:

1. **Task 1: Google OAuth helper and Workspace tools** - `cdbe26f` (feat)
2. **Task 2: Register Google Workspace tools in tool registry** - `9a216ea` (feat)

## Files Created/Modified
- `packages/gateway/src/skills/google-auth.ts` - OAuth2Client factory with refresh token credentials
- `packages/gateway/src/skills/google-workspace.ts` - 8 Google Workspace AI SDK tools
- `packages/gateway/src/skills/index.ts` - Barrel exports for google-auth and google-workspace
- `packages/gateway/src/agent/tool-registry.ts` - Conditional Google tools registration with approval tiers
- `packages/gateway/src/index.ts` - Gateway package exports for system skills

## Decisions Made
- Used Auth.OAuth2Client explicit return type annotation to avoid non-portable inferred type error (googleapis re-exports from google-auth-library)
- Used inputSchema (AI SDK v6 convention) instead of parameters for all tool definitions
- Read operations (gmail_search, gmail_read, drive_search, drive_read, calendar_list, docs_read) get "auto" approval tier
- Write operations (calendar_create, docs_create) get "session" approval tier
- Conditional registration only when googleAuth config object is provided (consistent with API-key-gated pattern from 10-03)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used inputSchema instead of parameters for AI SDK v6**
- **Found during:** Task 1
- **Issue:** Plan specified `parameters` but AI SDK v6 uses `inputSchema` for tool definitions
- **Fix:** Changed all 8 tool definitions to use `inputSchema` instead of `parameters`
- **Files modified:** packages/gateway/src/skills/google-workspace.ts
- **Verification:** tsc --noEmit passes clean
- **Committed in:** cdbe26f (Task 1 commit)

**2. [Rule 1 - Bug] Added explicit return type for createGoogleAuth**
- **Found during:** Task 1
- **Issue:** TypeScript error TS2742: inferred type references non-portable google-auth-library path
- **Fix:** Added explicit `Auth.OAuth2Client` return type annotation
- **Files modified:** packages/gateway/src/skills/google-auth.ts
- **Verification:** tsc --noEmit passes clean
- **Committed in:** cdbe26f (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for TypeScript compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
Google Workspace tools require OAuth 2.0 credentials:
- `GOOGLE_CLIENT_ID` - from Google Cloud Console -> APIs & Services -> Credentials
- `GOOGLE_CLIENT_SECRET` - from same location
- `GOOGLE_REFRESH_TOKEN` - generated during first-time OAuth flow
- Enable Gmail, Drive, Calendar, and Docs APIs in Google Cloud Console

## Next Phase Readiness
- All Google Workspace tools implemented and registered
- Phase 10 plan 04 is the final plan -- phase complete

---
*Phase: 10-claude-code-system-skills*
*Completed: 2026-02-16*
