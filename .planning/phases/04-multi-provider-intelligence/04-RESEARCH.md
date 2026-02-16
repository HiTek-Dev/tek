# Phase 4: Multi-Provider Intelligence - Research

**Researched:** 2026-02-16
**Domain:** Multi-provider LLM integration, intelligent model routing, provider abstraction
**Confidence:** HIGH

## Summary

Phase 4 extends the existing single-provider (Anthropic) gateway to support OpenAI and Ollama providers through AI SDK 6's unified provider abstraction, adds intelligent task routing based on complexity heuristics, and gives users visibility and override control over routing decisions.

The current codebase is well-structured for this extension. The `streamChatResponse()` function in `packages/gateway/src/llm/stream.ts` calls `getAnthropicProvider()` which returns a hardcoded Anthropic provider. The key architectural change is replacing this with a provider registry that resolves the correct provider based on a `provider:model` identifier string. AI SDK 6's `createProviderRegistry()` is purpose-built for exactly this pattern. The existing vault already stores keys for all three providers (`anthropic`, `openai`, `ollama`), the pricing module already supports fuzzy model matching, and the WebSocket protocol already passes model IDs -- all these need only incremental changes.

For routing, a rule-based heuristic approach is the right fit for a self-hosted system. ML-based routers require training data and add complexity inappropriate for this scale. A simple classifier that analyzes prompt length, keyword presence (e.g., "plan", "analyze", "compare" for complex tasks), and explicit user hints can route effectively between tiers (high-capability, standard, budget). The routing decision must be surfaced to the user via a new WebSocket message type before execution, with the user able to accept or override.

**Primary recommendation:** Use AI SDK 6 `createProviderRegistry()` to unify providers behind `provider:model` string identifiers, implement a rule-based complexity classifier for automatic routing, and add a `chat.route.propose` / `chat.route.confirm` WebSocket message pair for user-visible routing control.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` | ^6.0.86 | Multi-provider LLM abstraction | Already in use. Provides `createProviderRegistry()`, `customProvider()`, `streamText()` unified across all providers. |
| `@ai-sdk/anthropic` | ^3.0.44 | Anthropic Claude models | Already installed. Official AI SDK provider for Claude. |
| `@ai-sdk/openai` | ^3.0.29 | OpenAI GPT models | Official AI SDK provider. `createOpenAI()` factory with apiKey, baseURL config. Supports responses, chat, and completion APIs. |
| `@ai-sdk/openai-compatible` | ^2.0.29 | Ollama (via OpenAI compat) | Official package. `createOpenAICompatible()` with `baseURL: 'http://localhost:11434/v1'`. Avoids community Ollama packages with version churn. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | ^4.3.6 | Schema validation for routing config | Already installed. Validate routing rules, model registry config, new protocol messages. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@ai-sdk/openai-compatible` for Ollama | `ollama-ai-provider` (community) | Community package has direct Ollama HTTP API access but version churn and maintenance risk. Official openai-compatible is more stable. |
| Rule-based routing | ML-based router (LLMRouter) | ML routers need training data, add latency, increase complexity. Rule-based is transparent, predictable, and sufficient for self-hosted. |
| Custom provider registry | Direct provider instantiation | `createProviderRegistry()` gives string-based `provider:model` lookups with fallback. Without it, routing logic must manually map strings to provider instances. |

**Installation:**
```bash
pnpm --filter @agentspace/gateway add @ai-sdk/openai@^3 @ai-sdk/openai-compatible@^2
```

## Architecture Patterns

### Recommended Project Structure

```
packages/gateway/src/llm/
├── provider.ts          # REFACTOR: ProviderRegistry (replaces getAnthropicProvider)
├── registry.ts          # NEW: createProviderRegistry setup, model resolution
├── router.ts            # NEW: Complexity classifier + routing logic
├── router-rules.ts      # NEW: Default routing rules configuration
├── stream.ts            # MODIFY: Accept resolved provider model instead of hardcoded Anthropic
├── types.ts             # MODIFY: Add routing types (RoutingDecision, ModelTier, etc.)
└── index.ts             # MODIFY: Export new modules
```

