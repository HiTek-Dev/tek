# Architecture Research

**Domain:** CLI Visual Overhaul + Desktop UI Overhaul + Testing Foundation (Milestone: Visual Polish & Testing)
**Researched:** 2026-02-20
**Confidence:** HIGH — based on direct codebase reading, not speculation

---

> **Note:** This file replaces the original Feb-15 project research. That research described the initial platform design. This research describes integration architecture for the current milestone: visual polish (CLI + Desktop) and test infrastructure, layered on the existing Tek codebase.

---

## Existing Architecture (Ground Truth)

This is a subsequent milestone. The architecture is not hypothetical — it is the live codebase. Every component and boundary below was read directly from source.

### Package Dependency Graph (Current State)

```
@tek/core (no deps on other @tek packages)
    ^
    |──────────────────┐
@tek/db              @tek/cli ─── vault/ subpath export
    ^                    ^  \
    |                    |   \
@tek/gateway ────────────┘    \
(imports @tek/cli/vault)       \
    ^                           \
@tek/telegram               @tek/desktop (Tauri app)
                             (imports @tek/core, @tek/gateway)
```

**The circular dependency (confirmed in source):**

`packages/gateway/src/ws/handlers.ts` line 54:
```typescript
import { getKey } from "@tek/cli/vault";
```

`packages/cli/package.json` declares:
```json
"dependencies": { "@tek/gateway": "workspace:^" }
```

This creates: `@tek/cli -> @tek/gateway -> @tek/cli/vault` — a true circular dependency that breaks Turbo's build pipeline, requiring a 2-pass build workaround.

---

## Component Map (New vs Modified for This Milestone)

| Feature Area | Scope | Priority |
|---|---|---|
| Vault extraction | Move `packages/cli/src/vault/` to `@tek/core` to fix circular dep | BLOCKER — do first |
| CLI visual overhaul | Collapsible tool panels, improved streaming state, session picker | Phase A |
| Desktop markdown rendering | `react-markdown` + syntax highlighting in `ChatMessage.tsx` | Phase A |
| Desktop tool approval UI | WS handler + `ToolApprovalModal.tsx` component | Phase A |
| Desktop session history | New WS messages (`session.load`/`session.messages`) + `SessionHistoryPanel.tsx` | Phase B |
| Test infrastructure | Vitest workspace config + WS protocol harness | Parallel |

---

## Vault Extraction — Integration Points

### Current State

The vault lives in `packages/cli/src/vault/`:
- `index.ts` — `addKey`, `getKey`, `updateKey`, `removeKey`, `listProviders`, `getOrCreateAuthToken`
- `keychain.ts` — `@napi-rs/keyring` wrapper (OS keychain via `KEYCHAIN_SERVICE` constant)
- `providers.ts` — Provider enum (`anthropic`, `openai`, `ollama`, `venice`, `google`, `telegram`, `brave`, `tavily`) + validation

The vault's only external dependencies are `@tek/core` (for `VaultError`, `KEYCHAIN_SERVICE`, `generateAuthToken`) and `@tek/db` (for `recordAuditEvent`). Neither creates a circular import — the circular problem is caused by `@tek/gateway` importing the vault FROM `@tek/cli`, while `@tek/cli` already depends on `@tek/gateway`.

### Extraction Target: `@tek/core`

Move vault into `packages/core/src/vault/` and export from `@tek/core` main barrel. Rationale:

- Vault already only imports `@tek/core` and `@tek/db` — no `@tek/cli`-specific code
- `@tek/core` is already a dependency of both `@tek/gateway` and `@tek/cli`
- Gateway import changes from `import { getKey } from "@tek/cli/vault"` → `import { getKey } from "@tek/core"`
- After extraction, `@tek/cli` can drop its `@tek/gateway` dependency entirely if no other imports remain

**Alternative rejected:** New `@tek/vault` package. Vault is ~4 files, ~200 lines. A new package adds `package.json`, `tsconfig.json`, a turbo graph node — unnecessary overhead for code that logically belongs in core infrastructure.

### Files Changed

