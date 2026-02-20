# Pitfalls Research

**Domain:** CLI Visual Overhaul + Desktop UI Polish + Test Retrofitting (Tek v0.0.24+)
**Researched:** 2026-02-20
**Confidence:** HIGH (codebase inspected directly; verified against official Ink, Tauri, marked, AI SDK, and Vitest sources)

> NOTE: This file supersedes the previous PITFALLS.md (2026-02-15) for the visual polish + testing milestone. The prior file covered the AI agent platform architecture pitfalls (context management, sessions, WebSocket reliability) and remains valid for those concerns. This file focuses specifically on the new work: Ink rendering overhaul, Tauri/React markdown + design system, and test infrastructure retrofitting.

---

## Critical Pitfalls

### Pitfall 1: Breaking Ink's `Static` Component Contract During Visual Refactor

**What goes wrong:**
`MessageList.tsx` uses Ink's `<Static>` component for append-only message rendering. `Static` renders items permanently above the rest of the UI — items are rendered once and never re-rendered. Any refactor that introduces stateful logic, animations, or re-renderable markup inside `Static` children will cause either invisible updates (the change is never visible) or catastrophic flickering (Ink tries to re-render a permanently-committed region). This is the single most dangerous refactor point in the CLI visual overhaul because it looks fine locally until you add a feature that attempts to update an already-committed message.

**Why it happens:**
The `Static` API looks like a normal React list. Developers treat it as a `<ul>` equivalent and add hover effects, expand/collapse states, or reactive markdown highlighting inside it. Ink's `Static` explicitly states: "items can't be updated once they are displayed." State changes inside `Static` are silently dropped or produce artifacts.

**How to avoid:**
- Never put interactive or stateful UI inside `<Static>` items. `MessageBubble` must render purely from props with zero internal state.
- Keep the `Static`/non-static boundary explicit: completed messages go in `Static`, the active streaming response stays outside in `<StreamingResponse>`.
- If you need to show updated information (e.g., tool call status changes from `pending` to `complete`), duplicate the final resolved state into a new `Static` item — do not attempt to mutate an existing one.
- Test this by running the CLI and verifying that message updates after streaming completes do not cause flicker or duplicate rendering.

**Warning signs:**
- `useState` or `useEffect` appears inside `MessageBubble` or any component rendered within `<Static>`.
- A message's content appears twice in the terminal output.
- Visual changes added to completed messages are invisible during the live session.

**Phase to address:**
CLI Visual Overhaul phase. Establish a "Static contract" rule in the component: `MessageBubble` is pure/stateless.

---

### Pitfall 2: Ink Full-Screen Overflow Causing Terminal History Destruction

**What goes wrong:**
When Ink's rendered output height reaches or exceeds `process.stdout.rows`, Ink clears the entire terminal screen and redraws from scratch. This destroys terminal scroll history — users cannot scroll up to see earlier content. More critically, when the output height equals exactly `process.stdout.rows`, there is a known flickering bug (Ink Issue #450) where an accidental scroll triggers rapid resize. The Chat component uses `padding={1}` and vertical stacking (StatusBar + MessageList + InputBar), so in a standard 24-row terminal with several messages, this threshold is easily reached.

**Why it happens:**
Ink's rendering model uses `ansi-escapes.eraseLines()` to clear and redraw. When output equals the terminal height, cursor positioning and the redraw interact with terminal scroll behavior unpredictably. This is a documented upstream limitation, not a fixable bug in application code.

**How to avoid:**
- Implement a message windowing strategy: render only the last N messages in `MessageList` where N is calculated from available terminal rows, not an arbitrary constant. A safe formula: `Math.max(5, process.stdout.rows - 8)` (subtracting rows used by StatusBar and InputBar).
- Never render output exactly equal to `process.stdout.rows`. Always leave at least 1 row of margin.
- Listen to `process.stdout.resize` events and recalculate the visible window on terminal resize.
- Test with a small terminal window (20 rows) after several message exchanges to verify no flicker.