### Pattern 1: Provider Registry with String-Based Resolution

**What:** AI SDK 6 `createProviderRegistry()` assembles multiple providers into a single registry. Models are accessed via `registry.languageModel('anthropic:claude-sonnet-4-5')` strings.
**When to use:** Any time the gateway needs to resolve a model reference to a provider instance.
**Example:**
```typescript
// Source: https://ai-sdk.dev/docs/ai-sdk-core/provider-management
import { createProviderRegistry, customProvider } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function buildRegistry(keys: { anthropic?: string; openai?: string }) {
  const providers: Record<string, any> = {};

  if (keys.anthropic) {
    providers.anthropic = createAnthropic({ apiKey: keys.anthropic });
  }

  if (keys.openai) {
    providers.openai = createOpenAI({ apiKey: keys.openai });
  }

  // Ollama doesn't need an API key
  providers.ollama = createOpenAICompatible({
    name: "ollama",
    baseURL: "http://localhost:11434/v1",
  });

  return createProviderRegistry(providers);
}

// Usage:
const registry = buildRegistry({ anthropic: "sk-ant-...", openai: "sk-..." });
const model = registry.languageModel("anthropic:claude-sonnet-4-5");
```

### Pattern 2: Rule-Based Complexity Routing

**What:** A heuristic classifier analyzes the user message to assign a complexity tier, then maps to an appropriate model from available providers.
**When to use:** When `chat.send` arrives without an explicit model override, and routing is enabled.
**Example:**
```typescript
// Source: https://kleiber.me/blog/2025/08/10/llm-router-primer/
interface RoutingDecision {
  tier: "high" | "standard" | "budget";
  provider: string;
  model: string;
  reason: string;
  confidence: number;
}

interface RoutingRule {
  tier: "high" | "standard" | "budget";
  match: (message: string, history: number) => boolean;
  priority: number;
}

const DEFAULT_RULES: RoutingRule[] = [
  {
    tier: "high",
    priority: 1,
    match: (msg) => {
      const planningKeywords = /\b(plan|architect|design|analyze|compare|evaluate|debug complex|refactor)\b/i;
      return planningKeywords.test(msg) || msg.length > 2000;
    },
  },
  {
    tier: "budget",
    priority: 3,
    match: (msg) => {
      const simplePatterns = /\b(hi|hello|hey|thanks|what is|define|translate|summarize briefly)\b/i;
      return simplePatterns.test(msg) && msg.length < 200;
    },
  },
  {
    tier: "standard",
    priority: 2,
    match: () => true, // Default fallback
  },
];
```

### Pattern 3: Routing Proposal Protocol (User Override)

**What:** Before executing a routed request, the gateway sends a `chat.route.propose` message to the client showing which model was selected and why. The client either confirms or overrides.
**When to use:** When GATE-09 (user override) is required. Can be skipped if user has set "auto-route" preference.
**Example:**
```typescript
// New protocol messages
const ChatRouteProposalSchema = z.object({
  type: z.literal("chat.route.propose"),
  requestId: z.string(),
  sessionId: z.string(),
  routing: z.object({
    tier: z.enum(["high", "standard", "budget"]),
    provider: z.string(),
    model: z.string(),
    reason: z.string(),
  }),
  alternatives: z.array(z.object({
    provider: z.string(),
    model: z.string(),
    estimatedCost: z.string(),
  })),
});

const ChatRouteConfirmSchema = z.object({
  type: z.literal("chat.route.confirm"),
  id: z.string(),
  requestId: z.string(), // matches the proposal
  accept: z.boolean(),
  override: z.object({
    provider: z.string(),
    model: z.string(),
  }).optional(), // present when accept=false
});
```

### Pattern 4: Model Switching Mid-Conversation

