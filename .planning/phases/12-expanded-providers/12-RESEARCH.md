# Phase 12: Expanded Providers - Research

**Researched:** 2026-02-18
**Domain:** Multi-provider LLM integration (Venice AI, Google AI Studio/Gemini, Ollama remote hosts)
**Confidence:** HIGH

## Summary

Phase 12 extends the existing provider registry (built in Phase 4) with three new providers: Venice AI, Google AI Studio (Gemini), and configurable remote Ollama hosts. The existing architecture is well-suited for this expansion -- the singleton `buildRegistry()` in `packages/gateway/src/llm/registry.ts` already uses `createProviderRegistry()` from AI SDK 6 with a dynamic `ProviderMap`, and the `@ai-sdk/openai-compatible` package is already a dependency used for Ollama.

Venice AI implements the OpenAI API specification at `https://api.venice.ai/api/v1`, meaning it can be added via `createOpenAICompatible` -- the same pattern already used for Ollama. Google Gemini has a first-party AI SDK provider (`@ai-sdk/google`) that plugs directly into `createProviderRegistry()`. Ollama remote hosts require only changing the `baseURL` parameter from `http://localhost:11434/v1` to a user-configured endpoint. Venice image and video generation use non-OpenAI REST endpoints (`/image/generate`, `/video/queue`) that require custom tool implementations (same pattern as existing `image-gen.ts` and `web-search.ts` skills).

**Primary recommendation:** Use `@ai-sdk/openai-compatible` for Venice text, `@ai-sdk/google` for Gemini, and extend the existing Ollama `createOpenAICompatible` with user-configurable `baseURL`. Build Venice image/video as custom skill tools following the existing raw-fetch pattern in `skills/image-gen.ts`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@ai-sdk/google` | ^3 | Google Gemini provider | First-party AI SDK provider, plugs into `createProviderRegistry()` natively |
| `@ai-sdk/openai-compatible` | ^2 (already installed) | Venice AI text provider | Venice API is OpenAI-compatible; same package already used for Ollama |
| `ai` | ^6 (already installed) | Provider registry, streaming | Already the core SDK; `createProviderRegistry()` accepts dynamic provider map |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | ^4 (already installed) | Schema validation for config extensions | Validate Ollama endpoint URLs, Venice image/video params |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@ai-sdk/openai-compatible` for Venice | `@ai-sdk/openai` with custom baseURL | openai-compatible is lighter and purpose-built for this; openai provider has OpenAI-specific assumptions |
| Raw fetch for Venice image/video | Venice SDK (none exists) | No official Venice SDK; raw fetch is consistent with existing Stability AI pattern |
| `@ai-sdk/google` | `@ai-sdk/openai-compatible` targeting Gemini OpenAI endpoint | Google's first-party provider supports Gemini-specific features (tool use, image gen, thinking) that openai-compatible would miss |

**Installation:**
```bash
cd packages/gateway && npm install @ai-sdk/google@^3
```

Only one new package needed. Everything else is already installed.

## Architecture Patterns

### Recommended Changes
```
packages/
├── cli/src/vault/
│   └── providers.ts         # Extend PROVIDERS array with "venice", "google"
├── core/src/config/
│   └── schema.ts            # Add ollamaEndpoints config, optional provider-specific config
├── gateway/src/llm/
│   ├── registry.ts          # Add venice + google providers, configurable Ollama baseURL
│   ├── types.ts             # Extend ProviderName union
│   └── router-rules.ts      # Add Gemini and Venice model entries to DEFAULT_TIERS
├── gateway/src/usage/
│   └── pricing.ts           # Add Venice and Gemini pricing entries
└── gateway/src/skills/
    ├── venice-image.ts       # NEW: Venice image generation tool
    └── venice-video.ts       # NEW: Venice video generation tool
```

### Pattern 1: Provider Registration via createOpenAICompatible (Venice)
**What:** Register Venice as an OpenAI-compatible provider in `buildRegistry()`
**When to use:** Any provider implementing the OpenAI chat completions spec
**Example:**
```typescript
// Source: existing Ollama pattern in registry.ts + Venice docs
if (veniceKey) {
  logger.info("Registering Venice AI provider");
  providers.venice = createOpenAICompatible({
    name: "venice",
    baseURL: "https://api.venice.ai/api/v1",
    apiKey: veniceKey,
  });
}
```

