# Feature Research

**Domain:** CLI visual overhaul + Desktop UI overhaul + Testing foundation for Tek AI agent platform
**Researched:** 2026-02-20
**Confidence:** HIGH (codebase directly inspected; reference apps Claude Code, opencode, Claudia verified via web research)

> **Milestone scope note:** This research focuses ONLY on the new milestone: visual polish for CLI (make it feel like Claude Code) + visual polish for Desktop (markdown, tool approval, history) + testing foundation (WebSocket protocol, agent loop, LLM routing). The existing gateway backend, MCP integration, memory system, and multi-provider routing are already built and are NOT in scope.

---

## Existing Baseline (Already Built — Do Not Rebuild)

The following exist and inform what is new vs what is enhanced:

**CLI (`packages/cli/src/components/`):**
- `Chat.tsx` — main container wiring all components
- `StatusBar.tsx` — connection dot, session ID, model, token count
- `InputBar.tsx` — `@inkjs/ui` `TextInput` with `>` prompt; single-line only
- `MessageBubble.tsx` — type-switched renderer: user (cyan), assistant (magenta + MarkdownRenderer), tool_call (blue + input/output), bash_command (green), reasoning (dimmed italic)
- `MessageList.tsx` — list of MessageBubble components
- `StreamingResponse.tsx` — plain streaming text with spinner
- `ToolApprovalPrompt.tsx` — Y/N/S keyboard approval
- `SkillApprovalPrompt.tsx`, `PreflightChecklist.tsx`
- `MarkdownRenderer.tsx` — `marked` + `marked-terminal` rendering

**Desktop (`apps/desktop/src/`):**
- `pages/ChatPage.tsx` — agent selector, WS connect indicator, message list, streaming text, input bar
- `components/ChatMessage.tsx` — type-switched renderer: user (blue border-left), assistant (gray border-left, `whitespace-pre-wrap` plain text), tool_call (purple badge + raw pre), bash_command (green $), reasoning (italic)
- `components/StreamingText.tsx`, `ChatInput.tsx`, `Layout.tsx`, `Sidebar.tsx`, `GatewayStatus.tsx`
- `hooks/useChat.ts`, `useWebSocket.ts`, `useConfig.ts`
- `pages/DashboardPage.tsx`, `AgentsPage.tsx`, `SettingsPage.tsx`

**Gateway protocol (`packages/gateway/src/ws/`):**
- `protocol.ts` — `ToolApprovalResponse` message type exists (desktop receives `tool_approval_request` events but ignores them in UI)
- `handlers.ts` — full tool approval round-trip implemented server-side

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that users of Claude Code or any polished desktop chat app assume exist. Missing these makes the product feel like a prototype.

#### CLI Table Stakes

| Feature | Why Expected | Complexity | Dependency on Existing |
|---------|--------------|------------|----------------------|
| Syntax highlighting in code blocks | Claude Code, every modern terminal AI tool does this. `marked-terminal` alone does not produce reliable highlight results across terminals. | LOW | Enhances `MarkdownRenderer.tsx`. `cli-highlight` already in `package.json`. Wire into fenced block rendering. |
| Collapsible tool call panels | Claude Code and opencode both render tools as toggleable sections. Raw blue-header + full JSON floods the screen on tool-heavy sessions. | MEDIUM | Enhances `MessageBubble.tsx` tool_call case. Add `useInput` toggle per-panel or global. |
| Input command history (up/down arrow) | Every shell since 1981. Users press up-arrow expecting previous message. Currently nothing happens. | MEDIUM | Replaces or wraps `InputBar.tsx`. `@inkjs/ui` `TextInput` does not support history natively. Needs custom hook with circular buffer. |
| Truncated tool output with "N more lines" | Tool outputs (especially shell commands) flood the screen making conversation unreadable. | LOW | Enhances `MessageBubble.tsx` tool_call and bash_command cases. Cap at ~20 lines, show `... (N more lines)`. |
| Empty state welcome screen | Blank `>` prompt is disorienting. Every reference tool shows available commands and shortcuts on open. | LOW | Add to `Chat.tsx`. Show agent name, available slash commands, keyboard shortcuts. |
| Timestamps on messages | Users need temporal context, especially during multi-step tool operations that take time. | LOW | Enhances `MessageBubble.tsx`. Timestamp already in `ChatMessage` type. Dimmed HH:MM on right side. |

#### Desktop Table Stakes

