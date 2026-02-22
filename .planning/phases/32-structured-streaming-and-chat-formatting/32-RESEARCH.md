# Phase 32: Structured Streaming and Chat Formatting - Research

**Researched:** 2026-02-21
**Domain:** WebSocket streaming protocol, markdown rendering, reasoning blocks, system prompt formatting
**Confidence:** HIGH

## Summary

Phase 32 transforms Tek's streaming pipeline from raw text deltas into a structured JSON protocol that carries typed content blocks (text, reasoning, code, tool calls, sources) from the gateway to both CLI and desktop clients. Today the gateway has two streaming paths: `stream.ts` uses `result.textStream` (text-only, no reasoning/sources), and `tool-loop.ts` uses `result.fullStream` (captures tool calls but ignores reasoning and source parts). Neither path emits structured content types to clients -- everything arrives as flat `chat.stream.delta` strings.

The core work is: (1) extend the gateway to capture and relay reasoning blocks, sources, and content type information from the AI SDK's `fullStream`; (2) extend the WebSocket protocol with new structured message types; (3) update both CLI and desktop clients to render these structured parts with appropriate formatting; and (4) add a base system prompt that instructs agents to use markdown formatting for clean presentation.

**Primary recommendation:** Extend the existing `chat.stream.delta` protocol with new message types (`chat.stream.reasoning`, `chat.stream.source`) and add a `contentType` field to deltas, rather than replacing the entire protocol. Both CLI (marked + shiki) and desktop (Streamdown + @streamdown/code) already have solid markdown/code rendering -- this phase layers structured awareness on top.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ai | ^6.0.86 | AI SDK - streamText, fullStream | Already in use; provides reasoning, source, tool-call stream parts |
| streamdown | ^2.1.0 | Desktop streaming markdown | Already in use; handles partial markdown gracefully during streaming |
| @streamdown/code | ^1.0.3 | Desktop code block syntax highlighting | Already in use; Shiki-based code highlighting in React |
| marked | ^15.0.12 | CLI markdown parsing | Already in use for completed messages |
| marked-terminal | ^7.3.0 | CLI markdown-to-terminal rendering | Already in use with shiki integration |
| shiki | ^3.22.0 | CLI code syntax highlighting | Already in use; synchronous ANSI highlighting |
| zod | (workspace) | Protocol schema validation | Already used for all WS protocol messages |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @streamdown/math | latest | LaTeX/KaTeX rendering in desktop | If math expressions needed in responses |
| @streamdown/mermaid | latest | Diagram rendering in desktop | If diagram support requested |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Streamdown (desktop) | react-markdown + rehype | Streamdown handles streaming natively; react-markdown needs manual buffering |
| marked-terminal (CLI) | Streamdown terminal mode | Streamdown is React/browser only; CLI needs Ink/terminal output |
| New protocol message types | SSE data stream protocol | SSE would require transport rewrite; current WS protocol is working well |

**Installation:**
No new packages needed. All rendering libraries are already installed.

## Architecture Patterns

### Recommended Project Structure
```
packages/gateway/src/
├── llm/
│   ├── stream.ts          # MODIFY: use fullStream instead of textStream
│   └── types.ts           # MODIFY: add StreamReasoning, StreamSource chunk types
├── ws/
│   ├── protocol.ts        # MODIFY: add new server message schemas
│   └── handlers.ts        # MODIFY: relay reasoning/source events to transport
├── context/
│   └── assembler.ts       # MODIFY: inject formatting system prompt
│
packages/cli/src/
├── components/
│   ├── StreamingResponse.tsx  # MODIFY: handle structured content types
│   ├── ReasoningBlock.tsx     # NEW: collapsible reasoning display
│   └── MessageBubble.tsx      # MODIFY: render reasoning messages
├── hooks/
│   └── useChat.ts             # MODIFY: handle new message types
│
apps/desktop/src/
├── components/
│   ├── StreamingMessage.tsx   # MODIFY: handle reasoning blocks
│   ├── ReasoningBlock.tsx     # NEW: collapsible reasoning in desktop
│   └── MessageCard.tsx        # MODIFY: render reasoning in history
├── hooks/
│   └── useChat.ts             # MODIFY: handle new message types
├── lib/
│   └── gateway-client.ts      # MODIFY: add new server message types
```

