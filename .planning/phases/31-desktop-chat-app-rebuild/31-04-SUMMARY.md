---
phase: 31-desktop-chat-app-rebuild
plan: 04
subsystem: ui
tags: [react, streamdown, shadcn-ui, chat, streaming, auto-scroll, tauri, websocket]

# Dependency graph
requires:
  - phase: 31-02
    provides: "Gateway discovery, config loading, Layout shell, Zustand store"
  - phase: 31-03
    provides: "useChat hook with streaming state, useWebSocket, gateway-client types"
provides:
  - MessageCard component with user/assistant/tool_call rendering
  - StreamingMessage component with Streamdown and pulsing indicator
  - MessageList with smart auto-scroll and scroll-to-bottom button
  - ChatInput with auto-resize textarea and Enter-to-send
  - AgentSelector with auto-select and dropdown for multiple agents
  - ChatView composing all chat components with useChat and useConfig hooks
  - Layout back-to-landing navigation button
affects: [31-05]

# Tech tracking
tech-stack:
  added: []
  patterns: [streaming-markdown-rendering, smart-auto-scroll, auto-resize-textarea, agent-auto-selection]

key-files:
  created:
    - apps/desktop/src/components/MessageCard.tsx
    - apps/desktop/src/components/StreamingMessage.tsx
    - apps/desktop/src/components/MessageList.tsx
    - apps/desktop/src/components/ChatInput.tsx
    - apps/desktop/src/components/AgentSelector.tsx
    - apps/desktop/src/views/ChatView.tsx
  modified:
    - apps/desktop/src/App.tsx
    - apps/desktop/src/components/Layout.tsx

key-decisions:
  - "Streamdown plugins instantiated as module-level const (code plugin) to avoid re-initialization on every render"
  - "Layout main area changed from overflow-auto to overflow-hidden for proper chat scroll containment"
  - "ScrollArea wraps a div with ref for manual scroll tracking since Radix ScrollArea viewport doesn't expose ref easily"

patterns-established:
  - "Message rendering: discriminated union on ChatMessage.type for text/tool_call/tool_approval dispatch"
  - "Smart auto-scroll: track nearBottom via onScroll threshold, auto-scroll only when user is at bottom"
  - "Chat input: auto-resize via scrollHeight measurement, Enter sends, Shift+Enter for newline"
  - "Agent selection: auto-select single agent, show dropdown for multiple, useEffect for auto-selection"

requirements-completed: [DESK-04, DESK-05, DESK-06]

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 31 Plan 04: Chat View and Message Components Summary

**Complete chat interface with MessageCard (user/assistant/tool), Streamdown streaming markdown, smart auto-scroll MessageList, auto-resize ChatInput, and AgentSelector with auto-selection**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-22T03:56:22Z
- **Completed:** 2026-02-22T03:58:52Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- MessageCard renders user messages right-aligned, assistant messages left-aligned with Streamdown markdown, tool calls as expandable cards with status icons (spinning loader, check, X)
- StreamingMessage uses Streamdown with code plugin for flicker-free streaming markdown rendering with pulsing dot indicator
- MessageList implements smart auto-scroll: follows new content when user is at bottom, stops when user scrolls up, shows floating "Scroll to bottom" button
- ChatInput auto-resizes (1-6 rows), submits on Enter (Shift+Enter for newline), disables during streaming
- AgentSelector auto-selects single agent, shows dropdown for multiple, displays Bot icon with agent name
- ChatView composes all components with useChat hook (messages, streaming, sendMessage) and useConfig (agent list)
- App.tsx now renders real ChatView instead of placeholder, Layout has back-to-landing arrow button

## Task Commits

Each task was committed atomically:

1. **Task 1: Create MessageCard, StreamingMessage, and MessageList components** - `72f18f1` (feat)
2. **Task 2: Create ChatInput, AgentSelector, ChatView, and wire into App** - `2ad5596` (feat)

## Files Created/Modified
- `apps/desktop/src/components/MessageCard.tsx` - Message bubble (user right-aligned, assistant left-aligned with Streamdown, tool calls expandable)
- `apps/desktop/src/components/StreamingMessage.tsx` - Active streaming message with Streamdown and pulsing dot
- `apps/desktop/src/components/MessageList.tsx` - Scrollable message container with smart auto-scroll and scroll-to-bottom button
- `apps/desktop/src/components/ChatInput.tsx` - Auto-resizing textarea with Enter-to-send and Send button
- `apps/desktop/src/components/AgentSelector.tsx` - Agent picker with auto-select for single agent, dropdown for multiple
- `apps/desktop/src/views/ChatView.tsx` - Full chat interface composing all chat components with useChat and useConfig
- `apps/desktop/src/App.tsx` - Replaced ChatViewPlaceholder with real ChatView import
- `apps/desktop/src/components/Layout.tsx` - Added back-to-landing arrow button, changed overflow to hidden

## Decisions Made
- Streamdown plugins object (with code plugin) instantiated at module level as a const to avoid re-creating on every render
- Layout main area changed from `overflow-auto` to `overflow-hidden` to let ChatView manage its own scroll containment
- ScrollArea wraps a manual div with ref + onScroll for smart auto-scroll tracking, since Radix ScrollArea viewport ref is not easily accessible
- Tool approval messages return null from MessageCard (handled by ToolApprovalModal in Plan 05)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All chat UI components are in place and wired to the useChat hook
- Plan 05 (tool approval modal) can add ToolApprovalModal and integrate with the existing approveToolCall from useChat
- TypeScript compiles cleanly with no errors

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 31-desktop-chat-app-rebuild*
*Completed: 2026-02-22*
