# Phase 34: CLI Chat UX Overhaul - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Transform the CLI chat from a simple vertical flex layout into a Claude Code / Kimicode-style UX: fixed bottom input zone with bordered box, status line pinned below input, streaming responses and conversation history scrolling above, tool calls and approvals rendered inline. Clean separation between the compose zone and the read zone.

</domain>

<decisions>
## Implementation Decisions

### Input zone behavior
- Fixed at bottom of terminal, bordered box with visible border (like Claude Code's yellow-bordered input)
- Expands as user types, up to ~6 lines max, then scrolls internally
- Full cursor editing: left/right arrow keys, Home/End, insert/delete at cursor position (upgrade from current append-only)
- Placeholder text when empty (dimmed, contextual hint)
- Hint line below input showing keyboard shortcuts (e.g., "! for bash · / for commands · esc to undo")
- `>` prompt prefix on first line
- Enter to send, Shift+Enter for newline, Up/Down for history (when input empty)

### Status section placement
- Single status line pinned below the input box (bottom of screen)
- Contains: model name, connection status (green/red dot), token usage & cost, permission mode
- Permission mode shows current mode with keyboard shortcut to cycle between modes (like Claude Code's "shift+tab to cycle")
- Remove the current top status bar entirely — all status info lives in the bottom bar
- Single line only (no expansion during streaming)

### Scroll & separation
- Conversation history scrolls above the fixed input zone
- Horizontal rule divider (thin line like ───) between conversation and input zone
- Auto-scroll behavior: Claude's discretion on pause-on-scroll-up vs always-auto-scroll
- Tool calls appear inline in the conversation flow (not in a separate panel) — colored entries like Read(...), Bash(...), Update(...)
- Approval prompts appear as boxed dialogs inline in the conversation area (not replacing input). Input stays visible but disabled during approval. Selectable options (Yes/No/Always) inside the box

### Visual styling
- Inspired by Claude Code but distinct — same layout structure, Tek's own color palette and personality
- Tool calls use colored prefixes with Unicode icons: distinct icon + color per tool type (e.g., ▶ for bash, ● for reads, ✎ for edits)
- Inline diffs for file edits: red/green line coloring directly in conversation flow, collapsible for long diffs
- Todo/task progress display matches Claude Code's nested tree style: colored status icons (✔ green, ■ red/orange, □ pending) with indented hierarchy

### Claude's Discretion
- Exact color palette and icon choices for Tek's distinct visual identity
- Auto-scroll pause behavior (pause on scroll up vs always follow)
- Placeholder text content
- Exact border characters and padding
- How to handle terminal resize during active session
- Collapsible diff threshold (how many lines before auto-collapsing)

</decisions>

<specifics>
## Specific Ideas

- User provided Claude Code screenshots as reference: fixed bordered input at bottom, status bar below, inline tool calls with colored bullets, boxed approval dialogs, diff-style file edits (red/green), nested task tree with checkmarks
- "Inspired but distinct" — not a clone, but the same structural patterns with Tek's own feel
- Kimicode UX also referenced as inspiration (similar fixed-input-at-bottom pattern)
- The existing Ink-based React terminal framework should be leveraged (no framework change)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 34-cli-chat-ux-overhaul*
*Context gathered: 2026-02-21*
