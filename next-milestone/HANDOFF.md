# Next Milestone Handoff -- Claude Code GSD Skill

## Context for the GSD Skill

Tek is a self-hosted AI agent gateway (monorepo: pnpm + Turbo + TypeScript). It has 5 packages (`@tek/core`, `@tek/db`, `@tek/cli`, `@tek/gateway`, `@tek/telegram`) plus a Tauri desktop app (`apps/desktop`). 13 phases of development are complete. The core agent infrastructure (LLM routing, tool execution, memory, MCP, approval gates) is solid. The next milestone focuses on two things: (1) making the CLI feel professional like Claude Code, and (2) overhauling the desktop app visually.

Read `ONESHEET.md` for full architecture. Read `ASSESSMENT.md` in this folder for what's working and what's not.

---

## Phase 14: CLI Visual Overhaul

### Goal
Make `tek chat` look and feel like Claude Code or KimiCode -- a terminal UI that feels like a GUI.

### Tasks

#### 14.1 Extract Vault to Fix Circular Dependency
**Priority: Do this first. Everything else depends on clean builds.**
- Move `packages/cli/src/vault/` to `packages/core/src/vault/` (or create `@tek/vault`)
- Update imports in `@tek/gateway` and `@tek/cli`
- Remove the circular dependency so Turbo can build in one pass
- Update `turbo.json` and `pnpm-workspace.yaml` if new package
- Verify: `pnpm turbo build` succeeds without manual 2-pass workaround

#### 14.2 Redesign StatusBar
Current: Single bordered line with connection dot, session ID, model, tokens.
Target: Multi-zone status bar like Claude Code's footer.
- Left zone: Logo/name + connection indicator (animated dot)
- Center zone: Active model with provider icon, session ID
- Right zone: Token count + cost, elapsed time for current response
- Use Ink's `Box` with `borderStyle="round"` and colored borders
- Add a thin separator line (unicode box drawing) between status bar and chat

#### 14.3 Redesign MessageBubble
Current: Color-coded text with `>` and `*` prefixes.
Target: Distinct visual panels for each message type.
- **User messages**: Right-aligned with subtle border, username label
- **Assistant messages**: Full-width panel with left accent border, model name label
- **Tool calls**: Collapsible panel (default: collapsed showing tool name + status, expand to show args/output). Use Ink's `Box` with `borderStyle="round"` and blue/purple accent.
- **Bash commands**: Terminal-style panel with green `$` prefix, monospace output
- **Reasoning/thinking**: Collapsible dimmed panel with italic text, labeled "thinking..."
- **System messages**: Centered, subtle yellow background
- Add timestamps to all messages (right-aligned, dimmed)
- Truncate long tool outputs with "[show more]" indicator

#### 14.4 Redesign InputBar
Current: `> ` with basic TextInput.
Target: Rich input experience.
- Multiline input support (Shift+Enter for newline, Enter to send)
- Input history (up/down arrows to cycle through previous messages)
- Slash command autocomplete (show available commands as you type `/`)
- Character count or token estimate in the input area
- Visual indicator when input is disabled during streaming
- Consider a bottom border/panel around the input area

#### 14.5 Add Progress & Activity Indicators
Current: Single `Spinner` component during streaming.
Target: Rich feedback for every async operation.
- Streaming: Show token-by-token text with a cursor character
- Tool execution: Show elapsed time next to tool name
- Multi-step operations: Progress bar or step counter
- Connection: Animated reconnection indicator with retry count
- File operations: Show file path being read/written