| File | Change |
|---|---|
| `packages/core/src/vault/index.ts` | NEW — copy of `packages/cli/src/vault/index.ts` |
| `packages/core/src/vault/keychain.ts` | NEW — copy of `packages/cli/src/vault/keychain.ts` |
| `packages/core/src/vault/providers.ts` | NEW — copy of `packages/cli/src/vault/providers.ts` |
| `packages/core/src/index.ts` | MODIFY — add vault exports |
| `packages/gateway/src/ws/handlers.ts` | MODIFY — line 54: `from "@tek/cli/vault"` -> `from "@tek/core"` |
| `packages/cli/src/vault/` | DELETE or stub re-export from `@tek/core` for backward compat |
| `packages/cli/package.json` | MODIFY — remove `@tek/gateway` dependency if no other imports remain |

**Impact on Turbo:** After extraction, `@tek/cli` no longer depends on `@tek/gateway`. Build graph becomes a clean DAG. Turbo can parallelize `@tek/cli` and `@tek/gateway` builds since they both only depend on `@tek/core` and `@tek/db`.

---

## CLI Visual Overhaul — Component Boundaries

### Current Component Tree

```
Chat.tsx (orchestrator)
├── StatusBar.tsx          — 1-line status: connected, session, model, usage
├── MessageList.tsx        — renders array of ChatMessage via MessageBubble
│   └── MessageBubble.tsx  — switch on message.type: text/tool_call/bash_command/reasoning
│       └── MarkdownRenderer.tsx — wraps renderMarkdown() (marked + marked-terminal)
├── StreamingResponse.tsx  — live streaming display (no markdown during stream)
├── InputBar.tsx           — @inkjs/ui TextInput with cyan prompt
├── ToolApprovalPrompt.tsx — Y/N/S keyboard input modal
├── SkillApprovalPrompt.tsx — skill registration variant
└── PreflightChecklist.tsx — preflight checklist review
```

### Ink Box Model Constraints (Confirmed From Source)

- All layout is `flexDirection: "column"` or `"row"` — no CSS grid
- `borderStyle="single"` is the heaviest border option (no gradients, no color fills)
- `dimColor` + `bold` + 8 named colors are the full styling palette
- No scroll API — content renders sequentially; terminal scroll handles overflow
- Width is `process.stdout.columns` (fixed at module init in `lib/markdown.ts`)
- No focus management system — all `useInput` handlers receive all keypresses simultaneously

### Collapsible Tool Panels

Tool calls currently render inline in `MessageBubble.tsx` — flat display, no expand/collapse. Ink has no built-in accordion. Collapsible panels require `useInput` + local `useState` per panel, with `[+]`/`[-]` toggle indicators.

**New component needed:** `CollapsiblePanel.tsx`

```typescript
// packages/cli/src/components/CollapsiblePanel.tsx
function CollapsiblePanel({ title, children, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  useInput((input) => {
    // Coordinate key bindings carefully — all panels receive all keypresses
    if (input === "t") setExpanded((e) => !e);
  });

  return (
    <Box flexDirection="column">
      <Text dimColor>{expanded ? "[-]" : "[+]"} {title}</Text>
      {expanded && children}
    </Box>
  );
}
```

**Coordination constraint:** Multiple `CollapsiblePanel` instances with identical key bindings toggle simultaneously. Design around this: use per-panel numeric keys (e.g., `1`-`9` to toggle panel by index) managed from `MessageList.tsx`, or single "expand all / collapse all" toggle.

### MessageBubble Modifications

- `tool_call` branch: Wrap in `CollapsiblePanel` (title = tool name + status badge, content = args + output)
- `bash_command` branch: Wrap in `CollapsiblePanel` (title = command, content = output)
- `reasoning` branch: Already dimmed/italic — optionally add toggle for thinking traces

### StreamingResponse Modifications

- Currently uses `@inkjs/ui Spinner` when waiting for first token — keep this
- Plain text during streaming (no markdown) — keep this; partial markdown renders garbage
- Enhancement: show character count or elapsed time indicator (cosmetic only)

### New CLI Components Needed

| Component | Purpose | Location |
|---|---|---|
| `CollapsiblePanel.tsx` | Toggle expand/collapse for tool/bash blocks | `packages/cli/src/components/` |
| `SessionPicker.tsx` | List and select sessions from `/session list` slash command | `packages/cli/src/components/` |

### Modified CLI Components

| Component | What Changes |
|---|---|
| `MessageBubble.tsx` | Wrap `tool_call` and `bash_command` in `CollapsiblePanel` |
| `StreamingResponse.tsx` | Minor cosmetic improvements (elapsed time, char count) |
| `StatusBar.tsx` | Optional: add slash command hint or model tier badge |
| `Chat.tsx` | Wire `SessionPicker` when `/session list` slash command fires |

