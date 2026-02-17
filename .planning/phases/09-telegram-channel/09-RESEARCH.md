# Phase 9: Telegram Channel - Research

**Researched:** 2026-02-16
**Domain:** Telegram Bot integration via grammY, channel adapter bridging to existing WebSocket gateway
**Confidence:** HIGH

## Summary

Phase 9 adds Telegram as a second communication channel alongside the CLI. The existing gateway processes messages through WebSocket handlers that are tightly coupled to `WebSocket` objects (the `send(ws, msg)` pattern and `ConnectionState` keyed by `WebSocket`). The Telegram adapter must bridge grammY's update-driven model into this handler infrastructure, reusing the same session management, LLM streaming, tool approval, and context assembly.

The core challenge is that the current handlers (e.g., `handleChatSend`) accept a `WebSocket` as the first argument and use `send(ws, msg)` for outbound messages. Telegram does not use WebSockets -- it uses HTTP long polling or webhooks with grammY. The cleanest approach is to introduce a thin **transport abstraction** that wraps either a WebSocket or a Telegram chat context, allowing handlers to call a unified `send()` without knowing the underlying transport. This avoids rewriting all existing handlers while making them channel-agnostic.

grammY v1.40.0 is the current version, is TypeScript-first, and is the clear standard for Telegram bots in TypeScript. It supports inline keyboards (for tool approval buttons), callback queries, message formatting with HTML parse mode, and integrates with Fastify via `webhookCallback`. For this project, long polling is the simpler choice since AgentSpace runs as a local server.

**Primary recommendation:** Create a `@agentspace/telegram` package with grammY. Introduce a `Transport` interface in the gateway to abstract `send()` away from raw `WebSocket`. Bridge Telegram updates into the existing handler flow via this transport, and implement pairing-code authentication stored in a new `telegram_users` DB table.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| grammy | ^1.40.0 | Telegram Bot API framework | TypeScript-first, best DX of all Telegram bot libs. Plugin ecosystem for keyboards, sessions, menus. Actively maintained. Confirmed by prior stack decision. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @grammyjs/parse-mode | latest | HTML formatting helpers for Telegram messages | When formatting agent responses for Telegram display |
| nanoid | ^5.1.6 | Generate pairing codes and IDs | Already in project dependencies |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| grammy | Telegraf | Never. Telegraf is less maintained, worse TypeScript types. Prior decision locks grammy. |
| Long polling | Webhooks | Webhooks are better for production/serverless but require public URL + SSL. Since AgentSpace is a local daemon, long polling is simpler and avoids exposing ports. Switch to webhooks later if deployed to cloud. |
| HTML parse_mode | MarkdownV2 parse_mode | MarkdownV2 requires escaping many special characters. HTML is more predictable and easier to generate programmatically. |

**Installation:**
```bash
pnpm --filter @agentspace/telegram add grammy
```

## Architecture Patterns

### Recommended Project Structure
```
packages/telegram/
  src/
    bot.ts              # grammY Bot setup, middleware registration
    handlers/
      message.ts        # Text message handler -> gateway chat.send
      callback.ts       # Inline button callback handler -> tool approval
      commands.ts       # /start, /pair, /status commands
    auth/
      pairing.ts        # Pairing code generation, verification, storage
    transport.ts        # TelegramTransport implementing Transport interface
    formatter.ts        # ServerMessage -> Telegram formatted text
    index.ts            # Entry point, exports startTelegramBot()
  package.json
  tsconfig.json
```

### Pattern 1: Transport Abstraction
**What:** A `Transport` interface that abstracts the `send(msg: ServerMessage)` call, so handlers don't need to know whether they are sending to a WebSocket or a Telegram chat.
**When to use:** Always. This is the key bridge between existing WS handlers and the Telegram channel.
**Why needed:** Current handlers accept `WebSocket` as first argument and call `send(ws, msg)`. Rather than duplicate all handler logic, introduce a transport that both WebSocket and Telegram implement.