### Pattern 2: First-Party Provider Registration (Google/Gemini)
**What:** Register Google Gemini using `@ai-sdk/google`'s `createGoogleGenerativeAI`
**When to use:** Providers with dedicated AI SDK packages
**Example:**
```typescript
// Source: @ai-sdk/google docs (ai-sdk.dev)
import { createGoogleGenerativeAI } from "@ai-sdk/google";

if (googleKey) {
  logger.info("Registering Google Gemini provider");
  providers.google = createGoogleGenerativeAI({ apiKey: googleKey });
}
```

### Pattern 3: Configurable Ollama Endpoints
**What:** Allow Ollama baseURL to come from config instead of hardcoded localhost
**When to use:** User wants to connect to Ollama on LAN/cloud hosts
**Example:**
```typescript
// Source: existing Ollama registration + config extension
const ollamaEndpoints = config?.ollamaEndpoints ?? [
  { name: "localhost", url: "http://localhost:11434/v1" }
];

for (const endpoint of ollamaEndpoints) {
  const providerName = ollamaEndpoints.length === 1 ? "ollama" : `ollama-${endpoint.name}`;
  providers[providerName] = createOpenAICompatible({
    name: providerName,
    baseURL: endpoint.url,
  });
}
```

### Pattern 4: Venice Image/Video as Skill Tools (Raw Fetch)
**What:** Implement Venice image and video generation as AI SDK tools using raw `fetch()`
**When to use:** Non-chat-completions endpoints that need tool-call integration
**Example:**
```typescript
// Source: existing skills/image-gen.ts pattern (Stability AI)
export function createVeniceImageTool(apiKey?: string) {
  return tool({
    description: "Generate an image using Venice AI",
    inputSchema: z.object({
      prompt: z.string(),
      model: z.string().optional().default("fluently-xl"),
      width: z.number().optional().default(1024),
      height: z.number().optional().default(1024),
    }),
    execute: async ({ prompt, model, width, height }) => {
      const response = await fetch("https://api.venice.ai/api/v1/image/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, prompt, width, height }),
      });
      // ... handle response
    },
  });
}
```

### Pattern 5: Hot-Swap Provider Mid-Conversation
**What:** The existing `handleChatSend` already supports mid-conversation model switching via `msg.model`
**When to use:** Already works -- `resolveModelId()` + `sessionManager.updateModel()` handles provider:model switching
**Key insight:** The existing code at `handlers.ts:250-255` already resolves `msg.model` to a provider-qualified ID and updates the session. No new hot-swap logic needed -- just ensure new providers are registered in the registry.

### Anti-Patterns to Avoid
- **Separate streaming pipelines per provider:** All providers use `streamChatResponse()` via the unified registry. Never create provider-specific streaming code.
- **Hardcoded provider URLs:** Always read endpoints from config (especially Ollama). Hardcoded `localhost:11434` is the current anti-pattern to fix.
- **Registering unavailable providers:** The existing pattern of checking `getKey()` before registration should continue. Venice and Google should follow the same conditional pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Venice chat completions | Custom HTTP client | `createOpenAICompatible` | Venice is explicitly OpenAI-compatible; the SDK handles streaming, error handling, retries |
| Gemini integration | Raw Gemini REST client | `@ai-sdk/google` | First-party provider handles auth, streaming, structured output, tool use, thinking models |
| Provider registry | Custom model routing map | `createProviderRegistry()` from `ai` | Already handles model resolution, provider namespacing, type safety |
| Ollama remote connectivity | SSH tunnels or custom proxy | Direct HTTP with configurable baseURL | Ollama already exposes an HTTP API; just change the URL |
| Venice video polling | Custom polling loop | Simple poll-with-timeout utility | Video generation is async (queue/poll pattern); keep it simple with setTimeout/setInterval + max retries |

**Key insight:** The existing provider registry architecture was designed for exactly this kind of extension. The `ProviderMap` accepted by `createProviderRegistry()` is a plain object -- adding new providers is literally adding new keys.

## Common Pitfalls

### Pitfall 1: Venice API Key Confusion
**What goes wrong:** Venice uses bearer tokens, not `sk-` prefixed keys. Users may confuse the format.
**Why it happens:** Venice keys look different from Anthropic/OpenAI keys.
**How to avoid:** Add Venice to `PROVIDER_KEY_PREFIXES` with `null` (no prefix validation, same as Ollama). Provide clear error messages.
**Warning signs:** 401 errors from Venice API.

