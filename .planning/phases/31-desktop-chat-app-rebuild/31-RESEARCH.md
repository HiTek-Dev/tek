# Phase 31: Desktop Chat App Rebuild - Research

**Researched:** 2026-02-21
**Domain:** Tauri v2 + React desktop chat application with real-time streaming
**Confidence:** HIGH

## Summary

Phase 31 rebuilds the Tek desktop app from scratch as a polished chat-centric application modeled on [opcode](https://github.com/winfunc/opcode). The previous desktop app (shipped in Phase 17, polished in Phase 27) was intentionally removed from the codebase (commit `006cd48`) to start fresh. The old app had a 4-page layout (Dashboard, Chat, Agents, Settings) with a full sidebar -- the rebuild simplifies to a chat-first experience with gateway status landing page and agent selection.

The rebuild uses the same Tauri v2 + React + Vite + Tailwind CSS stack as before, but upgrades the component library to shadcn/ui (replacing hand-rolled components), and introduces Streamdown for flicker-free streaming markdown rendering. The existing gateway WebSocket protocol (`@tauri-apps/plugin-websocket` connecting to the Fastify gateway on `ws://127.0.0.1:{port}/gateway`) remains unchanged.

**Critical dependency:** Phase 32 (Structured Streaming & Chat Formatting) must complete first. Phase 32 adds structured JSON streaming to the gateway protocol, which Phase 31's message rendering depends on. Phase 31 should design message card components to consume the structured stream format (markdown blocks, code blocks, tool calls, reasoning blocks) that Phase 32 defines. Until Phase 32 is done, the desktop can still render raw text deltas, but the polished rendering requires structured data.

**Primary recommendation:** Use Tauri v2 + React 19 + Vite 6 + Tailwind CSS v4 + shadcn/ui + Zustand for state + Streamdown for streaming markdown. Keep Zustand-based page navigation (no router library needed for 2-3 views). Reuse the proven WebSocket hook, gateway discovery, and chat protocol patterns from the old app, upgrading components to shadcn/ui.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tauri v2 | 2.x (latest) | Desktop framework (Rust backend, webview frontend) | Already proven in this project; ~2MB binary, cross-platform, native capabilities |
| React | 19.x | UI framework | Already used throughout project; concurrent features help with streaming |
| Vite | 6.x | Build tool / dev server | Fast HMR, Tauri integration, already used |
| Tailwind CSS | 4.x | Utility-first CSS | Already used in the project; v4 with Vite plugin |
| shadcn/ui | latest | Component library (not a dependency -- copies components into project) | Used by opcode; provides polished accessible components; owns your code |
| Zustand | 5.x | State management | Already used in old desktop app; simple, performant |
| @tauri-apps/plugin-websocket | 2.x | WebSocket via Rust (bypasses browser CORS) | Required for Tauri WS connections; already proven in old app |
| @tauri-apps/plugin-fs | 2.x | Read config/runtime files from filesystem | Required for gateway discovery and config loading |
| @tauri-apps/plugin-process | 2.x | Process management | Gateway start/stop capability |
| @tauri-apps/plugin-shell | 2.x | Shell command execution | Start gateway process |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| streamdown | 2.x | Streaming markdown renderer (replaces react-markdown) | Rendering assistant message content during streaming; eliminates flicker |
| @streamdown/code | latest | Shiki-powered syntax highlighting for streamdown | Code block rendering with copy button |
| react-error-boundary | 6.x | Error boundaries for React pages | Wrap each page/view for graceful error recovery |
| @fontsource/inter | 5.x | UI font | Typography consistency with existing design system |
| lucide-react | latest | Icon library | shadcn/ui uses lucide icons by default |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn/ui | Hand-rolled components (old approach) | shadcn/ui saves weeks of work, accessible by default, matches opcode patterns |
| Zustand | Jotai | Jotai has finer-grained reactivity but Zustand already proven in this codebase |
| streamdown | react-markdown | react-markdown flickers badly during streaming; streamdown built specifically for this |
| No router | TanStack Router | Only 2-3 views; Zustand page state is simpler than adding a router dependency |
| react-shiki (old) | @streamdown/code | streamdown integrates code highlighting with streaming; react-shiki was static-only |

**Installation:**
```bash
# In apps/desktop/
pnpm add react react-dom zustand @tauri-apps/api @tauri-apps/plugin-websocket @tauri-apps/plugin-fs @tauri-apps/plugin-process @tauri-apps/plugin-shell react-error-boundary @fontsource/inter streamdown @streamdown/code lucide-react

pnpm add -D @vitejs/plugin-react @tailwindcss/vite tailwindcss typescript @types/react @types/react-dom @types/node @tauri-apps/cli vite

# Initialize shadcn/ui
pnpm dlx shadcn@latest init
# Add needed components:
pnpm dlx shadcn@latest add button card badge dialog scroll-area separator tabs avatar dropdown-menu tooltip textarea
```

## Architecture Patterns

### Recommended Project Structure
```
apps/desktop/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── components.json           # shadcn/ui config
├── src/
│   ├── main.tsx              # React entry point
│   ├── App.tsx               # Root component (view routing, error boundary)
│   ├── index.css             # Tailwind imports + design tokens
│   ├── lib/
│   │   ├── utils.ts          # shadcn/ui cn() utility
│   │   ├── gateway-client.ts # WS protocol message factories
│   │   ├── discovery.ts      # Gateway runtime.json discovery
│   │   └── config.ts         # Config file reading via Tauri FS
│   ├── hooks/
│   │   ├── useWebSocket.ts   # Tauri WS plugin hook with auto-reconnect
│   │   ├── useChat.ts        # Chat state (messages, streaming, approvals)
│   │   ├── useGateway.ts     # Gateway discovery polling
│   │   └── useConfig.ts      # Config file loading
│   ├── stores/
│   │   └── app-store.ts      # Zustand global state (view, agent, gateway)
│   ├── components/
│   │   ├── ui/               # shadcn/ui generated components
│   │   ├── Layout.tsx         # App shell (header bar, content area)
│   │   ├── ChatInput.tsx      # Auto-resizing textarea with submit
│   │   ├── MessageCard.tsx    # Individual message bubble (user/assistant/tool)
│   │   ├── MessageList.tsx    # Scrollable message container with auto-scroll
│   │   ├── StreamingMessage.tsx # Active streaming message with Streamdown
│   │   ├── ToolCallCard.tsx   # Expandable tool call display
│   │   ├── ToolApprovalModal.tsx # Tool approval dialog
│   │   ├── AgentSelector.tsx  # Agent picker dropdown (or auto-select)
│   │   ├── GatewayStatus.tsx  # Connection status indicator
│   │   └── SessionList.tsx    # Past session list for sidebar/panel
│   └── views/
│       ├── LandingView.tsx    # Gateway status + stats + quick actions
│       └── ChatView.tsx       # Full chat interface
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json
│   ├── icons/
│   └── src/
│       ├── lib.rs
│       └── main.rs
```

### Pattern 1: Chat-First View Architecture
**What:** Two main views instead of four pages. Landing shows gateway status and transitions to chat when connected. Chat is the primary interaction surface.
**When to use:** Always -- this is the core UX change from the old app.
**Example:**
```typescript
// App.tsx - Simplified view routing
type View = 'landing' | 'chat';

export function App() {
  const view = useAppStore((s) => s.currentView);
  const gateway = useAppStore((s) => s.gateway);

  // Auto-transition to chat when connected with agents
  useEffect(() => {
    if (gateway.status === 'running' && view === 'landing') {
      setCurrentView('chat');
    }
  }, [gateway.status]);

  return (
    <ErrorBoundary FallbackComponent={PageErrorFallback}>
      {view === 'landing' ? <LandingView /> : <ChatView />}
    </ErrorBoundary>
  );
}
```

### Pattern 2: Gateway Discovery via runtime.json
**What:** Read `~/.config/tek/runtime.json` via Tauri FS plugin to discover running gateway. Health check to validate stale files.
**When to use:** On app launch and periodic polling (every 5s).
**Example:**
```typescript
// Reuse from old app -- proven pattern
export async function discoverGateway(): Promise<RuntimeInfo | null> {
  const home = await homeDir();
  const path = await join(home, '.config', 'tek', 'runtime.json');
  if (!(await exists(path))) return null;
  const content = await readTextFile(path);
  const data = JSON.parse(content);
  // Health check to detect stale runtime.json
  const res = await fetch(`http://127.0.0.1:${data.port}/health`, {
    signal: AbortSignal.timeout(2000)
  });
  return res.ok ? data : null;
}
```

### Pattern 3: Agent Auto-Selection
**What:** If only one agent exists, auto-select it. If multiple, show a dropdown. Read agent list from config.json via Tauri FS.
**When to use:** On chat view mount.
**Example:**
```typescript
// In ChatView or useChat
const agents = config?.agents?.list ?? [];
useEffect(() => {
  if (agents.length === 1) {
    setSelectedAgentId(agents[0].id);
  } else if (agents.length > 1) {
    const defaultId = config?.agents?.defaultAgentId;
    if (defaultId) setSelectedAgentId(defaultId);
  }
}, [agents]);
```

### Pattern 4: Streaming Message Rendering with Streamdown
**What:** Use Streamdown instead of react-markdown for streaming text. Handles incomplete markdown gracefully.
**When to use:** For the active streaming message (assistant response in progress).
**Example:**
```typescript
import Streamdown from 'streamdown';
import { CodePlugin } from '@streamdown/code';