```typescript
// packages/gateway/src/transport.ts
import type { ServerMessage } from "./ws/protocol.js";

/**
 * Transport abstracts message delivery to a client.
 * WebSocket and Telegram each implement this.
 */
export interface Transport {
  /** Send a typed server message to the client */
  send(msg: ServerMessage): void;
  /** Unique identifier for this transport (for logging/debugging) */
  readonly transportId: string;
  /** Channel type identifier */
  readonly channel: "ws" | "telegram";
}
```

```typescript
// WebSocket transport (wraps existing pattern)
import type { WebSocket } from "ws";
import type { Transport } from "./transport.js";
import type { ServerMessage } from "./ws/protocol.js";

export class WebSocketTransport implements Transport {
  readonly channel = "ws" as const;
  readonly transportId: string;

  constructor(private ws: WebSocket, id: string) {
    this.transportId = `ws:${id}`;
  }

  send(msg: ServerMessage): void {
    if (this.ws.readyState === this.ws.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
```

```typescript
// Telegram transport
import type { Context } from "grammy";
import type { Transport } from "@agentspace/gateway";
import type { ServerMessage } from "@agentspace/gateway";
import { formatForTelegram } from "./formatter.js";

export class TelegramTransport implements Transport {
  readonly channel = "telegram" as const;
  readonly transportId: string;

  constructor(
    private chatId: number,
    private bot: Bot,
  ) {
    this.transportId = `tg:${chatId}`;
  }

  send(msg: ServerMessage): void {
    const formatted = formatForTelegram(msg);
    if (formatted) {
      this.bot.api.sendMessage(this.chatId, formatted.text, {
        parse_mode: "HTML",
        reply_markup: formatted.replyMarkup,
      }).catch(err => {
        logger.error(`Telegram send failed: ${err.message}`);
      });
    }
  }
}
```

### Pattern 2: Handler Refactor (Minimal)
**What:** Modify existing handlers to accept `Transport` instead of `WebSocket`. The `ConnectionState` map changes from `WeakMap<WebSocket, ...>` to `Map<string, ...>` keyed by transport ID.
**When to use:** This is the migration path for existing handlers.
**Scope:** The handler signature changes from `(socket: WebSocket, msg, connState)` to `(transport: Transport, msg, connState)`, and internal `send(socket, msg)` calls become `transport.send(msg)`. This is a mechanical find-and-replace.

```typescript
// Before:
export async function handleChatSend(
  socket: WebSocket, msg: ChatSend, connState: ConnectionState
): Promise<void> {
  send(socket, { type: "chat.stream.start", ... });
}

// After:
export async function handleChatSend(
  transport: Transport, msg: ChatSend, connState: ConnectionState
): Promise<void> {
  transport.send({ type: "chat.stream.start", ... });
}
```

### Pattern 3: Pairing Code Authentication
**What:** When an unknown Telegram user messages the bot, the bot generates a short-lived pairing code (e.g., 6 alphanumeric chars). The user enters this code in the CLI or web dashboard to link their Telegram chat ID to their AgentSpace identity.
**When to use:** TELE-05 requires this. Unauthenticated users cannot interact.

```typescript
// Pairing flow:
// 1. Unknown user sends /start to bot
// 2. Bot generates pairing code, stores in DB with expiry (1 hour)
// 3. Bot replies: "Your pairing code is: ABC123. Enter this in your AgentSpace CLI."
// 4. User runs `agentspace pair telegram ABC123` in CLI
// 5. CLI sends pairing code to gateway, gateway verifies and links telegram_chat_id to user
// 6. Bot now recognizes this chat ID and processes messages

interface TelegramUser {
  id: string;            // nanoid
  telegramChatId: number;
  telegramUsername: string | null;
  pairedAt: string;      // ISO timestamp
  active: boolean;
}

interface PairingCode {
  code: string;          // 6 alphanumeric chars
  telegramChatId: number;
  telegramUsername: string | null;
  createdAt: string;
  expiresAt: string;     // createdAt + 1 hour
  used: boolean;
}
```