**What:** The session stores the current model ID. When user sends `/model anthropic:claude-haiku-4-5`, the session model is updated and subsequent messages use the new provider/model.
**When to use:** GATE-04 requirement. The `chat.send` message already has an optional `model` field.
**Example:**
```typescript
// Session model update - extends existing Session type
interface Session {
  id: string;
  sessionKey: string;
  agentId: string;
  model: string;       // Now: "anthropic:claude-sonnet-4-5" (provider-qualified)
  createdAt: string;
  lastActiveAt: string;
}

// In handleChatSend, if msg.model is provided, update session:
if (msg.model && msg.model !== session.model) {
  sessionManager.updateModel(sessionId, msg.model);
  model = msg.model;
}
```

### Anti-Patterns to Avoid

- **Provider-specific code paths:** Do NOT write `if (provider === "anthropic") { ... } else if (provider === "openai") { ... }`. Use the registry's unified interface. Provider-specific behavior belongs in the provider setup, not in the streaming/routing logic.
- **Hardcoded model lists:** Do NOT hardcode available models. Query the registry for available providers and let users configure model aliases. Ollama models especially vary by installation.
- **Routing without override:** Do NOT implement routing that auto-sends without the user seeing the decision. GATE-09 requires explicit visibility. The auto-route option should be opt-in.
- **Blocking on Ollama availability:** Do NOT require Ollama to be running. Gracefully handle connection failures. Ollama is optional and local.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Provider abstraction | Custom provider wrapper per LLM vendor | `createProviderRegistry()` from AI SDK 6 | Handles model resolution, streaming, tool calling, structured output across all providers uniformly. |
| OpenAI-compatible API | Custom HTTP client for Ollama | `@ai-sdk/openai-compatible` with `createOpenAICompatible()` | Handles streaming protocol, error handling, usage extraction. Maintained by Vercel. |
| Model pricing lookup | Separate pricing APIs per provider | Extend existing `MODEL_PRICING` record in `pricing.ts` | Already has fuzzy matching. Just add OpenAI and Ollama model entries (Ollama is $0). |
| Provider health checking | Custom HTTP ping per provider | Catch errors on first model call, mark provider unavailable | AI SDK throws typed errors on provider failures. No custom health check protocol needed. |

**Key insight:** AI SDK 6 was designed for exactly this multi-provider scenario. The `createProviderRegistry()` + provider packages handle all the protocol differences, streaming formats, and error shapes. Building custom abstractions on top would duplicate what the SDK already provides.

## Common Pitfalls

### Pitfall 1: Model ID Format Migration

**What goes wrong:** Current codebase uses bare model names like `claude-sonnet-4-5-20250929`. Phase 4 needs provider-qualified names like `anthropic:claude-sonnet-4-5-20250929`. Existing sessions in the DB have bare names.
**Why it happens:** The model field in sessions and usage records was designed for single-provider.
**How to avoid:** Add a migration function that prefixes existing bare model names with `anthropic:` for backward compatibility. Make the registry accept both bare (with default provider) and qualified names.
**Warning signs:** Tests passing with hardcoded model names, existing sessions breaking after upgrade.

### Pitfall 2: Ollama Connection Failures

**What goes wrong:** Gateway crashes or hangs when Ollama is not running but a user requests an Ollama model.
**Why it happens:** Ollama is a local service that may not be running. Unlike cloud APIs, it's not always available.
**How to avoid:** Wrap Ollama provider calls in a timeout (e.g., 3 seconds for connection). Return a clear error message: "Ollama is not running at localhost:11434". List only available providers in routing decisions.
**Warning signs:** Unhandled promise rejections, long timeouts, confusing error messages.

### Pitfall 3: Pricing Mismatch Across Providers

**What goes wrong:** Usage tracking shows wrong costs because OpenAI and Ollama pricing differs from Anthropic, or Ollama (free) isn't handled.
**Why it happens:** The `MODEL_PRICING` record only has Anthropic models. OpenAI models have different pricing tiers. Ollama is free (local compute).
**How to avoid:** Extend `MODEL_PRICING` with OpenAI models (gpt-4o, gpt-4o-mini, o1, o3, etc.). Set Ollama pricing to $0. Use provider prefix in pricing lookup: `getModelPricing("openai:gpt-4o")`.
**Warning signs:** Cost tracking showing $0 for everything, or Sonnet fallback pricing applied to GPT models.

