---
phase: 22-agent-first-contact-dashboard-polish
plan: 03
subsystem: ui
tags: [tauri, react, zustand, websocket, agent-selection, desktop]

# Dependency graph
requires:
  - phase: 22-02
    provides: "Default agent sentinel removal from backend"
  - phase: 21-02
    provides: "Per-message agentId in WS protocol and gateway"
provides:
  - "Agent selector dropdown in desktop chat header"
  - "agentId sent in every desktop chat.send WS message"
  - "Clean agents page without DEFAULT_AGENT constant"
  - "Layout border between sidebar and content"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "selectedAgentId in Zustand store for cross-component agent state"
    - "Auto-select first/default agent via useEffect"

key-files:
  created: []
  modified:
    - apps/desktop/src/lib/gateway-client.ts
    - apps/desktop/src/hooks/useChat.ts
    - apps/desktop/src/stores/app-store.ts
    - apps/desktop/src/pages/ChatPage.tsx
    - apps/desktop/src/pages/AgentsPage.tsx
    - apps/desktop/src/lib/files.ts
    - apps/desktop/src/hooks/useIdentityFiles.ts
    - apps/desktop/src/components/Layout.tsx
    - apps/desktop/src/components/Sidebar.tsx

key-decisions:
  - "selectedAgentId stored in Zustand app store for persistence across page navigation"
  - "Auto-select uses config defaultAgentId with fallback to first agent in list"
  - "useIdentityFiles cache key changed from 'default' to 'global' for clarity"

patterns-established:
  - "Agent selector dropdown pattern: config-driven select with store-backed state"

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-02-19
---

# Phase 22 Plan 03: Desktop Agent Selection & Layout Polish Summary

**Desktop chat wired with agentId in WS messages via selector dropdown, DEFAULT_AGENT removed from agents page, layout polished with sidebar border and improved spacing**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T06:05:58Z
- **Completed:** 2026-02-20T06:07:53Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Desktop chat sends agentId in every chat.send WS message via agent selector
- DEFAULT_AGENT constant and all 'default' special-case checks removed from agents page
- Layout has clean border-l separator between sidebar and content area
- Sidebar nav items have improved vertical spacing

## Task Commits

Each task was committed atomically:

1. **Task 1: Add agentId to desktop chat flow and agent selector UI** - `2cf19a2` (feat)
2. **Task 2: Remove DEFAULT_AGENT from agents page and polish layout spacing** - `8d72ccc` (feat)

## Files Created/Modified
- `apps/desktop/src/lib/gateway-client.ts` - Added agentId to createChatSendMessage opts
- `apps/desktop/src/hooks/useChat.ts` - Added agentId to UseChatOptions, passed to WS message
- `apps/desktop/src/stores/app-store.ts` - Added selectedAgentId/setSelectedAgentId state
- `apps/desktop/src/pages/ChatPage.tsx` - Agent selector dropdown, auto-select, onboard prompt
- `apps/desktop/src/pages/AgentsPage.tsx` - Removed DEFAULT_AGENT, updated empty state
- `apps/desktop/src/lib/files.ts` - Removed 'default' agentId special-case in getIdentityDir
- `apps/desktop/src/hooks/useIdentityFiles.ts` - Changed cache key from 'default' to 'global'
- `apps/desktop/src/components/Layout.tsx` - Added border-l between sidebar and content
- `apps/desktop/src/components/Sidebar.tsx` - Improved nav spacing with space-y-1 and py-2.5

## Decisions Made
- selectedAgentId stored in Zustand app store so it persists across page navigation
- Auto-select uses config defaultAgentId with fallback to first agent in list
- useIdentityFiles cache key changed from 'default' to 'global' for semantic clarity
- Empty chat state shows "tek onboard" prompt when no agents exist

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Desktop app fully wired with agent selection in chat
- All DEFAULT_AGENT references removed across desktop codebase
- Layout polish complete with sidebar/content separation

---
*Phase: 22-agent-first-contact-dashboard-polish*
*Completed: 2026-02-19*

## Self-Check: PASSED