**Warning signs:**
- Terminal history disappears after a few messages are exchanged.
- Rapid flickering when terminal is resized with content near-full.
- Users report the terminal "clears itself" mid-conversation.

**Phase to address:**
CLI Visual Overhaul phase. Implement windowed message rendering as part of the MessageList redesign.

---

### Pitfall 3: Ink Full Re-Render Cascade Killing Performance During Streaming

**What goes wrong:**
Ink performs a complete tree traversal and full terminal redraw on every React state change, regardless of which component updated. During streaming (where `streamingText` updates every token, potentially 20-50 times per second), every token update triggers a full redraw of the StatusBar, MessageList, StreamingResponse, and InputBar. With complex markdown rendering or rich status displays in those components, this becomes computationally expensive and causes visible flicker on slower terminals or CI-like environments.

**Why it happens:**
This is architectural: Ink generates a 2D character buffer of the entire viewport on every render cycle. There is no partial update mechanism. Adding visual complexity (borders, colors, multi-column layouts) to StatusBar or adding rich formatting to MessageBubble increases the cost of every single token update.

**How to avoid:**
- Keep the StatusBar computation cheap: no dynamic formatting, no computed strings built in render. Compute display strings before rendering.
- Do not add animated components (spinners, progress bars) adjacent to actively streaming content — each animation frame doubles the already-high render rate.
- The `<Spinner>` from `@inkjs/ui` is already used in `StreamingResponse` when `text` is empty (waiting phase). This is safe because spinner updates only happen before streaming begins. Do not add spinners to other components that are visible during streaming.
- Ink v6.7.0 added synchronized updates support (fixes flicker in modern terminals). Verify `@inkjs/ui` and `ink` are at versions that enable this feature.

**Warning signs:**
- CPU spikes to 100% during streaming in `ps` output.
- Visible screen tearing or partial renders visible to the eye during token streaming.
- Streaming throughput (perceived tokens/second) is lower than the gateway's actual send rate.

**Phase to address:**
CLI Visual Overhaul phase. Audit render cost before adding any new visual components.

---

### Pitfall 4: Circular Dependency Between `@tek/cli` and `@tek/gateway` Blocking Test Infrastructure

**What goes wrong:**
`@tek/gateway` imports from `@tek/cli/vault` in six files (`handlers.ts`, `llm/registry.ts`, `llm/provider.ts`, `key-server/routes.ts`, `key-server/auth.ts`, `index.ts`). `@tek/cli` depends on `@tek/gateway`. This is a confirmed bidirectional dependency. When retrofitting unit tests onto `@tek/gateway`, any test that imports from `gateway` will transitively pull in `@tek/cli`, which in turn pulls in Ink, React, commander, node-pty, and all CLI dependencies. This makes gateway tests slow to compile, breaks in environments without terminal access (CI), and forces test mocks to cover an enormous surface area.

**Why it happens:**
The vault (`getKey`) lived in CLI first and was imported by gateway as a convenience. The boundary should have been `@tek/core` or a standalone `@tek/secrets` package. Now that gateway imports CLI, the circular chain is:
```
@tek/cli → @tek/gateway → @tek/cli/vault
```
pnpm's workspace resolution may allow this at build time, but test isolation at the package level fails.

**How to avoid:**
- Before writing any gateway tests, extract the vault interface (`getKey`, `validateProvider`, `getOrCreateAuthToken`) into `@tek/core` or a new `@tek/secrets` package that neither `@tek/cli` nor `@tek/gateway` depends on.
- This unblocks gateway tests without requiring a mock of the entire CLI package.
- If full extraction is out of scope for this milestone, use Vitest's `vi.mock('@tek/cli/vault', ...)` to stub the vault at test setup, and document the circular dependency as technical debt for the next milestone.
- Never let the circular dependency deepen — no new `@tek/cli` imports should appear in `@tek/gateway` source.