---

## Desktop UI Overhaul — Component Boundaries

### Current Component Tree (Desktop)

```
App.tsx (router)
├── Layout.tsx (sidebar + content area)
│   ├── Sidebar.tsx
│   └── [page content]
├── ChatPage.tsx (main chat)
│   ├── ChatMessage.tsx     — renders message.type (text/tool_call/bash_command/reasoning)
│   ├── StreamingText.tsx   — live streaming display
│   └── ChatInput.tsx       — textarea + send button
├── DashboardPage.tsx
├── AgentsPage.tsx
└── SettingsPage.tsx
```

### Markdown Rendering Pipeline

**Current state:** `ChatMessage.tsx` uses `whitespace-pre-wrap` CSS for assistant messages. No markdown parsing — plain text displayed verbatim.

**Target state:** `react-markdown` + `remark-gfm` + `react-syntax-highlighter` for code blocks.

**Integration point:** `ChatMessage.tsx` assistant branch only. User messages stay as plain text — no markdown interpretation of user input, matching current behavior.

```typescript
// After (ChatMessage.tsx, assistant message branch):
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  components={{
    code({ inline, className, children }) {
      const match = /language-(\w+)/.exec(className || "");
      return !inline && match ? (
        <SyntaxHighlighter language={match[1]} style={oneDark} PreTag="div">
          {String(children).replace(/\n$/, "")}
        </SyntaxHighlighter>
      ) : (
        <code className="bg-gray-800 px-1 rounded text-sm font-mono">
          {children}
        </code>
      );
    },
  }}
>
  {message.content}
</ReactMarkdown>
```

**Anti-pattern warning:** Do NOT apply `react-markdown` to `StreamingText.tsx` — streaming text is partial markdown. Partial backtick fences, unclosed bold delimiters, and incomplete code blocks produce garbled output. Apply markdown only to completed messages (existing `ChatMessage.tsx`, not `StreamingText.tsx`). The codebase already separates streaming vs. complete message rendering — preserve this.

**Library choice:** `react-markdown` v9 is the dominant React markdown library (13M+ weekly npm downloads), has explicit React 19 support, and uses a plugin architecture (remark/rehype) that works well with `remark-gfm`. Alternatives (`marked`, `markdown-it`) lack React-native rendering and require manual DOM integration.

### Tool Approval UI (Desktop)

**Current state:** Desktop `useChat.ts` handles `tool.call`, `tool.result`, `tool.error` WS messages but has NO approval flow. The approval flow exists only in CLI.

**Gateway side (confirmed in protocol.ts):**
- `tool.approval.request` ServerMessage — gateway sends this to clients when approval is needed
- `tool.approval.response` ClientMessage — client sends this back with `approved: boolean` + optional `sessionApprove: boolean`

**What the Desktop currently lacks:**
1. No handler for `tool.approval.request` in `apps/desktop/src/hooks/useChat.ts`
2. No `ToolApprovalModal.tsx` component
3. No `pendingApproval` state in `app-store.ts`

**Integration in `useChat.ts`:**
```typescript
case "tool.approval.request": {
  setPendingApproval({
    toolCallId: m.toolCallId as string,
    toolName: m.toolName as string,
    args: m.args,
    risk: m.risk as "low" | "medium" | "high" | undefined,
  });
  break;
}
```

**New component:** `ToolApprovalModal.tsx` — shows tool name, args (collapsed JSON with expand option), risk badge (low/medium/high color coding), Approve / Deny / Approve for Session buttons. Blocks chat input while visible.

**WS response shape:**
```typescript
ws.send({
  type: "tool.approval.response",
  id: nanoid(),
  toolCallId: pendingApproval.toolCallId,
  approved: boolean,
  sessionApprove: boolean | undefined,
});
```

**State placement:** `pendingApproval` must go in `app-store.ts` (Zustand), not local `ChatPage` state. Approval state must survive page navigation and be accessible from both the modal and the chat input disable logic.

### Session History UI (Desktop)

**Current state:** `ChatPage.tsx` displays `chat.sessionId` (first 8 chars) in the header. No way to browse or load past sessions.

**Gateway side (confirmed):**
- `session.list` ClientMessage exists in protocol
- `session.list` ServerMessage (response) exists with `sessions[]` array: `sessionId`, `sessionKey`, `model`, `createdAt`, `messageCount`
- `SessionManager.getMessages()` exists in `packages/gateway/src/session/manager.ts` — queries SQLite correctly

