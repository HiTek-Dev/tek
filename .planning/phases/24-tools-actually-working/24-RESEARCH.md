# Phase 24: Tools Actually Working - Research

**Researched:** 2026-02-20
**Domain:** Agent tool loop reliability (workspace creation, session history, error recovery)
**Confidence:** HIGH

## Summary

Phase 24 addresses three distinct root causes that prevent agent tools from working in production. All three are bugs in existing code rather than new features, and the fixes are straightforward once the root causes are understood.

**Root Cause 1 - Workspace directory never created:** The config stores a `workspaceDir` path (set during onboarding), but no code ever calls `mkdir` to ensure it exists. When the agent tries to write a file, `fs.writeFile` throws ENOENT because the target directory doesn't exist. Additionally, `write_file` doesn't create parent directories within the workspace.

**Root Cause 2 - Agent loop doesn't save assistant responses to session history:** The `streamToClient` helper (text-only path) calls `sessionManager.addMessage(sessionId, "assistant", fullResponse)` after streaming completes. But the agent tool loop path (`runAgentLoop`) never saves the assistant response back to the session. On the next user message, `assembleContext` rebuilds the message array from `sessionManager.getMessages()`, which is missing the assistant's prior response. The LLM sees `[user, user, user, ...]` instead of `[user, assistant, user, assistant, ...]`, causing it to re-introduce itself every turn.

**Root Cause 3 - Tool failures can cause silent agent:** When all tool calls fail, the agent may produce no text content, and the `onUsage` callback fires `chat.stream.end` but the client never receives any `chat.stream.delta` events. The user sees an empty response. The agent loop also catches errors and sends an `error` protocol message, but doesn't guarantee a user-visible text explanation is sent as a stream delta before ending.

**Primary recommendation:** Fix all three in targeted, testable patches: (1) ensure workspace directory exists at tool registry build time and before write_file, (2) collect text from the agent loop and call `sessionManager.addMessage` after completion, (3) guarantee a fallback text response when the agent produces no text deltas.

## Standard Stack

### Core

This phase uses only Node.js built-in APIs and the existing AI SDK. No new libraries needed.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:fs/promises` | Node built-in | `mkdir` with `recursive: true` | Standard for directory creation |
| `ai` | ^6.0.86 | `streamText` result provides `.text` PromiseLike | Already in use; provides aggregated text after stream |

### Supporting

No additional libraries needed. All fixes use existing dependencies.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `mkdir -p` via shell | `fs.mkdir({recursive: true})` | Use Node API directly; no shell dependency needed |
| Collecting text manually via `text-delta` events | `result.text` from AI SDK | AI SDK already aggregates text across all steps; use it |

## Architecture Patterns

### Pattern 1: Workspace Directory Ensurance

**What:** Ensure the workspace directory exists before any tool tries to use it.
**When to use:** At tool registry build time (once per connection) and before each write_file call.
**Confidence:** HIGH (verified from codebase analysis)

Two-layer approach:
1. **Eager:** In `buildToolRegistry` or `handleChatSend`, call `mkdir(workspaceDir, { recursive: true })` before tools are created. This handles the common case.
2. **Defensive:** In `write_file`'s execute, call `mkdir(dirname(path), { recursive: true })` before `writeFile`. This handles subdirectory creation within the workspace.

```typescript
// In filesystem.ts write_file execute:
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

execute: async ({ path: rawPath, content }) => {
  const path = resolveAgentPath(rawPath, workspaceDir);
  checkWorkspace(path, securityMode, workspaceDir);
  await mkdir(dirname(path), { recursive: true }); // Ensure parent dirs exist
  await writeFile(path, content, "utf-8");
  return `Wrote ${Buffer.byteLength(content, "utf-8")} bytes to ${path}`;
},
```

### Pattern 2: Agent Loop Session History Persistence

**What:** Collect the full text response from the agent loop and save it to session history.
**When to use:** After `runAgentLoop` completes in `handleChatSend`.
**Confidence:** HIGH (verified gap in code)

The AI SDK `streamText` result has a `.text` property (PromiseLike) that resolves to the full concatenated text from all steps. The `runAgentLoop` function should either:
- (A) Accept a callback/return value to pass the collected text back to the handler, OR
- (B) Accept `sessionId` and call `sessionManager.addMessage` internally.

Option A is cleaner (tool-loop stays focused on streaming, handler owns persistence):

```typescript
// In tool-loop.ts, collect text from deltas and return/expose it:
let fullText = "";
// ... in text-delta case:
fullText += part.text;
// ... after stream completes, return fullText or call a callback