**Warning signs:**
- `import { getKey } from '@tek/cli/vault'` appears in new gateway files.
- Gateway tests fail with "Cannot find module @tek/cli" in CI.
- Test setup files for gateway require mocking Ink or React internals.

**Phase to address:**
Test Infrastructure phase. This is the first thing to address before writing any gateway tests.

---

### Pitfall 5: `handlers.ts` Refactor Without Test Coverage Causing Regressions

**What goes wrong:**
`handlers.ts` is 1,422 lines handling chat streaming, tool approval, agent loop dispatch, memory management, MCP configuration, workflow triggers, schedule management, soul evolution, and heartbeat configuration — all in a single file. Any refactoring done to support cleaner test structure (e.g., extracting handler functions, injecting dependencies) without first having integration tests will cause silent regressions. WebSocket message handling is stateful (session IDs, connection state, approval queues) and the interaction between handlers is non-obvious.

**Why it happens:**
Handlers grew incrementally as features were added. Each feature touched the file, adding 50-150 lines. No tests existed, so each addition was only verified manually by running the gateway. Refactoring without tests means the only regression detection is manual QA, which is expensive and incomplete.

**How to avoid:**
- Write characterization tests first: tests that document current behavior without asserting it is "correct." These tests will fail if behavior changes, which is the desired safety net.
- Use the Strangler Fig pattern: extract one handler at a time (e.g., `handleChatSend`) into a pure function that takes explicit dependencies as parameters, add a test for it, then move to the next. Never modify two handlers in the same PR.
- The extracted handler functions should take `Transport`, `ConnectionState`, and the specific message as parameters — not capture them from module-level closure. This makes them testable in isolation.
- Do not extract and refactor simultaneously. Extract first (behavior-preserving), test next, refactor last.

**Warning signs:**
- A PR touches more than one handler in `handlers.ts`.
- Refactored handler functions still read from module-level singletons (`memoryManagerInstance`, `migrationRan`).
- Tests for `handleChatSend` require setting up a live Fastify server.

**Phase to address:**
Test Infrastructure phase. No handler refactoring until characterization tests exist.

---

### Pitfall 6: Tauri WebView CSP Blocking Local WebSocket Connections

**What goes wrong:**
Tauri v2 enables Content Security Policy by default. When adding markdown rendering libraries or design system packages that load external fonts, icons, or CDN resources, the CSP blocks those requests at the WebView level, silently breaking features. More critically, Tauri's IPC mechanism uses a custom URL scheme (`tauri://`) that interacts with CSP. If CSP is misconfigured while adding new content origins for markdown rendering, IPC calls from the React frontend to Rust commands can stop working entirely — a devastating and non-obvious breakage.

**Why it happens:**
Developers add a markdown library (e.g., `react-markdown`) that renders HTML, then add a syntax highlighting library (e.g., `highlight.js`) that needs to load CSS from `cdnjs.cloudflare.com`. The CSP `style-src` or `connect-src` blocks it. Worse, the developer loosens CSP to `unsafe-inline` to fix styling, which opens XSS vectors in the WebView. GitHub Copilot and LLM-rendered markdown is particularly dangerous here — agent output could include HTML that runs in the WebView context.

**How to avoid:**
- Keep all assets local. Vendor CSS and fonts into the Vite bundle. Never allow `connect-src` to reach external CDNs in the Tauri app.
- Use `react-markdown` (which uses React.createElement, not dangerouslySetInnerHTML) instead of raw `marked` for desktop. This prevents XSS by construction since React's JSX escaping handles sanitization.
- If raw HTML rendering is needed (for rich tool outputs), use `DOMPurify` before any `dangerouslySetInnerHTML` call. DOMPurify strips event handlers and script tags.
- Test CSP by opening Tauri's DevTools (`⌘⌥I` on macOS) and checking the Console for CSP violation warnings after adding any new dependency.
- The current desktop app does not render markdown at all (assistant messages use `whitespace-pre-wrap`). Adding markdown rendering is the main CSP risk vector.

