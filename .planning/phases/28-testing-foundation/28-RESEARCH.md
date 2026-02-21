# Phase 28: Testing Foundation - Research

**Researched:** 2026-02-20
**Domain:** Unit testing critical gateway paths with Vitest + AI SDK mocks
**Confidence:** HIGH

## Summary

Phase 28 adds automated test coverage for six critical subsystems: the WebSocket protocol schema (Zod discriminated unions), the agent tool loop, the LLM router, the config schema, the approval gate, and context assembly. The testing infrastructure (Vitest workspace) was established in Phase 25, and Vitest 4.0.18 is already installed at the root level with workspace-scoped project configs in `packages/core` and `packages/gateway`.

No test files exist yet anywhere in the codebase. The test targets are all pure functions or classes with clear interfaces and minimal side effects, which makes them ideal for unit testing. The most complex target is `runAgentLoop` in `packages/gateway/src/agent/tool-loop.ts`, which depends on AI SDK's `streamText` -- but AI SDK v6 ships `MockLanguageModelV3` and `simulateReadableStream` from `ai/test` specifically for this purpose.

**Primary recommendation:** Write co-located test files (`*.test.ts` beside source files) using Vitest's `vi.mock()` for module-level dependencies (config loader, vault, DB, registry) and AI SDK's `MockLanguageModelV3` + `simulateReadableStream` for streamText mocking. Keep tests focused on behavior, not implementation details.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 4.0.18 | Test runner, assertions, mocking | Already installed; workspace config exists |
| ai/test | 6.0.86 (bundled) | `MockLanguageModelV3`, `simulateReadableStream` | Official AI SDK test helpers; deterministic stream simulation |
| zod | 4.3.6 | Schema parse/safeParse for round-trip tests | Already used throughout for protocol and config schemas |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest `vi.mock()` | bundled | Module-level mocking | Mock `@tek/core`, `@tek/db`, vault, registry singletons |
| vitest `vi.fn()` | bundled | Function spy/stub | Mock Transport.send, callback functions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vi.mock() | Manual dependency injection | DI is cleaner but requires refactoring source; vi.mock() works now |
| MockLanguageModelV3 | Full vi.mock('ai') | Loses AI SDK stream behavior fidelity; mock model is purpose-built |

**Installation:** No new dependencies needed. Everything is already installed.

## Architecture Patterns

### Recommended Test File Structure
```
packages/gateway/src/
├── ws/
│   ├── protocol.ts
│   └── protocol.test.ts          # TEST-01
├── agent/
│   ├── tool-loop.ts
│   ├── tool-loop.test.ts         # TEST-02
│   ├── approval-gate.ts
│   └── approval-gate.test.ts     # TEST-05
├── llm/
│   ├── router.ts
│   ├── router.test.ts            # TEST-03
│   ├── router-rules.ts
│   └── router-rules.test.ts      # TEST-03 (rules coverage)
├── context/
│   ├── assembler.ts
│   └── assembler.test.ts         # TEST-06

packages/core/src/
├── config/
│   ├── schema.ts
│   └── schema.test.ts            # TEST-04
```

### Pattern 1: Zod Round-Trip Testing (TEST-01, TEST-04)
**What:** Parse a valid fixture through the Zod schema, then verify the output matches the input. Also test that invalid input is rejected.
**When to use:** Any Zod discriminated union or config schema.
**Example:**
```typescript
// Source: verified against codebase protocol.ts and schema.ts
import { describe, it, expect } from "vitest";
import { ClientMessageSchema, ServerMessageSchema } from "./protocol.js";

describe("ClientMessageSchema", () => {
  it("round-trips chat.send", () => {
    const msg = { type: "chat.send", id: "1", content: "hello" };
    const parsed = ClientMessageSchema.parse(msg);
    expect(parsed).toEqual(msg);
    expect(parsed.type).toBe("chat.send");
  });

  it("rejects unknown type", () => {
    expect(() =>
      ClientMessageSchema.parse({ type: "unknown", id: "1" })
    ).toThrow();
  });
});
```

### Pattern 2: Mock Transport for Agent Loop (TEST-02)
**What:** Create a mock Transport that captures `send()` calls, pair with `MockLanguageModelV3` to simulate the full stream lifecycle.
**When to use:** Testing `runAgentLoop` and any handler that sends ServerMessages.
**Example:**
```typescript
// Source: verified against transport.ts interface and AI SDK docs
import { vi } from "vitest";
import type { Transport } from "../transport.js";
import type { ServerMessage } from "../ws/protocol.js";

function createMockTransport(): Transport & { messages: ServerMessage[] } {
  const messages: ServerMessage[] = [];
  return {
    transportId: "test:1",
    channel: "ws" as const,
    messages,
    send: vi.fn((msg: ServerMessage) => { messages.push(msg); }),
  };
}
```

