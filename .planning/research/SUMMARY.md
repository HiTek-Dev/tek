# Project Research Summary

**Project:** Tek — Visual Polish & Testing Milestone (post v0.0.24)
**Domain:** CLI visual overhaul + Desktop UI overhaul + Testing foundation
**Researched:** 2026-02-20
**Confidence:** HIGH

## Executive Summary

Tek is a self-hosted AI agent platform with an Ink-based CLI and a Tauri + React desktop app, both communicating with a shared gateway over WebSocket. The existing backend (gateway, agent loop, MCP, memory, multi-provider routing) is fully built. This milestone is a targeted polish sprint: make the CLI feel like Claude Code, make the desktop feel like Claudia, and establish a test harness over the most critical gateway paths. The research is drawn directly from the live codebase — confidence is high because there is no speculation involved.

The recommended approach is to front-load two blockers before any visible work begins: (1) extract the vault from `@tek/cli` into `@tek/core` to break a confirmed circular dependency that prevents gateway tests from running in isolation, and (2) add per-page error boundaries to the desktop app to protect all subsequent component work. After those two tasks, CLI and desktop visual work can proceed in parallel with test infrastructure. The dependency order within each surface is clear: markdown rendering precedes the copy button and tool approval modal on desktop; collapsible panels and syntax highlighting are independent CLI tasks; test harness setup precedes any handler tests.

The dominant risks are architectural and Ink-specific. Ink's `Static` component will silently swallow state updates if developers add `useState` inside `MessageBubble`, which is rendered inside `<Static>`. Ink's full-screen re-render at terminal height triggers a documented upstream flicker bug requiring message windowing as a mitigation. The `handlers.ts` file (1,422 lines, zero tests) is a refactor trap — any restructuring without characterization tests first will cause silent regressions. On the desktop side, Tauri's CSP must be verified after every new dependency addition, and `react-markdown` (not raw `marked`) must be used to avoid XSS from agent-controlled content rendering in the WebView.

## Key Findings

### Recommended Stack

This milestone adds a small, targeted set of libraries to the existing stack. The headline choice is using `shiki` as the unified syntax highlighting engine for both CLI (via `codeToAnsi()` from `@shikijs/cli`) and desktop (via `@shikijs/rehype` with `react-markdown`). This replaces the abandoned `cli-highlight` and achieves VS Code-quality TextMate grammar highlighting on both surfaces from a single dependency family. All three shiki packages (`shiki`, `@shikijs/cli`, `@shikijs/rehype`) are versioned together at `3.22.0` and must be pinned as a set.

For desktop markdown, `react-markdown@10.1.0` + `remark-gfm@4.0.1` is the clear choice: React 19 compatible, no `dangerouslySetInnerHTML`, CSP-safe by construction. Animations use `motion@12.34.3` (the renamed Framer Motion) — import from `motion/react`, not the old `framer-motion` package name. Testing uses `msw@2.12.10` for both HTTP and WebSocket mocking (the Vitest-official recommendation), with no polyfills needed because Node 22 provides a native `WebSocket` global.

**Core new technologies:**
- `shiki` / `@shikijs/cli` / `@shikijs/rehype` `^3.22.0`: unified syntax highlighting engine — VS Code TextMate grammars, replaces abandoned cli-highlight; pin all three packages at the same version
- `react-markdown@^10.1.0` + `remark-gfm@^4.0.1`: markdown rendering in desktop — safe, React 19 compatible, CSP-compatible by construction
- `@tailwindcss/typography@^0.5.19`: prose styling for react-markdown output — configure via CSS `@plugin` directive in Tailwind v4, not `plugins: []`
- `motion@^12.34.3`: entrance animations and panel transitions — React 19 compatible, import from `motion/react` not `framer-motion`
- `react-diff-viewer-continued@^4.1.2`: diff display in chat — React 19 peer dep confirmed, accepts raw string input
- `msw@^2.12.10`: WebSocket and HTTP mocking in tests — Vitest-official recommendation, works in Node 22 with no polyfill
- `diff@^7.0.0`: programmatic diff computation in CLI — zero dependencies, ESM/CJS compatible