### Pitfall 2: Ollama Remote Connectivity Failures
**What goes wrong:** Ollama on remote hosts may have CORS issues, firewall blocks, or require `OLLAMA_HOST=0.0.0.0` server-side config.
**Why it happens:** Ollama binds to `127.0.0.1` by default, blocking remote connections.
**How to avoid:** Document that the remote Ollama server must be configured to listen on `0.0.0.0`. Provide a health-check endpoint test on registration.
**Warning signs:** Connection refused or timeout errors when using non-localhost Ollama endpoints.

### Pitfall 3: Venice Video Async Queue Pattern
**What goes wrong:** Video generation is not synchronous -- it uses a queue/poll pattern (`/video/queue` -> `/video/retrieve`).
**Why it happens:** Video generation takes minutes, not seconds.
**How to avoid:** Implement as a tool that queues the job, polls for completion with backoff, and returns the result. Set a reasonable timeout (5-10 minutes). Consider making it a long-running operation with progress notifications.
**Warning signs:** Tool call appearing to hang or timeout.

### Pitfall 4: Google API Key vs OAuth Confusion
**What goes wrong:** Google AI Studio uses a simple API key (via `GOOGLE_GENERATIVE_AI_API_KEY`), not OAuth. Users already have a Google OAuth config for Workspace. These are different auth flows.
**Why it happens:** Two different Google integrations in the system.
**How to avoid:** Use `google` as the provider name for Gemini API keys (stored in vault). Keep existing `googleAuth` config separate for Workspace OAuth.
**Warning signs:** Using a Workspace OAuth token for Gemini API calls (will fail).

### Pitfall 5: Model ID Collisions with Multiple Ollama Endpoints
**What goes wrong:** If user has two Ollama servers with the same model name (e.g., `llama3`), model IDs collide.
**Why it happens:** Current system uses `ollama:model-name` format with only one Ollama endpoint.
**How to avoid:** When multiple Ollama endpoints exist, use endpoint-qualified names like `ollama-gpu-server:llama3` or keep a single "ollama" provider that can be switched between endpoints via config.
**Warning signs:** Wrong server responding to model requests.

### Pitfall 6: Registry Singleton Cache Invalidation
**What goes wrong:** The provider registry is lazily cached (`cachedRegistry`). If a user adds a new API key, the registry won't pick it up until restart.
**Why it happens:** Singleton pattern caches on first access.
**How to avoid:** Add a `resetRegistry()` function or invalidate the cache when keys change. For Phase 12, this may be acceptable as-is (require restart), but document the limitation.
**Warning signs:** New provider key added but provider still shows as unavailable.

## Code Examples

### Extending the Provider Registry (registry.ts)
```typescript
// Source: existing registry.ts pattern + Venice/Google additions
import { createGoogleGenerativeAI } from "@ai-sdk/google";

export function buildRegistry(keys?: {
  anthropic?: string;
  openai?: string;
  venice?: string;
  google?: string;
  ollamaEndpoints?: Array<{ name: string; url: string }>;
}): ProviderRegistry {
  const anthropicKey = keys?.anthropic ?? getKey("anthropic") ?? undefined;
  const openaiKey = keys?.openai ?? getKey("openai") ?? undefined;
  const veniceKey = keys?.venice ?? getKey("venice") ?? undefined;
  const googleKey = keys?.google ?? getKey("google") ?? undefined;

  const providers: ProviderMap = {};

  if (anthropicKey) {
    providers.anthropic = createAnthropic({ apiKey: anthropicKey });
  }

  if (openaiKey) {
    providers.openai = createOpenAI({ apiKey: openaiKey });
  }

  if (veniceKey) {
    providers.venice = createOpenAICompatible({
      name: "venice",
      baseURL: "https://api.venice.ai/api/v1",
      apiKey: veniceKey,
    });
  }

  if (googleKey) {
    providers.google = createGoogleGenerativeAI({ apiKey: googleKey });
  }

  // Ollama: configurable endpoints (default: localhost)
  const endpoints = keys?.ollamaEndpoints ?? [
    { name: "localhost", url: "http://localhost:11434/v1" },
  ];
  for (const ep of endpoints) {
    const name = endpoints.length === 1 ? "ollama" : `ollama-${ep.name}`;
    providers[name] = createOpenAICompatible({
      name,
      baseURL: ep.url,
    });
  }

  return createProviderRegistry(providers);
}
```