### Pitfall 4: Routing Before Provider Availability Check

**What goes wrong:** Router selects an Ollama model but Ollama is offline, or selects OpenAI but no API key is configured.
**Why it happens:** Routing logic considers model capabilities but not provider availability.
**How to avoid:** Router must check: (1) Is the provider API key configured (via vault)? (2) For Ollama, is the service reachable? Only route to available providers. Surface unavailable providers in the routing proposal.
**Warning signs:** Routing to a provider that immediately errors, confusing UX.

### Pitfall 5: Streaming Format Differences

**What goes wrong:** Subtle differences in how providers report usage tokens, or streaming chunks behave differently.
**Why it happens:** OpenAI and Anthropic have different streaming protocols under the hood.
**How to avoid:** AI SDK 6 normalizes this. Use `result.usage` (the Promise) and `result.textStream` consistently -- they work the same across providers. Do NOT access provider-specific response fields.
**Warning signs:** Missing usage data for OpenAI responses, token counts of 0.

### Pitfall 6: Auto-Routing Annoyance

**What goes wrong:** Users find the routing proposal step intrusive for every message, abandoning the feature.
**Why it happens:** GATE-09 says users can "see and override" but doesn't mean they want to confirm every message.
**How to avoid:** Implement three routing modes: (1) **manual** -- always propose and wait for confirm, (2) **auto** -- route silently, show decision in stream.start but don't wait, (3) **suggest** -- propose only when routing differs from session default. Default to "auto" with the decision visible in `chat.stream.start`. "Manual" for when users want full control.
**Warning signs:** Users disabling routing entirely because it's too chatty.

## Code Examples

Verified patterns from official sources:

### Provider Registry Setup
```typescript
// Source: https://ai-sdk.dev/docs/ai-sdk-core/provider-management
import { createProviderRegistry } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getKey } from "@agentspace/cli/vault";

export function createModelRegistry() {
  const providers: Record<string, any> = {};

  const anthropicKey = getKey("anthropic");
  if (anthropicKey) {
    providers.anthropic = createAnthropic({ apiKey: anthropicKey });
  }

  const openaiKey = getKey("openai");
  if (openaiKey) {
    providers.openai = createOpenAI({ apiKey: openaiKey });
  }

  // Ollama: no API key, always register (may not be running)
  providers.ollama = createOpenAICompatible({
    name: "ollama",
    baseURL: "http://localhost:11434/v1",
  });

  return createProviderRegistry(providers);
}
```

### Unified Streaming (Replace Current stream.ts)
```typescript
// Source: https://ai-sdk.dev/docs/foundations/providers-and-models
import { streamText, type ModelMessage } from "ai";
import type { StreamChunk } from "./types.js";

export async function* streamChatResponse(
  registry: ReturnType<typeof createProviderRegistry>,
  modelId: string,  // e.g. "anthropic:claude-sonnet-4-5" or "openai:gpt-4o"
  messages: ModelMessage[],
  system?: string,
): AsyncGenerator<StreamChunk> {
  const model = registry.languageModel(modelId);

  const result = streamText({ model, messages, system });

  for await (const chunk of result.textStream) {
    yield { type: "delta", text: chunk };
  }

  const usage = await result.usage;
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const totalTokens = usage.totalTokens ?? inputTokens + outputTokens;

  yield { type: "done", usage: { inputTokens, outputTokens, totalTokens } };
}
```

### Ollama Provider (OpenAI-Compatible)
```typescript
// Source: https://ai-sdk.dev/providers/openai-compatible-providers
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const ollama = createOpenAICompatible({
  name: "ollama",
  baseURL: "http://localhost:11434/v1",
  // No apiKey needed for local Ollama
  // includeUsage: true if Ollama version supports it
});

// Usage: ollama("llama3.2"), ollama("codellama"), etc.
```

### OpenAI Provider
```typescript
// Source: https://ai-sdk.dev/providers/ai-sdk-providers/openai
import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({
  apiKey: "sk-...",
  // baseURL can override for proxies
});

// Usage: openai("gpt-4o"), openai("gpt-4o-mini"), openai("o3"), etc.
```