### Pattern 1: Structured Stream Delta Protocol
**What:** Extend the `chat.stream.delta` with a `contentType` discriminator, and add sibling message types for reasoning and sources.
**When to use:** When the gateway receives non-text content from `fullStream`.
**Example:**
```typescript
// Current: flat text delta
{ type: "chat.stream.delta", requestId: "...", delta: "Hello world" }

// New: typed content deltas
{ type: "chat.stream.delta", requestId: "...", delta: "Hello world", contentType: "text" }
{ type: "chat.stream.reasoning", requestId: "...", delta: "Let me think about this..." }
{ type: "chat.stream.source", requestId: "...", source: { url: "...", title: "..." } }
```

### Pattern 2: fullStream Consumption in Gateway
**What:** Replace `textStream` with `fullStream` in `stream.ts` and capture reasoning/source events alongside text deltas.
**When to use:** For all LLM streaming (both simple and tool-loop paths).
**Example:**
```typescript
// Source: AI SDK docs - fullStream
for await (const part of result.fullStream) {
  switch (part.type) {
    case "text-delta":
      transport.send({
        type: "chat.stream.delta",
        requestId,
        delta: part.text,
        contentType: "text",
      });
      break;
    case "reasoning":
      transport.send({
        type: "chat.stream.reasoning",
        requestId,
        delta: part.text,
      });
      break;
    case "source":
      transport.send({
        type: "chat.stream.source",
        requestId,
        source: { url: part.url, title: part.title },
      });
      break;
    // tool-call, tool-result already handled in tool-loop.ts
  }
}
```

### Pattern 3: Enable Reasoning for Anthropic Models
**What:** Pass `providerOptions.anthropic.thinking` configuration when using Claude models that support it.
**When to use:** When model is claude-opus-4, claude-sonnet-4, or claude-3.7-sonnet.
**Example:**
```typescript
// Source: AI SDK Anthropic provider docs
const providerOptions = model.startsWith("anthropic:claude-opus-4") ||
  model.startsWith("anthropic:claude-sonnet-4") ||
  model.startsWith("anthropic:claude-3-7-sonnet")
  ? { anthropic: { thinking: { type: "enabled", budgetTokens: 10000 } } }
  : undefined;

const result = streamText({
  model: languageModel,
  messages,
  system,
  providerOptions,
});
```

### Pattern 4: Base System Prompt for Response Formatting
**What:** Inject a formatting instruction section into every assembled context.
**When to use:** Always -- appended to the system prompt in the context assembler.
**Example:**
```typescript
// Append to system prompt in assembler.ts
const RESPONSE_FORMAT_PROMPT = `
## Response Formatting