### Extending the Providers List (providers.ts)
```typescript
// Source: existing providers.ts
export const PROVIDERS = [
  "anthropic", "openai", "ollama", "venice", "google"
] as const;

export const PROVIDER_KEY_PREFIXES: Record<Provider, string | null> = {
  anthropic: "sk-ant-",
  openai: "sk-",
  ollama: null,
  venice: null,      // Venice uses bearer tokens, no standard prefix
  google: null,       // Google AI Studio uses AIzaSy... keys, variable format
};
```

### Venice Image Tool (skills/venice-image.ts)
```typescript
// Source: existing skills/image-gen.ts pattern + Venice image API docs
import { tool } from "ai";
import { z } from "zod";

export function createVeniceImageTool(apiKey?: string) {
  return tool({
    description: apiKey
      ? "Generate an image using Venice AI's image generation models."
      : "Venice image generation unavailable (no API key configured).",
    inputSchema: z.object({
      prompt: z.string().describe("Image description (up to 7500 chars)"),
      model: z.string().optional().describe("Venice image model ID"),
      width: z.number().optional().default(1024),
      height: z.number().optional().default(1024),
      negative_prompt: z.string().optional(),
      cfg_scale: z.number().min(0).max(20).optional(),
      safe_mode: z.boolean().optional().default(false),
    }),
    execute: async ({ prompt, model, width, height, negative_prompt, cfg_scale, safe_mode }) => {
      if (!apiKey) return { error: "Venice image gen unavailable" };
      try {
        const response = await fetch("https://api.venice.ai/api/v1/image/generate", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            model: model ?? "fluently-xl",
            prompt,
            width,
            height,
            negative_prompt,
            cfg_scale,
            safe_mode,
          }),
        });
        if (!response.ok) {
          const text = await response.text();
          return { error: `Venice image gen failed: ${response.status} ${text}` };
        }
        const data = await response.json();
        return { images: data.images, id: data.id };
      } catch (err) {
        return { error: `Venice image gen failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    },
  });
}
```

### Venice Video Tool (skills/venice-video.ts)
```typescript
// Source: Venice video API docs (queue/poll pattern)
import { tool } from "ai";
import { z } from "zod";

export function createVeniceVideoTool(apiKey?: string) {
  return tool({
    description: apiKey
      ? "Generate a video using Venice AI. Returns a queue ID to poll for results."
      : "Venice video generation unavailable (no API key configured).",
    inputSchema: z.object({
      prompt: z.string().describe("Video description"),
      model: z.string().optional().describe("Venice video model ID"),
      duration: z.number().optional().describe("Video duration in seconds"),
      resolution: z.enum(["1K", "2K", "4K"]).optional(),
    }),
    execute: async ({ prompt, model, duration, resolution }) => {
      if (!apiKey) return { error: "Venice video gen unavailable" };
      const baseURL = "https://api.venice.ai/api/v1";
      const headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };

      // Step 1: Queue the video
      const queueRes = await fetch(`${baseURL}/video/queue`, {
        method: "POST",
        headers,
        body: JSON.stringify({ model, prompt, duration, resolution }),
      });
      if (!queueRes.ok) {
        return { error: `Video queue failed: ${queueRes.status}` };
      }
      const { queue_id } = await queueRes.json();

      // Step 2: Poll for completion (max 5 minutes, 10s intervals)
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 10000));
        const pollRes = await fetch(`${baseURL}/video/retrieve`, {
          method: "POST",
          headers,
          body: JSON.stringify({ queue_id }),
        });
        if (pollRes.ok) {
          const data = await pollRes.json();
          if (data.status === "completed") {
            return { queue_id, status: "completed", video_url: data.video_url };
          }
        }
      }
      return { queue_id, status: "pending", message: "Video still processing. Use queue_id to check later." };
    },
  });
}
```

### Config Schema Extension
```typescript
// Source: existing core/src/config/schema.ts pattern
export const OllamaEndpointSchema = z.object({
  name: z.string(),
  url: z.string().url(),
});

// Add to AppConfigSchema:
ollamaEndpoints: z.array(OllamaEndpointSchema).optional(),
```

### Pricing Table Extensions
```typescript
// Venice pricing (approximate, based on Venice billing docs)
"venice:llama-3.3-70b": { inputPerMTok: 0.4, outputPerMTok: 0.4 },
"venice:deepseek-r1-671b": { inputPerMTok: 2.0, outputPerMTok: 2.0 },