| Feature | Why Expected | Complexity | Dependency on Existing |
|---------|--------------|------------|----------------------|
| Markdown rendering in chat messages | Every LLM chat UI (ChatGPT, Claude, Claudia) renders markdown. Raw `whitespace-pre-wrap` assistant text looks broken — no headers, no code blocks, no lists. | MEDIUM | Replaces plain text in `ChatMessage.tsx` assistant case. Add `react-markdown` + `rehype-highlight` or `react-shiki`. |
| Code block copy button | Users copy code from chat constantly. Missing copy button is the most common friction point in chat UIs. | LOW | Overlay inside markdown renderer's code block component. Standard pattern in shadcn/ui. |
| Tool approval UI in desktop | CLI has full Y/N/S approval; desktop currently shows tool call status but provides no way to approve/deny. Security and feature parity gap. | HIGH | New `ToolApprovalModal` component. Protocol already exists: gateway emits `tool_approval_request`, accepts `tool_approval_response`. Desktop `useChat` hook receives but discards approval events. No gateway changes required. |
| Error boundary per page | A render crash in any component kills the entire desktop app. Users experience a blank screen with no recovery path. | LOW | Wrap each page in `Layout.tsx` with a `React.ErrorBoundary` class component. Applies to all 4 pages. |
| Loading states on async actions | App appears frozen during gateway startup, WS connect, and LLM requests. Users refresh or kill the app. | LOW | Many places already check `gateway.status`; add skeleton loaders, spinners, disabled states consistently. |
| WebSocket auto-reconnect with backoff | Brief network hiccup or gateway restart disconnects the session permanently. Users must manually reload. | MEDIUM | Update both `apps/desktop/src/hooks/useWebSocket.ts` AND `packages/cli/src/hooks/useWebSocket.ts`. Exponential backoff: 1s, 2s, 4s, 8s, max 30s. |

### Differentiators (Competitive Advantage)

Features that are not universally expected but make Tek stand out from Claude Code and Claudia.

#### CLI Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Multi-line input (Shift+Enter) | opencode supports Meta+Enter; Claude Code supports Shift+Enter. Essential for pasting code or multi-paragraph prompts. Most impactful single CLI improvement. | HIGH | `@inkjs/ui` `TextInput` is single-line only. Requires full custom input component using raw `useInput` to accumulate lines. Shift+Enter = newline, Enter = submit. Build this and history together — same custom component. |
| Compact vs expanded tool display | Toggle with a key (e.g. `e` to expand/`c` to collapse all tools) between truncated name+status and full input/output. Claude Code has this. | MEDIUM | Global session toggle stored in `useChat` state. Propagated to `MessageBubble` via prop or context. |
| Live step counter during agent loop | During multi-step tool sequences, users see only "streaming..." for 10-30 seconds. A `Step 3/10: bash_command` display makes it feel active. | LOW | Count `tool_call` events received during streaming. Display in `StreamingResponse.tsx`. Data already available from WS message flow. |
| Token/cost in footer with short format | StatusBar already receives `usage` state but display is raw numbers. Short format (`12.3k tokens · $0.04`) is the Claude Code style. | LOW | Update `StatusBar.tsx` formatting only. No data changes needed. |