When responding, follow these formatting guidelines:
- Use **markdown** for structured responses: headings, lists, bold, italic
- Use fenced code blocks with language identifiers for code:
  \`\`\`typescript
  const x = 1;
  \`\`\`
- Keep code blocks focused and concise
- Use inline \`code\` for variable names, file paths, and short code references
- Use bullet points or numbered lists for multi-step instructions
- Use > blockquotes for important callouts or warnings
- Do NOT wrap entire responses in code blocks
- Do NOT use markdown when a simple conversational reply suffices
`;
```

### Anti-Patterns to Avoid
- **Bundling reasoning into text deltas:** Reasoning should be a separate stream type so clients can render it differently (collapsible, dimmed, italic). Do NOT mix reasoning into the `chat.stream.delta` text.
- **Breaking backward compatibility:** The `contentType` field on `chat.stream.delta` should be optional, defaulting to `"text"`. Older clients that don't check it will still work.
- **Over-formatting system prompts:** The formatting prompt should be brief and guide, not dictate. Overly prescriptive formatting instructions cause models to produce stilted, unnatural responses.
- **Client-side markdown parsing during streaming (CLI):** The CLI currently shows plain text while streaming and renders markdown only for completed messages. This is intentional -- partial markdown causes artifacts. Keep this pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Streaming markdown rendering (desktop) | Custom incremental parser | Streamdown ^2.1.0 | Handles unterminated blocks, partial syntax, token-by-token gracefully |
| Code syntax highlighting (desktop) | Custom highlighter | @streamdown/code (Shiki) | Production-grade, 100+ languages, themes |
| Code syntax highlighting (CLI) | Custom ANSI coloring | shiki ^3.22.0 (already in codeToAnsiSync) | TextMate grammars, proper token classification |
| Markdown-to-terminal (CLI) | Custom terminal renderer | marked + marked-terminal | Handles tables, lists, links, emphasis properly |
| Protocol validation | Manual JSON parsing | Zod discriminated unions | Type-safe, automatic validation, already the pattern |
| Reasoning stream extraction | Regex/string parsing | AI SDK fullStream `reasoning` part type | SDK handles provider-specific formats natively |

**Key insight:** All rendering infrastructure is already in place. This phase is about connecting the gateway's streaming to clients with proper content typing, NOT building new renderers.

## Common Pitfalls

### Pitfall 1: Reasoning Not Available on All Providers
**What goes wrong:** Enabling reasoning options for non-Anthropic models causes errors or silent failures.
**Why it happens:** Only Claude Opus 4, Sonnet 4, and Claude 3.7 Sonnet support extended thinking via the `providerOptions.anthropic.thinking` setting.
**How to avoid:** Check the model identifier before applying provider options. Only Anthropic models starting with specific prefixes should get thinking enabled. Other providers (OpenAI, Ollama, Google) may have their own reasoning mechanisms or none at all.
**Warning signs:** Errors during stream initialization, missing reasoning content when expected.

### Pitfall 2: Protocol Backward Compatibility
**What goes wrong:** Adding required fields to existing message types breaks older clients.
**Why it happens:** CLI and desktop parse `ServerMessage` -- if new required fields are added, older client builds will fail.
**How to avoid:** All new fields must be optional. New message types (like `chat.stream.reasoning`) should be handled via fallthrough in client switch statements. Desktop `gateway-client.ts` must add the new types to its local `ServerMessage` union.
**Warning signs:** TypeScript compilation errors in desktop app, unhandled message types.

### Pitfall 3: stream.ts vs tool-loop.ts Divergence
**What goes wrong:** The two streaming paths emit different message types/structures to clients, causing inconsistent UX.
**Why it happens:** `stream.ts` (simple streaming) and `tool-loop.ts` (agent with tools) are separate code paths that evolved independently. Currently `stream.ts` uses `textStream` while `tool-loop.ts` uses `fullStream`.
**How to avoid:** Either unify into a single streaming function or ensure both paths emit identical structured message types. Consider refactoring `stream.ts` to use `fullStream` so reasoning and sources work even without tools.
**Warning signs:** Reasoning blocks appear in agent-loop responses but not in simple chat responses.

### Pitfall 4: CLI Streaming Partial Markdown
**What goes wrong:** Attempting to render markdown on incomplete streaming text produces visual artifacts (unclosed bold, partial code blocks).
**Why it happens:** Markdown parsers expect complete syntax. Token-by-token streaming means syntax is regularly incomplete.
**How to avoid:** Keep the current CLI pattern: show plain text during streaming, render full markdown only after stream completes. Desktop Streamdown handles this natively.
**Warning signs:** Flickering, broken formatting, unclosed emphasis tags in CLI during streaming.

### Pitfall 5: Reasoning Token Budget Cost
**What goes wrong:** Enabling reasoning with high token budgets dramatically increases response costs and latency.
**Why it happens:** Reasoning tokens are billed at a higher rate by Anthropic, and the model may use the full budget.
**How to avoid:** Start with a modest budget (5000-10000 tokens). Make reasoning opt-in via configuration, not always-on. Track reasoning token usage separately in the cost reporting.
**Warning signs:** Unexpectedly high costs, slow first-token latency on Claude models.

## Code Examples

Verified patterns from official sources and codebase analysis:

### Extending the Protocol (protocol.ts)
```typescript
// New server message schemas to add to protocol.ts