### Pattern 4: Inline Buttons for Tool Approval
**What:** When the gateway sends a `tool.approval.request` message, the Telegram transport renders it as a message with inline keyboard buttons (Approve / Deny).
**When to use:** TELE-04 requires this. This is the Telegram equivalent of the CLI's approval prompt.

```typescript
// When tool.approval.request arrives:
import { InlineKeyboard } from "grammy";

function renderToolApproval(msg: ToolApprovalRequest): {
  text: string;
  replyMarkup: InlineKeyboard;
} {
  const keyboard = new InlineKeyboard()
    .text("Approve", `tool:approve:${msg.toolCallId}`)
    .text("Deny", `tool:deny:${msg.toolCallId}`);

  // Optionally add "Approve for Session" button
  keyboard.row()
    .text("Approve for Session", `tool:session:${msg.toolCallId}`);

  return {
    text: `<b>Tool Approval Required</b>\n\n`
      + `Tool: <code>${escapeHtml(msg.toolName)}</code>\n`
      + `Risk: ${msg.risk ?? "unknown"}\n\n`
      + `<pre>${escapeHtml(JSON.stringify(msg.args, null, 2).slice(0, 500))}</pre>`,
    replyMarkup: keyboard,
  };
}

// Handle callback:
bot.callbackQuery(/^tool:(approve|deny|session):(.+)$/, async (ctx) => {
  const [_, action, toolCallId] = ctx.match!;
  const approved = action !== "deny";
  const sessionApprove = action === "session";

  // Resolve the pending approval in ConnectionState
  connState.pendingApprovals.get(toolCallId)?.resolve(approved);

  if (sessionApprove && approved && connState.approvalPolicy) {
    recordSessionApproval(toolName, connState.approvalPolicy);
  }

  await ctx.answerCallbackQuery({
    text: approved ? "Approved" : "Denied",
  });

  // Edit the message to show the decision
  await ctx.editMessageText(
    `${ctx.callbackQuery.message?.text}\n\n<b>${approved ? "APPROVED" : "DENIED"}</b>`,
    { parse_mode: "HTML" },
  );
});
```

### Pattern 5: Streaming Response Accumulation
**What:** LLM responses stream as `chat.stream.delta` messages. WebSocket clients render deltas in real-time, but Telegram cannot edit messages at high frequency (rate limits). Accumulate deltas and send/edit one message at a controlled rate.
**When to use:** Always for Telegram responses. Rate limit edits to ~1 per 2-3 seconds.

```typescript
// TelegramTransport accumulates deltas and batch-edits
class TelegramResponseAccumulator {
  private buffer = "";
  private messageId: number | null = null;
  private lastEdit = 0;
  private editInterval = 2000; // ms between edits
  private timer: NodeJS.Timeout | null = null;

  async handleDelta(delta: string): Promise<void> {
    this.buffer += delta;
    // Throttle edits
    const now = Date.now();
    if (now - this.lastEdit >= this.editInterval) {
      await this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.editInterval);
    }
  }

  async flush(): Promise<void> {
    if (!this.buffer) return;
    this.timer = null;
    this.lastEdit = Date.now();

    if (!this.messageId) {
      // Send initial message
      const sent = await bot.api.sendMessage(chatId, this.buffer);
      this.messageId = sent.message_id;
    } else {
      // Edit existing message
      await bot.api.editMessageText(chatId, this.messageId, this.buffer)
        .catch(() => {}); // Ignore "message not modified" errors
    }
  }

  async finalize(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    await this.flush();
  }
}
```