#### Desktop Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Conversation history sidebar | Cannot resume sessions without this. The #1 UX gap for chat apps. Claudia has full session versioning; Tek needs at minimum a list with resume. | HIGH | New panel in `Layout.tsx` or separate sidebar component. Query `sessionManager.listSessions()` via new WebSocket message type OR via Tauri command. Click session to resume (resume flow already exists in CLI via `resumeSessionId`). |
| Tool approval modal with argument preview | Claudia shows tool inputs before approval in a clean modal. Users can make informed approve/deny decisions. Desktop tool approval is absent entirely. | MEDIUM | Part of the tool approval feature. The approval modal should show: tool name, formatted args (JSON with syntax highlighting), approve / deny / approve-for-session buttons. |
| Session context indicator in chat header | Users get confused about which prior session is resumed and how much context it has. Show session ID prefix + message count. | LOW | Data already in `chat.sessionId` from `useChat` hook. Display in `ChatPage.tsx` header area (space already exists). |
| Tek brand identity (color + typography) | Claudia has purple/dark design language. ChatGPT has green. Tek currently uses generic default blue/gray with no personality. | MEDIUM | Define 3 brand colors in `tailwind.config.js`. Apply to active states, borders, highlights, and status indicators. Single pass update across all pages. Not a full design system — targeted polish only. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| File tree view in CLI | Claude Code renders directory trees. Users want parity. | Claude Code's tree renderer is deeply custom and integrated with their file tool. Significant Ink complexity for marginal gain in Tek's general-purpose context. | Format shell tool output better: truncate, add line numbers, highlight changed lines. Defer tree view to a later milestone. |
| Real-time message search in desktop | Find past information quickly | Requires full-text index across session history (SQLite FTS). SQLite FTS5 is manageable but adds schema complexity that does not belong in a visual polish milestone. | Ship conversation history sidebar first. Users can skim sessions visually. Add search in a dedicated data milestone. |
| Multi-line paste detection in CLI | Pasting multi-line text should work even without Shift+Enter | Terminal paste events are raw character streams to Ink. Distinguishing paste from typed input requires OS-level bracketed paste mode — unreliable across terminal emulators. | Build Shift+Enter multi-line input first. Bracketed paste as a v2 enhancement. |
| Dark/light theme toggle in desktop | Some users prefer light mode | Tailwind dark mode with a toggle requires threading theme state everywhere. The current dark theme just needs polish, not a second theme. | Apply `prefers-color-scheme` CSS media query passively. Ship one excellent dark theme. |
| E2E tests calling real LLM API | "Real" integration tests | Slow (10-30s), costs money, fails in CI without API keys, tests LLM output not Tek behavior | Mock LLM at AI SDK registry level. Test Tek's handling of responses, not the LLM itself. |
| Ink component snapshot tests | "Test the CLI UI" | Ink rendering in vitest environments requires complex node setup. Terminal output snapshots are brittle — ANSI escape sequences change on minor version bumps. | Test the hooks (`useChat`, `useWebSocket`) and pure logic in isolation. CLI visual testing is manual review. |
| 100% code coverage target | Discipline metric | Chasing coverage means testing internals, not behavior. Leads to coupled tests that break on every refactor. | Cover the critical paths (tool loop, approval gate, routing, WebSocket protocol) at 60-70% meaningful coverage. |

---

## Feature Dependencies

```
[Markdown Rendering — Desktop]
    └──required by──> [Code Block Copy Button]
    └──required by──> [Tool Approval Modal with formatted args]
    └──must precede──> visual polish work in ChatMessage.tsx

[Tool Approval Modal — Desktop]
    └──uses──> existing ToolApprovalResponse protocol (no gateway changes)
    └──requires──> [WebSocket auto-reconnect] (approval must survive brief disconnects)
    └──requires fixing──> desktop useChat hook to not discard tool_approval_request events

[Conversation History Sidebar — Desktop]
    └──requires──> session list API (sessionManager.listSessions() in gateway)
    └──requires──> new WS message type OR Tauri command for session listing
    └──requires──> session resume flow (already in CLI via resumeSessionId; needs desktop implementation)

[Multi-line Input — CLI]
    └──conflicts──> @inkjs/ui TextInput (must replace, not extend)
    └──best built with──> [Input Command History] (same custom input component handles both)

[Input Command History — CLI]
    └──depends on──> [Multi-line Input] if both are built, OR
    └──can be──> standalone history hook on top of existing TextInput if done independently

[Syntax Highlighting — CLI]
    └──uses──> cli-highlight (already in package.json, no install needed)
    └──enhances──> existing MarkdownRenderer.tsx fenced code block handling

[Collapsible Tool Panels — CLI]
    └──enhances──> existing MessageBubble.tsx tool_call case
    └──needs──> per-panel open/closed state (useState in MessageBubble or lifted to MessageList)

[WebSocket Auto-Reconnect]
    └──required for──> [Tool Approval Modal] (approval flow must not drop mid-session)
    └──applies to──> both CLI useWebSocket.ts AND Desktop useWebSocket.ts (same fix, two files)
    └──no other features depend on it but it should be early in desktop phase

[Error Boundary — Desktop]
    └──no dependencies
    └──should be first thing in desktop phase (protects all subsequent component work)

[LLM Router Tests]
    └──requires──> no mocks (classifyComplexity is a pure function)
    └──source──> packages/gateway/src/llm/router.ts

[Agent Loop Tests]
    └──requires──> mock Transport (interface already in transport.ts)
    └──requires──> mock AI SDK streamText (vi.mock)
    └──source──> packages/gateway/src/agent/tool-loop.ts

[WebSocket Protocol Tests]
    └──requires──> message factory functions from ws/protocol.ts
    └──no external dependencies needed

[Tool Approval Integration Test]
    └──requires──> [Agent Loop Tests infrastructure] (mock transport)
    └──requires──> vitest-websocket-mock or manual WS server
    └──tests──> approval-gate.ts + tool-loop.ts + ws/handlers.ts interaction
```