**What is MISSING:** `session.load` — no WS message to load messages from a specific past session. The session store has the data; no protocol message exposes it.

**New WS messages needed (additions to `packages/gateway/src/ws/protocol.ts`):**

```typescript
// Client -> Gateway
const SessionLoadSchema = z.object({
  type: z.literal("session.load"),
  id: z.string(),
  sessionId: z.string(),
});

// Gateway -> Client
const SessionMessagesSchema = z.object({
  type: z.literal("session.messages"),
  requestId: z.string(),
  sessionId: z.string(),
  messages: z.array(z.object({
    role: z.string(),
    content: z.string(),
    createdAt: z.string(),
  })),
});
```

**Handler addition in `packages/gateway/src/ws/handlers.ts`:**
```typescript
async function handleSessionLoad(
  transport: Transport,
  _connState: ConnectionState,
  msg: SessionLoad,
): Promise<void> {
  const session = sessionManager.get(msg.sessionId);
  if (!session) {
    transport.send({ type: "error", requestId: msg.id, code: "not_found", message: "Session not found" });
    return;
  }
  const messages = sessionManager.getMessages(msg.sessionId);
  transport.send({
    type: "session.messages",
    requestId: msg.id,
    sessionId: msg.sessionId,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
  });
}
```

**New Desktop component:** `SessionHistoryPanel.tsx` — slide-in panel or collapsible section, lists sessions with date + message count, click to load.

**`app-store.ts` additions:** `sessions: SessionSummary[]`, `loadSession(id: string)` action.

---

## Test Infrastructure — Integration Points

### Current State

- Root `package.json`: `vitest: ^4.0.18` is already a dev dependency
- `turbo.json`: `test` task configured (`"dependsOn": ["build"]`)
- No test files exist anywhere in the codebase
- No `vitest.config.ts` files in any package
- No `vitest.workspace.ts` at root

### Vitest Workspace Setup

**Root config:**
```typescript
// vitest.workspace.ts (new file at repo root)
export default [
  "packages/core/vitest.config.ts",
  "packages/gateway/vitest.config.ts",
  "packages/cli/vitest.config.ts",
];
```

**Per-package config example:**
```typescript
// packages/gateway/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
```

### WebSocket Protocol Test Harness

Gateway handlers in `packages/gateway/src/ws/handlers.ts` take `Transport` and `ConnectionState` parameters. This is the correct test seam — handlers are pure functions of these inputs, no actual WebSocket server required.

**Mock Transport pattern:**
```typescript
// packages/gateway/src/ws/__tests__/harness.ts
import type { Transport } from "../../transport.js";
import type { ServerMessage } from "../protocol.js";

export class MockTransport implements Transport {
  sent: ServerMessage[] = [];
  send(msg: ServerMessage): void {
    this.sent.push(msg);
  }
  sentOfType<T extends ServerMessage["type"]>(type: T) {
    return this.sent.filter((m) => m.type === type) as Extract<ServerMessage, { type: T }>[];
  }
}

export function createConnectionState() {
  return { streaming: false, streamRequestId: null };
}
```

**LLM mocking strategy:** `streamChatResponse` in `packages/gateway/src/llm/stream.ts` must be mocked for handler tests. Use `vi.mock("../llm/index.js")` to stub the module — return a controlled async generator that emits a predictable sequence of delta chunks followed by a done event.

**Vault mocking:** After vault extraction to `@tek/core`, handler tests mock `@tek/core` vault functions with `vi.mock("@tek/core", ...)`. Before extraction, mock `@tek/cli/vault`.

**SQLite in tests:** Do NOT use the production SQLite file at `~/.tek/tek.db`. Set `DB_PATH=:memory:` in test environment. Drizzle ORM + `better-sqlite3` supports `:memory:` databases. Add to each package's `vitest.config.ts`:
```typescript
test: {
  env: { DB_PATH: ":memory:" },
}
```

### Test Priorities by Phase