const ChatStreamReasoningSchema = z.object({
  type: z.literal("chat.stream.reasoning"),
  requestId: z.string(),
  delta: z.string(),
});

const ChatStreamSourceSchema = z.object({
  type: z.literal("chat.stream.source"),
  requestId: z.string(),
  source: z.object({
    url: z.string(),
    title: z.string().optional(),
  }),
});

// Add contentType to existing ChatStreamDelta (optional for backward compat)
const ChatStreamDeltaSchema = z.object({
  type: z.literal("chat.stream.delta"),
  requestId: z.string(),
  delta: z.string(),
  contentType: z.enum(["text", "code"]).optional(), // defaults to "text"
});
```

### Refactoring stream.ts to fullStream
```typescript
// Replace textStream with fullStream for structured part handling
export async function* streamChatResponse(
  model: string,
  messages: ModelMessage[],
  system?: string,
): AsyncGenerator<StreamChunk> {
  const registry = getRegistry();
  const languageModel = registry.languageModel(model as never);

  // Conditionally enable reasoning for supported models
  const providerOptions = getReasoningOptions(model);

  const result = streamText({
    model: languageModel,
    messages,
    system,
    ...(providerOptions ? { providerOptions } : {}),
  });

  for await (const part of result.fullStream) {
    switch (part.type) {
      case "text-delta":
        yield { type: "delta", text: part.text };
        break;
      case "reasoning":
        yield { type: "reasoning", text: part.text };
        break;
      case "source":
        yield { type: "source", url: part.url, title: part.title };
        break;
      case "finish":
        // Extract usage from finish event
        break;
    }
  }

  const usage = await result.usage;
  yield {
    type: "done",
    usage: {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      totalTokens: usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
    },
  };
}
```

### Desktop Reasoning Block Component
```typescript
// apps/desktop/src/components/ReasoningBlock.tsx
import { useState } from "react";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";

interface ReasoningBlockProps {
  content: string;
  defaultExpanded?: boolean;
}

export function ReasoningBlock({ content, defaultExpanded = false }: ReasoningBlockProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="my-1 rounded border border-muted bg-muted/20">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground"
      >
        <Brain className="size-3" />
        <span>Reasoning</span>
        {expanded ? <ChevronDown className="ml-auto size-3" /> : <ChevronRight className="ml-auto size-3" />}
      </button>
      {expanded && (
        <div className="border-t border-muted px-3 py-2">
          <p className="whitespace-pre-wrap text-xs italic text-muted-foreground">
            {content}
          </p>
        </div>
      )}
    </div>
  );
}
```

### CLI Reasoning Display (Ink)
```typescript
// packages/cli/src/components/ReasoningBlock.tsx
import React from "react";
import { Box, Text } from "ink";

interface ReasoningBlockProps {
  content: string;
}

export function ReasoningBlock({ content }: ReasoningBlockProps) {
  const preview = content.length > 120
    ? content.slice(0, 117) + "..."
    : content;

  return (
    <Box>
      <Text dimColor italic>{"~ "}{preview}</Text>
    </Box>
  );
}
```

### Base Formatting System Prompt
```typescript
// Injected at the end of the system prompt in assembler.ts
const RESPONSE_FORMAT_PROMPT = [
  "",
  "## Response Formatting",
  "",
  "Format your responses for readability:",
  "- Use **markdown** for structured content: headings, lists, emphasis",
  "- Use fenced code blocks (```language) with the language identifier",
  "- Use inline `code` for names, paths, commands, and short references",
  "- Use numbered lists for sequential steps",
  "- Use > blockquotes for important notes or warnings",
  "- Keep responses conversational when a simple reply suffices",
  "- Do NOT wrap entire responses in a single code block",
].join("\n");
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `textStream` only | `fullStream` with typed parts | AI SDK 4+ (2025) | Enables reasoning, sources, structured tool calls |
| react-markdown for streaming | Streamdown | 2025 | Native streaming support, no partial-parse artifacts |
| No reasoning/thinking support | Extended thinking via providerOptions | AI SDK 4.2+ (2025) | Claude reasoning blocks stream alongside text |
| Flat text protocol | Typed content stream parts | Current best practice | Clients can render content-type-aware UX |

