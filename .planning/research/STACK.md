# Stack Research — Visual Polish & Testing Milestone

**Domain:** CLI visual overhaul, Desktop UI overhaul, Testing foundation (additions only)
**Project:** Tek — self-hosted AI agent platform (milestone after v0.0.24)
**Researched:** 2026-02-20
**Confidence:** HIGH (all versions verified via npm registry February 2026)

> This document covers ONLY NEW additions required for this milestone.
> The existing stack (Ink, React, Tailwind v4, Zustand, Vitest, Drizzle, AI SDK) is already in place and validated.

---

## What This Milestone Adds

| Area | Current state | Target state |
|------|--------------|--------------|
| CLI syntax highlighting | `marked-terminal` (highlight.js, basic) | `shiki` via `codeToAnsi` (VS Code-quality, ANSI output) |
| CLI collapsible panels | Not implemented | Custom Ink component with `useInput` toggle |
| CLI diff rendering | Not implemented | Plain text delta display with `chalk` + `diff` |
| Desktop markdown | Raw `whitespace-pre-wrap` in `<pre>` | `react-markdown` + `@shikijs/rehype` + GFM |
| Desktop typography | None | `@tailwindcss/typography` prose classes |
| Desktop animations | None | `motion` (Motion for React v12) |
| Desktop diff view | Not implemented | `react-diff-viewer-continued` |
| WebSocket testing | No tests at all | `msw` with WebSocket handlers |
| Unit/integration tests | `vitest` installed, zero test files | Write tests with `vitest` + `msw` |

---

## Recommended Additions

### CLI: Syntax Highlighting

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `shiki` | `^3.22.0` | Syntax highlighting engine | VS Code-identical grammar support. `codeToAnsi()` converts code to ANSI escape codes for terminal output. Replaces `cli-highlight` which uses a much weaker highlight.js grammar. 15M weekly downloads. ESM-only (matches project). |
| `@shikijs/cli` | `^3.22.0` | Exports `codeToAnsi` function | The `codeToAnsi(code, lang, theme)` function lives in this package. Import from here rather than the main `shiki` package for ANSI terminal output specifically. |

**Integration point:** Replace the `cli-highlight` call inside `marked-terminal`'s code renderer with `shiki`'s `codeToAnsi`. The `marked-terminal` package accepts a `code` renderer function — override it to call `await codeToAnsi(code, lang, 'github-dark')` and return the ANSI-escaped string.

**Why not keep `cli-highlight`:** `cli-highlight` uses highlight.js regex grammars, which miss many tokens that TextMate grammars (used by shiki/VS Code) catch. The visual quality gap is noticeable on TypeScript and Python code. `cli-highlight` also has no maintainer activity since 2022.

**Why not `ink-syntax-highlight` (npm package):** Abandoned. Last published 2 years ago, CommonJS-only (incompatible with Ink 6 ESM), open GitHub issue confirming Ink version incompatibility with no maintainer response.

### CLI: Collapsible Panels

| Approach | Version | Purpose | Why |
|---------|---------|---------|-----|
| Custom Ink component | N/A — no library needed | Toggle-able tool call blocks | Ink's `useInput` + React `useState` is sufficient. Zero external dependency. Pattern: render `▶ tool_name (enter to expand)` collapsed, `▼ tool_name` + indented content when expanded. Standard pattern used in Claude Code and similar tools. |

**Why no library:** No mature Ink-native collapsible library exists. `@inkjs/ui` (already installed at `^2.0.0`) does not include an accordion/collapsible component. The terminal has no click events — toggling is keyboard-driven via `useInput`. A custom ~40-line component with `useState(false)` + `useInput` is the correct approach here.

### CLI: Diff Rendering

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `chalk` | `^5.0.0` (already installed) | Color `+`/`-` diff lines | Terminal diff rendering is colored text. Green for additions, red for deletions. No dedicated library needed for display. |
| `diff` | `^7.0.0` | Compute diffs programmatically | If the agent produces before/after content and the CLI needs to compute the diff. Lightweight, zero dependencies. Used internally by `react-diff-viewer-continued`. |

**Why not a terminal diff library:** There is no maintained, Ink-compatible terminal diff renderer with meaningful adoption. The correct approach is to receive unified diff output from the agent (already in standard format) and render with colored chalk. This is exactly what Claude Code does — it is colored text, not a library.

---

### Desktop: Markdown Rendering

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `react-markdown` | `^10.1.0` | Markdown to React component tree | Safe, no `dangerouslySetInnerHTML`. Plugin system via remark/rehype. Built on unified ecosystem. 10M weekly downloads. The standard for React markdown rendering. |
| `remark-gfm` | `^4.0.1` | GitHub Flavored Markdown | Tables, task lists, strikethrough, autolink. AI responses frequently use GFM syntax. Required alongside react-markdown. |
| `@shikijs/rehype` | `^3.22.0` | Syntax highlighting in markdown | Rehype plugin that runs Shiki over code blocks in markdown. Produces syntax-highlighted HTML with inline styles — no separate CSS needed. Matches theme to rest of desktop UI. |