function StreamingMessage({ text, isStreaming }: Props) {
  return (
    <Streamdown
      plugins={[CodePlugin]}
      isAnimating={isStreaming}
    >
      {text}
    </Streamdown>
  );
}
```

### Pattern 5: WebSocket Message Handler Pattern
**What:** Register a handler on the WebSocket that dispatches server messages to chat state updates. Same pattern as old app but cleaner with structured messages.
**When to use:** In the useChat hook.
**Example:**
```typescript
// Message types from gateway protocol
// chat.stream.start -> begin streaming, set model/session
// chat.stream.delta -> append text to streaming buffer
// chat.stream.end -> finalize message, add to history
// tool.call -> add tool call card to message list
// tool.approval.request -> show approval modal
// tool.result -> update tool call card with result
// error -> display error state
```

### Anti-Patterns to Avoid
- **Importing @tek/core or @tek/gateway directly in browser code:** The desktop frontend runs in a webview. Node.js-only packages cannot be imported. Use Tauri FS/shell plugins to read config files instead.
- **Using browser WebSocket instead of Tauri plugin:** Browser WS has CORS restrictions; Tauri's Rust-backed WS plugin bypasses this.
- **Polling for streaming updates:** Use the WebSocket event-driven pattern. Never poll.
- **Rebuilding the full sidebar navigation:** The new design is chat-first, not multi-page. Keep navigation minimal.
- **Using react-markdown for streaming content:** It will flicker. Use Streamdown.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Component library | Custom buttons, cards, dialogs, badges | shadcn/ui | Accessibility, consistent design, matches opcode |
| Streaming markdown | Custom incremental markdown parser | Streamdown | Handles incomplete syntax, code blocks, LaTeX gracefully |
| Code syntax highlighting | Custom highlighter | @streamdown/code (Shiki) | Language detection, copy button, line numbers built-in |
| Auto-scrolling chat | Manual scroll management | ScrollArea from shadcn/ui + scroll-to-bottom logic | Edge cases with user scroll intent vs auto-scroll |
| WebSocket reconnection | Custom retry logic | Reuse existing useWebSocket hook | Already has exponential backoff (1s->2s->4s->8s->30s max) |
| Gateway discovery | Custom file watching | Reuse existing discoverGateway() + polling | Already handles stale runtime.json via health check |
| Icon system | Custom SVG components | lucide-react | shadcn/ui default icon library, comprehensive |

**Key insight:** The old desktop app already solved the hard infrastructure problems (WS connection, gateway discovery, config loading, chat state management). The rebuild should reuse those patterns while upgrading the presentation layer to shadcn/ui + Streamdown.

## Common Pitfalls

### Pitfall 1: Importing Node.js Packages in Webview
**What goes wrong:** Build fails or runtime errors when importing `@tek/core`, `@tek/gateway`, `fs`, `path` etc. in frontend code.
**Why it happens:** Tauri frontend runs in a webview (browser context). Node.js APIs are not available.
**How to avoid:** Use Tauri plugins (plugin-fs, plugin-shell) for filesystem access. Define WS protocol types locally in the desktop package (as the old app did in `lib/gateway-client.ts`).
**Warning signs:** Build errors mentioning `fs`, `path`, `process`, or `node:` imports.

### Pitfall 2: Stale runtime.json After Gateway Crash
**What goes wrong:** Desktop shows "connected" but gateway is actually dead.
**Why it happens:** Gateway writes runtime.json on startup but may not clean up on crash.
**How to avoid:** Always validate with HTTP health check (`/health` endpoint) before trusting runtime.json. Already implemented in old discovery code.
**Warning signs:** WebSocket connection attempts failing despite "running" status.

### Pitfall 3: Streaming Markdown Flicker
**What goes wrong:** Assistant messages re-render entire markdown tree on each delta, causing visual flicker.
**Why it happens:** react-markdown was designed for static content, not character-by-character streaming.
**How to avoid:** Use Streamdown which was built specifically for this use case. It handles incomplete markdown syntax gracefully.
**Warning signs:** Code blocks appearing/disappearing, bold text snapping in/out, headers flickering.

### Pitfall 4: Auto-Scroll Fighting User Scroll
**What goes wrong:** User scrolls up to read earlier messages, but new streaming content forces scroll back to bottom.
**Why it happens:** Naive auto-scroll implementation always scrolls to bottom on content change.
**How to avoid:** Track whether user has scrolled up (is not at bottom). Only auto-scroll if user is already at/near bottom. Provide a "scroll to bottom" button when not at bottom.
**Warning signs:** Users unable to read earlier messages during streaming.

### Pitfall 5: CSP Blocking WebSocket or Fetch
**What goes wrong:** WebSocket connections or health check fetch calls are blocked by Content Security Policy.
**Why it happens:** Tauri's CSP is strict by default.
**How to avoid:** Include `connect-src 'self' ws://127.0.0.1:* http://127.0.0.1:*` in the CSP config in tauri.conf.json.
**Warning signs:** Browser console errors about CSP violations.