**Notable exclusions:**
- `ink-syntax-highlight`: abandoned, CommonJS-only, incompatible with Ink 6 ESM
- `framer-motion`: renamed — install `motion` instead
- `rehype-raw`: must never be enabled in Tauri desktop — opens XSS vector through agent-controlled markdown
- `react-syntax-highlighter`: heavy, uses weaker highlight.js grammars; `@shikijs/rehype` is the replacement

### Expected Features

**Must have (table stakes) — Phase P1:**
- CLI syntax highlighting in fenced code blocks via shiki — biggest visual gap, lowest effort
- CLI collapsible tool call panels — tool-heavy sessions are unreadable without this
- CLI input command history (up/down arrow) — too basic to be absent
- CLI truncated tool output with "N more lines" — prevents screen flooding
- CLI empty state welcome screen with slash command list
- Desktop markdown rendering in ChatMessage.tsx — single most impactful desktop change
- Desktop code block copy button — trivial effort, constant user friction without it
- Desktop tool approval modal wired to existing gateway protocol — security gap and parity with CLI
- Desktop error boundary per page — prevents render crashes from blanking the entire app
- Gateway unit tests: LLM router `classifyComplexity` (pure function, zero mocks), agent loop with mock transport, WS protocol schema shapes, tool approval integration test

**Should have (competitive differentiators) — Phase P2:**
- Conversation history sidebar in desktop — HIGH value, HIGH complexity; requires new `session.load` WS message not yet in protocol
- WebSocket auto-reconnect with exponential backoff, both CLI and desktop
- Multi-line input with Shift+Enter in CLI — same custom component as command history; best built together
- Token/cost short format in CLI StatusBar (`12.3k · $0.04`)
- Session context indicator in desktop chat header
- Approval gate policy unit tests, context assembly unit tests

**Defer (P3 / future milestone):**
- Tek brand design system beyond spot color changes
- Session search in desktop — requires SQLite FTS, belongs in a dedicated data milestone
- Step counter in streaming response
- Ink component snapshot tests — brittle ANSI escape sequences
- 100% code coverage targets — cover critical paths at 60-70% meaningful coverage instead

### Architecture Approach

The architecture for this milestone is additive — no new packages, no new services. The one structural change required is the vault extraction: move `packages/cli/src/vault/` into `packages/core/src/vault/` and update 6 gateway import sites. This eliminates the confirmed `@tek/cli -> @tek/gateway -> @tek/cli/vault` circular dependency, giving Turbo a clean DAG and allowing gateway tests to run without pulling in Ink and the full CLI tree. Beyond that, new components (`CollapsiblePanel`, `ToolApprovalModal`, `SessionHistoryPanel`) slot into existing trees without restructuring them. The gateway adds two new WS messages (`session.load` / `session.messages`) to support the desktop session history feature.

**Major components (new or significantly modified):**
1. `@tek/core/vault/` — NEW, moved from CLI; breaks the circular dependency and enables isolated gateway tests
2. `CollapsiblePanel.tsx` (CLI) — NEW; `useInput` toggle for tool/bash blocks in `MessageBubble`
3. `ChatMessage.tsx` (Desktop) — MODIFIED; replace `whitespace-pre-wrap` with `react-markdown` + shiki pipeline
4. `ToolApprovalModal.tsx` (Desktop) — NEW; wires to the existing gateway approval protocol the desktop currently ignores
5. `SessionHistoryPanel.tsx` (Desktop) — NEW; requires new `session.load` WS message in gateway protocol
6. `vitest.workspace.ts` + per-package `vitest.config.ts` — NEW; enables `pnpm test` from repo root
7. `packages/gateway/src/ws/__tests__/harness.ts` — NEW; `MockTransport` pattern enables all handler tests without a live server

**Key patterns to follow:**
- `MessageBubble` is a pure stateless component — no `useState` or `useEffect` ever; it lives inside Ink's `<Static>` which forbids updates after first render
- Markdown applies only to completed messages — never to `StreamingText.tsx` / `StreamingResponse.tsx` (partial markdown produces garbage output)
- `pendingApproval` state goes in `app-store.ts` (Zustand), not `ChatPage` local state — must survive page navigation
- Gateway handler tests use `MockTransport` — never test against a live WebSocket server or the production SQLite file
- All gateway handler functions take explicit `Transport` + `ConnectionState` + message params — no module-level singleton capture in extracted functions

### Critical Pitfalls