#### 14.6 Add Syntax Highlighting & Diff Views
Current: Markdown rendered via `marked` + `marked-terminal`, no diff rendering.
Target: Code blocks with language labels, file diffs with color coding.
- Ensure code blocks show language label (```typescript -> [TypeScript])
- Add diff rendering for file write operations (green for additions, red for deletions)
- Consider using `cli-highlight` or similar for richer syntax highlighting
- Render tables properly in terminal (use box-drawing characters)

#### 14.7 Implement Collapsible Sections
This is what really makes Claude Code feel like a GUI.
- Tool call panels default to collapsed (show: tool name, status icon, one-line summary)
- Press Enter or a hotkey to expand/collapse
- Reasoning/thinking sections collapsible
- Long assistant responses could have a "fold" at N lines

### Reference Files
- `packages/cli/src/components/Chat.tsx` -- main chat layout
- `packages/cli/src/components/StatusBar.tsx` -- status bar
- `packages/cli/src/components/InputBar.tsx` -- input
- `packages/cli/src/components/MessageBubble.tsx` -- message rendering
- `packages/cli/src/components/StreamingResponse.tsx` -- streaming display
- `packages/cli/src/components/ToolApprovalPrompt.tsx` -- approval UI
- `packages/cli/src/components/MarkdownRenderer.tsx` -- markdown
- `packages/cli/src/lib/markdown.ts` -- markdown processing

---

## Phase 15: Desktop App Visual Overhaul

### Goal
Transform the Tauri app from a developer tool into a product that looks like Claudia or the Claude desktop app.

### Tasks

#### 15.1 Add Markdown Rendering to Chat
**This is the single biggest UX gap in the desktop app.**
Current: `whitespace-pre-wrap` plain text for all messages.
Target: Full markdown rendering with syntax-highlighted code blocks.
- Install `react-markdown` + `rehype-highlight` (or `remark-gfm` + `shiki`)
- Render assistant messages through markdown pipeline
- Code blocks with language labels, copy button, and syntax highlighting
- Support tables, lists, headers, inline code, links
- Sanitize HTML to prevent XSS from model output

#### 15.2 Add Tool Approval UI to Desktop
**The desktop app currently has NO way for users to approve tool calls.**
- Port the CLI's `ToolApprovalPrompt` and `PreflightChecklist` concepts to React
- Show a modal or inline card when a tool call needs approval
- Display tool name, arguments (syntax highlighted), and approve/deny/session-approve buttons
- Show tool execution status (pending, running, complete, error) with appropriate icons
- Add the `SkillApprovalPrompt` equivalent too

#### 15.3 Add Conversation History Sidebar
Current: No way to browse or resume past sessions.
Target: Sidebar panel (left side, inside chat page or replacing main sidebar) showing session history.
- List sessions with: first message preview, timestamp, model used, message count
- Click to load/resume a session
- "New conversation" button at the top
- Search/filter sessions
- Group by date (Today, Yesterday, This Week, Older)
- This requires the gateway to support a `session.list` WebSocket message (check if it exists in the protocol, if not, add it)

#### 15.4 Redesign Chat Message Components
Current: Basic bubbles with border-left accent and monospace tool output.
Target: Polished message cards.
- User messages: Right-aligned with avatar/initial, subtle background, timestamp
- Assistant messages: Left-aligned with model badge, full markdown rendering, copy button
- Tool calls: Expandable cards with status indicators (spinning icon while running, checkmark on complete, X on error). Show args collapsed by default, click to expand.
- Bash commands: Terminal-style card with dark background, green prompt, monospace font
- Reasoning: Collapsible "thinking" card with dimmed styling
- Add message actions: copy, regenerate (for assistant), delete

#### 15.5 Polish the Dashboard
Current: Gateway status + 3 quick-action cards.
Target: Useful at-a-glance information.
- Gateway status with uptime, total requests served
- Recent sessions list (last 5-10)
- Usage stats: tokens used today/this week, cost breakdown by provider
- Memory activity: recent memories saved, SOUL.md last updated
- Active agent indicator
- System health: database size, memory file count

#### 15.6 Visual Identity & Design System
Current: Generic dark theme with default Tailwind grays/blues.
Target: Cohesive visual identity.
- Define a color palette (primary, secondary, accent, semantic colors)
- Add a logo/wordmark to the sidebar
- Consistent border radius, spacing, shadow tokens
- Typography scale (use Inter or similar for UI, JetBrains Mono for code)
- Add subtle animations: page transitions (fade), button hover states, loading skeletons
- Consider a glass-morphism or subtle gradient approach for cards
- Error boundary wrapping each page

#### 15.7 Responsive Sidebar
Current: Fixed w-56 sidebar, no collapse.
Target: Collapsible sidebar.
- Collapse to icon-only mode (click to expand or hover to preview)
- Remember collapsed state in Zustand store
- Smooth transition animation
- Mobile-friendly (if you ever ship to smaller screens)

#### 15.8 Settings Page Polish
Current: Flat form with ConfigSection cards.
Target: Organized settings with visual grouping.
- Tab or accordion navigation for settings categories
- API key management directly in desktop (currently CLI-only)
- MCP server management with add/edit/delete UI
- Model alias management with drag-to-reorder
- Import/export config
- Visual indicators for which providers are configured and healthy

### Reference Files
- `apps/desktop/src/App.tsx` -- root component, page routing
- `apps/desktop/src/pages/ChatPage.tsx` -- chat interface
- `apps/desktop/src/pages/DashboardPage.tsx` -- dashboard
- `apps/desktop/src/pages/AgentsPage.tsx` -- agent management
- `apps/desktop/src/pages/SettingsPage.tsx` -- settings
- `apps/desktop/src/components/ChatMessage.tsx` -- message rendering
- `apps/desktop/src/components/ChatInput.tsx` -- input bar
- `apps/desktop/src/components/Sidebar.tsx` -- navigation sidebar
- `apps/desktop/src/components/Layout.tsx` -- main layout
- `apps/desktop/src/stores/app-store.ts` -- Zustand state
- `apps/desktop/src/index.css` -- global styles + Tailwind

---

## Phase 16: Testing Foundation

### Goal
Get basic test coverage on the critical paths so refactoring doesn't break things.

### Tasks

#### 16.1 Gateway WebSocket Protocol Tests
- Test message serialization/deserialization for all ClientMessage/ServerMessage types
- Test connection lifecycle (connect, authenticate, disconnect)
- Test chat message flow (send -> stream -> complete)
- Test tool approval flow (request -> approve/deny -> continue)
- File: `packages/gateway/src/ws/protocol.ts` (~21KB of message types)

#### 16.2 Agent Tool Loop Tests
- Test tool registry building (configs + skills + MCP)
- Test approval gate logic (auto/session/always tiers)
- Test tool execution and result collection
- Test failure detection patterns
- Files: `packages/gateway/src/agent/`

#### 16.3 LLM Router Tests
- Test complexity-based routing decisions
- Test model selection with aliases
- Test provider fallback
- Files: `packages/gateway/src/llm/router.ts`, `router-rules.ts`

#### 16.4 Config & Schema Tests
- Test Zod schema validation for all config shapes
- Test config load/save round-trip
- Test migration from older config formats
- File: `packages/core/src/config/schema.ts`

### Setup
- Vitest is already configured. Just add `.test.ts` files next to the source files.
- For WebSocket tests, use a test Fastify server.
- Mock the keychain for vault tests.

---

## Suggested Build Order

1. **14.1** (Extract vault) -- unblocks clean builds, do first
2. **15.1** (Markdown in desktop) -- biggest bang for buck, single biggest gap
3. **15.2** (Tool approval in desktop) -- the app is broken without this
4. **14.2 + 14.3** (StatusBar + MessageBubble redesign) -- CLI visual leap
5. **15.3** (Conversation history) -- makes desktop actually usable
6. **14.4** (InputBar redesign) -- quality of life
7. **15.4 + 15.6** (Chat messages + design system) -- visual cohesion
8. **14.5 + 14.6 + 14.7** (Progress, syntax, collapsible) -- CLI polish
9. **15.5 + 15.7 + 15.8** (Dashboard, sidebar, settings) -- desktop polish
10. **16.x** (Tests) -- can be done incrementally alongside any of the above

---

## Key Decisions for You to Make

1. **New package or core?** Extract vault to `@tek/core/vault` (simpler) or `@tek/vault` (cleaner separation)?
2. **Markdown library for desktop?** `react-markdown` + `remark-gfm` + `rehype-highlight` is the standard choice. `@mdx-js/react` if you want more control. `shiki` for syntax highlighting if you want VS Code-quality highlighting.
3. **Design system approach?** Continue with Tailwind utility classes, or adopt a component library (shadcn/ui, Radix primitives)? Tailwind + headless components (Radix) is probably the sweet spot for a Tauri app.
4. **Session history protocol.** Need to check if `session.list` / `session.load` messages exist in the WS protocol. If not, they need to be added to `packages/gateway/src/ws/protocol.ts` and `handlers.ts`.
5. **Collapsible sections in CLI.** Ink doesn't have a native collapsible component. You'll need to build one with state management. Consider whether to use a third-party Ink component or build custom.