| Test Target | Test Type | Priority | Notes |
|---|---|---|---|
| Protocol Zod schemas | Unit | High | Fast, no mocks, catches regressions immediately |
| `handleSessionList` | Integration | High | Simple handler, good harness validation |
| `handleChatSend` — session creation path | Integration | High | Core path; LLM mock required |
| `handleToolApprovalResponse` | Integration | High | Approval gate correctness is critical |
| `handleSessionLoad` (NEW) | Unit | High | Test as built; simple DB query |
| Vault functions (post-extraction) | Unit | Medium | `keychainGet`/`keychainSet` with mock keyring |
| Desktop `useChat` hook | Unit | Medium | React Testing Library; test approval handler |
| CLI `MessageBubble` rendering | Unit | Low | Ink render testing is complex; focus on logic |

---

## System Overview — Post-Milestone

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Interface Layer                              │
├──────────────────────────────┬──────────────────────────────────────┤
│          CLI (Ink)           │       Desktop (Tauri + React)         │
│  ┌────────────────────────┐  │  ┌──────────────────────────────┐    │
│  │ StatusBar              │  │  │ ChatPage                     │    │
│  │ MessageList            │  │  │  ├─ ChatMessage (react-md)   │    │
│  │  └─ MessageBubble      │  │  │  ├─ ToolApprovalModal (NEW)  │    │
│  │      └─CollapsiblePanel│  │  │  ├─ SessionHistoryPanel (NEW)│    │
│  │         (NEW)          │  │  │  └─ StreamingText (unchanged)│    │
│  │ StreamingResponse      │  │  │ useChat (+ approval handler) │    │
│  │ InputBar               │  │  │ app-store (+ approval state) │    │
│  │ ToolApprovalPrompt     │  │  │ useWebSocket (Tauri plugin)   │    │
│  │ SessionPicker (NEW)    │  │  └──────────────────────────────┘    │
│  └────────────────────────┘  └──────────────────────────────────────┘
│           │ ws://                          │ ws://                    │
├───────────┴────────────────────────────────┴────────────────────────┤
│                       Gateway (Fastify + WS)                         │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ ws/handlers.ts — dispatches ClientMessage by type           │    │
│  │  ├─ handleChatSend → LLM stream → chat.stream.*            │    │
│  │  ├─ handleToolApprovalResponse → approval gate             │    │
│  │  ├─ handleSessionList → session.list response              │    │
│  │  └─ handleSessionLoad (NEW) → session.messages response    │    │
│  │ ws/protocol.ts — Zod schemas (+ session.load/messages NEW) │    │
│  └─────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ session/ — SessionManager, SessionStore (SQLite)            │    │
│  │ agent/ — approval-gate, tool-loop, preflight               │    │
│  │ key-server/ — local API for vault key serving              │    │
│  └─────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────┤
│                        Package Layer                                 │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ @tek/core — config, errors, logger, crypto, skills, vault(NEW)│  │
│  │ @tek/db   — SQLite schema, migrations, query functions        │  │
│  │ @tek/telegram — Telegram bot channel adapter                  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

| Component | Responsibility | Status |
|---|---|---|
| `@tek/core/vault/` | OS keychain operations, provider key CRUD, auth token | NEW (moved from @tek/cli) |
| `packages/cli/.../CollapsiblePanel.tsx` | Toggle expand/collapse for tool/bash blocks in Ink | NEW |
| `packages/cli/.../SessionPicker.tsx` | Browse and select past sessions in CLI | NEW |
| `packages/cli/.../MessageBubble.tsx` | Wrap tool_call and bash_command in CollapsiblePanel | MODIFIED |
| `packages/cli/.../StreamingResponse.tsx` | Minor cosmetic improvements | MODIFIED |
| `apps/desktop/.../ChatMessage.tsx` | react-markdown rendering for assistant messages | MODIFIED |
| `apps/desktop/.../ToolApprovalModal.tsx` | Inline modal for tool approval with risk badge | NEW |
| `apps/desktop/.../SessionHistoryPanel.tsx` | Session list picker and load trigger | NEW |
| `apps/desktop/src/hooks/useChat.ts` | Add tool.approval.request handler + approval state | MODIFIED |
| `apps/desktop/src/stores/app-store.ts` | Add sessions[] + pendingApproval state | MODIFIED |
| `packages/gateway/src/ws/protocol.ts` | Add SessionLoad client msg + SessionMessages server msg | MODIFIED |
| `packages/gateway/src/ws/handlers.ts` | Add handleSessionLoad, fix vault import | MODIFIED |
| `packages/*/vitest.config.ts` | Per-package test configuration | NEW |
| `vitest.workspace.ts` (root) | Workspace-level test coordination | NEW |
| `packages/gateway/src/ws/__tests__/` | MockTransport harness + handler tests | NEW |