**Warning signs:**
- Console shows `Refused to load stylesheet` or `Refused to connect` after adding a dependency.
- Tauri IPC calls (`invoke()`) stop responding after a CSP change.
- Syntax highlighting CSS does not apply even though the library is installed.

**Phase to address:**
Desktop UI Overhaul phase. Validate CSP after each new library addition.

---

### Pitfall 7: `marked` v15 Synchronous API Assumption Breaking at Runtime

**What goes wrong:**
The CLI's `lib/markdown.ts` calls `marked.parse(text)` and checks `typeof result === "string"`. In older marked versions, `marked.parse()` with synchronous extensions returns a string synchronously. In marked v15, the behavior depends on whether any async extensions are registered — if they are (or if marked detects a Promise-returning hook), `marked.parse()` returns `Promise<string>`, not `string`. The fallback (`return text`) silently produces unrendered markdown in the terminal when this happens. The current code handles this, but adding any async marked extension (e.g., for custom code highlighting) will silently break rendering.

**Why it happens:**
`marked-terminal` is a synchronous renderer extension. The current stack works because no async extensions are in use. Developers see the `marked.use()` pattern, find an extension they want, and add it without checking whether it uses async hooks.

**How to avoid:**
- Never add async extensions to the marked instance used in the CLI. Keep `renderMarkdown()` synchronous.
- If async rendering is needed in the future, convert `renderMarkdown` to `async` and update all call sites before adding any async extension.
- Add an assertion in `renderMarkdown`: if the result is a Promise (from an inadvertently async extension), throw a clear error rather than silently returning the original text.
- For desktop markdown rendering, use `react-markdown` entirely — do not share the `marked` instance between CLI and desktop.

**Warning signs:**
- Markdown appears unrendered (raw asterisks and backticks) in the terminal after adding a new `marked` extension.
- `typeof result` check in `renderMarkdown` evaluates to `"object"` at runtime.
- A new `marked.use()` call is added without verifying it is synchronous.

**Phase to address:**
CLI Visual Overhaul phase. Document the sync-only constraint at the top of `lib/markdown.ts`.

---

### Pitfall 8: AI SDK v6 `CoreMessage`/`ModelMessage` API Mismatch in Gateway Tests

**What goes wrong:**
`@tek/gateway` uses `ai@^6.0.86` and `@ai-sdk/*@^3.0.0`. AI SDK v6 removed the `CoreMessage` type entirely, replacing it with `ModelMessage`. The function `convertToCoreMessages` was replaced with `convertToModelMessages`, which is now asynchronous (requires `await`). If gateway tests mock the AI SDK's message types using the old `CoreMessage` interface (from training data or cached npm types), tests will compile but produce wrong runtime behavior. Additionally, `streamObject`/`generateObject` no longer exist — they were replaced by `streamText`/`generateText` with an `output` parameter. Tests that mock these removed APIs will silently pass while the actual SDK calls fail.

**Why it happens:**
AI SDK v6 was a significant breaking change. Test code written using training data knowledge of AI SDK v4/v5 APIs will reference removed types and functions. The TypeScript compiler may not catch this if the test file imports from a re-export that smooths over the change, or if the mock fully replaces the module before type checking runs.

**How to avoid:**
- Run `npx @ai-sdk/codemod v6` if migrating from an older AI SDK version. The codemod handles the mechanical changes.
- In test mocks for AI SDK, import from the actual `ai` package and use the exported types — do not define message type interfaces inline.
- Specifically: replace `CoreMessage` with `ModelMessage`, `convertToCoreMessages` with `await convertToModelMessages()`, `partialObjectStream` with `partialOutputStream`, and remove any `streamObject`/`generateObject` mock implementations.
- Verify the provider packages: all `@ai-sdk/*` must be at `^3.0.0` to match `ai@^6`. Mismatched provider package versions cause cryptic runtime errors, not build errors.

