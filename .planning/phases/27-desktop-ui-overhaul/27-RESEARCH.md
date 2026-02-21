# Phase 27: Desktop UI Overhaul - Research

**Researched:** 2026-02-20
**Domain:** React markdown rendering, syntax highlighting, chat UI design, Tailwind design systems, page transitions
**Confidence:** HIGH

## Summary

Phase 27 transforms the desktop Tauri app from a functional prototype into a polished chat experience. The current app renders all assistant messages as plain `whitespace-pre-wrap` text with no markdown support, tool calls are displayed inline with no approval mechanism, there is no conversation history sidebar, and the visual design uses generic `blue-600`/`gray-800` Tailwind defaults with no brand identity.

The work decomposes into five parallel streams: (1) markdown rendering with syntax highlighting, (2) tool approval modal and gateway integration, (3) conversation history sidebar with session management, (4) chat card redesign with page transitions, and (5) design system (brand palette, typography, sidebar collapse, dashboard enrichment, settings reorganization).

The gateway WebSocket protocol already supports every server message needed: `tool.approval.request` (with `toolCallId`, `toolName`, `args`, `risk`), `tool.approval.response` (with `approved`, `sessionApprove`), and `session.list` (returning `sessionId`, `sessionKey`, `model`, `createdAt`, `messageCount`). The desktop `gateway-client.ts` already exports factory functions for `createToolApprovalResponse` and `createSessionListMessage`. The remaining work is purely frontend.

**Primary recommendation:** Use `react-markdown` + `react-shiki` for markdown/syntax highlighting (per prior decisions), CSS transitions (not framer-motion) for lightweight page fades, and Tailwind v4 CSS theme variables for the brand design system.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DSKV-01 | Assistant messages render full markdown (headers, code blocks, lists, tables, inline code, links) with syntax highlighting | Use `react-markdown` with `remarkGfm` for GFM tables/lists. Use `react-shiki` (ShikiHighlighter component) for code block highlighting via react-markdown `components.code` override. Prior decision: react-markdown for XSS safety, shiki as unified highlighter. |
| DSKV-02 | Code blocks have a copy-to-clipboard button | Build a `CodeBlock` wrapper component that wraps `react-shiki`'s ShikiHighlighter with an absolute-positioned copy button using `navigator.clipboard.writeText()`. |
| DSKV-03 | User can approve/deny/session-approve tool calls from desktop app via modal with argument preview | Gateway already sends `tool.approval.request` with `toolCallId`, `toolName`, `args`, `risk`. Desktop already has `createToolApprovalResponse()` factory. Build a modal component with three buttons (Approve/Deny/Session Approve). Hook into `useChat` to detect `tool.approval.request` messages and display modal. |
| DSKV-04 | Async operations show loading states (skeleton loaders, spinners, disabled states) | Build reusable `Skeleton` and `Spinner` components with Tailwind `animate-pulse`. Apply to settings page (already has skeleton), dashboard stats, session list loading, and chat connection states. |
| DSKV-05 | Conversation history sidebar lists past sessions with preview, timestamp, click-to-resume | Gateway `session.list` protocol returns `sessionId`, `sessionKey`, `model`, `createdAt`, `messageCount`. Add a session list panel inside the sidebar. On click, send `chat.send` with `sessionId` to resume. Need to add a `createSessionResumeMessage` or reuse `chat.send` with existing `sessionId`. |
| DSKV-06 | Brand color palette defined and applied (primary, secondary, accent colors) | Define CSS custom properties via Tailwind v4 `@theme` directive in `index.css`. Replace hardcoded `blue-600`, `gray-800` classes with semantic tokens (`--color-primary`, `--color-surface`, etc.). |
| DSKV-07 | Typography system applied (UI font + monospace code font with consistent scale) | Use `Inter` for UI text, system monospace stack for code. Define Tailwind v4 `@theme` font-family and font-size scale tokens. Apply globally via `index.css` `:root` and utility classes. |
| DSKV-08 | Chat messages redesigned as polished cards (user right-aligned, assistant with model badge, tool calls expandable) | Refactor `ChatMessage.tsx` into sub-components: `UserMessage`, `AssistantMessage`, `ToolCallCard`. Assistant messages get model badge (already partially present as `chat.model`). Tool calls get expandable disclosure with chevron toggle. |
| DSKV-09 | Page transitions with subtle fade animation | Use CSS `@keyframes fadeIn` + Tailwind `animate-` utility on the page container in `Layout.tsx`. Key the animation on `currentPage` to re-trigger on navigation. No need for framer-motion (32KB) for simple fade. |
| DSKV-10 | Sidebar is collapsible to icon-only mode with smooth transition | Add `collapsed` state to `useAppStore`. Sidebar transitions `width` from `14rem` to `3.5rem` using CSS `transition-all duration-200`. Hide label text when collapsed, show only icons. Add collapse toggle button (chevron or hamburger). |
| DSKV-11 | Dashboard shows usage stats, recent sessions, memory activity, system health | Gateway already has `usage.query` and `session.list` protocols. Send these on DashboardPage mount. Display stats cards: total cost, total tokens, request count. Recent sessions list (top 5). Gateway status (already present). Memory activity can use `memory.search` with empty query or a summary endpoint if available. |
| DSKV-12 | Settings page organized with tabs/accordion, provider health indicators | Refactor SettingsPage into tabbed sections: General, Providers, Model Aliases, MCP Servers, Gateway Info. Use a simple tab bar component. Provider health can ping the gateway or show configured status from existing `configuredProviders` data. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-markdown | ^9.x | Markdown-to-React rendering with XSS safety | Prior decision. No `dangerouslySetInnerHTML`, remark/rehype plugin ecosystem, 12M+ weekly downloads |
| react-shiki | ^0.9.x | Syntax highlighting for code blocks in React | Renders shiki output as React elements (no `dangerouslySetInnerHTML`), streaming support for LLM responses, uses same shiki engine as CLI (prior decision) |
| remark-gfm | ^4.x | GitHub Flavored Markdown (tables, strikethrough, task lists) | Standard companion to react-markdown for GFM features |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @fontsource/inter | ^5.x | Inter font for UI typography | Self-hosted web font, no external requests in Tauri app |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-shiki | @shikijs/rehype (rehype plugin) | rehype plugin works at build-time / requires async setup; react-shiki is purpose-built for React components with streaming support |
| react-shiki | rehype-pretty-code | Server-side focused; react-shiki is client-side optimized for streaming LLM output |
| CSS transitions (page fades) | framer-motion | framer-motion adds ~32KB gzip for simple fade; CSS transitions are zero-cost and sufficient for DSKV-09 |
| Custom tab component | Headless UI / Radix Tabs | Phase scope is simple tabs; a hand-rolled tab bar is 20 lines of code, no need for a library |
| @fontsource/inter | Google Fonts CDN | Tauri app runs offline; self-hosted fonts are required |