**Integration:** In `ChatMessage.tsx`, replace the `whitespace-pre-wrap` pre tag with `<ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeShiki, { theme: 'github-dark' }]]}>{content}</ReactMarkdown>`. Apply `prose dark:prose-invert` className wrapper for typography.

**Why `@shikijs/rehype` over `rehype-highlight`:** `rehype-highlight` uses highlight.js grammars (same weakness as `cli-highlight`). `@shikijs/rehype` uses TextMate grammars identical to VS Code. Since we use shiki in the CLI too, a single highlighting engine across both surfaces is architecturally cleaner. Same theme means consistent color tokens.

### Desktop: Typography

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@tailwindcss/typography` | `^0.5.19` | Prose styling for markdown output | The `prose` class applies opinionated typography defaults to arbitrary HTML (exactly what react-markdown produces). Dark mode support via `prose-invert`. Size variants via `prose-sm`, `prose-base`. v4 integration: add `@plugin "@tailwindcss/typography"` to your CSS instead of `tailwind.config.js`. |

**v4 compatibility:** `@tailwindcss/typography` 0.5.x works with Tailwind CSS v4. The plugin API changed — configure via CSS `@plugin` directive, not `plugins: []` in config. The existing `tailwindcss@^4` + `@tailwindcss/vite@^4` setup is compatible.

### Desktop: Animations

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `motion` | `^12.34.3` | UI animations | `motion` is the current package name for Motion for React (previously Framer Motion). v12 is React 19 compatible (required, since desktop uses React 19). Vite works out of the box, no special Tauri configuration needed. Tree-shakeable. Use for message entrance animations, skeleton loading states, smooth panel transitions. |

**Important naming note:** The npm package is now `motion`, not `framer-motion`. Both exist in the registry but `motion` is the current canonical package. Import as `import { motion } from 'motion/react'` for React components.

**Scope:** Use sparingly — entrance animations for new chat messages (fade + translate-y 8px, 200ms), smooth expand/collapse for panels, skeleton loading for conversation history load. Avoid decorative animations that add latency to the feel of an AI response interface.

### Desktop: Diff Rendering

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `react-diff-viewer-continued` | `^4.1.2` | File diff display in chat | Actively maintained (published within days of research date). Peer dependencies explicitly list React 19 (`^19.0.0`). Split and unified view modes. Word-level diff highlighting. Matches GitHub-style diff presentation familiar to developers. Fork of the abandoned `react-diff-viewer`. |

**When to use:** Only for `tool_call` and `bash_command` message types where output contains a diff (unified diff format from git or AI-generated patch). Do not use for general content — this is specifically for displaying file changes.

---

### Testing: WebSocket Mocking

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `msw` | `^2.12.10` | API and WebSocket mocking | Industry standard. First-class WebSocket support added in MSW 2.x. Officially recommended by Vitest docs for network mocking. Mocks at the network layer — no app code changes needed. Works in Node.js 22+ natively (project already requires `node >= 22`). Reuse same mock handlers across unit tests and browser tests. |

**WebSocket-specific:** MSW v2 added `ws()` handlers alongside existing `http()` handlers. Define a handler once, use it across all test files. No separate mock server process needed.

**Why not `vitest-websocket-mock`:** Lower-level utility requiring manual message tracking. MSW is the Vitest-recommended approach and handles both HTTP and WebSocket in one framework. Since Tek's gateway mixes both HTTP and WS traffic, a unified mock layer is cleaner. `vitest-websocket-mock` is a viable fallback if specific WS assertion matchers are needed, but MSW covers the core use case.

**Node.js 22 note:** The existing `package.json` engines field already specifies `"node": ">=22"`. MSW's WebSocket interception requires a global `WebSocket` class, which Node.js 22 provides natively. No polyfill or custom Vitest environment needed.

---

## Installation Commands

```bash
# CLI: syntax highlighting upgrade
pnpm --filter @tek/cli add shiki @shikijs/cli

# CLI: diff compute (chalk already present; add diff for compute if needed)
pnpm --filter @tek/cli add diff

# Desktop: markdown rendering stack
pnpm --filter @tek/desktop add react-markdown remark-gfm @shikijs/rehype

# Desktop: typography plugin
pnpm --filter @tek/desktop add @tailwindcss/typography

# Desktop: animations
pnpm --filter @tek/desktop add motion

# Desktop: diff viewer
pnpm --filter @tek/desktop add react-diff-viewer-continued