// Google Gemini pricing (from Google AI Studio)
"google:gemini-2.5-pro": { inputPerMTok: 1.25, outputPerMTok: 10 },
"google:gemini-2.5-flash": { inputPerMTok: 0.15, outputPerMTok: 0.6 },
"google:gemini-2.0-flash": { inputPerMTok: 0.1, outputPerMTok: 0.4 },
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@ai-sdk/google-genai` | `@ai-sdk/google` | AI SDK v4+ | Use `@ai-sdk/google` -- it is the correct package for Google AI Studio/Gemini |
| Hardcoded Ollama localhost | Configurable baseURL | Phase 12 | Users can now connect to any Ollama instance |
| Venice had no video API | Queue-based video generation | Oct 2025 | Async queue/poll pattern required for video |

**Deprecated/outdated:**
- `@google/generative-ai`: This is Google's own SDK, not the AI SDK provider. Use `@ai-sdk/google` instead for AI SDK integration.
- Venice swagger at `api.venice.ai/doc/api/swagger.yaml`: Authoritative API spec, but docs.venice.ai is easier to consume.

## Open Questions

1. **Venice Video Model Availability**
   - What we know: Video generation uses queue/poll pattern with `/video/queue` and `/video/retrieve` endpoints.
   - What's unclear: Exact model IDs for video, pricing per video generation, whether API access requires a paid plan.
   - Recommendation: Fetch model list from `GET /models` at implementation time. Document that video gen may require a Venice subscription.

2. **Multiple Ollama Endpoint Naming Strategy**
   - What we know: A single Ollama provider uses `ollama:model` format. Multiple endpoints need disambiguation.
   - What's unclear: Best UX for users with multiple Ollama servers.
   - Recommendation: Use `ollama` for the first/default endpoint, `ollama-{name}` for additional ones. Keep backward compatibility with bare `ollama:` prefix.

3. **Registry Cache Invalidation**
   - What we know: Registry is a lazy singleton. Adding keys requires restart.
   - What's unclear: Whether users expect hot-reload of API keys.
   - Recommendation: Acceptable for Phase 12 MVP. Document the restart requirement. Consider `resetRegistry()` as future enhancement.

4. **Venice-Specific Parameters**
   - What we know: Venice supports `venice_parameters` in chat completions for features like `enable_web_search`, `character_slug`.
   - What's unclear: Whether `createOpenAICompatible` can pass through vendor-specific parameters.
   - Recommendation: Start with standard OpenAI-compatible parameters. Venice-specific params can be added later via custom headers or body extensions if needed.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `packages/gateway/src/llm/registry.ts`, `types.ts`, `router-rules.ts`, `stream.ts` -- verified current provider architecture
- Existing codebase: `packages/cli/src/vault/providers.ts` -- verified provider list and key prefix system
- Existing codebase: `packages/gateway/src/skills/image-gen.ts` -- verified raw-fetch tool pattern for image generation
- Existing codebase: `packages/gateway/src/agent/tool-registry.ts` -- verified how skill tools are registered with approval gates

### Secondary (MEDIUM confidence)
- [Venice API Docs](https://docs.venice.ai/api-reference/api-spec) -- OpenAI compatibility, base URL, auth method, image/video endpoints
- [AI SDK Google Provider](https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai) -- `@ai-sdk/google` installation, `createGoogleGenerativeAI` config, model IDs
- [AI SDK OpenAI-Compatible](https://ai-sdk.dev/providers/openai-compatible-providers/custom-providers) -- `createOpenAICompatible` API for custom providers
- [Venice Image Generate](https://docs.venice.ai/api-reference/endpoint/image/generate) -- Image endpoint parameters and response format

### Tertiary (LOW confidence)
- Venice video generation endpoints -- gathered from changelog and blog posts, not full API reference. Video endpoint paths (`/video/queue`, `/video/retrieve`, `/video/quote`, `/video/complete`) need implementation-time verification.
- Venice model pricing -- approximate, should be verified against billing documentation at implementation time.
- Google Gemini pricing -- based on public pricing pages, subject to change.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - AI SDK providers are well-documented; Venice OpenAI compatibility is confirmed
- Architecture: HIGH - Extension of existing patterns (registry, skills, vault) -- minimal new architecture
- Pitfalls: MEDIUM - Video async pattern and multi-endpoint Ollama need implementation-time validation

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (30 days -- provider APIs are stable)