**Warning signs:**
- TypeScript errors mentioning `CoreMessage is not defined` or `Property 'partialObjectStream' does not exist`.
- Tests pass but gateway chat handler produces no streaming output in integration tests.
- `@ai-sdk/anthropic` is at `^1.x` while `ai` is at `^6.x`.

**Phase to address:**
Test Infrastructure phase. Audit all AI SDK type imports before writing any gateway tests.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems specific to this milestone.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skipping the `@tek/cli/vault` extraction and mocking it in tests | Faster test setup | Gateway tests are permanently coupled to CLI, CI fragility increases | Only in MVP test milestone; extract before next major refactor |
| Using `marked` + `dangerouslySetInnerHTML` for desktop markdown | Reuses existing CLI markdown logic | XSS vector via agent output in WebView; CSP complications | Never — use `react-markdown` for desktop |
| Adding visual polish to CLI without message windowing | Looks good on demo terminal | Flicker and history loss in real user terminals narrower than expected | Never — implement windowing in same phase |
| Writing tests against the live WebSocket server | Tests real behavior end-to-end | Tests are slow, flaky, and require a running gateway | Only for integration test suite; unit tests must mock the transport |
| Mocking entire `handlers.ts` module in tests | Fast test setup | Tests the mock, not the handlers | Never — mock dependencies OF handlers, not handlers themselves |
| Adding Tailwind `v4` classes directly to components without a design token layer | Fast iteration | Color/spacing changes require grep-and-replace across all components | Acceptable for MVP of this milestone; extract tokens before adding a theme |

---

## Integration Gotchas

Common mistakes when connecting the pieces of this milestone.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Ink + `marked-terminal` | Configuring `width` from `process.stdout.columns` at module load time, before terminal is ready | Defer width configuration to first render or listen to resize events |
| Tauri + `react-markdown` | Allowing `rehype-raw` plugin which enables raw HTML passthrough | Omit `rehype-raw`; use only `remark-*` plugins that produce safe AST nodes |
| Tauri + external fonts | Loading fonts via `@import url(https://fonts.googleapis.com/...)` in CSS | Bundle fonts with Vite; use `@font-face` pointing to local file paths |
| Vitest + WebSocket tests | Using `jsdom` environment for WebSocket server tests | Use `node` environment for server tests; WebSocket server is Node.js, not browser |
| Vitest + ESM monorepo | `import.meta.url` errors in gateway tests | Configure `vitest.config.ts` with `resolve.conditions: ['node']` for gateway package |
| `@inkjs/ui` + Ink v6 | Assuming `@inkjs/ui` components are always compatible with the installed `ink` version | Check peer dependency matrix; `@inkjs/ui` v2 requires `ink` v5+; v3 of `@inkjs/ui` may be needed for `ink` v6 |

---

## Performance Traps

Patterns that work in demo conditions but degrade in real use.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Rendering all chat messages in `<Static>` without windowing | Terminal clears history; flicker at full screen | Implement message window: render last N messages where N = available rows | >15 messages in a 24-row terminal |
| Using `marked.parse()` on every render of `StreamingResponse` | CPU spike during streaming; partial markdown artifacts mid-stream | Only apply markdown rendering to completed messages; stream as plain text | Every token during streaming |
| Adding `useMemo`/`useCallback` to Ink components expecting React performance gains | Wasted complexity; Ink still redraws the full screen regardless | Do not rely on React memo optimizations in Ink — they do not reduce terminal redraws | Always — React optimizations don't help Ink's rendering model |
| Importing large syntax highlighting libraries (highlight.js full bundle) for CLI | Slow CLI startup; cold start takes 3-5 seconds | Use `cli-highlight` (already installed) with lazy loading for specific languages | At import; slows every tek command invocation |
| Running gateway tests with real SQLite database | Tests leave state, fail in parallel, are slow | Use `:memory:` SQLite for tests; reset per test | Any CI run with parallel test workers |

---

## Security Mistakes