### Pitfall 6: Phase 32 Dependency
**What goes wrong:** Building message rendering without knowing the structured stream format.
**Why it happens:** Phase 32 defines the structured JSON streaming protocol that message cards consume.
**How to avoid:** Phase 32 must complete first. If starting early, build the app shell (landing page, layout, WebSocket, config) and use simple text rendering as a placeholder. Design message card components to be easily updated once Phase 32's format is finalized.
**Warning signs:** Hard-coding message rendering logic that won't match Phase 32's output.

## Code Examples

### Tauri Configuration (tauri.conf.json)
```json
{
  "productName": "Tek",
  "version": "0.0.29",
  "identifier": "com.tek.desktop",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [{
      "title": "Tek",
      "width": 1000,
      "height": 700,
      "minWidth": 600,
      "minHeight": 400
    }],
    "security": {
      "csp": "default-src 'self'; connect-src 'self' ws://127.0.0.1:* http://127.0.0.1:*; style-src 'self' 'unsafe-inline'"
    }
  }
}
```

### Rust Plugin Registration (lib.rs)
```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_websocket::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Zustand App Store
```typescript
import { create } from 'zustand';

type View = 'landing' | 'chat';

interface GatewayState {
  status: 'unknown' | 'running' | 'stopped';
  port: number | null;
  pid: number | null;
  startedAt: string | null;
}