// In handlers.ts, after runAgentLoop completes:
sessionManager.addMessage(sessionId, "assistant", fullText);
```

Option B (simpler, but couples tool-loop to session):

```typescript
// In runAgentLoop, after the fullStream loop:
const finalText = await result.text;
if (finalText) {
  // sessionManager.addMessage called here
}
```

**Recommendation:** Use Option A. Have `runAgentLoop` return the collected text. The handler already owns session management (it calls `addMessage` for user messages and does so for the text-only path). Keeping this consistent is better.

### Pattern 3: Guaranteed Fallback Text on Total Tool Failure

**What:** When the agent loop completes with zero text deltas sent, send a fallback message explaining what happened.
**When to use:** After the fullStream iteration completes in `runAgentLoop` or in the handler after `runAgentLoop` returns.
**Confidence:** HIGH

```typescript
// After agent loop completes:
if (!fullText || fullText.trim().length === 0) {
  const fallbackMsg = "I attempted to use tools to help with your request, but encountered errors. Could you try rephrasing or providing more details?";
  transport.send({
    type: "chat.stream.delta",
    requestId,
    delta: fallbackMsg,
  });
  fullText = fallbackMsg;
}
```

### Anti-Patterns to Avoid

- **Creating workspace in onboarding only:** The onboarding flow saves `workspaceDir` to config but doesn't `mkdir` it. Even if we add `mkdir` to onboarding, users may delete the directory or the config could point to a non-existent path. Always verify at runtime.
- **Saving tool call/result messages to session as structured data:** The session store uses a simple `(role, content)` schema. Don't try to serialize tool calls into structured format. Save only the final text response as the assistant message. The LLM's tool calls are ephemeral to that request.
- **Swallowing empty responses silently:** The current code sends `chat.stream.end` even when no deltas were sent. This makes the client think the response is complete, but the user sees nothing.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recursive directory creation | Manual path traversal | `fs.mkdir(path, { recursive: true })` | Handles race conditions, already exists, nested paths |
| Aggregating text from stream | Manual concatenation across steps | `result.text` from AI SDK streamText | AI SDK already tracks this across multi-step tool loops |

**Key insight:** Node.js `mkdir` with `recursive: true` is idempotent and handles the "already exists" case. AI SDK's `result.text` handles multi-step aggregation automatically.

## Common Pitfalls

### Pitfall 1: Race condition on workspace mkdir
**What goes wrong:** Two concurrent requests both try to create the workspace directory.
**Why it happens:** Multiple chat messages arrive before the first mkdir completes.
**How to avoid:** `mkdir({ recursive: true })` is idempotent; calling it multiple times is safe. No locking needed.
**Warning signs:** EEXIST errors in logs (but `recursive: true` handles this).

### Pitfall 2: Empty text from agent loop after tool-only steps
**What goes wrong:** The LLM uses tools but produces no text in the final step, so `fullText` is empty.
**Why it happens:** Some LLMs finish with `tool-calls` finish reason and never produce a text step.
**How to avoid:** Check if `fullText` is empty after the stream completes and send a fallback delta.
**Warning signs:** `chat.stream.end` events with no preceding `chat.stream.delta`.

### Pitfall 3: StepResult.text vs accumulated fullText
**What goes wrong:** Using only `onStepFinish` text to accumulate response misses text from the final step.
**Why it happens:** `onStepFinish` fires per-step, but the streaming loop processes all parts including the last step's text.
**How to avoid:** Accumulate via `text-delta` events in the fullStream loop, or use `result.text` which the AI SDK aggregates correctly.
**Warning signs:** Partial or missing assistant responses in session history.

### Pitfall 4: Session addMessage called with tool call JSON
**What goes wrong:** Saving tool call metadata as the assistant message content makes the session history ugly and confuses context assembly.
**Why it happens:** Over-engineering the session persistence to include tool call details.
**How to avoid:** Only save the final text content as the assistant message. Tool calls are ephemeral.
**Warning signs:** Agent messages showing JSON blobs in conversation history.

### Pitfall 5: write_file fails on nested paths within workspace
**What goes wrong:** Agent tries to write `src/utils/helper.ts` but `src/utils/` doesn't exist within the workspace.
**Why it happens:** `writeFile` doesn't create intermediate directories.
**How to avoid:** Call `mkdir(dirname(path), { recursive: true })` before `writeFile` in the write_file tool.
**Warning signs:** ENOENT errors with paths that are within the workspace boundary.

## Code Examples

### Ensuring workspace directory exists (tool-registry.ts or handlers.ts)

```typescript
// Source: Node.js fs.mkdir documentation
import { mkdir } from "node:fs/promises";

// In buildToolRegistry or handleChatSend, before creating tools:
if (workspaceDir) {
  await mkdir(workspaceDir, { recursive: true });
}
```

### write_file with parent directory creation (filesystem.ts)

```typescript
// Source: Codebase analysis of packages/gateway/src/tools/filesystem.ts
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