---

## Data Flow

### Tool Approval Flow (Desktop — NEW)

```
Gateway approvalGate blocks execution
  → sends tool.approval.request { toolCallId, toolName, args, risk }
      ↓
useChat.ts handler: setPendingApproval({ toolCallId, toolName, args, risk })
      ↓
ChatPage renders <ToolApprovalModal> (blocks ChatInput)
      ↓
User clicks Approve / Deny / Approve-All-Session
      ↓
ChatPage: ws.send({ type: "tool.approval.response", toolCallId, approved, sessionApprove })
  + setPendingApproval(null) → modal closes
      ↓
Gateway approvalGate resolves → tool executes → tool.result sent
      ↓
useChat.ts: updates tool_call message status to "complete" (existing logic)
```

### Session Load Flow (Desktop — NEW)

```
User clicks past session in SessionHistoryPanel
      ↓
send({ type: "session.load", id: nanoid(), sessionId })
      ↓
Gateway ws/handlers.ts handleSessionLoad:
  sessionManager.get(sessionId) → verify session exists
  sessionManager.getMessages(sessionId) → MessageRow[]
  transport.send({ type: "session.messages", requestId, sessionId, messages })
      ↓
useChat.ts handler: convert MessageRow[] -> ChatMessage[], setMessages()
  setSessionId(loadedSessionId)
      ↓
ChatPage re-renders with loaded history
New messages from this point append to the loaded session
```

### Vault Key Flow (Post-Extraction)

```
Before: @tek/gateway/ws/handlers.ts -> @tek/cli/vault -> @napi-rs/keyring
After:  @tek/gateway/ws/handlers.ts -> @tek/core/vault -> @napi-rs/keyring
        @tek/cli/commands/keys.ts   -> @tek/core/vault -> @napi-rs/keyring
```

Both gateway and CLI import vault from `@tek/core`. `@tek/cli` no longer depends on `@tek/gateway`. Circular dependency eliminated. Turbo build graph is a clean DAG.

### Streaming Chat Flow (Unchanged — For Reference)

```
User submits message → ws.send chat.send
      ↓
Gateway handleChatSend → assembleContext → streamChatResponse
      ↓
chat.stream.start → chat.stream.delta (×N) → chat.stream.end
      ↓
useChat: accumulate delta in streamingText
  → on stream.end: push final text as TextMessage (role: "assistant")
      ↓
ChatPage: StreamingText shows live plain text
  → ChatMessage shows completed assistant message with react-markdown
```

---

## Recommended Project Structure (After Milestone)

```
packages/
├── core/
│   └── src/
│       ├── config/         (unchanged)
│       ├── crypto/         (unchanged)
│       ├── skills/         (unchanged)
│       ├── vault/          (NEW — moved from cli/src/vault/)
│       │   ├── index.ts
│       │   ├── keychain.ts
│       │   └── providers.ts
│       ├── errors.ts       (unchanged — VaultError already here)
│       ├── logger.ts       (unchanged)
│       └── index.ts        (MODIFIED — add vault exports)
├── cli/
│   └── src/
│       ├── components/
│       │   ├── CollapsiblePanel.tsx    (NEW)
│       │   ├── SessionPicker.tsx       (NEW)
│       │   ├── MessageBubble.tsx       (MODIFIED)
│       │   ├── StreamingResponse.tsx   (MODIFIED — minor)
│       │   └── ... (rest unchanged)
│       ├── vault/          (DELETE after extraction, or stub re-export)
│       └── ...
├── gateway/
│   └── src/
│       ├── ws/
│       │   ├── handlers.ts  (MODIFIED — vault import, session.load handler)
│       │   ├── protocol.ts  (MODIFIED — session.load + session.messages schemas)
│       │   └── __tests__/   (NEW)
│       │       ├── harness.ts           (MockTransport + test utilities)
│       │       ├── protocol.test.ts     (Zod schema unit tests)
│       │       └── handlers.test.ts     (handler integration tests)
│       └── ...
└── db/ (unchanged)

apps/
└── desktop/
    └── src/
        ├── components/
        │   ├── ChatMessage.tsx          (MODIFIED — react-markdown)
        │   ├── ToolApprovalModal.tsx    (NEW)
        │   ├── SessionHistoryPanel.tsx  (NEW)
        │   └── ... (rest unchanged)
        ├── hooks/
        │   └── useChat.ts              (MODIFIED — approval handler)
        └── stores/
            └── app-store.ts            (MODIFIED — sessions, pendingApproval)

vitest.workspace.ts                     (NEW — root workspace config)
packages/gateway/vitest.config.ts      (NEW)
packages/cli/vitest.config.ts          (NEW)
packages/core/vitest.config.ts         (NEW)
```

