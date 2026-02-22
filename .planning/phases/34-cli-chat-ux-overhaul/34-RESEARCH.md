# Phase 34: CLI Chat UX Overhaul - Research

**Researched:** 2026-02-21
**Domain:** Terminal UI layout architecture (Ink/React), fullscreen terminal apps, cursor-based text editing
**Confidence:** MEDIUM-HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Fixed input zone at bottom of terminal, bordered box with visible border (like Claude Code's yellow-bordered input)
- Input expands as user types, up to ~6 lines max, then scrolls internally
- Full cursor editing: left/right arrow keys, Home/End, insert/delete at cursor position (upgrade from current append-only)
- Placeholder text when empty (dimmed, contextual hint)
- Hint line below input showing keyboard shortcuts (e.g., "! for bash . / for commands . esc to undo")
- `>` prompt prefix on first line
- Enter to send, Shift+Enter for newline, Up/Down for history (when input empty)
- Single status line pinned below the input box (bottom of screen)
- Status contains: model name, connection status (green/red dot), token usage & cost, permission mode
- Permission mode shows current mode with keyboard shortcut to cycle between modes
- Remove the current top status bar entirely -- all status info lives in the bottom bar
- Single line only (no expansion during streaming)
- Conversation history scrolls above the fixed input zone
- Horizontal rule divider (thin line like ---) between conversation and input zone
- Tool calls appear inline in the conversation flow (not in a separate panel) -- colored entries like Read(...), Bash(...), Update(...)
- Approval prompts appear as boxed dialogs inline in the conversation area (not replacing input). Input stays visible but disabled during approval. Selectable options (Yes/No/Always) inside the box
- Inspired by Claude Code but distinct -- same layout structure, Tek's own color palette and personality
- Tool calls use colored prefixes with Unicode icons: distinct icon + color per tool type
- Inline diffs for file edits: red/green line coloring directly in conversation flow, collapsible for long diffs
- Todo/task progress display matches Claude Code's nested tree style

### Claude's Discretion
- Exact color palette and icon choices for Tek's distinct visual identity
- Auto-scroll pause behavior (pause on scroll up vs always follow)
- Placeholder text content
- Exact border characters and padding
- How to handle terminal resize during active session
- Collapsible diff threshold (how many lines before auto-collapsing)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Summary

This phase transforms the CLI chat from a simple vertical flex layout (StatusBar on top, Static messages, streaming response, input at bottom) into a fullscreen terminal application with Claude Code-style UX: fixed bordered input zone at the bottom, status line below input, and conversation history scrolling above. The overhaul touches every component in the CLI chat: layout architecture, input handling, message rendering, tool call display, approval dialogs, and status bar placement.

The core technical challenge is that Ink (v6.7.0, the project's terminal React framework) does **not** natively support scrolling or fixed-position layouts. The current architecture uses Ink's `<Static>` component for completed messages (append-only, renders above dynamic content) which is fundamentally incompatible with a fullscreen layout where messages need to be windowed/scrolled within a fixed-height viewport. The transition requires:

1. Switching to the alternate screen buffer for fullscreen mode
2. Replacing `<Static>` with a manually-windowed message list
3. Building a cursor-aware multiline input component (replacing the current append-only InputBar)
4. Restructuring the flex layout to pin input+status at the bottom with messages filling the remaining space

**Primary recommendation:** Use `fullscreen-ink` (or manual alternate screen buffer management) for fullscreen mode, implement manual virtual scrolling for the message area using terminal height from `useStdout`, build a custom cursor-editing input component using `useInput` + cursor position state, and use the `diff` npm package for inline diff rendering.

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ink | 6.7.0 | Terminal React framework | Already in use, provides Box/Text/useInput/useStdout |
| @inkjs/ui | 2.0.0 | UI components (Spinner, Select) | Already in use for spinners and selectors |
| react | 19.2.4 | Component model | Already in use |
| ansis | 4.2.0 | ANSI color styling | Already in use for terminal colors |
| chalk | 5.6.2 | ANSI color styling | Already in use |

### New Dependencies Needed
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fullscreen-ink | latest | Alternate screen buffer + screen size hook | Wraps the Chat render for fullscreen mode |
| diff | ^8.0.0 | Structured text diff generation | Generating line-by-line diffs for inline file edit display |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fullscreen-ink | Manual `\x1b[?1049h` escape codes | fullscreen-ink adds `useScreenSize` hook + proper cleanup; manual approach is dependency-free but more error-prone |
| diff (npm) | diff-match-patch | diff is simpler, smaller, and `structuredPatch`/`diffLines` are exactly what we need for unified diffs |
| ink-multiline-input (0.1.0) | Custom cursor input | ink-multiline-input is v0.1.0 with 1 star, too immature; custom implementation using useInput + cursor state is more reliable and controllable |
| @inkjs/ui TextInput | Custom cursor input | TextInput is single-line only, no multiline support, no cursor positioning |

**Installation:**
```bash
pnpm add fullscreen-ink diff --filter @tek/cli
pnpm add -D @types/diff --filter @tek/cli
```

**Note on fullscreen-ink compatibility:** fullscreen-ink depends on ink as a peer dependency. It must be verified against Ink 6.7.0 before use. If incompatible, the alternate screen buffer pattern is trivial to implement manually (5-10 lines of code).

## Architecture Patterns

### Current Layout Structure (Being Replaced)
```
<Box flexDirection="column" padding={1}>
  <StatusBar />              ← TOP: connection, model, usage
  <WelcomeScreen />          ← Shown when no messages
  <Static items={messages}>  ← Completed messages (append-only)
    <MessageBubble />
  </Static>
  <StreamingResponse />      ← Currently streaming text
  <TodoPanel />              ← Active todos
  <ToolPanel />              ← Live tool call display
  <ToolApprovalPrompt />     ← OR: approval dialog (replaces input)
  <InputBar />               ← Bottom: text input
</Box>
```

### New Layout Structure (Target)
```
<FullScreen>
  <Box flexDirection="column" height={screenHeight}>
    ┌─────────────────────────────────────────────┐
    │ <ConversationScroll>          flexGrow={1}   │ ← Messages, tool calls,
    │   <WelcomeScreen />                          │   approvals, streaming
    │   <MessageBubble /> (windowed)               │   response, diffs, todos
    │   <InlineToolCall />                         │   ALL scroll together
    │   <InlineApproval />                         │
    │   <StreamingResponse />                      │
    │   <InlineDiff />                             │
    │   <TodoPanel />                              │
    │ </ConversationScroll>                        │
    ├─────────────────────────────────────────────┤ ← Thin horizontal divider
    │ <InputZone>               fixed height       │ ← Bordered input box
    │   > user types here_                         │   with cursor editing
    │   ! for bash . / for commands                │   Hint line below
    │ </InputZone>                                 │
    │ <StatusLine>              1 line fixed        │ ← Model, connection,
    │   ● sonnet-4-5  1,234 tok  $0.02  Full Ctrl │   usage, permission mode
    │ </StatusLine>                                │
    └─────────────────────────────────────────────┘
  </Box>
</FullScreen>
```

### Pattern 1: Fullscreen Layout with Fixed Bottom
**What:** Use alternate screen buffer + flex column with explicit height
**When to use:** Always -- this is the foundational layout pattern

```typescript
// Source: combray.prose.sh/2025-11-28-ink-tui-expandable-layout + ink GitHub issue #263
import { useEffect } from "react";
import { Box, useStdout } from "ink";

function FullScreenChat({ children }: { children: React.ReactNode }) {
  const { stdout } = useStdout();
  const height = stdout?.rows ?? 24;

  useEffect(() => {
    process.stdout.write("\x1b[?1049h"); // Enter alternate screen
    return () => {
      process.stdout.write("\x1b[?1049l"); // Leave alternate screen
    };
  }, []);

  return (
    <Box flexDirection="column" height={height}>
      {children}
    </Box>
  );
}
```

### Pattern 2: Virtual Scrolling for Messages
**What:** Only render messages that fit in the visible viewport
**When to use:** For the conversation history area

```typescript
// Source: combray.prose.sh/2025-11-28-ink-tui-expandable-layout
function ConversationScroll({ messages, availableHeight }: Props) {
  const [scrollOffset, setScrollOffset] = useState(0);

  // Calculate visible window of messages
  // Each message has variable height -- need to estimate or measure
  const visibleMessages = messages.slice(
    Math.max(0, messages.length - availableHeight),
  );

  // Auto-scroll: always show latest unless user scrolled up
  useEffect(() => {
    setScrollOffset(Math.max(0, messages.length - availableHeight));
  }, [messages.length]);

  return (
    <Box flexDirection="column" flexGrow={1} overflow="hidden">
      {visibleMessages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
    </Box>
  );
}
```

### Pattern 3: Cursor-Aware Multiline Input
**What:** Text input with cursor position tracking, insert/delete at cursor, arrow key navigation
**When to use:** For the bordered input zone

```typescript
function CursorInput({ onSubmit, maxLines = 6 }: Props) {
  const [text, setText] = useState("");
  const [cursorPos, setCursorPos] = useState(0);

  useInput((input, key) => {
    if (key.return && !key.shift) {
      // Submit
      onSubmit(text.trim());
      setText("");
      setCursorPos(0);
      return;
    }
    if (key.return && key.shift) {
      // Newline at cursor
      setText(prev => prev.slice(0, cursorPos) + "\n" + prev.slice(cursorPos));
      setCursorPos(p => p + 1);
      return;
    }
    if (key.leftArrow) {
      setCursorPos(p => Math.max(0, p - 1));
      return;
    }
    if (key.rightArrow) {
      setCursorPos(p => Math.min(text.length, p + 1));
      return;
    }
    if (key.backspace) {
      if (cursorPos > 0) {
        setText(prev => prev.slice(0, cursorPos - 1) + prev.slice(cursorPos));
        setCursorPos(p => p - 1);
      }
      return;
    }
    if (key.delete) {
      setText(prev => prev.slice(0, cursorPos) + prev.slice(cursorPos + 1));
      return;
    }
    // Home/End: key.ctrl + 'a' / key.ctrl + 'e' or detect from input
    if (input && !key.ctrl && !key.meta) {
      setText(prev => prev.slice(0, cursorPos) + input + prev.slice(cursorPos));
      setCursorPos(p => p + input.length);
    }
  });

  // Render with cursor indicator
  const before = text.slice(0, cursorPos);
  const after = text.slice(cursorPos);
  // ...render with <Text inverse> cursor block
}
```

### Pattern 4: Inline Approval Dialog (Not Replacing Input)
**What:** Approval prompts render in the conversation area, input stays visible but disabled
**When to use:** When tool.approval.request is received

```typescript
// Old: pendingApproval ? <ToolApprovalPrompt /> : <InputBar />
// New: approval renders ABOVE input in conversation area; input is always visible
<ConversationScroll>
  {/* ... messages ... */}
  {pendingApproval && <InlineApproval {...pendingApproval} />}
</ConversationScroll>
<Divider />
<InputZone disabled={!!pendingApproval} />
<StatusLine />
```

### Anti-Patterns to Avoid
- **Using `<Static>` in fullscreen mode:** Static renders content above the dynamic area permanently and is incompatible with manual scrolling/windowing. Replace entirely.
- **Re-rendering all messages on every frame:** Without windowing, rendering hundreds of messages will cause severe performance issues. Always slice to visible viewport.
- **Blocking input during approval:** The old pattern replaces InputBar with the approval prompt. New pattern keeps input visible (but disabled) while approval dialog renders inline.
- **Fixed pixel heights for components:** Terminal dimensions change on resize. Always derive heights from `stdout.rows` dynamically.
- **Assuming `stdout.rows` is always defined:** It can be `undefined` in non-TTY environments. Always provide fallback (24 is standard).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Alternate screen buffer | Manual escape sequences with edge cases | fullscreen-ink (or simple wrapper) | Handles cleanup on crash, resize events, proper lifecycle |
| Text diffing algorithm | Custom line comparison | `diff` npm package (v8) `diffLines()` | O(n*d) Myers diff algorithm, handles edge cases, well-tested |
| ANSI color codes | Raw escape sequences | ansis/chalk (already installed) | Handle terminal capability detection, nesting, reset codes |
| Unicode string width | `string.length` for cursor positioning | `string-width` (transitive dep of ink) | CJK chars, emoji are 2 columns wide; ASCII is 1; zero-width joiners |

**Key insight:** Terminal UIs have deceptive complexity around Unicode width, ANSI escape code handling, and terminal capability detection. Use existing libraries for anything involving character rendering width or color output.

## Common Pitfalls

### Pitfall 1: Static Component Incompatibility
**What goes wrong:** `<Static>` renders content above the dynamic region by writing it permanently to stdout. In fullscreen (alternate screen buffer) mode, this fights with the layout manager because Static assumes infinite scroll, while fullscreen assumes a fixed viewport.
**Why it happens:** The current `MessageList` uses `<Static items={messages}>` which works for traditional terminal output but breaks the fixed-viewport paradigm.
**How to avoid:** Replace `<Static>` entirely with a manually-windowed `<Box>` that renders only the visible slice of messages. Calculate available height from `stdout.rows` minus input zone height minus status line minus divider.
**Warning signs:** Messages appear duplicated, layout jumps, or content overflows below the input zone.

### Pitfall 2: Variable-Height Message Windowing
**What goes wrong:** Simple line-counting for scroll offset doesn't work because messages have variable rendered heights (multi-line markdown, code blocks, tool calls, diffs).
**Why it happens:** Unlike a web browser, Ink doesn't provide a "scrollHeight" API. You can't know how many terminal rows a message will occupy until it's rendered.
**How to avoid:** Two approaches: (a) Use `measureElement` from Ink to measure rendered heights and cache them, or (b) Use a simpler heuristic -- always render the last N messages and let `overflow="hidden"` clip anything that doesn't fit, auto-scrolling to bottom. Approach (b) is recommended for Phase 34 as it's simpler and matches the streaming chat UX where users mostly read the latest content.
**Warning signs:** Messages cut off mid-render, blank space at top of conversation area, scroll jumps.

### Pitfall 3: Cursor Position vs String Length
**What goes wrong:** Cursor appears at wrong position when text contains emoji, CJK characters, or ANSI codes.
**Why it happens:** `string.length` counts JavaScript code units, not visual columns. A single emoji like "wave" is 2+ code units but occupies 2 terminal columns.
**How to avoid:** Use `string-width` (already a transitive dependency of Ink) to calculate visual column width. All cursor positioning math must use visual width, not string length.
**Warning signs:** Cursor drifts right of expected position, especially with non-ASCII input.

### Pitfall 4: Terminal Resize Handling
**What goes wrong:** Layout breaks when terminal is resized during an active session.
**Why it happens:** `stdout.rows` changes but the layout doesn't re-render with new dimensions.
**How to avoid:** Use `useStdout()` and listen to stdout's 'resize' event, or use `fullscreen-ink`'s `useScreenSize()` which handles this automatically. Re-derive all height calculations on resize.
**Warning signs:** Content overflows viewport, fixed footer disappears below visible area, messages area collapses to zero height.

### Pitfall 5: Approval Dialog Focus Conflicts
**What goes wrong:** Keyboard input goes to the wrong component when both input zone and approval dialog are visible.
**Why it happens:** Multiple `useInput` hooks active simultaneously without proper `isActive` gating.
**How to avoid:** Use a focus state machine: `idle` -> input active; `approval` -> approval dialog active, input disabled; `streaming` -> both disabled. Pass `isActive` prop carefully to each `useInput`.
**Warning signs:** Key presses trigger both input typing and approval responses simultaneously.

### Pitfall 6: Inline Diff Performance
**What goes wrong:** Large file diffs (hundreds of lines) cause the terminal to lag or flicker.
**Why it happens:** Rendering hundreds of colored `<Text>` components in a single frame overwhelms Ink's reconciliation.
**How to avoid:** Auto-collapse diffs above a threshold (e.g., 20 lines). Show summary ("42 lines changed") with expand-on-demand. Only render the visible portion when expanded.
**Warning signs:** Noticeable delay when assistant makes large file edits, terminal flickers.

## Code Examples

### Fullscreen Wrapper with Resize Handling
```typescript
// Source: ink issue #263 + combray.prose.sh article
import { useEffect, useState } from "react";
import { Box, useStdout } from "ink";

export function FullScreenWrapper({ children }: { children: React.ReactNode }) {
  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState({
    width: stdout?.columns ?? 80,
    height: stdout?.rows ?? 24,
  });

  useEffect(() => {
    // Enter alternate screen buffer
    process.stdout.write("\x1b[?1049h");
    // Hide cursor (Ink manages its own cursor)
    process.stdout.write("\x1b[?25l");

    const handleResize = () => {
      setDimensions({
        width: stdout?.columns ?? 80,
        height: stdout?.rows ?? 24,
      });
    };

    stdout?.on("resize", handleResize);

    return () => {
      stdout?.off("resize", handleResize);
      // Show cursor
      process.stdout.write("\x1b[?25h");
      // Leave alternate screen buffer
      process.stdout.write("\x1b[?1049l");
    };
  }, [stdout]);

  return (
    <Box flexDirection="column" width={dimensions.width} height={dimensions.height}>
      {children}
    </Box>
  );
}
```

### Horizontal Divider Component
```typescript
import { Box, Text, useStdout } from "ink";

export function Divider() {
  const { stdout } = useStdout();
  const width = stdout?.columns ?? 80;
  return (
    <Box>
      <Text dimColor>{"─".repeat(width)}</Text>
    </Box>
  );
}
```

### Inline Diff Rendering
```typescript
// Source: diff npm package docs (jsdocs.io/package/diff)
import { diffLines } from "diff";
import { Box, Text } from "ink";

interface InlineDiffProps {
  oldText: string;
  newText: string;
  fileName: string;
  collapsed?: boolean;
  onToggle?: () => void;
}

export function InlineDiff({ oldText, newText, fileName, collapsed }: InlineDiffProps) {
  const changes = diffLines(oldText, newText);
  const totalChanged = changes.filter(c => c.added || c.removed)
    .reduce((sum, c) => sum + (c.count ?? 0), 0);

  if (collapsed) {
    return (
      <Box>
        <Text color="blue">{"✎ "}{fileName}</Text>
        <Text dimColor> ({totalChanged} lines changed)</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text color="blue" bold>{"✎ "}{fileName}</Text>
      {changes.map((change, i) => {
        if (change.added) {
          return <Text key={i} color="green">{"+ "}{change.value.trimEnd()}</Text>;
        }
        if (change.removed) {
          return <Text key={i} color="red">{"- "}{change.value.trimEnd()}</Text>;
        }
        // Context lines (unchanged) - show first/last only if long
        return null; // or render dimmed context
      })}
    </Box>
  );
}
```

### Tool Call Icon Mapping
```typescript
// Distinct icons + colors per tool type for inline tool call display
const TOOL_ICONS: Record<string, { icon: string; color: string }> = {
  bash_command:    { icon: "▶", color: "green" },
  read_file:       { icon: "●", color: "cyan" },
  write_file:      { icon: "✎", color: "blue" },
  update_file:     { icon: "✎", color: "blue" },
  web_search:      { icon: "◆", color: "magenta" },
  skill_register:  { icon: "★", color: "yellow" },
  todo_write:      { icon: "☐", color: "white" },
  // Default for unknown tools
  default:         { icon: "◇", color: "gray" },
};

function getToolIcon(toolName: string) {
  return TOOL_ICONS[toolName] ?? TOOL_ICONS.default;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `<Static>` for messages | Manual windowing in fullscreen | Ink has always had this limitation; Claude Code built custom renderer | Must replace Static with windowed Box |
| Append-only input | Cursor-aware editing | Standard in modern CLI tools (Claude Code, Kimicode) | Need cursor position state + string-width for positioning |
| Status bar on top | Status line pinned below input | Claude Code popularized this in 2024/2025 | Matches user expectation from Claude Code UX |
| Approval replaces input | Approval inline in conversation | Claude Code pattern | Input always visible, disabled during approval |

**Deprecated/outdated:**
- ink-text-input (v4): Superseded by @inkjs/ui TextInput, but both are single-line only
- ink-scrollbar (v1.0.0): 8 years old, not maintained, not compatible with Ink 6

## Existing Codebase Analysis

### Files That Must Change
| File | Current Role | Change Needed |
|------|-------------|---------------|
| `Chat.tsx` | Root layout (vertical flex) | Complete rewrite: fullscreen wrapper, new layout zones, remove Static dependency |
| `InputBar.tsx` | Append-only text input | Complete rewrite: cursor editing, bordered box, expandable, placeholder, hint line |
| `StatusBar.tsx` | Top status bar | Rewrite: move below input, add permission mode display, single-line compact |
| `MessageList.tsx` | `<Static>` wrapper | Replace: windowed message rendering in scrollable area |
| `MessageBubble.tsx` | Message renderer | Modify: add inline tool call styling with icons/colors, inline diff rendering |
| `StreamingResponse.tsx` | Streaming text display | Modify: renders within conversation scroll area (not separate section) |
| `ToolPanel.tsx` | Separate tool call display | Replace with inline tool call rendering inside conversation flow |
| `ToolApprovalPrompt.tsx` | Replaces InputBar during approval | Rewrite: render inline in conversation area, boxed dialog style |
| `SkillApprovalPrompt.tsx` | Replaces InputBar during approval | Rewrite: render inline in conversation area |
| `PreflightChecklist.tsx` | Replaces InputBar during approval | Rewrite: render inline in conversation area |
| `TodoPanel.tsx` | Separate panel below streaming | Modify: renders within conversation flow area |
| `WelcomeScreen.tsx` | Empty state display | Modify: renders within conversation scroll area |
| `chat.ts` (command) | Entry point with `render()` | Modify: use fullscreen-ink `withFullScreen()` or manual alt-screen |

### New Files Needed
| File | Purpose |
|------|---------|
| `FullScreenWrapper.tsx` | Alternate screen buffer + terminal dimensions provider |
| `ConversationScroll.tsx` | Windowed message area with auto-scroll |
| `Divider.tsx` | Horizontal rule separator component |
| `InlineDiff.tsx` | Collapsible red/green diff display |
| `InlineToolCall.tsx` | Compact inline tool call with icon + color |
| `InlineApproval.tsx` | Boxed approval dialog for conversation area |

### Hooks to Modify
| Hook | Change |
|------|--------|
| `useChat.ts` | No structural changes -- state management stays the same |
| `useInputHistory.ts` | May need minor updates for cursor position reset on history navigation |

## Open Questions

1. **fullscreen-ink Ink 6 compatibility**
   - What we know: fullscreen-ink exists and provides `withFullScreen` + `useScreenSize`
   - What's unclear: Whether it supports Ink 6.7.0 (it may target older versions)
   - Recommendation: Try installing; if incompatible, use the 10-line manual implementation (alternate screen buffer + useStdout for dimensions). LOW risk either way.

2. **Variable-height message windowing accuracy**
   - What we know: Ink's `measureElement` can measure rendered components, but measuring before rendering requires a pre-render pass
   - What's unclear: Whether measureElement works reliably in fullscreen mode with overflow hidden
   - Recommendation: Start with the simple "render last N messages" approach. If messages get clipped, add height estimation heuristics. Can be refined iteratively.

3. **Home/End key detection in Ink's useInput**
   - What we know: Ink's `useInput` provides `key.upArrow`, `key.downArrow`, `key.leftArrow`, `key.rightArrow`, `key.backspace`, `key.delete`, `key.return`, `key.tab`, `key.escape`
   - What's unclear: Whether Home/End keys are surfaced (they're terminal-specific escape sequences)
   - Recommendation: Implement Home/End via Ctrl+A/Ctrl+E (standard readline bindings) as primary, and attempt to detect Home/End escape sequences as secondary.

4. **Permission mode cycling**
   - What we know: Status line should show permission mode with keyboard shortcut to cycle
   - What's unclear: What permission modes exist and how they're currently managed in the gateway
   - Recommendation: Research existing permission mode implementation in gateway during planning. This may be a display-only feature if modes are managed elsewhere.

## Sources

### Primary (HIGH confidence)
- Ink GitHub repository (github.com/vadimdemedes/ink) - Static component, useStdout, useInput, Box overflow
- Ink 6.7.0 installed in project - verified version via `pnpm ls`
- Existing codebase (packages/cli/src/components/) - current architecture analysis

### Secondary (MEDIUM confidence)
- [Ink TUI: Building Expandable Layouts with Fixed Footer](https://combray.prose.sh/2025-11-28-ink-tui-expandable-layout) - fullscreen pattern, virtual scrolling, fixed footer architecture
- [TUI Development: Ink + React](https://combray.prose.sh/2025-12-01-tui-development) - terminal dimensions, scrolling patterns
- [fullscreen-ink GitHub](https://github.com/DaniGuardiola/fullscreen-ink) - withFullScreen API, useScreenSize hook
- [Ink GitHub Issue #263](https://github.com/vadimdemedes/ink/issues/263) - fullscreen implementation patterns
- [Ink GitHub Issue #432](https://github.com/vadimdemedes/ink/issues/432) - overflow/scrolling limitations
- [Claude Code Architecture Analysis](https://www.southbridge.ai/blog/claude-code-an-analysis-dependencies) - React/Ink/Yoga stack, rendering approach
- diff npm package (v8) - diffLines API for structured diffs

### Tertiary (LOW confidence)
- ink-multiline-input (v0.1.0) - evaluated but rejected (too immature at 1 star)
- ink-scrollbar (v1.0.0) - evaluated but rejected (8 years old, not Ink 6 compatible)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all core libraries already installed and in use, only 2 new deps needed
- Architecture: MEDIUM-HIGH - fullscreen + windowing pattern is well-documented but Ink's scrolling limitations require manual implementation; patterns are proven in articles but not in first-party Ink docs
- Pitfalls: HIGH - Static/fullscreen incompatibility is well-documented; cursor/width issues are standard terminal dev knowledge
- Input editing: MEDIUM - cursor-aware editing must be custom-built; no mature Ink multiline input exists

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (30 days - Ink ecosystem is stable)