**Installation:**
```bash
cd apps/desktop
pnpm add react-markdown remark-gfm react-shiki @fontsource/inter
```

## Architecture Patterns

### Recommended Project Structure
```
apps/desktop/src/
├── components/
│   ├── chat/
│   │   ├── ChatMessage.tsx       # (refactored) delegates to sub-components
│   │   ├── UserMessage.tsx       # Right-aligned user bubble
│   │   ├── AssistantMessage.tsx  # Markdown-rendered with model badge
│   │   ├── ToolCallCard.tsx      # Expandable tool call display
│   │   ├── CodeBlock.tsx         # Shiki-highlighted code with copy button
│   │   ├── MarkdownRenderer.tsx  # react-markdown configured with plugins
│   │   └── StreamingText.tsx     # (moved) streaming response display
│   ├── sidebar/
│   │   ├── Sidebar.tsx           # (refactored) collapsible with session list
│   │   └── SessionList.tsx       # Past sessions with preview
│   ├── modals/
│   │   └── ToolApprovalModal.tsx # Approve/deny/session-approve modal
│   ├── ui/
│   │   ├── Skeleton.tsx          # Reusable skeleton loader
│   │   ├── Spinner.tsx           # Loading spinner
│   │   ├── Tabs.tsx              # Simple tab bar component
│   │   └── Badge.tsx             # Model badge, status badge
│   ├── ChatInput.tsx             # (existing)
│   ├── Layout.tsx                # (updated with page transition + collapsed sidebar)
│   └── GatewayStatus.tsx         # (existing)
├── hooks/
│   ├── useChat.ts                # (extended) tool approval state
│   ├── useSessions.ts            # NEW: fetch/manage session list
│   └── useWebSocket.ts           # (existing)
├── stores/
│   └── app-store.ts              # (extended) sidebarCollapsed, pendingApproval
├── pages/
│   ├── ChatPage.tsx              # (refactored)
│   ├── DashboardPage.tsx         # (enriched with stats)
│   └── SettingsPage.tsx          # (reorganized with tabs)
└── styles/
    └── index.css                 # (enhanced) brand tokens, font imports, animations
```