---

## Architectural Patterns

### Pattern 1: Ink Collapsible Panel via useInput

**What:** Local state toggle in Ink components, listening for keyboard events on focused elements.

**When to use:** Any CLI content block that benefits from show/hide without restructuring parent layout.

**Trade-offs:** Ink has no focus management — all `useInput` calls in the component tree receive all keypresses simultaneously. Must coordinate via explicit key scoping or managing "focused index" in a parent component.

**Example:**
```typescript
// CollapsiblePanel.tsx
function CollapsiblePanel({ title, children, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  useInput((input) => {
    if (input === "t") setExpanded((e) => !e);
  });

  return (
    <Box flexDirection="column">
      <Text dimColor>{expanded ? "[-]" : "[+]"} {title}</Text>
      {expanded && children}
    </Box>
  );
}
```

### Pattern 2: Gateway Handler Test via Mock Transport

**What:** Test gateway WS handlers in isolation by providing a `MockTransport` that collects sent messages. No actual WebSocket server needed.

**When to use:** All gateway handlers with deterministic responses. LLM streaming handlers require additional mocking.

**Example:**
```typescript
it("session.list returns sessions array", async () => {
  const transport = new MockTransport();
  const connState = createConnectionState();

  await handleSessionList(transport, connState, {
    type: "session.list",
    id: "test-req-1",
  });

  const [response] = transport.sentOfType("session.list");
  expect(response).toMatchObject({
    type: "session.list",
    requestId: "test-req-1",
    sessions: expect.any(Array),
  });
});
```

### Pattern 3: Protocol Schema Unit Tests

**What:** Test Zod schemas in `ws/protocol.ts` directly. Parse known-good and known-bad inputs, assert success/failure.

**When to use:** First test suite to write — fast, no mocks, catches regressions before handler tests.

**Example:**
```typescript
it("parses valid chat.send", () => {
  const result = ClientMessageSchema.safeParse({
    type: "chat.send",
    id: "req-1",
    content: "Hello",
  });
  expect(result.success).toBe(true);
});

it("rejects chat.send without id", () => {
  const result = ClientMessageSchema.safeParse({
    type: "chat.send",
    content: "Hello",
  });
  expect(result.success).toBe(false);
});
```

---

## Anti-Patterns

### Anti-Pattern 1: Creating @tek/vault as a New Package

**What people do:** Create `packages/vault/` with its own `package.json`, `tsconfig.json`, build step.

**Why it's wrong:** Vault is 4 files (~200 lines). A new package adds a turbo graph node, a build artifact, and a versioning concern for code that logically belongs in core infrastructure. Vault's dependencies (`@tek/core`, `@tek/db`) already rule out it being a leaf package.

**Do this instead:** Move vault into `packages/core/src/vault/`. Same isolation, zero overhead.

### Anti-Pattern 2: Rendering Markdown During Streaming

**What people do:** Apply `react-markdown` or `renderMarkdown()` to live streaming text.

**Why it's wrong:** Streaming text is partial markdown. A `**bold` without a closing `**`, a code fence with no closing backticks, or a half-rendered heading produce garbled output. The parser either throws or renders garbage until the closing delimiter arrives.

**Do this instead:** The codebase already handles this correctly — `StreamingText.tsx` and `StreamingResponse.tsx` show plain text during streaming; markdown only runs in `ChatMessage.tsx` on completed message content (after `chat.stream.end`). Preserve this pattern in all future work.

### Anti-Pattern 3: Approval State in Local Component State

**What people do:** Track `pendingApproval` in `ChatPage.tsx` local `useState`.

**Why it's wrong:** If the user navigates to another page and back while an approval is pending, the local state is lost. Input disable logic and modal rendering would need to be in the same component. Re-renders on unrelated state changes could cause the modal to flicker.

**Do this instead:** Put `pendingApproval` in `app-store.ts` (Zustand). Modal reads from store, approval dispatch clears store, input disables via store selector.