1. **Ink `Static` contract violation** — `MessageBubble` is rendered inside `<Static>`, which renders items once and never re-renders them. Any `useState` or `useEffect` inside `MessageBubble` produces invisible updates or flickering artifacts. Enforce a "pure props only" rule on `MessageBubble`; all interactive state (collapsible toggle, etc.) must live in components rendered outside `<Static>`.

2. **Ink terminal overflow / history destruction** — When rendered output height reaches `process.stdout.rows`, Ink clears the screen and destroys scroll history (documented Ink Issue #450 and #382). Implement message windowing: render only the last `Math.max(5, process.stdout.rows - 8)` messages. Listen to `process.stdout.resize`. Test with a 20-row terminal. This is an upstream architectural limitation, not fixable by Ink itself.

3. **Circular dependency blocking gateway tests** — `@tek/gateway` imports from `@tek/cli/vault`; `@tek/cli` depends on `@tek/gateway`. Gateway tests that import from the package transitively pull in Ink, React, commander, node-pty. Tests fail in CI. Fix: extract vault to `@tek/core` before writing any gateway tests. If deferred, use `vi.mock('@tek/cli/vault')` as a temporary stub, documented as tech debt.

4. **`handlers.ts` refactor regression risk** — The file is 1,422 lines with zero tests. Refactoring without first writing characterization tests will cause silent regressions. Use Strangler Fig: extract one handler at a time, test it, then move to the next. Never extract and refactor simultaneously in the same PR.

5. **Tauri CSP blocking new dependencies** — Tauri v2 enforces CSP. Any library loading external fonts, CDN CSS, or using `dangerouslySetInnerHTML` breaks in the WebView. Use `react-markdown` (JSX-based, no raw HTML) exclusively. Never enable `rehype-raw`. Verify zero CSP violations in DevTools after each library addition.

6. **AI SDK v6 type mismatch in tests** — AI SDK v6 removed `CoreMessage` (replaced by `ModelMessage`) and `convertToCoreMessages` (replaced by async `convertToModelMessages`). Test code based on older API knowledge will compile but fail at runtime. Audit all AI SDK imports before writing gateway tests; run `npx @ai-sdk/codemod v6` if needed.

## Implications for Roadmap

Based on combined research, the milestone should be structured into 4 phases with a strict ordering constraint on Phase 1.

### Phase 1: Foundation and Blockers

**Rationale:** Two blockers must be resolved before any other work can proceed safely. The circular dependency prevents gateway tests from running in CI. Missing error boundaries mean any new component added to the desktop can crash the entire app. Both are low-effort (hours, not days) and unblock everything downstream. The vault extraction also gives the test infrastructure team a clean import graph to write against from day one.

**Delivers:** Clean Turbo build DAG, isolated gateway test environment, crash-protected desktop app shell

**Addresses:**
- Vault extraction: `packages/cli/src/vault/` moved to `packages/core/src/vault/`; update 6 gateway import sites in `handlers.ts`, `llm/registry.ts`, `llm/provider.ts`, `key-server/routes.ts`, `key-server/auth.ts`, `index.ts`; remove `@tek/gateway` from CLI's `package.json` dependencies
- Error boundary per desktop page — wrap each page in `Layout.tsx` with a React ErrorBoundary class component
- Vitest workspace config — `vitest.workspace.ts` at repo root + per-package `vitest.config.ts` files with `env: { DB_PATH: ":memory:" }`

**Avoids:** Pitfall 3 (circular dep blocking tests), Pitfall 5 (handlers.ts regression from untested refactor)

**Research flag:** Standard patterns — skip `/gsd:research-phase`. Vault extraction is a mechanical file move with no design decisions. Error boundaries are a React standard. Vitest workspace config is well-documented.

---

### Phase 2: CLI Visual Overhaul

**Rationale:** CLI work is entirely self-contained within `packages/cli/src/components/`. No gateway protocol changes required. All work enhances existing components or adds new Ink components alongside them. Syntax highlighting and collapsible panels are independent tasks. Starting here while desktop work proceeds in parallel maximizes velocity with multiple engineers.

**Delivers:** Claude Code-quality CLI experience — syntax-highlighted code blocks, collapsible tool panels, command history, clean welcome screen, truncated output with line caps

**Addresses:**
- `shiki` / `codeToAnsi` wired into `MarkdownRenderer.tsx` code block renderer (replaces `cli-highlight`)
- `CollapsiblePanel.tsx` — new component; wrap `tool_call` and `bash_command` branches in `MessageBubble`
- Message windowing in `MessageList.tsx` — render last N messages based on `process.stdout.rows` (required to prevent Pitfall 2)
- CLI empty state in `Chat.tsx` — show agent name, available slash commands, keyboard shortcuts
- Truncated tool output in `MessageBubble` — cap at ~20 lines, show "... (N more lines)"
- Input command history — custom hook with circular buffer; coordinate with or defer multi-line input to P2

**Avoids:** Pitfall 1 (Static contract — MessageBubble stays pure/stateless), Pitfall 2 (terminal overflow — implement windowing in this phase), Pitfall 3 (Ink re-render cascade — keep StatusBar computation cheap, no animated components adjacent to streaming)

**Research flag:** Standard patterns — skip `/gsd:research-phase`. All patterns (useInput toggle, message windowing, history buffer) are documented in Ink issues and implemented in Claude Code and opencode reference apps.

---

### Phase 3: Desktop UI Overhaul

**Rationale:** Desktop work is more complex than CLI work because it involves both new UI components and a gateway protocol addition. Markdown rendering must come first because the copy button and tool approval modal both depend on it. Tool approval modal requires no gateway changes — the protocol exists and the desktop hook already receives but discards approval events. Session history requires a new gateway WS message (`session.load`), so it is sequenced last within this phase.

**Delivers:** Production-quality desktop chat — rendered markdown, syntax-highlighted code with copy buttons, functional tool approval modal, conversation history sidebar

**Addresses:**
- `react-markdown` + `remark-gfm` + `@shikijs/rehype` + `@tailwindcss/typography` in `ChatMessage.tsx` assistant branch only (streaming in `StreamingText.tsx` stays plain text)
- Code block copy button as overlay component inside markdown renderer's code block
- `ToolApprovalModal.tsx` — new component; wire `tool.approval.request` handler in `useChat.ts`; add `pendingApproval` to `app-store.ts` (Zustand, not local state)
- `react-diff-viewer-continued` for diff-format tool outputs
- `motion` for message entrance animations and panel transitions — use sparingly
- `session.load` + `session.messages` WS messages added to gateway `protocol.ts` and `handlers.ts`
- `SessionHistoryPanel.tsx` + `app-store.ts` `sessions[]` state + `useChat.ts` session load handler
- WS auto-reconnect with exponential backoff (1s/2s/4s/8s/max 30s) in `useWebSocket.ts` for both desktop and CLI

**Avoids:** Pitfall 4 (Tauri CSP — validate DevTools after each new library; never enable `rehype-raw`), XSS via agent markdown (`react-markdown` JSX-based, safe by construction), streaming markdown artifacts (preserve `StreamingText` plain text path)

**Research flag:** Tool approval modal UX and session history integration may benefit from a short `/gsd:research-phase` pass to confirm WS message schema design and whether the gateway needs per-session ownership checks for `session.load` (single-user self-hosted: likely not needed; worth confirming).

---

### Phase 4: Test Infrastructure

**Rationale:** Test infrastructure can run in parallel with Phases 2 and 3 after Phase 1 completes, but the correct internal ordering is: Zod schema tests first (fastest, no mocks), then mock transport harness, then handler tests (require vault extraction from Phase 1), then desktop hook tests (require approval handler work from Phase 3). Agent loop tests unblock all other gateway tests by establishing the `MockTransport` + mock `streamText` pattern.

**Delivers:** 60-70% meaningful coverage over critical gateway paths — LLM router, agent loop, WS protocol contracts, tool approval round-trip, context assembly

**Addresses:**
- WS protocol Zod schema unit tests (`protocol.test.ts`) — no mocks, fast regression detection; first suite to write
- `MockTransport` harness (`__tests__/harness.ts`) — enables all handler tests without live server or live AI provider
- `classifyComplexity` (LLM router) unit tests — pure function, zero mocks, high regression value
- `runAgentLoop` unit tests with mock transport and mock AI SDK `streamText`
- `handleChatSend` characterization tests
- `handleToolApprovalResponse` integration test — most complex user-facing flow
- `handleSessionList` + `handleSessionLoad` handler tests
- Desktop `useChat` hook tests (React Testing Library) — test approval event handler path

**Avoids:** Pitfall 5 (handlers.ts regression — characterization tests before any extraction), Pitfall 6 (AI SDK v6 type mismatch — audit all `ModelMessage` / `streamText` imports before writing gateway tests), production SQLite contamination (use `DB_PATH=:memory:` in all test environments)

**Research flag:** The AI SDK v6 mock setup for `streamText` / `ModelMessage` API surface may benefit from a targeted research pass before writing agent loop tests to confirm the correct `vi.mock` patterns.

---

### Phase Ordering Rationale

- **Phase 1 must come first and is non-negotiable.** The circular dependency is a hard blocker for CI tests. Error boundaries protect all future desktop work. Neither task has any dependencies.
- **Phases 2 and 3 can proceed in parallel** if multiple engineers are available. CLI work (Phase 2) has zero gateway protocol dependencies. Desktop work (Phase 3) adds one new WS message but does not touch existing handlers.
- **Phase 4 can run continuously alongside Phases 2 and 3** after Phase 1 completes. Protocol tests and mock transport harness can be written immediately after Phase 1. Handler tests follow in order of dependency.
- **Session history (end of Phase 3) is the only feature with a cross-surface protocol dependency.** It requires gateway protocol additions (`session.load` / `session.messages`) before the desktop component can be built. This dependency is correctly isolated to the end of Phase 3.
- **Multi-line input and command history share the same custom Ink input component.** P1 includes command history; P2 includes multi-line Shift+Enter. If resources allow, building both in Phase 2 avoids building the custom component twice.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (tool approval modal UX):** The approval modal needs a decision on blocking vs inline rendering. Reference app analysis (Claudia, Claude Code) shows different approaches — a short research pass on approval UX patterns is warranted before implementation.
- **Phase 3 (session.load security):** Confirm whether gateway `handleSessionLoad` needs per-session ownership checks. In a single-user self-hosted deployment this is likely unnecessary, but worth explicit confirmation before adding the handler.
- **Phase 4 (AI SDK v6 mock patterns):** The migration from `CoreMessage` / `streamObject` to `ModelMessage` / `streamText` with `output` parameter requires careful mock setup — worth a targeted research pass before writing agent loop tests.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Vault extraction is a mechanical move of 4 files. Vitest workspace config is copy-paste from Vitest docs. Error boundaries are a React standard.
- **Phase 2:** All CLI patterns (useInput toggle, message windowing, command history buffer) are documented in Ink upstream issues and implemented in Claude Code and opencode. No new design decisions.
- **Phase 3 (markdown pipeline):** `react-markdown` + `@shikijs/rehype` + `@tailwindcss/typography` is a standard, well-documented stack with no ambiguous integration points.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All version numbers verified via npm registry February 2026. React 19 peer deps confirmed via `npm show`. Tailwind v4 `@plugin` directive sourced from community discussion thread (only MEDIUM confidence point in this area). |
| Features | HIGH | Based on direct codebase inspection of all three surfaces plus competitor analysis (Claude Code, opencode, Claudia). Gap identification is authoritative — drawn from live source files. |
| Architecture | HIGH | All findings from direct source reading of `handlers.ts`, `protocol.ts`, `useChat.ts`, `ChatMessage.tsx`, CLI component tree. No speculation. Circular dependency confirmed via explicit import tracing. |
| Pitfalls | HIGH | Ink flicker pitfalls confirmed via upstream GitHub issues with numbers cited. Tauri CSP issues confirmed via official docs and a specific bug report. AI SDK v6 migration from official Vercel migration guide. |

**Overall confidence:** HIGH

### Gaps to Address

- **`@inkjs/ui` version compatibility with Ink v6:** The pitfalls research flagged that `@inkjs/ui` v2 requires Ink v5+ and v3 may be needed for Ink v6. `@inkjs/ui@^2.0.0` is already installed. Verify during Phase 2 that `useInput` and `TextInput` behave correctly before building the custom input component. May require upgrading to `@inkjs/ui` v3.

- **`session.load` WS message authorization:** The architecture research provides the full schema for `session.load` but does not address whether the gateway needs to verify the requesting client owns the session. Current `handleSessionList` returns all sessions globally. For a single-user self-hosted deployment this is acceptable; multi-user deployments would need per-session ownership validation. Flag for explicit decision during Phase 3 planning.

- **Tailwind v4 typography `@plugin` directive:** The `@tailwindcss/typography` v4 integration was sourced from a community discussion thread, not official documentation. Verify this config pattern works in the actual Vite build during Phase 3 implementation before committing to the approach; have a fallback (CSS-based manual prose styles) ready.

- **Multi-line input and command history sequencing:** P1 includes command history as a standalone feature on the existing `TextInput`. P2 includes multi-line Shift+Enter via a full custom input component. If command history is added to `@inkjs/ui TextInput` first, that work may be discarded when the custom component is built. Consider building both in Phase 2 to avoid duplication, or explicitly plan Phase 2 to replace the Phase 1 history implementation.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `packages/gateway/src/ws/handlers.ts`, `protocol.ts`, `packages/cli/src/components/*.tsx`, `apps/desktop/src/components/ChatMessage.tsx`, `apps/desktop/src/hooks/useChat.ts`, `packages/gateway/src/session/manager.ts`, `packages/cli/package.json`, `packages/gateway/package.json` — all architectural findings
- npm registry, February 2026 — all version numbers verified via `npm show [package] version`
- [Shiki GitHub](https://github.com/shikijs/shiki) — active maintenance, `codeToANSI` confirmed in `@shikijs/cli`
- [react-markdown GitHub](https://github.com/remarkjs/react-markdown) — v10, React 19 support confirmed
- [MSW WebSocket docs](https://mswjs.io/docs/websocket/) — WebSocket interception, Node 22 native WebSocket requirement
- [Vitest mocking/requests docs](https://vitest.dev/guide/mocking/requests) — MSW as official Vitest recommendation
- [motion.dev React docs](https://motion.dev/docs/react) — React 19 compatibility confirmed
- [AI SDK Migration Guide: v5 to v6](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0) — CoreMessage removed, ModelMessage, streamText with output parameter
- [Tauri v2 CSP Documentation](https://v2.tauri.app/security/csp/) — CSP defaults and configuration
- [Ink GitHub Issue #450](https://github.com/vadimdemedes/ink/issues/450) — terminal overflow flicker bug
- [Ink GitHub Issue #382](https://github.com/vadimdemedes/ink/issues/382) — history destruction at full screen height
- [Ink v6.7.0 Release Notes](https://github.com/vadimdemedes/ink/releases/tag/v6.7.0) — synchronized updates support
- [ink-syntax-highlight GitHub issue #4](https://github.com/vsashyn/ink-syntax-highlight/issues/4) — Ink incompatibility confirmed, no maintainer response
- `/Users/hitekmedia/Documents/GitHub/tek/next-milestone/ASSESSMENT.md` — primary gap analysis source

### Secondary (MEDIUM confidence)
- [Tailwind v4 typography discussion](https://github.com/tailwindlabs/tailwindcss/discussions/14120) — `@plugin` directive for v4 (community thread, not official docs)
- [Claude Code Terminal UI internals (Medium)](https://kotrotsos.medium.com/claude-code-internals-part-11-terminal-ui-542fe17db016) — Ink rendering architecture reference
- [Claudia desktop GUI features (BrightCoding)](https://www.blog.brightcoding.dev/2025/07/04/claudia-a-powerful-gui-app-and-toolkit-for-claude-code/) — session versioning, markdown, analytics competitor analysis
- [opencode TUI Prompt Component (DeepWiki)](https://deepwiki.com/sst/opencode/6.5-tui-prompt-component-and-input-handling) — multiline, history, autocomplete feature patterns
- [Avoiding XSS via Markdown in React (Medium)](https://medium.com/javascript-security/avoiding-xss-via-markdown-in-react-91665479900) — security analysis
- [Tauri GitHub Issue #14707](https://github.com/tauri-apps/tauri/issues/14707) — CSP prevents IPC requests (confirmed bug report)
- [test-ink-flickering/INK-ANALYSIS.md](https://github.com/atxtechbro/test-ink-flickering/blob/main/INK-ANALYSIS.md) — deep architectural analysis of Ink's rendering model

---
*Research completed: 2026-02-20*
*Ready for roadmap: yes*