### Anti-Patterns to Avoid
- **Direct WebSocket references in Telegram code:** Never pass a WebSocket object to Telegram handlers. Use the Transport abstraction.
- **Editing Telegram messages on every delta:** Telegram rate limits message edits. Throttle to max 1 edit per 2 seconds.
- **Storing Telegram bot token in config.json:** Store the bot token in the encrypted credential vault (already exists at `@agentspace/core` crypto module), not in plaintext config.
- **Using MarkdownV2 for Telegram formatting:** MarkdownV2 requires escaping 18+ special characters. Use HTML parse mode instead.
- **Running webhooks locally without public URL:** Use long polling for local development. Only switch to webhooks if deploying to a cloud server.
- **Blocking grammY middleware on LLM streaming:** grammY middleware should dispatch to the gateway and return quickly. Streaming happens asynchronously via the transport.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Telegram Bot API client | Custom HTTP client | grammY `Bot` class | API surface is massive (100+ methods), handles rate limiting, retries, type safety |
| Inline keyboards | Custom JSON construction | grammY `InlineKeyboard` | Builder pattern handles row layout, button types, callback data encoding |
| Telegram message formatting | Custom markdown escaper | HTML parse_mode + simple `escapeHtml()` | MarkdownV2 escaping is notoriously error-prone. HTML is straightforward |
| Telegram update polling | Custom long-poll loop | grammY `bot.start()` | Handles backoff, error recovery, update offsets, graceful shutdown |
| Callback query routing | Custom regex/switch dispatcher | grammY `bot.callbackQuery()` with regex | Built-in pattern matching, automatic `answerCallbackQuery` reminders |

**Key insight:** grammY handles all Telegram API complexity. The real engineering work is bridging grammY's event model to the existing gateway handler infrastructure, not reimplementing Telegram protocol handling.

## Common Pitfalls

### Pitfall 1: Telegram Rate Limits on Message Editing
**What goes wrong:** Editing a message on every streaming delta hits Telegram's rate limits (roughly 30 messages/second per chat, but edits are throttled more aggressively). Bot gets 429 Too Many Requests errors.
**Why it happens:** WebSocket streaming sends dozens of deltas per second. Naively mirroring this to Telegram edits overwhelms the API.
**How to avoid:** Accumulate deltas in a buffer. Flush to Telegram at most once per 2-3 seconds. On `chat.stream.end`, do a final flush with the complete response.
**Warning signs:** 429 error responses from Telegram API. Messages appearing incomplete.

### Pitfall 2: grammY Callback Query Timeout
**What goes wrong:** If `answerCallbackQuery()` is not called within ~30 seconds of a button press, the Telegram client shows a loading spinner that persists for up to 1 minute.
**Why it happens:** Forgetting to call `answerCallbackQuery()` in the callback handler, or an error occurring before the call.
**How to avoid:** Always call `ctx.answerCallbackQuery()` in every callback handler, including error paths. Add a catch-all `bot.on("callback_query:data")` handler at the end.
**Warning signs:** Users reporting "loading forever" when pressing buttons.

### Pitfall 3: ConnectionState Lifecycle Mismatch
**What goes wrong:** WebSocket connections have clear open/close lifecycle events. Telegram chats are persistent -- there is no "connection close." If ConnectionState cleanup depends on socket close events, Telegram connections leak state.
**Why it happens:** ConnectionState was designed for ephemeral WebSocket connections.
**How to avoid:** Use a `Map<string, ConnectionState>` keyed by transport ID instead of `WeakMap<WebSocket, ConnectionState>`. For Telegram, state persists across messages in the same chat. Implement explicit cleanup on bot stop or inactivity timeout.
**Warning signs:** Memory growth over time. Stale approval promises that never resolve.

### Pitfall 4: Concurrent Messages from Same Telegram Chat
**What goes wrong:** User sends a second message while the first is still streaming. The gateway's `connState.streaming` guard rejects it, but the Telegram error message may be confusing.
**Why it happens:** WebSocket clients can show the streaming state in the UI. Telegram users have no visual indicator that a response is still being generated.
**How to avoid:** Send a clear "Still processing your previous message..." reply when a user messages during an active stream. Use Telegram's `sendChatAction("typing")` to indicate the bot is working.
**Warning signs:** Users complaining about "ignored" messages.