### Pattern 1: react-markdown with react-shiki Code Blocks
**What:** Configure react-markdown to use a custom `code` component that delegates to react-shiki for fenced code blocks.
**When to use:** Every assistant message rendering.
**Example:**
```typescript
// Based on react-shiki docs and react-markdown custom components pattern
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ShikiHighlighter } from 'react-shiki';

function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : 'text';
  const code = String(children).replace(/\n$/, '');

  if (!match) {
    // Inline code
    return <code className="bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>;
  }

  return (
    <div className="relative group my-3">
      <button
        onClick={() => navigator.clipboard.writeText(code)}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded text-xs"
      >
        Copy
      </button>
      <ShikiHighlighter language={lang} theme="github-dark">
        {code}
      </ShikiHighlighter>
    </div>
  );
}

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code: CodeBlock,
        // Style tables, links, etc.
        table: ({ children }) => (
          <div className="overflow-x-auto my-3">
            <table className="min-w-full border-collapse border border-gray-700 text-sm">{children}</table>
          </div>
        ),
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

### Pattern 2: Tool Approval Modal via Gateway Protocol
**What:** Listen for `tool.approval.request` in useChat, show modal, send `tool.approval.response` back.
**When to use:** Whenever the gateway requests tool approval during a chat session.
**Example:**
```typescript
// In useChat.ts handler:
case "tool.approval.request": {
  const approval = {
    toolCallId: m.toolCallId as string,
    toolName: m.toolName as string,
    args: m.args,
    risk: m.risk as string | undefined,
  };
  setPendingApproval(approval);
  break;
}

// In modal callback:
function handleApprovalResponse(approved: boolean, sessionApprove?: boolean) {
  const msg = createToolApprovalResponse(pendingApproval.toolCallId, approved, sessionApprove);
  ws.send(msg);
  setPendingApproval(null);
}
```

### Pattern 3: Tailwind v4 Design Tokens via @theme
**What:** Define brand colors as CSS custom properties through Tailwind v4's @theme directive.
**When to use:** All color, typography, and spacing decisions.
**Example:**
```css
/* index.css */
@import "tailwindcss";
@import "@fontsource/inter/400.css";
@import "@fontsource/inter/500.css";
@import "@fontsource/inter/600.css";
@import "@fontsource/inter/700.css";