Domain-specific security issues specific to this milestone's scope.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Using raw `marked` output in Tauri's WebView without sanitization | Agent output containing `<script>` tags executes in the WebView | Use `react-markdown` (no `dangerouslySetInnerHTML`) for all desktop markdown rendering |
| Exposing full tool output JSON in desktop without length limits | Very long outputs (100KB+) freeze the React renderer | Truncate display output in `ChatMessage.tsx` (truncation is already present; preserve it) |
| Allowing `rehype-raw` in `react-markdown` | Same XSS vector as raw HTML injection | Never install or enable `rehype-raw` in the desktop app |
| Test database containing real API keys from developer environment | Leaked keys in test snapshots committed to git | Test fixtures must use fake keys; add `sk-ant-`, `sk-`, `AIza` patterns to `.gitignore` and pre-commit hooks |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Markdown rendering applied to streaming text mid-response | Partial markdown syntax appears and disappears as tokens arrive (e.g., `**bold` before the closing `**`) | Render streaming text as plain text; apply markdown only to the finalized message in `MessageBubble` |
| Adding color themes that override terminal's own color scheme | Text becomes unreadable in light-background terminals | Use semantic colors only: `bold`, `dim`, named colors that adapt to terminal theme; avoid hardcoded hex values in Ink |
| Desktop markdown codeblocks with no copy button | Users must manually select and copy code from assistant responses | Add a copy-to-clipboard button to code blocks in the desktop's markdown renderer |
| Overly rich CLI UI that delays startup | Users wait 2+ seconds for `tek chat` to display the input prompt | Keep Ink component initialization synchronous; defer WebSocket connection until after first render |
| Test suite so slow it's not run before commit | Regressions slip into main | Gateway unit tests must complete in <10 seconds; integration tests are a separate script |

---

## "Looks Done But Isn't" Checklist

Things that appear complete during demos but are missing critical pieces.