# Testing: WebSocket mocking (workspace root dev dep, shared across packages)
pnpm add -Dw msw
```

**Note on shiki versioning:** `shiki`, `@shikijs/cli`, and `@shikijs/rehype` are all published at the same version (`3.22.0`). Pin them together in the same version range to avoid mismatch issues.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `shiki` / `codeToAnsi` | Keep `cli-highlight` | cli-highlight uses regex-based highlight.js grammars; shiki uses VS Code's TextMate grammars. Quality difference is visible, especially on TypeScript. cli-highlight maintenance is dead. |
| `@shikijs/rehype` | `rehype-highlight` (highlight.js) | Same quality argument as above. Single engine across CLI and desktop is architecturally simpler. |
| `motion` (v12) | `framer-motion` | `motion` IS framer-motion renamed. Always install `motion`, not `framer-motion`. |
| `motion` | `@formkit/auto-animate` | Auto-animate is useful for list reordering. Too limited for entrance animations and panel layout transitions needed here. |
| `msw` | `vitest-websocket-mock` | MSW handles both HTTP and WS in one framework, matches Vitest's official recommendation, cleaner for Tek's mixed gateway. |
| `msw` | Custom WS mock | Too much boilerplate; MSW is maintained, well-documented, and community-supported. |
| `react-diff-viewer-continued` | `react-diff-view` | `react-diff-view` requires parsing unified diff yourself before passing to the component. `react-diff-viewer-continued` accepts raw string inputs. Simpler API for our use case. |
| `@tailwindcss/typography` | Manual prose CSS | The prose plugin is 8 years of typographic refinement. Manual CSS is reinventing it badly. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `ink-syntax-highlight` | CommonJS-only, abandoned, incompatible with Ink 6 ESM | `shiki` / `codeToAnsi` from `@shikijs/cli` |
| `react-syntax-highlighter` | Heavy (~2MB), uses Prism or highlight.js grammars, outdated approach | `@shikijs/rehype` plugin with react-markdown |
| `framer-motion` (old package name) | Renamed to `motion` — installing old name gets stale releases | Install `motion` |
| `socket.io-client` for testing | Overkill; Tek gateway uses plain `ws`, not Socket.IO protocol | `msw` ws() handlers |
| `jest-websocket-mock` | Jest-specific; project uses Vitest | `msw` |
| shadcn/ui or Radix | Not scoped for this milestone — full design system is a separate concern | Hand-crafted components + `@tailwindcss/typography` for this milestone |
| `prism-react-renderer` | Prism grammars are weaker than Shiki; outdated approach for new projects | `@shikijs/rehype` |
| `highlight.js` directly | Already moving away from it by removing `cli-highlight` | `shiki` unified engine |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `shiki@3.22.0` | `@shikijs/cli@3.22.0`, `@shikijs/rehype@3.22.0` | Shiki packages are versioned together — always install same version across the `@shikijs/*` family. |
| `react-markdown@10.1.0` | `react@19.0.0`, `remark-gfm@4.0.1` | react-markdown 10.x supports React 19. remark-gfm 4.x is the correct companion. |
| `@shikijs/rehype@3.22.0` | `react-markdown@10.1.0`, rehype ecosystem | Compatible with full unified/rehype plugin ecosystem. No conflicts. |
| `@tailwindcss/typography@0.5.19` | `tailwindcss@4.x` | v4 config: use `@plugin "@tailwindcss/typography"` in CSS, NOT `plugins: []` in config. |
| `motion@12.34.3` | `react@19.0.0`, `vite@6.x` | React 19 compatible. No Tauri-specific configuration needed. |
| `react-diff-viewer-continued@4.1.2` | `react@19.0.0`, `react-dom@19.0.0` | Peer deps explicitly list React 19. Verified via `npm show react-diff-viewer-continued peerDependencies`. |
| `msw@2.12.10` | `vitest@4.x`, `node@22+` | Node 22 provides native `WebSocket` global — no polyfill needed for MSW WS interception in tests. |
| `diff@7.0.0` | No peers | Zero dependencies, ESM and CJS compatible. |

---

## Sources

- npm registry, February 2026 — all version numbers verified via `npm show [package] version`
- [Shiki CLI package docs](https://shiki.style/packages/cli) — `codeToANSI` function confirmed in `@shikijs/cli` (HIGH confidence)
- [Shiki GitHub](https://github.com/shikijs/shiki) — active maintenance, 3.22.0 confirmed current (HIGH confidence)
- [react-markdown GitHub](https://github.com/remarkjs/react-markdown) — v10, React 19 support (HIGH confidence)
- [MSW WebSocket docs](https://mswjs.io/docs/websocket/) — first-class WebSocket mocking (HIGH confidence)
- [MSW: Enter WebSockets blog](https://mswjs.io/blog/enter-websockets/) — WebSocket interception requirements (HIGH confidence)
- [Vitest mocking/requests docs](https://vitest.dev/guide/mocking/requests) — MSW as official Vitest recommendation (HIGH confidence)
- [motion.dev React docs](https://motion.dev/docs/react) — React 19 compatibility confirmed (HIGH confidence)
- `npm show react-diff-viewer-continued peerDependencies` — React 19 in peer deps verified directly (HIGH confidence)
- [Tailwind v4 typography discussion](https://github.com/tailwindlabs/tailwindcss/discussions/14120) — `@plugin` directive for v4 (MEDIUM confidence — community discussion thread)
- [ink-syntax-highlight GitHub issue #4](https://github.com/vsashyn/ink-syntax-highlight/issues/4) — Ink incompatibility confirmed, no maintainer response (HIGH confidence)

---
*Stack research for: Tek visual polish & testing milestone*
*Researched: 2026-02-20*