### Extended Pricing Table
```typescript
// Extending existing packages/gateway/src/usage/pricing.ts
export const MODEL_PRICING: Record<
  string,
  { inputPerMTok: number; outputPerMTok: number }
> = {
  // Anthropic (existing)
  "anthropic:claude-opus-4.6": { inputPerMTok: 5, outputPerMTok: 25 },
  "anthropic:claude-opus-4.5": { inputPerMTok: 5, outputPerMTok: 25 },
  "anthropic:claude-sonnet-4.5": { inputPerMTok: 3, outputPerMTok: 15 },
  "anthropic:claude-sonnet-4": { inputPerMTok: 3, outputPerMTok: 15 },
  "anthropic:claude-haiku-4.5": { inputPerMTok: 1, outputPerMTok: 5 },
  "anthropic:claude-haiku-3.5": { inputPerMTok: 0.8, outputPerMTok: 4 },

  // OpenAI
  "openai:gpt-4o": { inputPerMTok: 2.5, outputPerMTok: 10 },
  "openai:gpt-4o-mini": { inputPerMTok: 0.15, outputPerMTok: 0.6 },
  "openai:o3": { inputPerMTok: 2, outputPerMTok: 8 },
  "openai:o3-mini": { inputPerMTok: 1.1, outputPerMTok: 4.4 },
  "openai:o4-mini": { inputPerMTok: 1.1, outputPerMTok: 4.4 },
  "openai:gpt-4.1": { inputPerMTok: 2, outputPerMTok: 8 },
  "openai:gpt-4.1-mini": { inputPerMTok: 0.4, outputPerMTok: 1.6 },
  "openai:gpt-4.1-nano": { inputPerMTok: 0.1, outputPerMTok: 0.4 },

  // Ollama (local, free)
  "ollama:*": { inputPerMTok: 0, outputPerMTok: 0 },
};
```

