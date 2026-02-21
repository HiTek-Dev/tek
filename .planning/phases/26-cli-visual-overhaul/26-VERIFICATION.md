---
phase: 26-cli-visual-overhaul
verified: 2026-02-20T00:00:00Z
status: human_needed
score: 4/5 success criteria verified
gaps: []
human_verification:
  - test: "Verify historical tool calls in Static appear visually 'collapsed'"
    expected: "Tool_call messages in the completed message history show only tool name and status, NOT the full args/input by default"
    why_human: "MessageBubble renders message.input (args) as dimColor text below the header for every tool_call in Static — this shows args unconditionally, which may or may not match the user's expectation of 'collapsed' per CLIV-02. The live ToolPanel correctly collapses. Whether the Static display is acceptable requires visual review."
---

# Phase 26: CLI Visual Overhaul Verification Report

**Phase Goal:** CLI chat experience reaches Claude Code quality -- syntax-highlighted code, collapsible tool panels, input history, and a clean information-dense StatusBar
**Verified:** 2026-02-20
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Code blocks in assistant responses display syntax-highlighted output with language-appropriate coloring via shiki | VERIFIED | `shiki.ts` implements `codeToAnsiSync` using `createHighlighterCoreSync` + `codeToTokensBase`. `markdown.ts` passes it as the `highlight` option to `markedTerminal`. Build compiles clean. `cli-highlight` removed. |
| 2 | Tool call and bash command blocks render collapsed by default (showing tool name and status) and expand on keypress | PARTIAL | Live region `ToolPanel` correctly starts collapsed (`useState(false)`) and toggles on Enter. Historical `tool_call` in `<Static>` via `MessageBubble` shows tool name header AND dimmed input args unconditionally — not strictly "collapsed showing only name + status." Needs human visual review. |
| 3 | User can press up/down arrow to cycle through previous messages and Shift+Enter to insert a newline without submitting | VERIFIED | `useInputHistory` hook implements `push`/`back`/`forward` capped at 100 entries. `InputBar` wires `key.upArrow`/`key.downArrow` (when `text === ''`) and `key.return && key.shift` for newline insertion. `useInput` disabled during streaming (`isActive: !isStreaming`). |
| 4 | Long tool output is truncated at ~20 lines with a "(N more lines)" indicator; empty chat shows a welcome screen | VERIFIED | `truncate.ts` exports `truncateOutput(output, maxLines=20)` producing `... (N more lines)`. `MessageBubble` applies it to `tool_call` and `bash_command` output. `WelcomeScreen` renders on `messages.length === 0 && !isStreaming` in `Chat.tsx`. |
| 5 | StatusBar displays a multi-zone layout with connection status, model/provider, and token count + cost in compact format; messages show dimmed HH:MM timestamps | VERIFIED | `StatusBar` has three zones: `● DISPLAY_NAME` (left, color-coded connection), `shortModel` (center, cyan), `N tok · $X.XX` (right, dimColor). No border. `MessageBubble` defines `formatTimestamp(iso)` returning `HH:MM` and renders it as `<Text dimColor>` right-aligned via `justifyContent="space-between"` on all message types. |