### Dependency Notes

- **Markdown rendering must precede copy button:** The copy button lives inside the markdown renderer's code block component — there is nothing to attach it to without first implementing markdown rendering.
- **Tool approval modal requires no gateway changes:** The gateway already emits `tool_approval_request` and accepts `tool_approval_response`. The desktop hook receives approval request events and discards them. The fix is entirely in the desktop UI layer.
- **Multi-line input and command history are best built together:** They share the same custom `useInput` event handler. Building history alone on the existing TextInput is fragile; it needs to be replaced or significantly extended either way.
- **Error boundary should be first in desktop phase:** Any new component added can crash the app. Adding the boundary first protects all subsequent work.
- **Agent loop tests unblock all other gateway tests:** Establishing the mock Transport and mock streamText pattern in tool-loop tests makes approval gate, failure detector, and handler tests easy to write.

---

## MVP Definition for This Milestone

### Launch With — Phase P1

These close the most visible gaps identified in `next-milestone/ASSESSMENT.md`.

**CLI:**
- [ ] Syntax highlighting in fenced code blocks via `cli-highlight` wired into `MarkdownRenderer` — largest visual gap
- [ ] Collapsible tool call panels (toggle expand/collapse) — makes tool-heavy sessions readable
- [ ] Input command history (up/down arrow) — too basic to be missing
- [ ] Truncated tool output with line cap + "N more lines" — prevents screen flooding
- [ ] Empty state welcome screen with slash command list

**Desktop:**
- [ ] Markdown rendering in `ChatMessage.tsx` assistant case via `react-markdown` + syntax highlighting — single most impactful change
- [ ] Code block copy button — instant value, trivially complex
- [ ] Tool approval modal wired to existing protocol — security and feature parity with CLI
- [ ] Error boundary per page — correctness, prevents crashes from blocking testing

**Testing:**
- [ ] Unit tests for `classifyComplexity` (LLM router) — pure function, zero mocks needed, high regression value
- [ ] Unit tests for `runAgentLoop` with mocked transport and mocked `streamText` — covers most critical server-side path
- [ ] WebSocket protocol message shape tests — validates the client/server contract
- [ ] Integration test for tool approval round-trip — most complex user-facing flow

### Add After P1 Stabilizes — Phase P2

- [ ] Conversation history sidebar (desktop) — high value but requires WS or Tauri session list API
- [ ] Multi-line input with Shift+Enter (CLI) — high impact but high effort; get other CLI work stable first
- [ ] WebSocket auto-reconnect with backoff (both CLI and desktop)
- [ ] Token/cost short format in CLI StatusBar
- [ ] Session context indicator in desktop chat header
- [ ] Approval gate policy tests (unit tests for `approval-gate.ts`)
- [ ] Context assembly tests (unit tests for `assembleContext`)

### Future Consideration — Later Milestone

- [ ] Tek brand design system (beyond spot color changes)
- [ ] Session search in desktop
- [ ] Collapsible tool timeline accordion (more complex than collapsible panels)
- [ ] Step counter in streaming response
- [ ] Session persistence tests with SQLite test database setup

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Desktop markdown rendering | HIGH | MEDIUM | P1 |
| CLI syntax highlighting | HIGH | LOW | P1 |
| Tool approval modal (desktop) | HIGH | HIGH | P1 |
| CLI collapsible tool panels | HIGH | MEDIUM | P1 |
| Code block copy button (desktop) | HIGH | LOW | P1 |
| Error boundary (desktop) | HIGH | LOW | P1 |
| CLI input command history | MEDIUM | MEDIUM | P1 |
| CLI truncated tool output | MEDIUM | LOW | P1 |
| CLI empty state | MEDIUM | LOW | P1 |
| LLM router unit tests | HIGH | LOW | P1 |
| Agent loop unit tests | HIGH | MEDIUM | P1 |
| WS protocol shape tests | HIGH | LOW | P1 |
| Tool approval integration test | HIGH | MEDIUM | P1 |
| Conversation history sidebar | HIGH | HIGH | P2 |
| WS auto-reconnect | HIGH | MEDIUM | P2 |
| Multi-line CLI input | HIGH | HIGH | P2 |
| Session context indicator | MEDIUM | LOW | P2 |
| Approval gate policy tests | HIGH | LOW | P2 |
| Token/cost display format CLI | LOW | LOW | P2 |
| Brand color identity | MEDIUM | MEDIUM | P3 |
| Session search desktop | HIGH | HIGH | P3 |