### Pitfall 5: Pairing Code Brute-Force
**What goes wrong:** Short pairing codes (4 chars) can be brute-forced if there is no rate limiting.
**Why it happens:** Inadequate protection on the pairing verification endpoint.
**How to avoid:** Use 6+ alphanumeric characters (36^6 = 2.18 billion combinations). Expire codes after 1 hour. Rate-limit pairing attempts to 5 per minute per Telegram chat ID. Delete codes after use.
**Warning signs:** Logs showing many failed pairing attempts from the same chat.

### Pitfall 6: Bot Token Exposure
**What goes wrong:** Bot token stored in plaintext config file gets committed to git or exposed.
**Why it happens:** Treating the bot token like regular config instead of a secret.
**How to avoid:** Store the bot token in the encrypted credential vault (same as API keys). Load from vault at bot startup. Never log the full token.
**Warning signs:** Token visible in `config.json`, environment variables, or log output.

## Code Examples

### Basic grammY Bot Setup with Fastify Webhook
```typescript
// Source: https://grammy.dev/guide/deployment-types
import { Bot, webhookCallback } from "grammy";
import Fastify from "fastify";

const bot = new Bot("BOT_TOKEN");

bot.command("start", (ctx) => ctx.reply("Welcome!"));
bot.on("message:text", (ctx) => ctx.reply("Echo: " + ctx.message.text));

// Option 1: Long polling (recommended for local development)
bot.start();

// Option 2: Fastify webhook (for production/cloud deployment)
const app = Fastify();
app.post(`/${bot.token}`, webhookCallback(bot, "fastify"));
app.listen({ port: 3000 });
```

### Inline Keyboard with Callback Handling
```typescript
// Source: https://grammy.dev/plugins/keyboard
import { Bot, InlineKeyboard } from "grammy";

const bot = new Bot("TOKEN");

// Build keyboard
const keyboard = new InlineKeyboard()
  .text("Approve", "approve:abc123")
  .text("Deny", "deny:abc123");

// Send message with keyboard
await bot.api.sendMessage(chatId, "Approve this action?", {
  reply_markup: keyboard,
});

// Handle callbacks with regex
bot.callbackQuery(/^(approve|deny):(.+)$/, async (ctx) => {
  const [_, action, id] = ctx.match!;
  await ctx.answerCallbackQuery({ text: `${action}d!` });
  await ctx.editMessageText(`Action ${action}d.`);
});

// Catch-all for unhandled callbacks (important!)
bot.on("callback_query:data", async (ctx) => {
  await ctx.answerCallbackQuery();
});
```

### HTML Message Formatting for Telegram
```typescript
// Telegram HTML parse_mode supports: <b>, <i>, <u>, <s>, <code>, <pre>, <a>
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatAgentResponse(text: string): string {
  // Convert markdown-style formatting to HTML
  // Bold: **text** -> <b>text</b>
  // Code: `text` -> <code>text</code>
  // Code block: ```text``` -> <pre>text</pre>
  // Links: [text](url) -> <a href="url">text</a>
  // Strip unsupported markdown artifacts
  return text
    .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre>$2</pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*]+)\*/g, '<i>$1</i>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}
```