### Pattern 3: Pure Function Testing with Dependency Mocking (TEST-03, TEST-05)
**What:** For functions like `classifyComplexity` and `checkApproval` that have no side effects, test directly with various inputs. For `routeMessage` which calls `getAvailableProviders`, mock the registry module.
**When to use:** Router, approval gate, failure detector.
**Example:**
```typescript
// Source: verified against router.ts and approval-gate.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { classifyComplexity } from "./router.js";

describe("classifyComplexity", () => {
  it("returns high tier for 'analyze' keyword", () => {
    const result = classifyComplexity("analyze this code", 0);
    expect(result.tier).toBe("high");
    expect(result.confidence).toBe(1.0);
  });

  it("returns budget tier for short greeting", () => {
    const result = classifyComplexity("hi", 0);
    expect(result.tier).toBe("budget");
  });

  it("returns standard for default case", () => {
    const result = classifyComplexity("tell me about cats", 5);
    expect(result.tier).toBe("standard");
    expect(result.confidence).toBe(0.5);
  });
});
```

### Pattern 4: Context Assembly with Mocked Managers (TEST-06)
**What:** Mock `MemoryManager.getMemoryContext()` and `ThreadManager.buildSystemPrompt()` to return controlled content, then verify the assembled context includes soul/memory/identity sections.
**When to use:** `assembleContext` in `context/assembler.ts`.
**Key challenge:** The assembler uses module-level singleton instances (`memoryManagerInstance`, `threadManagerInstance`) and calls `loadConfig()`, `getModelPricing()`, `discoverSkills()`. All must be mocked.

### Anti-Patterns to Avoid
- **Testing Zod internals:** Don't test that `z.string()` works. Test that YOUR schema accepts valid domain objects and rejects invalid ones.
- **Coupling to message format:** Don't assert exact JSON structure in transport.send calls if only the `type` field matters for the test.
- **Real file system in config tests:** Don't read/write actual config files. Mock `loadConfig` / use schema parse directly.
- **Testing streamText itself:** The mock model tests that YOUR code handles stream events correctly, not that AI SDK works.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LLM stream simulation | Custom async generators | `MockLanguageModelV3` + `simulateReadableStream` from `ai/test` | Handles stream protocol details, finish events, usage reporting correctly |
| Zod fixture generation | Manual object builders | Direct object literals matching schema | Schemas are the source of truth; literals keep tests readable |
| Transport mocking | Complex WebSocket mock | Simple `{ send: vi.fn(), transportId, channel }` object | Transport interface is 3 properties; no need for ws library in tests |
| Timer control | `setTimeout` wrapper | `vi.useFakeTimers()` | Needed for approval timeout test in tool-loop |

**Key insight:** The codebase has clean interfaces (Transport, ApprovalPolicy) and pure functions (classifyComplexity, checkApproval, classifyFailurePattern) that are already well-designed for testing. Minimal refactoring needed.

## Common Pitfalls

### Pitfall 1: ESM Module Mocking in Vitest
**What goes wrong:** `vi.mock()` with ESM modules can fail if import paths don't match exactly, or if mocking named exports from barrel files.
**Why it happens:** Vitest's ESM mock hoisting requires paths to match the actual import specifiers used in source files (including `.js` extensions).
**How to avoid:** Mock the exact import path used in source (e.g., `vi.mock("../llm/registry.js")` with `.js` extension matching the source import). Use `vi.hoisted()` for mock setup that needs to run before imports.
**Warning signs:** "Cannot find module" errors in tests, or mocks not being applied.

### Pitfall 2: Singleton State Leaking Between Tests
**What goes wrong:** `getRegistry()`, `getMemoryManager()`, `getThreadManager()` cache singleton instances. Tests that modify these singletons contaminate later tests.
**Why it happens:** Module-level `let` variables persist across tests in the same file.
**How to avoid:** Mock the module that exports the singleton (e.g., `vi.mock("../llm/registry.js")`), or use `beforeEach` to reset module state via `vi.resetModules()`.
**Warning signs:** Tests pass individually but fail when run together.