**Deprecated/outdated:**
- `textStream` for anything beyond simple chat: use `fullStream` to capture all content types
- Building custom streaming markdown parsers: Streamdown handles this natively

## Open Questions

1. **Reasoning Token Budget Configuration**
   - What we know: Anthropic models support `budgetTokens` for thinking. Cost implications are significant.
   - What's unclear: Should the reasoning budget be configurable per-agent, per-request, or global? Should it be enabled by default or opt-in?
   - Recommendation: Start with a global config option (`reasoning.enabled`, `reasoning.budgetTokens`) in the Tek config, default to disabled. Can be enhanced later with per-agent overrides.

2. **OpenAI and Google Reasoning Support**
   - What we know: OpenAI o1/o3 models have internal reasoning. Google Gemini 2.0 has thinking.
   - What's unclear: How the AI SDK surfaces reasoning from non-Anthropic providers via fullStream. The `reasoning` part type may be provider-specific.
   - Recommendation: Implement for Anthropic first (best documented). Handle reasoning parts generically so other providers work automatically if/when the AI SDK normalizes them.

3. **Source Attribution Display**
   - What we know: Some providers (Perplexity, Google) emit `source` parts with URLs. The AI SDK relays these in fullStream.
   - What's unclear: How often sources appear in Tek's typical usage patterns. Whether the UX investment is worthwhile now.
   - Recommendation: Add protocol support for sources now (cheap), but defer elaborate source rendering UI until proven useful. A simple footnote-style display is sufficient.

4. **Streaming vs Completed Rendering in CLI**
   - What we know: CLI currently shows plain text during streaming and full markdown after completion. This avoids partial-parse artifacts.
   - What's unclear: Whether reasoning blocks should appear during streaming or only after completion in CLI.
   - Recommendation: Show reasoning blocks during streaming in CLI as dimmed italic text (same as current `reasoning` message type in MessageBubble). They are standalone content, not partial markdown.

## Sources

### Primary (HIGH confidence)
- AI SDK docs: `streamText` reference (https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text) - fullStream parts, reasoning, sources
- AI SDK docs: Anthropic provider (https://ai-sdk.dev/providers/ai-sdk-providers/anthropic) - thinking configuration, reasoning support
- AI SDK docs: Claude 4 guide (https://ai-sdk.dev/cookbook/guides/claude-4) - extended thinking setup, interleaved thinking
- Streamdown docs (https://streamdown.ai/docs) - plugins, streaming markdown rendering
- Codebase: `packages/gateway/src/ws/protocol.ts` - current WS protocol schema
- Codebase: `packages/gateway/src/llm/stream.ts` - current textStream-only implementation
- Codebase: `packages/gateway/src/agent/tool-loop.ts` - fullStream usage with tool calls
- Codebase: `packages/gateway/src/context/assembler.ts` - system prompt assembly

### Secondary (MEDIUM confidence)
- AI SDK blog: AI SDK 6 announcement (https://vercel.com/blog/ai-sdk-6) - structured streaming architecture
- Streamdown GitHub (https://github.com/vercel/streamdown) - plugins, features, version info
- Markdown formatting for LLM prompts research (https://arxiv.org/html/2411.10541v1) - formatting impact on LLM performance

### Tertiary (LOW confidence)
- OpenAI/Google reasoning normalization in AI SDK - assumed based on SDK architecture, not verified with current docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new deps needed
- Architecture: HIGH - clear pattern: extend protocol, update gateway streaming, update clients
- Pitfalls: HIGH - based on direct codebase analysis of existing streaming paths
- System prompt formatting: MEDIUM - best practices are well-documented but optimal prompt wording requires iteration

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (stable domain, libraries already locked)