**Score:** 4/5 success criteria fully verified; 1 partially verified (CLIV-02 historical collapse behavior)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/cli/src/lib/shiki.ts` | Synchronous shiki highlighter singleton, exports `codeToAnsiSync` | VERIFIED | 84 lines. Exports `codeToAnsiSync`. Uses `createHighlighterCoreSync` + `createJavaScriptRegexEngine`. 11 languages pre-loaded via top-level ESM await (valid in `type: module` package). Graceful try/catch fallback. |
| `packages/cli/src/lib/markdown.ts` | Markdown renderer using shiki for code blocks | VERIFIED | Imports `codeToAnsiSync` from `./shiki.js`. Passes `{ highlight: (code, lang) => codeToAnsiSync(code, lang) }` as second arg to `markedTerminal`. |
| `packages/cli/src/hooks/useInputHistory.ts` | Input history cycling hook, exports `useInputHistory` | VERIFIED | 80 lines. Exports `useInputHistory` returning `{ push, back, forward, current }`. History capped at 100 via `MAX_HISTORY`. Uses `useRef` for array (no re-render on push) and `useState` tick for cursor re-renders. |
| `packages/cli/src/components/InputBar.tsx` | Custom multiline input with history | VERIFIED | 109 lines. Uses `useInput` from ink (not `@inkjs/ui` TextInput — confirmed 0 TextInput references). Handles Enter/Shift+Enter/up/down/backspace. Wires `useInputHistory`. `isActive: !isStreaming` disables during streaming. |
| `packages/cli/src/lib/truncate.ts` | Output truncation utility, exports `truncateOutput` | VERIFIED | 12 lines. `truncateOutput(output, maxLines=20)` splits on `\n`, returns first maxLines + `... (N more lines)` indicator. |
| `packages/cli/src/components/MessageBubble.tsx` | Message rendering with timestamps and truncated tool output | VERIFIED | Defines `formatTimestamp(iso)`. All message types (`user`, `assistant`, `system`, `tool_call`, `bash_command`, `reasoning`) include `<Text dimColor>{ts}</Text>` in `justifyContent="space-between"` boxes. `truncateOutput` applied to `tool_call.output` and `bash_command.output`. Stateless (0 useState calls). |
| `packages/cli/src/components/ToolPanel.tsx` | Collapsible tool panel for live render region, exports `ToolPanel` | VERIFIED | 57 lines. `useState(false)` for `expanded`. `useInput` toggles on `key.return` when `isFocused`. Collapsed: `▶ toolName status-icon`. Expanded: adds dimmed input + truncated output. `truncateOutput` imported and used. |
| `packages/cli/src/components/MessageList.tsx` | Static message list rendering | VERIFIED | Uses `<Static items={messages}>` with `MessageBubble`. Stateless (0 useState). |
| `packages/cli/src/components/WelcomeScreen.tsx` | Empty state welcome screen, exports `WelcomeScreen` | VERIFIED | 29 lines. Renders `DISPLAY_NAME` from `@tek/core`, slash commands (`/help`, `/model`, `/swap`, `/proxy`), keyboard shortcut hint. Static, no state. |
| `packages/cli/src/components/StatusBar.tsx` | Redesigned multi-zone status bar, exports `StatusBar` | VERIFIED | No `borderStyle` (confirmed 0 occurrences). Three-zone `justifyContent="space-between"` layout. Connection dot colored green/red, bold `DISPLAY_NAME`, cyan `shortModel`, dimColor token+cost. |
| `packages/cli/src/components/Chat.tsx` | Orchestrator with all new components wired | VERIFIED | Imports `WelcomeScreen` and `ToolPanel`. `messages.length === 0 && !isStreaming` condition on line 179. `toolCalls` destructured from `useChat`. `ToolPanel` rendered for last pending tool call in live region. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `markdown.ts` | `shiki.ts` | `import codeToAnsiSync` | WIRED | Line 3: `import { codeToAnsiSync } from "./shiki.js"` — used as `highlight` option in `markedTerminal` call |
| `shiki.ts` | `shiki/core` | `createHighlighterCoreSync` | WIRED | Line 1 import, line 39 usage |
| `InputBar.tsx` | `useInputHistory.ts` | `useInputHistory` hook | WIRED | Line 3 import, line 21 call, methods used on lines 29, 44, 53 |
| `InputBar.tsx` | `ink` | `useInput` hook | WIRED | Line 2 import, line 23 call with `isActive: !isStreaming` |
| `MessageBubble.tsx` | `truncate.ts` | `import truncateOutput` | WIRED | Line 5 import, used on lines 91, 107 for tool_call and bash_command output |
| `ToolPanel.tsx` | `truncate.ts` | `import truncateOutput` | WIRED | Line 3 import, used on line 52 for expanded output |
| `MessageList.tsx` | `MessageBubble.tsx` | renders inside `<Static>` | WIRED | Line 4 import, line 17 usage inside Static |
| `Chat.tsx` | `WelcomeScreen.tsx` | conditional render when `messages.length === 0` | WIRED | Line 16 import, line 179 conditional render |
| `Chat.tsx` | `ToolPanel.tsx` | renders active pending tool call in live region | WIRED | Line 17 import, lines 187-199 conditional render with `toolCalls[last].status === 'pending'` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CLIV-01 | 26-01 | Code blocks display syntax highlighting via shiki | SATISFIED | `shiki.ts` + `markdown.ts` integration. `cli-highlight` removed (confirmed via package.json). shiki and ansis present. |
| CLIV-02 | 26-03 | Tool call panels collapsible — collapsed by default, expand on keypress | PARTIAL | Live ToolPanel: fully correct (collapsed default, Enter to expand). Static MessageBubble: shows args unconditionally — not strictly a "collapsed" view. Needs human verification. |
| CLIV-03 | 26-02 | User can cycle through previous messages with up/down arrow | SATISFIED | `useInputHistory.ts` + `InputBar.tsx` wired correctly. `key.upArrow`/`key.downArrow` when `text === ''` calls `history.back()`/`history.forward()`. |
| CLIV-04 | 26-03 | Tool output truncated at ~20 lines with indicator | SATISFIED | `truncateOutput` in `truncate.ts`, applied in `MessageBubble` and `ToolPanel`. Indicator format: `... (N more lines)`. |
| CLIV-05 | 26-04 | Empty chat shows welcome with agent name, slash commands, keyboard shortcuts | SATISFIED | `WelcomeScreen.tsx` renders `DISPLAY_NAME`, 4 slash commands, keyboard shortcut hint. Conditional in `Chat.tsx` on `messages.length === 0 && !isStreaming`. |
| CLIV-06 | 26-03 | Messages display timestamps (HH:MM) right-aligned and dimmed | SATISFIED | `formatTimestamp` in `MessageBubble` applied to ALL message types (user, assistant, system, tool_call, bash_command, reasoning). Rendered as `<Text dimColor>` right-aligned. |
| CLIV-07 | 26-02 | User can enter multi-line input (Shift+Enter for newline, Enter to submit) | SATISFIED | `InputBar` handles `key.return && key.shift` for `\n` insertion, `key.return && !key.shift` for submit. Multiline rendering splits on `\n`, shows line count indicator. |
| CLIV-08 | 26-04 | StatusBar multi-zone layout: connection, model, token count + cost | SATISFIED | `StatusBar.tsx` three zones, no border. Connection color-coded, shortened model name, compact `N tok · $X.XX`. |

All 8 CLIV requirement IDs accounted for. No orphaned requirements found in REQUIREMENTS.md (all 8 listed as Phase 26, all addressed by plans 01-04).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | No TODO/FIXME/placeholder comments found in any phase file. No empty implementations. No return-null stubs. |

### Human Verification Required

#### 1. Historical Tool Call "Collapsed" Appearance (CLIV-02)

**Test:** Run the CLI, send a message that triggers one or more tool calls. After the tool calls complete and appear in the Static message history, observe how they appear.

**Expected per CLIV-02:** Tool call history entries should appear as a compact collapsed view showing only tool name and status (the "collapsed" behavior). Full arguments should not be visible by default.

**Actual implementation:** `MessageBubble` for `tool_call` renders: header line (tool name + timestamp) AND `<Text dimColor>{message.input}</Text>` (the args) AND `truncateOutput(message.output)`. The args are always shown, making historical entries more verbose than "collapsed."

**Why human:** This is a visual/UX judgment call. The implementation is consistent and intentional (the PLAN was updated to describe this as "collapsed one-line summaries" but the actual code shows more). Whether this meets the spirit of CLIV-02 requires a human to observe the terminal output and judge if it reads as appropriately compact.

**Verdict options:**
- If historical tool entries look clean and compact: mark CLIV-02 as satisfied
- If they look too verbose compared to Claude Code's collapsed panels: flag as a gap for a follow-on plan to add a "collapsed header only" mode to MessageBubble for Static rendering

#### 2. Syntax Highlighting Visual Quality (CLIV-01)

**Test:** Run the CLI, ask Claude to write a TypeScript function. Observe the assistant response code block.

**Expected:** Syntax-highlighted code with VS Code github-dark coloring (keywords in purple/blue, strings in orange/green, types colored). NOT plain text.

**Why human:** The shiki integration uses top-level ESM `await` to resolve language grammars. The build compiles, but runtime rendering can only be confirmed by running the app. Token coloring, ANSI output quality, and terminal compatibility must be observed.

#### 3. Multiline Input Line Count Indicator

**Test:** Press Shift+Enter multiple times in the input box to create a 3+ line message.

**Expected:** A dimmed `[N lines]` counter appears below the input, and each continuation line is indented with the `>` prompt prefix. The block cursor appears at the end of the last line.

**Why human:** Input rendering is a terminal-interactive behavior that requires live observation.

## Summary

Phase 26 is substantially complete. All 10 required artifacts exist with substantive implementations and are correctly wired. The build compiles cleanly. All 8 CLIV requirement IDs are addressed by plans 01-04 with no orphaned requirements.

The one item requiring human verification is CLIV-02's "collapsed" behavior for historical tool calls in Static: the live `ToolPanel` correctly implements collapse/expand, but `MessageBubble` in the Static history shows tool args unconditionally rather than being strictly "collapsed." This may be the intended design (args in Static are read-only and cannot expand anyway), or it may need a visual polish pass. A human must run the CLI to judge whether the terminal output is acceptably compact.

All automated checks indicate the phase goal is functionally achieved — syntax highlighting, input history, multiline input, truncation, timestamps, welcome screen, and StatusBar redesign are all correctly implemented and wired.

---

_Verified: 2026-02-20_
_Verifier: Claude (gsd-verifier)_