### Pitfall 3: Async Stream Consumption in Tool Loop Tests
**What goes wrong:** `runAgentLoop` iterates `result.fullStream` which is async. If the mock stream doesn't properly signal completion, the test hangs forever.
**Why it happens:** `simulateReadableStream` requires a `finish` chunk to signal stream end.
**How to avoid:** Always include a `{ type: "finish", ... }` chunk at the end of mock stream chunks. Use `vi.setConfig({ testTimeout: 5000 })` to catch hangs early.
**Warning signs:** Tests that hang indefinitely without error.

### Pitfall 4: Zod v4 vs v3 API Differences
**What goes wrong:** Zod 4.3.6 is installed. Some v3 patterns like `.safeParse().success` still work, but discriminatedUnion behavior and error messages may differ.
**Why it happens:** The codebase uses Zod v4 (which has the `zod` package name but different internals from v3).
**How to avoid:** Use `.parse()` (throws) and `.safeParse()` (returns result) as-is. Don't assume specific error message text in assertions -- use `.success` boolean checks.
**Warning signs:** Tests that check exact Zod error strings may be brittle.

### Pitfall 5: ConnectionState with Map Fields
**What goes wrong:** `ConnectionState` has `pendingApprovals: Map<string, { toolName: string; resolve: () => void }>`. Creating test fixtures requires initializing Maps correctly.
**Why it happens:** Object literal spread doesn't handle Map instances.
**How to avoid:** Use `initConnection("test-id")` from `connection.ts` to create valid state objects, or build fixtures with `new Map()`.

## Code Examples

### Example 1: Complete Protocol Round-Trip Test (TEST-01)
```typescript
// Enumerate all ClientMessage types from the discriminated union
const CLIENT_MESSAGE_FIXTURES: Record<string, object> = {
  "chat.send": { type: "chat.send", id: "1", content: "hello" },
  "context.inspect": { type: "context.inspect", id: "1", sessionId: "s1" },
  "usage.query": { type: "usage.query", id: "1" },
  "session.list": { type: "session.list", id: "1" },
  "chat.route.confirm": { type: "chat.route.confirm", id: "1", requestId: "r1", accept: true },
  "memory.search": { type: "memory.search", id: "1", query: "test" },
  "thread.create": { type: "thread.create", id: "1", title: "Test" },
  "thread.list": { type: "thread.list", id: "1" },
  "thread.update": { type: "thread.update", id: "1", threadId: "t1" },
  "prompt.set": { type: "prompt.set", id: "1", name: "n", content: "c" },
  "prompt.list": { type: "prompt.list", id: "1" },
  "claude-code.start": { type: "claude-code.start", id: "1", prompt: "p", cwd: "/tmp" },
  "claude-code.abort": { type: "claude-code.abort", id: "1", sessionId: "s1" },
  "tool.approval.response": { type: "tool.approval.response", id: "1", toolCallId: "tc1", approved: true },
  "preflight.approval": { type: "preflight.approval", id: "1", requestId: "r1", approved: true },
  "terminal.snapshot": { type: "terminal.snapshot", id: "1", sessionId: "s1", content: "data", timestamp: 123 },
  "terminal.control.grant": { type: "terminal.control.grant", id: "1", sessionId: "s1" },
  "terminal.control.revoke": { type: "terminal.control.revoke", id: "1", sessionId: "s1" },
  "workflow.trigger": { type: "workflow.trigger", id: "1", workflowId: "w1" },
  "workflow.approval": { type: "workflow.approval", id: "1", executionId: "e1", stepId: "s1", approved: true },
  "workflow.list": { type: "workflow.list", id: "1" },
  "workflow.execution.list": { type: "workflow.execution.list", id: "1" },
  "schedule.create": { type: "schedule.create", id: "1", name: "Daily", cronExpression: "0 9 * * *" },
  "schedule.update": { type: "schedule.update", id: "1", scheduleId: "sch1" },
  "schedule.delete": { type: "schedule.delete", id: "1", scheduleId: "sch1" },
  "schedule.list": { type: "schedule.list", id: "1" },
  "heartbeat.configure": { type: "heartbeat.configure", id: "1", heartbeatPath: "/health" },
  "soul.evolution.response": { type: "soul.evolution.response", id: "1", requestId: "r1", approved: true },
};

// Test all types with: Object.entries(CLIENT_MESSAGE_FIXTURES).forEach(([type, fixture]) => { ... })
```