// In write_file execute, before writeFile:
await mkdir(dirname(path), { recursive: true });
await writeFile(path, content, "utf-8");
```

### Returning collected text from agent loop (tool-loop.ts)

```typescript
// Source: AI SDK v6 streamText API
// In runAgentLoop, modify to return collected text:
export async function runAgentLoop(options: AgentLoopOptions): Promise<string> {
  // ... existing setup ...
  let fullText = "";

  // In text-delta case:
  case "text-delta": {
    fullText += part.text;
    transport.send({ type: "chat.stream.delta", requestId, delta: part.text });
    break;
  }

  // After fullStream loop, before returning:
  return fullText;
}
```

### Saving assistant response in handler (handlers.ts)

```typescript
// Source: Codebase analysis - existing pattern from streamToClient
// In handleChatSend agent loop branch:
const agentResponse = await runAgentLoop({ ... });

// Persist assistant message (matching streamToClient pattern at line 200)
if (agentResponse) {
  sessionManager.addMessage(sessionId, "assistant", agentResponse);
}
```

### Fallback text for empty agent responses

```typescript
// After agent loop completes with empty text:
if (!agentResponse || agentResponse.trim().length === 0) {
  const fallback = "I tried to help with your request but ran into issues with the tools. Could you try rephrasing?";
  transport.send({ type: "chat.stream.delta", requestId: msg.id, delta: fallback });
  sessionManager.addMessage(sessionId, "assistant", fallback);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual text accumulation | AI SDK `result.text` PromiseLike | AI SDK v4+ | Can await full text after stream completes |
| `fs.writeFile` without mkdir | `mkdir({recursive:true})` + writeFile | Always available | Idempotent directory creation |

## Key Code Locations

Files requiring modification:

| File | Root Cause | What to Change |
|------|-----------|----------------|
| `packages/gateway/src/tools/filesystem.ts` | RC1 (workspace dir) | Add `mkdir(dirname(path), { recursive: true })` before `writeFile` in write_file |
| `packages/gateway/src/agent/tool-registry.ts` | RC1 (workspace dir) | Add `mkdir(workspaceDir, { recursive: true })` at start of `buildToolRegistry` |
| `packages/gateway/src/agent/tool-loop.ts` | RC2 (session history), RC3 (silent failure) | Accumulate `fullText` from text-delta events, return it; add fallback text |
| `packages/gateway/src/ws/handlers.ts` | RC2 (session history), RC3 (silent failure) | After `runAgentLoop`, call `sessionManager.addMessage` with returned text; handle empty case |

## Open Questions

1. **Should `runAgentLoop` return the text or accept a callback?**
   - What we know: The function currently returns `Promise<void>`. The handler needs the collected text.
   - What's unclear: Whether changing the return type to `Promise<string>` is cleanest, or if a callback is better.
   - Recommendation: Change return type to `Promise<string>`. It's simpler and the handler already awaits it. The `handlePreflightApproval` handler also calls `runAgentLoop` and would benefit from the same pattern.

2. **Should workspace mkdir happen eagerly (once at tool build) or lazily (per write)?**
   - What we know: Both approaches work. `mkdir({recursive: true})` is idempotent.
   - What's unclear: Performance impact of calling mkdir on every write.
   - Recommendation: Do both. Eager creation in `buildToolRegistry` handles the workspace root. Lazy creation in `write_file` handles subdirectories. The cost of `mkdir({recursive: true})` on an existing directory is negligible.

3. **What should the fallback message say when all tools fail?**
   - What we know: The failure-detector already classifies patterns and sends `failure.detected` messages.
   - What's unclear: Whether the fallback text should include specific error details.
   - Recommendation: Keep it generic but helpful. The tool.error messages already provide specific details to the client. The fallback text is for the conversation flow.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `packages/gateway/src/agent/tool-loop.ts` - no session persistence, no text accumulation
- Codebase analysis: `packages/gateway/src/ws/handlers.ts` lines 200-204 - assistant addMessage only in streamToClient
- Codebase analysis: `packages/gateway/src/tools/filesystem.ts` - no mkdir before writeFile
- Codebase analysis: `packages/gateway/src/agent/tool-registry.ts` - no mkdir for workspaceDir
- AI SDK v6 type definitions: `result.text` is `PromiseLike<string>` available after stream
- Node.js fs documentation: `mkdir({recursive: true})` is idempotent

### Secondary (MEDIUM confidence)
- Phase 23 plan/summary: Prior work on resolveAgentPath and tool-error handling (already merged)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Node.js built-ins only, no new deps
- Architecture: HIGH - All three fixes verified against existing code patterns
- Pitfalls: HIGH - Common Node.js filesystem and async patterns, well understood

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (stable, no external dependency changes expected)