### Anti-Pattern 4: Testing Gateway Handlers Against the Production SQLite File

**What people do:** Run gateway handler tests against `~/.tek/tek.db`.

**Why it's wrong:** Tests mutate production session and message data, are not isolated between test runs, fail in CI (no home directory), and may leave corrupted data after test failures.

**Do this instead:** Set `DB_PATH=:memory:` in test environment. `better-sqlite3` supports `:memory:` as the database path, creating an in-memory SQLite database per test run. Drizzle ORM works identically. Add `env: { DB_PATH: ":memory:" }` to each package's `vitest.config.ts`.

---

## Build Order (Dependency Constraints for This Milestone)

```
Step 1: Vault Extraction (@tek/core/vault)
  MUST be first — gateway import fix unblocks clean Turbo builds.
  All other work can begin after this, as parallel branches.

Step 2a (parallel): CLI Component Refactoring
  CollapsiblePanel.tsx, SessionPicker.tsx, MessageBubble.tsx updates
  No external dependencies — pure Ink component work.

Step 2b (parallel): Desktop Component Refactoring
  react-markdown in ChatMessage.tsx, ToolApprovalModal.tsx
  Approval handler in useChat.ts
  app-store.ts updates for approval state

Step 2c (parallel): WS Protocol Extensions
  session.load ClientMessage + session.messages ServerMessage
  in protocol.ts + handlers.ts
  Can write tests immediately after this step.

Step 3: Desktop Session History Integration
  DEPENDS ON Step 2c — needs WS message shapes defined first.
  SessionHistoryPanel.tsx, useChat.ts session.messages handler,
  app-store.ts sessions state.

Step 4: Test Infrastructure
  Protocol tests (protocol.test.ts): can start after Step 2c
  Handler tests: can start after Step 1 (clean import graph)
  useChat tests: can start after Step 2b
  Run tests continuously — add to CI alongside each feature.
```

---

## Integration Points Summary

| Integration Point | Packages Involved | Protocol | Status After Milestone |
|---|---|---|---|
| Vault → Gateway | `@tek/core` → `@tek/gateway` | Direct import | Clean (was circular) |
| Vault → CLI | `@tek/core` → `@tek/cli` | Direct import | Clean (no gateway dep) |
| Chat stream | CLI/Desktop → Gateway | WS: `chat.send`, `chat.stream.*` | Unchanged |
| Tool approval (CLI) | CLI → Gateway | WS: `tool.approval.request/.response` | Already works |
| Tool approval (Desktop) | Desktop → Gateway | WS: `tool.approval.request/.response` | NEW |
| Session list | Desktop → Gateway | WS: `session.list` | Protocol exists; Desktop UI NEW |
| Session load | Desktop → Gateway | WS: `session.load` / `session.messages` | NEW both sides |
| Markdown render | Desktop internal | Component prop | react-markdown in ChatMessage |
| Test harness | Gateway internal | MockTransport | NEW, no external deps |

---

## Sources

- Direct source: `packages/gateway/src/ws/handlers.ts` line 54 — confirmed circular dep origin
- Direct source: `packages/gateway/src/ws/protocol.ts` — full ClientMessage/ServerMessage schema inventory
- Direct source: `packages/cli/src/components/*.tsx` — all Ink component boundaries confirmed
- Direct source: `apps/desktop/src/components/ChatMessage.tsx` — confirmed markdown gap (plain text only)
- Direct source: `apps/desktop/src/hooks/useChat.ts` — confirmed missing approval handler
- Direct source: `packages/gateway/src/session/manager.ts` + `store.ts` — confirmed session.load feasibility
- Direct source: `packages/cli/package.json` + `packages/gateway/package.json` — circular dep confirmed via dependency declarations
- [react-markdown npm](https://www.npmjs.com/package/react-markdown) — 13M+ weekly downloads, React 19 compatible, v9
- [remark-gfm GitHub](https://github.com/remarkjs/remark-gfm) — GFM tables, strikethrough, autolinks plugin
- [react-syntax-highlighter GitHub](https://github.com/react-syntax-highlighter/react-syntax-highlighter) — code block highlighting, Prism backend
- [Vitest workspace config docs](https://vitest.dev/guide/workspace) — multi-package test coordination

---

*Architecture research for: Tek — CLI/Desktop visual overhaul and testing foundation milestone*
*Researched: 2026-02-20*
*Confidence: HIGH — all findings from direct codebase source reading*