interface AppState {
  currentView: View;
  setCurrentView: (view: View) => void;
  gateway: GatewayState;
  setGateway: (info: { pid: number; port: number; startedAt: string } | null) => void;
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'landing',
  setCurrentView: (view) => set({ currentView: view }),
  gateway: { status: 'unknown', port: null, pid: null, startedAt: null },
  setGateway: (info) => set({
    gateway: info
      ? { status: 'running', port: info.port, pid: info.pid, startedAt: info.startedAt }
      : { status: 'stopped', port: null, pid: null, startedAt: null },
  }),
  selectedAgentId: null,
  setSelectedAgentId: (id) => set({ selectedAgentId: id }),
}));
```

### Landing View Pattern
```typescript
// LandingView shows gateway connection status, stats, and transitions to chat
export function LandingView() {
  const gateway = useAppStore((s) => s.gateway);
  const setView = useAppStore((s) => s.setCurrentView);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6">
      <GatewayStatus status={gateway.status} port={gateway.port} />
      {gateway.status === 'running' && (
        <Button onClick={() => setView('chat')}>Start Chat</Button>
      )}
      {gateway.status === 'stopped' && (
        <p className="text-muted-foreground">
          Start the gateway: <code>tek gateway start</code>
        </p>
      )}
    </div>
  );
}
```

### Message Card Component Pattern
```typescript
interface MessageCardProps {
  message: ChatMessage;
  model?: string | null;
}