@theme {
  --color-brand-50: #eef2ff;
  --color-brand-100: #e0e7ff;
  --color-brand-400: #818cf8;
  --color-brand-500: #6366f1;
  --color-brand-600: #4f46e5;
  --color-surface-primary: #0f0f0f;
  --color-surface-secondary: #1a1a1a;
  --color-surface-elevated: #252525;
  --color-surface-overlay: #2a2a2a;
  --color-text-primary: #e0e0e0;
  --color-text-secondary: #9ca3af;
  --color-text-muted: #6b7280;
  --font-family-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-family-mono: 'SF Mono', 'Fira Code', 'JetBrains Mono', ui-monospace, monospace;
}
```
Then use `bg-brand-600`, `text-brand-400`, `bg-surface-primary`, `font-sans`, `font-mono` in components.

### Pattern 4: Collapsible Sidebar with CSS Transition
**What:** Toggle sidebar width between full and icon-only with smooth CSS transition.
**When to use:** Sidebar collapse (DSKV-10).
**Example:**
```typescript
// Sidebar.tsx
export function Sidebar({ collapsed, onToggle, currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className={`h-full bg-surface-secondary border-r border-surface-overlay flex flex-col transition-all duration-200 ${
      collapsed ? 'w-14' : 'w-56'
    }`}>
      <div className="p-4 border-b border-surface-overlay flex items-center justify-between">
        {!collapsed && <h1 className="text-xl font-bold text-white tracking-tight">Tek</h1>}
        <button onClick={onToggle} className="text-gray-400 hover:text-gray-200">
          {/* chevron icon */}
        </button>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-1">
        {navItems.map(({ page, label, icon }) => (
          <button key={page} onClick={() => onNavigate(page)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              collapsed ? 'justify-center' : ''
            } ${currentPage === page ? 'bg-brand-500/20 text-brand-400' : 'text-gray-400 hover:text-gray-200 hover:bg-surface-elevated'}`}
          >
            {icon}
            {!collapsed && <span>{label}</span>}
          </button>
        ))}
      </nav>
    </aside>
  );
}
```

### Pattern 5: Page Transition with CSS Animation
**What:** Fade-in animation on page changes using CSS keyframes keyed on currentPage.
**When to use:** Layout.tsx page container.
**Example:**
```css
/* index.css */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fadeIn 0.15s ease-out;
}
```
```typescript
// Layout.tsx - key the wrapper on currentPage to re-trigger animation
<main key={currentPage} className="flex-1 overflow-y-auto animate-fade-in">
  {children}
</main>
```

### Anti-Patterns to Avoid
- **Rendering markdown during streaming:** Do NOT pass incomplete streaming text through react-markdown. Incomplete markdown (e.g., unclosed code fences) causes parse errors and flicker. Render streaming text as plain `whitespace-pre-wrap` text, only render through react-markdown once the stream completes (in `chat.stream.end` handler).
- **Synchronous shiki initialization blocking render:** react-shiki handles async loading internally with its hook/component API. Do NOT try to create a synchronous highlighter in the browser like the CLI does.
- **Global CSS class conflicts with shiki themes:** Shiki generates inline styles on `<span>` elements. Tailwind's `@layer base` resets can strip these. Ensure shiki output containers are not affected by aggressive CSS resets.
- **Hardcoding colors instead of using design tokens:** All color values must use the Tailwind theme tokens, not raw hex values, to ensure the brand palette is consistent and changeable.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown parsing | Custom regex-based renderer | react-markdown | Markdown has hundreds of edge cases (nested lists, HTML entities, link references). react-markdown uses micromark parser, battle-tested |
| Syntax highlighting | Custom token coloring | react-shiki | TextMate grammars handle 600+ languages with proper scope nesting. Custom highlighting is always incomplete |
| GFM tables/task lists | Custom table parser | remark-gfm plugin | GFM spec has edge cases around pipe escaping, column alignment, multi-line cells |
| Clipboard API | execCommand('copy') | navigator.clipboard.writeText() | execCommand is deprecated. clipboard API is the modern standard, works in Tauri WebView |
| Font loading | Manual @font-face declarations | @fontsource/inter | @fontsource handles font subsetting, weights, and formats automatically |

**Key insight:** Markdown rendering is deceptively complex. Even well-intentioned custom renderers fail on nested blockquotes, code blocks inside lists, or HTML entities. react-markdown + remark/rehype plugins handle all of these correctly.

## Common Pitfalls

### Pitfall 1: Streaming Markdown Parse Flicker
**What goes wrong:** Passing incomplete streaming text through react-markdown causes constant re-parsing, visual flicker, and broken rendering when markdown tokens are partially received (e.g., `\`\`\`typ` without closing fence).
**Why it happens:** LLM tokens arrive character-by-character. Markdown parsers expect complete documents.
**How to avoid:** Keep streaming text as plain pre-wrapped text. Only render through react-markdown after `chat.stream.end`. The StreamingText component should remain simple.
**Warning signs:** Code blocks appearing/disappearing during streaming, "flash of unstyled markdown."

### Pitfall 2: Shiki Bundle Size in Browser
**What goes wrong:** Importing all shiki languages and themes bloats the bundle by 5-10MB.
**Why it happens:** Shiki bundles TextMate grammars as JSON. Each language is 10-500KB.
**How to avoid:** react-shiki supports lazy loading by default. Only specify the languages you need (typescript, javascript, json, bash, python, css, html, yaml, markdown, tsx, jsx -- same as CLI). Use a single theme (`github-dark`).
**Warning signs:** Slow initial page load, large JS bundle in Vite build output.

### Pitfall 3: Tool Approval Race Condition
**What goes wrong:** Multiple tool approval requests arrive rapidly (e.g., agent calls 3 tools in sequence). If only one `pendingApproval` state is maintained, earlier requests get overwritten.
**Why it happens:** The gateway sends `tool.approval.request` for each tool call. If the agent queues multiple calls, they arrive in quick succession.
**How to avoid:** Use an array/queue for pending approvals, not a single state variable. Process approvals in order (FIFO). Show the first pending approval in the modal; when approved/denied, show the next.
**Warning signs:** Tool calls stuck in "pending" state, agent appears hung waiting for approval that was silently dropped.

### Pitfall 4: Session Resume vs New Session
**What goes wrong:** Clicking a past session in the history sidebar starts a new session instead of resuming the old one.
**Why it happens:** The `chat.send` message must include the correct `sessionId` to resume. If session state in `useChat` is reset on page navigation, the sessionId is lost.
**How to avoid:** When resuming a session, set the `sessionId` in chat state before sending the first message. The gateway will continue the existing conversation context.
**Warning signs:** "Session not found" errors, conversations starting fresh when they should have history.

### Pitfall 5: Tailwind v4 @theme vs v3 Config
**What goes wrong:** Trying to use `tailwind.config.js` patterns (extend.colors, etc.) which don't exist in Tailwind v4.
**Why it happens:** Most online examples are for Tailwind v3. The project uses Tailwind v4 with `@tailwindcss/vite`.
**How to avoid:** Use `@theme { }` blocks in CSS to define custom design tokens. Tailwind v4 uses CSS-first configuration. No `tailwind.config.js` file.
**Warning signs:** Custom classes not working, "unknown utility" errors in the browser console.

## Code Examples

### Session List Hook
```typescript
// hooks/useSessions.ts
import { useState, useEffect, useCallback } from 'react';
import { createSessionListMessage } from '../lib/gateway-client';

interface Session {
  sessionId: string;
  sessionKey: string;
  model: string;
  createdAt: string;
  messageCount: number;
}

export function useSessions(
  send: (msg: object) => void,
  addMessageHandler: (handler: (msg: unknown) => void) => void,
  removeMessageHandler: (handler: (msg: unknown) => void) => void,
  connected: boolean,
) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!connected) return;
    setLoading(true);
    send(createSessionListMessage());
  }, [connected, send]);

  useEffect(() => {
    const handler = (msg: unknown) => {
      const m = msg as Record<string, unknown>;
      if (m?.type === 'session.list' && Array.isArray(m.sessions)) {
        setSessions(m.sessions as Session[]);
        setLoading(false);
      }
    };
    addMessageHandler(handler);
    return () => removeMessageHandler(handler);
  }, [addMessageHandler, removeMessageHandler]);

  // Fetch on mount and when connected
  useEffect(() => {
    if (connected) refresh();
  }, [connected, refresh]);

  return { sessions, loading, refresh };
}
```

### Tool Approval Modal
```typescript
// components/modals/ToolApprovalModal.tsx
interface ToolApprovalModalProps {
  toolName: string;
  toolCallId: string;
  args: unknown;
  risk?: string;
  onResponse: (approved: boolean, sessionApprove?: boolean) => void;
}

export function ToolApprovalModal({ toolName, args, risk, onResponse }: ToolApprovalModalProps) {
  const argsStr = typeof args === 'string' ? args : JSON.stringify(args, null, 2);
  const riskColor = risk === 'high' ? 'text-red-400' : risk === 'medium' ? 'text-yellow-400' : 'text-green-400';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-elevated border border-surface-overlay rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">
        <h3 className="text-lg font-semibold text-white mb-1">Tool Approval Required</h3>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-mono text-brand-400 bg-brand-400/10 px-2 py-0.5 rounded">{toolName}</span>
          {risk && <span className={`text-xs ${riskColor}`}>{risk} risk</span>}
        </div>
        <div className="bg-surface-primary rounded-lg p-3 mb-4 max-h-48 overflow-y-auto">
          <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap">{argsStr}</pre>
        </div>
        <div className="flex gap-3">
          <button onClick={() => onResponse(true)} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2 rounded-lg text-sm font-medium">
            Approve
          </button>
          <button onClick={() => onResponse(false)} className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg text-sm font-medium">
            Deny
          </button>
          <button onClick={() => onResponse(true, true)} className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-2 rounded-lg text-sm font-medium">
            Session Approve
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Dashboard Usage Stats
```typescript
// Usage query integration pattern
// Gateway sends usage.report with: perModel (map of model -> stats), grandTotal
// Desktop already has createUsageQueryMessage() in gateway-client.ts

// In DashboardPage, fetch on mount:
useEffect(() => {
  if (connected) {
    send(createUsageQueryMessage());  // Get overall usage
    send(createSessionListMessage()); // Get recent sessions
  }
}, [connected]);

// Handle responses in message handler:
case "usage.report":
  setUsageStats({
    totalCost: m.grandTotal.totalCost,
    totalTokens: m.grandTotal.totalTokens,
    requestCount: m.grandTotal.requestCount,
    perModel: m.perModel,
  });
  break;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| highlight.js (rehype-highlight) | shiki (react-shiki) | 2024 | VS Code-quality highlighting, TextMate grammars, better theme support |
| marked + dangerouslySetInnerHTML | react-markdown (no innerHTML) | react-markdown v9 (2024) | XSS safety by default, React component tree instead of raw HTML |
| Tailwind v3 config (tailwind.config.js) | Tailwind v4 CSS-first (@theme) | 2025 | No config file, CSS custom properties, better tree-shaking |
| framer-motion for all animations | CSS transitions + Web Animations API | 2025 | 32KB savings, browser-native performance, sufficient for simple transitions |
| react-syntax-highlighter | react-shiki | 2025 | react-syntax-highlighter uses highlight.js or Prism; shiki provides better accuracy and streaming support |

**Deprecated/outdated:**
- `react-syntax-highlighter`: Still functional but react-shiki is the modern choice with better streaming support and VS Code-quality grammars
- `rehype-highlight`: Uses highlight.js internally; shiki provides superior highlighting quality
- `tailwind.config.js`: Tailwind v4 uses CSS-first configuration via `@theme` blocks

## Open Questions

1. **Streaming markdown rendering**
   - What we know: Passing incomplete markdown to react-markdown causes flicker. The safe approach is to render streaming text as plain text.
   - What's unclear: Whether react-shiki's streaming support could enable partial code block highlighting during streaming (it supports throttled updates). The `react-shiki` library was specifically designed for streaming LLM output.
   - Recommendation: Start with plain text during streaming, markdown on complete. If users want richer streaming, investigate react-shiki's streaming mode as a follow-up.

2. **Session message history retrieval**
   - What we know: `session.list` returns session metadata (id, key, model, createdAt, messageCount). The `chat.send` with `sessionId` resumes a session.
   - What's unclear: Whether the gateway returns past messages when resuming a session, or if the desktop needs to fetch message history separately. No `session.messages` or `session.history` protocol message exists.
   - Recommendation: Verify gateway behavior when resuming with `sessionId`. If past messages are not replayed, add a `session.history` message type to the gateway protocol (may be out of scope for this phase).

3. **Memory activity display on dashboard**
   - What we know: `memory.search` exists but requires a query string. There is no "recent memory activity" or "memory stats" endpoint.
   - What's unclear: What "memory activity" should look like on the dashboard without a dedicated stats endpoint.
   - Recommendation: Show a simple "Memory: Active" / "Memory: N entries" indicator using existing config data, or defer memory activity display if it requires gateway changes.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `apps/desktop/src/` - all existing components, hooks, stores, and pages read directly
- Codebase analysis: `packages/gateway/src/ws/protocol.ts` - full gateway protocol schema with tool.approval.request/response and session.list
- Codebase analysis: `packages/cli/src/lib/shiki.ts` and `markdown.ts` - existing shiki + marked integration for CLI
- Codebase analysis: `apps/desktop/src/lib/gateway-client.ts` - existing factory functions for tool approval and session list

### Secondary (MEDIUM confidence)
- [react-shiki GitHub](https://github.com/AVGVSTVS96/react-shiki) - React component for shiki, streaming support, v0.9.x
- [react-markdown GitHub](https://github.com/remarkjs/react-markdown) - Custom components API, rehype plugin integration
- [Shiki official docs](https://shiki.style/) - Theme and language configuration
- [Tailwind v4 docs](https://tailwindcss.com/docs) - @theme directive for CSS-first configuration

### Tertiary (LOW confidence)
- WebSearch results on framer-motion bundle size (~32KB gzip) - used to justify CSS transitions recommendation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - react-markdown and shiki are prior decisions; react-shiki verified via npm/GitHub
- Architecture: HIGH - all gateway protocol messages verified in source code; component structure follows React conventions
- Pitfalls: HIGH - streaming markdown flicker is well-documented; shiki bundle size is a known issue with documented mitigation (lazy loading)

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (30 days - stable ecosystem, no expected breaking changes)