### Example 2: Agent Loop Test with Mock Stream (TEST-02)
```typescript
// Source: AI SDK v6 docs (ai/test) + codebase transport.ts
import { simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";

// Mock the registry to return our mock model
vi.mock("../llm/registry.js", () => ({
  getRegistry: () => ({
    languageModel: () => mockModel,
  }),
}));

const mockModel = new MockLanguageModelV3({
  doStream: async () => ({
    stream: simulateReadableStream({
      chunks: [
        { type: "text-start", id: "text-1" },
        { type: "text-delta", id: "text-1", delta: "Hello" },
        { type: "text-delta", id: "text-1", delta: " world" },
        { type: "text-end", id: "text-1" },
        {
          type: "finish",
          finishReason: { unified: "stop", raw: undefined },
          logprobs: undefined,
          usage: {
            inputTokens: { total: 5, noCache: 5, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 2, text: 2, reasoning: undefined },
          },
        },
      ],
    }),
  }),
});
```

### Example 3: Approval Gate Unit Tests (TEST-05)
```typescript
// Source: verified against approval-gate.ts
import { createApprovalPolicy, checkApproval, recordSessionApproval } from "./approval-gate.js";

describe("checkApproval", () => {
  it("auto tier never requires approval", () => {
    const policy = createApprovalPolicy({ defaultTier: "auto", approvalTimeout: 60000 });
    expect(checkApproval("any-tool", policy)).toBe(false);
  });

  it("always tier always requires approval", () => {
    const policy = createApprovalPolicy({ defaultTier: "always", approvalTimeout: 60000 });
    expect(checkApproval("any-tool", policy)).toBe(true);
  });

  it("session tier requires approval first, then remembers", () => {
    const policy = createApprovalPolicy({ defaultTier: "session", approvalTimeout: 60000 });
    expect(checkApproval("shell", policy)).toBe(true);
    recordSessionApproval("shell", policy);
    expect(checkApproval("shell", policy)).toBe(false);
  });

  it("perTool overrides defaultTier", () => {
    const policy = createApprovalPolicy({
      defaultTier: "session",
      perTool: { "shell": "auto" },
      approvalTimeout: 60000,
    });
    expect(checkApproval("shell", policy)).toBe(false);
    expect(checkApproval("fetch", policy)).toBe(true); // falls back to session
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `MockLanguageModelV1` | `MockLanguageModelV3` | AI SDK v6 (2025) | V3 spec has different stream chunk format (text-start/text-end wrapping) |
| `vi.mock()` only | `vi.mock()` + `vi.hoisted()` | Vitest 1.0+ | `vi.hoisted()` enables cleaner mock setup before import execution |
| `maxToolRoundtrips` in streamText | `stopWhen: stepCountIs(n)` | AI SDK v6 | Step control is now predicate-based, not a simple number |

**Deprecated/outdated:**
- `MockLanguageModelV1`: Replaced by V3 spec in AI SDK v6. The codebase uses AI SDK v6 so must use V3 mocks.
- `maxToolRoundtrips`: No longer exists in streamText options. Use `stopWhen` predicate.

## Open Questions

1. **Tool-call stream chunk format in AI SDK v6 mocks**
   - What we know: `MockLanguageModelV3` supports `doStream` returning a readable stream with text chunks. The docs show text-delta patterns.
   - What's unclear: The exact chunk format for tool-call simulation (tool-call-start, tool-call-delta, tool-call-end) in the V3 stream spec. The `fullStream` in tool-loop.ts handles `tool-call`, `tool-result`, `tool-approval-request` events which are AI SDK abstractions on top of the raw model stream.
   - Recommendation: Start with text-only stream tests for tool-loop, then incrementally add tool-call scenarios. The tool-call events in fullStream are generated by AI SDK when the model returns tool_use content -- may need to use `doGenerate` with tool_call content blocks instead of `doStream` for tool execution tests.

2. **Context assembler's heavy dependency chain**
   - What we know: `assembleContext` calls `loadConfig()`, `getModelPricing()`, `getMemoryManager()`, `getThreadManager()`, `discoverSkills()`, `getSkillsDirs()`, `estimateTokenCount()`.
   - What's unclear: Whether mocking all of these individually is worth the complexity, or if a simpler approach (testing the section-building logic with extracted helper functions) would be more maintainable.
   - Recommendation: Mock at module boundaries (`vi.mock("@tek/core")`, `vi.mock("@tek/db")`, `vi.mock("tokenx")`, `vi.mock("../memory/memory-manager.js")`, `vi.mock("../memory/thread-manager.js")`, `vi.mock("../usage/pricing.js")`). The function is the integration point -- test it as such.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEST-01 | WebSocket protocol tests validate serialization/deserialization for all ClientMessage/ServerMessage types | Protocol at `gateway/src/ws/protocol.ts`: 28 ClientMessage types in discriminated union, 27 ServerMessage types. Each needs a round-trip fixture. Pattern: `parse(fixture)` must equal fixture; invalid inputs must throw. |
| TEST-02 | Agent loop unit tests with mock Transport and mock streamText cover tool execution flow | `gateway/src/agent/tool-loop.ts`: `runAgentLoop` uses AI SDK `streamText` + `fullStream`. Mock with `MockLanguageModelV3`+`simulateReadableStream` from `ai/test`. Mock Transport captures `send()` calls. Mock registry via `vi.mock("../llm/registry.js")`. ConnectionState from `initConnection()`. |
| TEST-03 | LLM router unit tests cover classifyComplexity and model selection logic | `gateway/src/llm/router.ts`: `classifyComplexity` is pure (message+historyLength -> tier+confidence). `routeMessage` calls `getAvailableProviders()` which needs mocking. `DEFAULT_RULES` in `router-rules.ts` define keyword, length, history triggers. Test: high keywords, budget keywords, length >2000, history >20, default standard fallback. |
| TEST-04 | Config/schema tests validate Zod schema round-trips and migration from older formats | `core/src/config/schema.ts`: `AppConfigSchema` with defaults, nested objects, `.refine()` on MCPServerConfig. Test: minimal valid config round-trips, defaults are applied, invalid configs rejected. Migration: test that older config shapes (missing new fields) still parse thanks to `.default()` and `.optional()`. |
| TEST-05 | Approval gate policy tests cover auto/session/always tier logic | `gateway/src/agent/approval-gate.ts`: 4 exported functions. `checkApproval` has 3 branches (auto->false, always->true, session->check Set). `recordSessionApproval` adds to Set. `createApprovalPolicy` applies defaults. `wrapToolWithApproval` adds `_approvalTier`. All are pure -- no mocking needed. |
| TEST-06 | Context assembly tests verify system prompt construction with soul/memory/identity | `gateway/src/context/assembler.ts`: `assembleContext` builds system prompt from soul+identity+style+user+agents+longTermMemory+recentLogs. Heavy mocking needed: MemoryManager, ThreadManager, loadConfig, getModelPricing, discoverSkills, estimateTokenCount. Verify: system string contains soul/identity/memory sections; sections array has correct names; messages array built correctly. |
</phase_requirements>

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `packages/gateway/src/ws/protocol.ts` -- all ClientMessage and ServerMessage Zod schemas
- Codebase inspection: `packages/gateway/src/agent/tool-loop.ts` -- runAgentLoop implementation
- Codebase inspection: `packages/gateway/src/agent/approval-gate.ts` -- approval policy functions
- Codebase inspection: `packages/gateway/src/llm/router.ts` + `router-rules.ts` -- classifyComplexity, routeMessage, DEFAULT_RULES
- Codebase inspection: `packages/core/src/config/schema.ts` -- AppConfigSchema
- Codebase inspection: `packages/gateway/src/context/assembler.ts` -- assembleContext
- AI SDK bundled docs: `node_modules/ai/docs/03-ai-sdk-core/55-testing.mdx` -- MockLanguageModelV3, simulateReadableStream
- AI SDK source: `node_modules/ai/src/test/mock-language-model-v3.ts` -- MockLanguageModelV3 implementation

### Secondary (MEDIUM confidence)
- Vitest 4.0.18 installed version confirmed via `node_modules/vitest/package.json`
- AI SDK v6.0.86 installed version confirmed via `packages/gateway/node_modules/ai/package.json`
- Vitest workspace config at root `vitest.config.ts` with `projects: ['packages/*']`

### Tertiary (LOW confidence)
- Tool-call stream simulation in V3 mock format: unclear from bundled docs alone, may need experimentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all tools already installed, versions confirmed, docs reviewed
- Architecture: HIGH - all source files read, interfaces understood, mock patterns verified against AI SDK docs
- Pitfalls: HIGH - identified from actual codebase patterns (singleton caching, ESM imports with .js extensions, ConnectionState Maps)
- Tool-call mock format: LOW - V3 stream spec for tool calls not fully documented in bundled AI SDK docs

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (stable domain; Vitest and AI SDK mock APIs unlikely to change within 30 days)