- [ ] **CLI markdown rendering:** Verify it does not apply to streaming text (check `StreamingResponse` vs `MessageBubble` — streaming must show plain text).
- [ ] **CLI message windowing:** Verify that opening a small terminal (20 rows) and sending 10 messages does not destroy scroll history or flicker.
- [ ] **Desktop markdown:** Verify that agent output containing `<script>alert(1)</script>` renders as escaped text, not executed JavaScript.
- [ ] **Desktop markdown:** Verify that code blocks have syntax highlighting and a copy button.
- [ ] **Gateway unit tests:** Verify that `handleChatSend` tests run without a live WebSocket server or live AI provider.
- [ ] **Gateway tests in CI:** Verify that `pnpm test` in `packages/gateway` passes without any environment variables set (keys mocked).
- [ ] **Circular dependency:** Verify that `packages/gateway` tests do not fail with "Cannot find @tek/cli" when `@tek/cli` is not built.
- [ ] **Tauri CSP:** Open DevTools after adding any new library and verify zero CSP violation warnings in Console.
- [ ] **`marked-terminal` width:** Verify that the terminal width is correct on first render after a terminal resize, not only on startup.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Static component re-render artifacts | LOW | Remove stateful logic from `MessageBubble`; restore pure props-only rendering |
| Terminal overflow / history destruction | LOW-MEDIUM | Implement message windowing; takes ~2 hours to add correctly with resize handling |
| Circular dependency blocking tests | MEDIUM | Extract vault interface to `@tek/core`; update 6 import sites in gateway; ~1 day |
| CSP blocking desktop features | LOW | Add specific `connect-src` or `style-src` allowlist entries in `tauri.conf.json`; test thoroughly |
| `handlers.ts` regression from refactor | HIGH | Roll back the refactor; add characterization tests first; re-extract one function at a time |
| AI SDK v6 type mismatch in tests | LOW | Run `npx @ai-sdk/codemod v6`; manually fix remaining type references; ~2 hours |
| Streaming markdown partial artifacts | LOW | Move markdown rendering from `StreamingResponse` to `MessageBubble` (it's already structured this way; ensure it stays that way) |

---

## Pitfall-to-Phase Mapping

How roadmap phases for this milestone should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Static component contract violation | CLI Visual Overhaul | `MessageBubble` has zero `useState`/`useEffect` calls; confirmed with grep |
| Terminal overflow / flicker | CLI Visual Overhaul | Pass 20-row terminal smoke test; no history destruction after 15+ messages |
| Ink full re-render cascade during streaming | CLI Visual Overhaul | CPU stays below 30% during 50-token-per-second streaming on M1 Mac |
| Circular dep blocking gateway tests | Test Infrastructure (first task) | `pnpm test` in `packages/gateway` runs without `@tek/cli` built |
| `handlers.ts` refactor without tests | Test Infrastructure | No handler extraction until characterization tests exist for that handler |
| Tauri CSP blocking new deps | Desktop UI Overhaul | Zero CSP violations in DevTools after each new library addition |
| `marked` v15 async extension | CLI Visual Overhaul | `renderMarkdown` includes assertion: result must be string, not Promise |
| AI SDK v6 type mismatch | Test Infrastructure | All test files use `ModelMessage` not `CoreMessage`; build passes cleanly |
| XSS via agent output in desktop | Desktop UI Overhaul | `<script>alert(1)</script>` in assistant message renders as escaped text |
| Streaming markdown artifacts | CLI + Desktop Visual Overhaul | Streaming text renders plain; markdown applies only to completed messages |

---

## Sources

- [Ink GitHub Issue #450: Flickering when height equals terminal rows](https://github.com/vadimdemedes/ink/issues/450) — HIGH confidence, documented upstream bug
- [Ink GitHub Issue #359: View longer than screen flickers badly](https://github.com/vadimdemedes/ink/issues/359) — HIGH confidence, documented upstream limitation
- [Ink GitHub Issue #382: Terminal history cleared if output > window height](https://github.com/vadimdemedes/ink/issues/382) — HIGH confidence, architectural limitation confirmed
- [test-ink-flickering/INK-ANALYSIS.md](https://github.com/atxtechbro/test-ink-flickering/blob/main/INK-ANALYSIS.md) — HIGH confidence, deep architectural analysis of Ink's rendering model
- [Ink v6.7.0 Release Notes: Synchronized updates](https://github.com/vadimdemedes/ink/releases/tag/v6.7.0) — HIGH confidence, official release notes
- [AI SDK Migration Guide: v5 to v6](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0) — HIGH confidence, official Vercel documentation
- [Tauri v2 CSP Documentation](https://v2.tauri.app/security/csp/) — HIGH confidence, official Tauri documentation
- [Tauri GitHub Issue #14707: CSP prevents IPC requests](https://github.com/tauri-apps/tauri/issues/14707) — HIGH confidence, confirmed bug report
- [Avoiding XSS via Markdown in React (Medium)](https://medium.com/javascript-security/avoiding-xss-via-markdown-in-react-91665479900) — MEDIUM confidence, security analysis
- [Secure Markdown Rendering: Balancing Flexibility and Safety (HackerOne)](https://www.hackerone.com/blog/secure-markdown-rendering-react-balancing-flexibility-and-safety) — MEDIUM confidence, security best practices
- [Vitest 3 Monorepo Setup](https://www.thecandidstartup.org/2025/09/08/vitest-3-monorepo-setup.html) — MEDIUM confidence, practical guidance
- [Writing Integration Tests for WebSocket Servers Using Vitest](https://thomason-isaiah.medium.com/writing-integration-tests-for-websocket-servers-using-jest-and-ws-8e5c61726b2a) — MEDIUM confidence
- [vitest-websocket-mock GitHub](https://github.com/akiomik/vitest-websocket-mock) — HIGH confidence, official library
- Direct codebase inspection: `/packages/cli/`, `/packages/gateway/`, `/apps/desktop/` — HIGH confidence, authoritative

---
*Pitfalls research for: CLI Visual Overhaul + Desktop UI Polish + Test Retrofitting (Tek milestone, 2026-02-20)*
*Researched: 2026-02-20*
