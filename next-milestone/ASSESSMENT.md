# Tek Project Assessment -- Honest Review (2026-02-20)

## What's Working Well

**Architecture is solid.** The gateway-as-hub pattern with WebSocket clients (CLI, Desktop, Telegram) is the right call. It means you build the intelligence once and surface it everywhere. The Fastify + WS setup is clean and the module separation (agent, context, memory, session, tools, llm) inside the gateway is well-organized.

**Security model is thoughtful.** OS keychain for API keys instead of .env files, bearer token auth for the local gateway, tiered tool approval (auto/session/always), pre-flight checklists for complex operations -- this is ahead of most projects at this stage.

**Multi-provider routing is a real feature.** Complexity-based routing across Anthropic/OpenAI/Ollama/Venice/Google with user overrides is genuinely useful and differentiating. The cost tracking per message is a nice touch too.

**Memory system has depth.** SOUL.md for personality, MEMORY.md for long-term facts, daily logs, vector search via sqlite-vec -- this goes beyond what most agent platforms offer. The thread management and pressure detection (context overflow) show real thought.

**Tool infrastructure is mature.** MCP integration, built-in filesystem/shell/memory tools, skill discovery, Claude Code session management, approval gates -- the agent capabilities layer is the strongest part of the codebase.

## What Needs Work

### Critical: Circular Dependency (cli <-> gateway)

This is the #1 structural problem. The vault code (keychain access) lives in `@tek/cli` but `@tek/gateway` imports it. This breaks Turbo's dependency graph and requires a manual 2-pass build. It also means the gateway conceptually depends on the CLI, which is backwards.

**Fix:** Extract vault into `@tek/core` or a new `@tek/vault` package. This is a prerequisite for everything else because it unblocks clean builds and makes the package boundaries honest.

### CLI: Functional But Visually Bare

The Ink-based CLI works, but compared to Claude Code or KimiCode it looks like a prototype. Specifically:

- **StatusBar** is a single bordered line with connection dot, session ID, model, and token count. No visual hierarchy, no branding.
- **InputBar** is literally `> ` with a TextInput. No multiline editing, no autocomplete, no file path completion, no history.
- **MessageBubble** uses color-coded text (`cyan` for user, `magenta` for assistant) but no panels, no borders, no visual separation between messages.
- **Tool calls** show as plain `# Tool: name` with dimmed args. No collapsible sections, no diff views, no progress indication beyond a spinner.
- **StreamingResponse** is plain text with a spinner. No token-by-token rendering effect, no syntax highlighting during stream.
- **No file tree views, no diff rendering, no progress bars for multi-step operations.**

What Claude Code does that you don't:
- Rounded panel borders around tool executions
- Collapsible sections for tool input/output
- Syntax-highlighted code with language labels
- File diff rendering (green/red lines)
- Animated progress for multi-step operations
- Compact vs expanded display modes
- Rich input with history, autocomplete, multiline

### Desktop App: Needs a Full Visual Overhaul

The Tauri app has the right pages (Dashboard, Chat, Agents, Settings) but the implementation is minimal:

- **No markdown rendering** in chat messages. Assistant responses are displayed as `whitespace-pre-wrap` plain text. No syntax highlighting, no formatted lists, no code blocks.
- **No tool approval UI.** The CLI has `ToolApprovalPrompt` and `PreflightChecklist` but the desktop app has no equivalent -- tool calls just display status but the user can't approve/deny from the desktop.
- **No conversation history sidebar.** You can't browse or resume past sessions.
- **No search.** Can't search messages, memories, or sessions.
- **Dashboard is sparse.** Just a gateway status card and 3 quick-action buttons. No usage stats, no recent sessions, no memory activity.
- **Settings page is a flat form.** Works, but feels like a debug panel not a product settings page.
- **No visual identity.** No logo, no brand colors beyond default blue/gray, no personality.
- **No animations or transitions.** Page switches are instant with no visual feedback.
- **No loading states** beyond a pulse skeleton on Settings.

### No Test Suite

The ONESHEET acknowledges "vitest configured but no test files written." For a project this complex, with agent tool loops, approval gates, multi-provider routing, and WebSocket message handling, this is a real risk. The gateway handlers file alone is 38KB -- one bad refactor breaks everything with no safety net.

### Other Gaps

- **No error boundary in the desktop app.** A crash in any page takes down the whole app.
- **No responsive design.** Desktop app has fixed sidebar width (w-56) with no collapse.
- **Agent onboarding only works from CLI.** Desktop says "run `tek onboard` in terminal" which breaks the self-contained desktop experience.
- **No dark/light theme toggle.** It's always dark, which is fine, but the dark theme itself needs polish.
- **WebSocket reconnection.** CLI has basic disconnect detection but no automatic reconnection with backoff.

## Comparison to Reference Apps

### vs Claude Code (CLI)
Claude Code's terminal UI feels almost like a GUI because of:
1. Rich box-drawing with distinct visual zones (input, output, tools, status)
2. Collapsible tool call panels with diffs
3. Token/cost tracking in a persistent footer
4. Animated spinners and progress indicators
5. File tree rendering and path autocompletion

Your CLI has the right bones (Ink + React component model) but needs 2-3 passes of visual refinement to reach that level.

### vs Claudia / Cowork (Desktop)
These apps succeed because:
1. Chat-first design with markdown rendering (code blocks, tables, headers)
2. Conversation history in a sidebar
3. Visual feedback for every state (connecting, streaming, tool running, error)
4. Polished typography and spacing
5. Fluid animations on state transitions

Your desktop app currently feels like a developer tool rather than a product. The gap is mostly in the chat experience (markdown rendering, tool approval) and visual polish (transitions, loading states, typography).