### Telegram Chat Action (Typing Indicator)
```typescript
// Source: https://grammy.dev/guide/
// Show "typing..." indicator while processing
async function showTypingWhileProcessing(
  bot: Bot,
  chatId: number,
  processFn: () => Promise<void>,
): Promise<void> {
  const interval = setInterval(() => {
    bot.api.sendChatAction(chatId, "typing").catch(() => {});
  }, 4000); // Telegram typing indicator lasts 5 seconds

  try {
    await processFn();
  } finally {
    clearInterval(interval);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Telegraf library | grammY | 2021+ | grammY is TypeScript-first, better maintained, richer plugin ecosystem |
| Markdown parse_mode | HTML or MarkdownV2 | Telegram Bot API 4.5+ | Original Markdown is deprecated. HTML is safest; MarkdownV2 needs heavy escaping |
| Custom long-polling | grammY built-in `bot.start()` | Always current | grammY handles offset tracking, error recovery, backoff |
| Direct `fetch()` to Bot API | grammY `bot.api.*` | Always current | Type-safe, auto-serialization, file upload handling |

**Deprecated/outdated:**
- **Telegraf:** Less maintained predecessor. Do not use.
- **Markdown parse_mode (v1):** Telegram deprecated original Markdown in favor of MarkdownV2 and HTML. Use HTML.
- **Custom webhook URL validation:** grammY handles webhook setup including secret token validation.

## Open Questions

1. **Where to run the bot process?**
   - What we know: The gateway already runs as a Fastify server. grammY can run as long polling in the same process or as a Fastify webhook route.
   - What's unclear: Should the Telegram bot run in the same process as the gateway (simpler) or as a separate process (better isolation)?
   - Recommendation: Run in the same process. Register grammY long polling alongside the Fastify server. The bot is lightweight and shares the same session/handler infrastructure. Separate process adds IPC complexity with no benefit for a single-user system.

2. **Transport abstraction scope**
   - What we know: Handlers currently accept `WebSocket` directly. Refactoring to `Transport` touches all handler signatures.
   - What's unclear: How much refactoring is acceptable in this phase?
   - Recommendation: Refactor is necessary and mechanical. Every `send(socket, msg)` becomes `transport.send(msg)`. The `ConnectionState` map changes key type. This is a prerequisite for Telegram and any future channel. Do it in this phase.

3. **Session unification across channels**
   - What we know: TELE-02 requires the same session management as CLI. Sessions are currently keyed by `nanoid` and created per-connection.
   - What's unclear: Should a Telegram user share a session with their CLI session, or get a separate session per channel?
   - Recommendation: Create separate sessions per channel but allow the user to reference the same session ID from either channel. The pairing links the Telegram user to the AgentSpace identity, and sessions already have `sessionKey` format `agent:{agentId}:{id}`. The Telegram adapter can look up or create sessions using the same `SessionManager`.

4. **Telegram message length limits**
   - What we know: Telegram messages are limited to 4096 characters. Agent responses can be much longer.
   - What's unclear: How to handle overflow.
   - Recommendation: Split long messages at paragraph boundaries. Send as multiple messages. Include "continued..." indicator.

## Sources

### Primary (HIGH confidence)
- [grammY Official Documentation](https://grammy.dev/guide/) - Bot setup, middleware, deployment types
- [grammY Keyboard Plugin](https://grammy.dev/plugins/keyboard) - InlineKeyboard API, callback queries
- [grammY Deployment Types](https://grammy.dev/guide/deployment-types) - Long polling vs webhooks, Fastify integration
- [grammY npm](https://www.npmjs.com/package/grammy) - Version 1.40.0 confirmed current
- [Telegram Bot API](https://core.telegram.org/bots/api) - Message formatting, parse_mode, entity support

### Secondary (MEDIUM confidence)
- [grammY GitHub](https://github.com/grammyjs/grammY) - Source code, examples repository
- [grammY webhookCallback reference](https://grammy.dev/ref/core/webhookcallback) - Fastify adapter details

### Tertiary (LOW confidence)
- Pairing code authentication pattern observed in OpenClaw docs - pattern is sound but implementation details are project-specific

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - grammY is the locked decision from prior research. Version 1.40.0 confirmed on npm.
- Architecture: HIGH - Transport abstraction pattern is well-understood. The existing codebase structure is clear from reading the source.
- Pitfalls: HIGH - Telegram rate limits, callback query timeouts, and message length limits are well-documented by Telegram and grammY docs.

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (grammY is stable; Telegram Bot API changes are infrequent)
