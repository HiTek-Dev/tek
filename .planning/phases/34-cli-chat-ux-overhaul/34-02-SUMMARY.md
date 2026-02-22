---
phase: 34-cli-chat-ux-overhaul
plan: 02
subsystem: ui
tags: [ink, react, terminal, inline-tools, approval-dialog, diff-rendering, todo-tree]

# Dependency graph
requires:
  - phase: 34-cli-chat-ux-overhaul
    provides: Fullscreen layout with ConversationScroll, InputBar, StatusBar
provides:
  - InlineToolCall with colored icon prefixes per tool type
  - InlineApproval unified approval dialog (tool, skill, preflight)
  - InlineDiff red/green line diff rendering with auto-collapse
  - Restyled TodoPanel with tree-style layout and Unicode status icons
  - Diff heuristic detection in MessageBubble for tool call output
affects: [cli-chat-rendering, cli-ux, future-diff-gateway-support]

# Tech tracking
tech-stack:
  added: [diff]
  patterns: [inline-tool-rendering, unified-approval-component, diff-heuristic-detection, tree-style-todo]

key-files:
  created:
    - packages/cli/src/components/InlineToolCall.tsx
    - packages/cli/src/components/InlineApproval.tsx
    - packages/cli/src/components/InlineDiff.tsx
  modified:
    - packages/cli/src/components/MessageBubble.tsx
    - packages/cli/src/components/Chat.tsx
    - packages/cli/src/components/ConversationScroll.tsx
    - packages/cli/src/components/TodoPanel.tsx
    - packages/cli/package.json

key-decisions:
  - "Unified InlineApproval component replaces three separate approval components (ToolApprovalPrompt, SkillApprovalPrompt, PreflightChecklist)"
  - "ToolPanel removed from Chat.tsx -- tool calls now render inline via MessageBubble and InlineToolCall"
  - "Diff heuristic detection: check first 10 lines for + and - prefixed lines to auto-render InlineDiff"
  - "Auto-collapse threshold of 20 changed lines for InlineDiff, Enter key toggle for focused diff"
  - "isLastToolCall prop tracks most recent tool call for diff focus control"

patterns-established:
  - "InlineToolCall TOOL_ICONS mapping for per-tool-type colored icon prefixes"
  - "InlineApproval with isActive prop for keyboard focus control during approvals"
  - "looksLikeDiff heuristic for detecting diff-like output in tool results"
  - "Tree-style TodoPanel with box drawing characters and Unicode status icons"

requirements-completed: [CLIX-05, CLIX-06, CLIX-07, CLIX-08]

# Metrics
duration: 4min
completed: 2026-02-22
---

# Phase 34 Plan 02: Inline Rendering Summary

**Inline tool calls with colored icons, unified approval dialogs, red/green diff rendering, and tree-style todo display in conversation scroll area**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-22T07:03:32Z
- **Completed:** 2026-02-22T07:07:56Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Tool calls render inline in conversation with colored icon prefixes per tool type (8 tool types mapped)
- Approval dialogs (tool, skill, preflight) appear as boxed prompts inside conversation scroll -- input zone stays visible
- InlineDiff component renders red/green line changes with auto-collapse for large diffs and Enter-key toggle
- TodoPanel restyled with tree-style layout using box drawing characters and Unicode status icons
- Removed ToolPanel and old approval-replaces-input pattern from Chat.tsx

## Task Commits

Each task was committed atomically:

1. **Task 1: Create InlineToolCall, InlineApproval, and refactor approval flow** - `51e7077` (feat)
2. **Task 2: Create InlineDiff, restyle TodoPanel, and wire diff rendering** - `683a59f` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `packages/cli/src/components/InlineToolCall.tsx` - Compact colored tool call display with TOOL_ICONS mapping (8 tool types)
- `packages/cli/src/components/InlineApproval.tsx` - Unified boxed approval dialog for tool, skill, and preflight types
- `packages/cli/src/components/InlineDiff.tsx` - Red/green line diff with diffLines, auto-collapse >20 lines, Enter toggle
- `packages/cli/src/components/MessageBubble.tsx` - Uses InlineToolCall for tool_call/bash_command, InlineDiff for diff-like output
- `packages/cli/src/components/Chat.tsx` - Removed ToolPanel and old approval imports, wires approval via ConversationScroll
- `packages/cli/src/components/ConversationScroll.tsx` - Accepts approval props, renders InlineApproval, passes isLastToolCall
- `packages/cli/src/components/TodoPanel.tsx` - Tree-style layout with box drawing characters, Unicode check/circle/spinner icons
- `packages/cli/package.json` - Added diff dependency
- `pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- **Unified InlineApproval:** Combined ToolApprovalPrompt, SkillApprovalPrompt, and PreflightChecklist into one component. Old files remain in codebase (not deleted) but are no longer imported by Chat.tsx.
- **ToolPanel removed from Chat.tsx:** Tool calls already appear as messages via useChat, so InlineToolCall via MessageBubble is sufficient. No separate live panel needed.
- **Diff heuristic detection:** Simple check for `+ ` and `- ` prefixed lines in first 10 lines of tool output. Gateway does not yet send structured old/new content, so this prepares the UI for when it does.
- **Auto-collapse threshold:** Diffs with >20 changed lines start collapsed. The most recent tool call gets keyboard focus for Enter-to-toggle.
- **isLastToolCall prop:** ConversationScroll identifies the last tool_call message and passes focus flag so only the most recent diff responds to keyboard input.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None -- both tasks built cleanly on the first try.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 34 CLI Chat UX Overhaul is complete
- Fullscreen layout (Plan 01) + inline rendering (Plan 02) deliver the Claude Code-style UX
- Old approval components (ToolApprovalPrompt, SkillApprovalPrompt, PreflightChecklist) can be cleaned up in a future housekeeping pass
- InlineDiff is wired with heuristic detection; when gateway sends structured diff content, it can be enhanced with actual old/new text

---
*Phase: 34-cli-chat-ux-overhaul*
*Completed: 2026-02-22*