### Model Tier Configuration
```typescript
// Default tier-to-model mapping (user-configurable)
interface TierConfig {
  high: string;      // Complex reasoning, planning
  standard: string;  // General conversation
  budget: string;    // Simple Q&A, greetings
}

const DEFAULT_TIERS: TierConfig = {
  high: "anthropic:claude-sonnet-4-5",
  standard: "anthropic:claude-sonnet-4",
  budget: "anthropic:claude-haiku-4-5",
};

// Users can override per-tier models, e.g.:
// { high: "openai:o3", standard: "openai:gpt-4o", budget: "ollama:llama3.2" }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single provider per app | Multi-provider registries (AI SDK 6) | AI SDK 6 release (2025) | `createProviderRegistry()` is the standard pattern for multi-provider TS apps. |
| Community Ollama packages | `@ai-sdk/openai-compatible` for Ollama | 2025 | Official package is more stable than community providers. Ollama's OpenAI compat layer is mature. |
| ML-based LLM routing | Hybrid: rule-based for simple, ML for enterprise | 2025-2026 | Research (ICLR 2025, LLMRouter) shows ML routers excel at scale. For self-hosted, rule-based heuristics are appropriate. |
| Opaque model selection | User-visible routing decisions | 2025-2026 | Transparency is a growing concern. GATE-09 aligns with industry trend toward explainable AI routing. |

**Deprecated/outdated:**
- `ollama-ai-provider` (community): Still works but `@ai-sdk/openai-compatible` is preferred for stability.
- Direct provider SDK calls (bypassing AI SDK): Unnecessary when AI SDK 6 provides unified interface.

## Open Questions

1. **Ollama Model Discovery**
   - What we know: Ollama has a `/api/tags` endpoint listing installed models. The OpenAI-compatible layer at `/v1/models` also lists them.
   - What's unclear: Should the gateway auto-discover Ollama models at startup, or should the user configure them explicitly?
   - Recommendation: Auto-discover at startup via `/v1/models` endpoint. Cache the list. Refresh on demand via a new `provider.refresh` WS message. Gracefully handle Ollama being offline.

2. **Provider-Qualified Model IDs vs Bare Names**
   - What we know: Current DB has bare model names (`claude-sonnet-4-5-20250929`). Phase 4 needs `anthropic:claude-sonnet-4-5`.
   - What's unclear: Should we migrate existing data, or support both formats indefinitely?
   - Recommendation: Support both. If no provider prefix, assume the configured default provider (initially `anthropic`). Add provider prefix to new records. No DB migration needed for existing sessions.

3. **Routing Mode Default**
   - What we know: GATE-09 requires users to see and override routing. But confirming every message is intrusive.
   - What's unclear: What should the default routing mode be?
   - Recommendation: Default to "auto" mode where routing happens silently but the chosen model is shown in `chat.stream.start`. Add `/routing manual` slash command for full proposal/confirm flow. Add `/routing off` to disable routing entirely.

4. **OpenAI Pricing Volatility**
   - What we know: OpenAI frequently updates pricing and model names.
   - What's unclear: How to keep pricing data current without manual updates.
   - Recommendation: Ship a default pricing table. Allow user-provided overrides in config. Log a warning if a model is not in the pricing table (falls back to $0 for safety). Pricing accuracy is LOW confidence since it changes frequently.

## Sources

### Primary (HIGH confidence)
- [AI SDK Provider Management](https://ai-sdk.dev/docs/ai-sdk-core/provider-management) - `createProviderRegistry()`, `customProvider()`, `wrapLanguageModel()` APIs
- [AI SDK OpenAI Provider](https://ai-sdk.dev/providers/ai-sdk-providers/openai) - `createOpenAI()` setup, configuration, streaming
- [AI SDK OpenAI Compatible](https://ai-sdk.dev/providers/openai-compatible-providers) - `createOpenAICompatible()` for Ollama
- [AI SDK Custom Providers](https://ai-sdk.dev/providers/openai-compatible-providers/custom-providers) - Custom provider authoring
- [AI SDK Foundations](https://ai-sdk.dev/docs/foundations/providers-and-models) - Unified provider abstraction design
- [AI SDK Anthropic Provider](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic) - Existing provider reference
- [Ollama OpenAI Compatibility](https://docs.ollama.com/api/openai-compatibility) - Ollama's OpenAI-compatible endpoints

### Secondary (MEDIUM confidence)
- [LLM Routing Primer](https://kleiber.me/blog/2025/08/10/llm-router-primer/) - Rule-based vs ML-based routing approaches, implementation spectrum
- [LLMRouter (U of Illinois)](https://www.marktechpost.com/2025/12/30/meet-llmrouter-an-intelligent-routing-system-designed-to-optimize-llm-inference-by-dynamically-selecting-the-most-suitable-model-for-each-query/) - Research on routing families (single-round, multi-round, agentic)
- [Intelligent LLM Routing Enterprise](https://www.requesty.ai/blog/intelligent-llm-routing-in-enterprise-ai-uptime-cost-efficiency-and-model) - Enterprise routing patterns
- [@ai-sdk/openai npm](https://www.npmjs.com/package/@ai-sdk/openai) - v3.0.29 latest
- [@ai-sdk/openai-compatible npm](https://www.npmjs.com/package/@ai-sdk/openai-compatible) - v2.0.29 latest

### Tertiary (LOW confidence)
- OpenAI pricing: Cited values are approximate and change frequently. Validate at implementation time against https://openai.com/pricing.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - AI SDK 6 provider packages are well-documented, official, and already partially in use.
- Architecture: HIGH - `createProviderRegistry()` pattern is documented and purpose-built. WS protocol extension follows existing patterns.
- Routing logic: MEDIUM - Rule-based approach is well-understood but specific rules (keywords, thresholds) need tuning with real usage.
- Pricing data: LOW - OpenAI prices change frequently; Ollama model capabilities vary by installation.
- Pitfalls: HIGH - Based on direct codebase analysis of current hardcoded assumptions.

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days - AI SDK ecosystem is stable; routing rules may need tuning earlier)