export function MessageCard({ message, model }: MessageCardProps) {
  if (message.type === 'text') {
    return (
      <Card className={cn(
        "max-w-[80%]",
        message.role === 'user' ? "ml-auto" : "mr-auto"
      )}>
        <CardContent className="p-4">
          {message.role === 'assistant' ? (
            <Streamdown plugins={[CodePlugin]}>
              {message.content}
            </Streamdown>
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
          {model && message.role === 'assistant' && (
            <Badge variant="secondary" className="mt-2">{model}</Badge>
          )}
        </CardContent>
      </Card>
    );
  }
  if (message.type === 'tool_call') {
    return <ToolCallCard message={message} />;
  }
  return null;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-markdown for streaming | Streamdown (by Vercel) | 2025 | Eliminates flicker, handles incomplete syntax |
| Hand-rolled UI components | shadcn/ui (copy-paste components) | 2024-2025 | Faster development, better accessibility, consistent design |
| Custom CSS color variables | Tailwind CSS v4 with theme tokens | 2025 | Better theming support, CSS-first configuration |
| react-shiki for static code | @streamdown/code for streaming code | 2025 | Integrates with streaming, no separate highlighting pass |
| 4-page multi-purpose app | Chat-first with landing page | opcode pattern | Focused UX, users go straight to chat |

**Deprecated/outdated:**
- Tailwind v3 config file approach: v4 uses CSS-first configuration with `@import "tailwindcss"`
- react-markdown for streaming: Use Streamdown instead (built specifically for streaming AI)
- Manual icon SVGs (old app pattern): Use lucide-react (shadcn/ui default)

## Open Questions

1. **Phase 32 Structured Stream Format**
   - What we know: Phase 32 will add structured JSON streaming with markdown blocks, code blocks, reasoning blocks, tool call displays
   - What's unclear: The exact message format (will it extend `chat.stream.delta` or add new message types?)
   - Recommendation: Build the app shell and basic text streaming first. Design message card components with a discriminated union type that can easily add new block types. Upgrade rendering after Phase 32 completes.

2. **Session History in Sidebar or Separate View**
   - What we know: Old app had session list in collapsible sidebar. Phase goal says "chat selects from available agents."
   - What's unclear: Whether session history should be in a sidebar panel, a dropdown, or a separate view.
   - Recommendation: Use a collapsible side panel (similar to old app but simpler) that shows recent sessions. Keep the primary focus on the chat.

3. **Gateway Start/Stop from Desktop**
   - What we know: Old app could start/stop gateway via shell commands. New design is "landing page shows gateway connection status."
   - What's unclear: Whether the landing page should have start/stop controls or just show status.
   - Recommendation: Include a start button on the landing page for convenience, but also show the CLI command. Keep stop as a secondary action (not prominent).

4. **Dark/Light Theme**
   - What we know: opcode supports dark/light mode. shadcn/ui has built-in theme support. Old app was dark-only.
   - What's unclear: Whether to implement both themes now or stay dark-only.
   - Recommendation: Start dark-only (consistent with current design tokens). Theme toggle is listed in DSKF-02 as a future requirement. shadcn/ui makes adding it later straightforward.

## Sources

### Primary (HIGH confidence)
- Old desktop app source (git commit `006cd48~1`) -- reviewed all 58 deleted files for patterns, hooks, types, and architecture
- Gateway WebSocket protocol (`packages/gateway/src/ws/protocol.ts`) -- 750 lines, all client/server message types
- Config schema (`packages/core/src/config/schema.ts`) -- AgentDefinition, AgentsConfig, AppConfig types
- Gateway connection state (`packages/gateway/src/ws/connection.ts`) -- ConnectionState interface

### Secondary (MEDIUM confidence)
- [opcode (winfunc/opcode)](https://github.com/winfunc/opcode) -- Tauri v2 + React + shadcn/ui desktop chat app for Claude Code
- [shadcn/ui Vite installation](https://ui.shadcn.com/docs/installation/vite) -- Official setup guide
- [shadcn/ui AI components](https://www.shadcn.io/ai) -- Message, Conversation, Prompt Input, Reasoning, Tool, Code Block components
- [Tauri v2 WebSocket plugin](https://v2.tauri.app/plugin/websocket/) -- Official plugin docs
- [Streamdown](https://github.com/vercel/streamdown) -- Vercel's streaming markdown renderer, v2.1.0

### Tertiary (LOW confidence)
- [Brightcoding opcode review](https://blog.brightcoding.dev/2026/02/13/opcode-the-revolutionary-claude-code-command-center) -- Third-party architecture analysis
- [tauri-ui template](https://github.com/agmmnn/tauri-ui) -- Tauri + shadcn/ui project template (community)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- same stack as old app (Tauri v2 + React + Vite + Tailwind + Zustand), upgrading component library to shadcn/ui (verified in opcode and official docs)
- Architecture: HIGH -- patterns directly derived from old desktop app code (reviewed all 58 files) plus opcode reference
- Pitfalls: HIGH -- most pitfalls are from actual issues encountered in the old app (CSP, stale runtime.json, Node.js imports in webview)
- Streaming rendering: MEDIUM -- Streamdown is new (v2.1.0, by Vercel), but well-documented and specifically built for this use case

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (30 days -- stable stack, well-documented patterns)