**Priority key:**
- P1: Must have for this milestone to meet its stated goal
- P2: Should have once P1 is stable
- P3: Nice to have, future milestone

---

## Competitor Feature Analysis

| Feature | Claude Code (CLI) | opencode (CLI) | Claudia (Desktop) | Tek Current | Tek Target |
|---------|-------------------|----------------|-------------------|-------------|------------|
| Syntax highlighting in terminal | YES (custom ANSI) | YES (terminal renderer) | N/A (web view) | Partial (marked-terminal inconsistent) | YES (cli-highlight wired into MarkdownRenderer) |
| Collapsible tool panels | YES (keyboard toggle) | YES (BasicTool card with expand) | YES (accordion) | NO | YES (keyboard toggle in MessageBubble) |
| Markdown rendering (desktop) | N/A | N/A | YES (react-markdown + Shiki) | NO (whitespace-pre-wrap) | YES (react-markdown + rehype-highlight) |
| Code block copy button | N/A | N/A | YES | NO | YES (overlay in code block component) |
| Input history | YES (up/down) | YES | YES | NO | YES (custom hook + circular buffer) |
| Multi-line input | YES (Shift+Enter) | YES (Meta+Enter) | YES | NO | YES (custom Ink component) |
| Tool approval UI | YES (Y/N/S) | YES | YES | CLI: YES, Desktop: NO | Desktop: YES (modal with arg preview) |
| Conversation history | YES (session list) | YES (session tree) | YES (full sidebar + versioning) | NO | YES (sidebar with resume) |
| WebSocket auto-reconnect | YES | YES | YES | NO | YES (exponential backoff) |
| Error boundaries | YES | YES | YES | NO | YES (per page) |
| Token/cost display | YES (compact format) | YES | YES (analytics page) | Partial (raw numbers) | YES (12.3k · $0.04 format) |
| Test coverage | Unknown (closed) | YES (Go tests) | YES (Rust + vitest) | NO (vitest configured, 0 test files) | YES (unit + integration) |

---

## Sources

- Direct codebase inspection: `packages/cli/src/`, `apps/desktop/src/`, `packages/gateway/src/`
- `/Users/hitekmedia/Documents/GitHub/tek/next-milestone/ASSESSMENT.md` — primary gap analysis
- `/Users/hitekmedia/Documents/GitHub/tek/next-milestone/QUICK-WINS.md` — low-effort improvements
- [Claude Code Terminal UI internals (Medium)](https://kotrotsos.medium.com/claude-code-internals-part-11-terminal-ui-542fe17db016) — Ink + Yoga rendering architecture
- [How Claude Code is built (Pragmatic Engineer)](https://newsletter.pragmaticengineer.com/p/how-claude-code-is-built)
- [opencode TUI Prompt Component (DeepWiki)](https://deepwiki.com/sst/opencode/6.5-tui-prompt-component-and-input-handling) — multiline, history, autocomplete features
- [Claudia desktop GUI features (BrightCoding, 2025)](https://www.blog.brightcoding.dev/2025/07/04/claudia-a-powerful-gui-app-and-toolkit-for-claude-code/) — session versioning, markdown, analytics
- [ink-ui component library (GitHub)](https://github.com/vadimdemedes/ink-ui) — TextInput and other Ink components
- [ink-syntax-highlight (GitHub)](https://github.com/vsashyn/ink-syntax-highlight) — syntax highlighting for Ink
- [vitest-websocket-mock (GitHub)](https://github.com/akiomik/vitest-websocket-mock) — WS mock for integration tests
- [WebSocket integration testing with Vitest (Medium)](https://thomason-isaiah.medium.com/writing-integration-tests-for-websocket-servers-using-jest-and-ws-8e5c61726b2a)
- [react-markdown (remarkjs)](https://github.com/remarkjs/react-markdown) — markdown component for React
- [react-shiki (GitHub)](https://github.com/avgvstvs96/react-shiki) — Shiki-powered highlighting hook for React
- [shadcn AI code block component](https://www.shadcn.io/ai/code-block) — copy button + Shiki in chat UI pattern

---
*Feature research for: Tek agent platform — CLI visual overhaul, desktop UI overhaul, testing foundation*
*Researched: 2026-02-20*
