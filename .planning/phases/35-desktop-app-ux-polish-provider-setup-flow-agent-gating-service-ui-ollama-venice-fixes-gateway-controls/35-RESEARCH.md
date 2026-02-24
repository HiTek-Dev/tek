# Phase 35: Desktop App UX Polish - Research

**Researched:** 2026-02-24
**Domain:** Tauri v2 desktop app UX, provider setup flows, gateway shell control
**Confidence:** HIGH

## Summary

This phase addresses nine user feedback items covering the desktop app's provider setup UX, agent gating, service configuration UI, Ollama/Venice provider bugs, and gateway controls. The core issues are: (1) providers UI uses a card-grid + separate detail panel instead of an inline flow, (2) agents tab is accessible with zero configured providers, (3) Ollama discovery at `localhost:11434` fails silently, (4) Venice key testing returns "No API key configured" because the test handler checks `getKey()` before the key is saved for a fresh provider, (5) the model picker shows bare model IDs without provider prefix, and (6) gateway start/stop/restart from the desktop app fails because the Tauri shell capability is `shell:default` (which only grants URL opening, not command execution).

The desktop app is a Tauri v2 application (React + Zustand + TailwindCSS v4) communicating with the gateway over WebSocket. All changes are within `apps/desktop/` (frontend views, components, hooks, lib) and `apps/desktop/src-tauri/capabilities/default.json` (shell permissions). A small gateway-side fix is needed in `packages/gateway/src/ws/vault-handlers.ts` for the Venice test and Ollama discovery logic.

**Primary recommendation:** Fix the gateway shell permissions first (unblocks gateway controls), then restructure provider/service UIs to inline flow pattern, add provider-gating for agents, fix Ollama discovery and Venice test bugs, and update model pickers with `provider/model` format.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.1.0 | UI framework | Already in use |
| Zustand | ^5.0.5 | State management | Already in use, lightweight |
| TailwindCSS | ^4.1.4 | Styling | Already in use |
| lucide-react | ^0.487.0 | Icons | Already in use |
| @tauri-apps/plugin-shell | ^2.2.0 | Shell command execution | Already in use, needed for gateway control |
| @tauri-apps/plugin-fs | ^2.2.0 | File system access | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-variance-authority | ^0.7.1 | Variant-based component styling | Already in use for UI components |
| react-error-boundary | ^6.0.0 | Error boundaries | Already in use |

### Alternatives Considered
None -- this phase uses only the existing stack. No new dependencies needed.

**Installation:**
No new packages required.

## Architecture Patterns

### Recommended Project Structure
```
apps/desktop/src/
  views/
    ProvidersView.tsx      # Refactored: inline detail pattern
    ServicesView.tsx        # Refactored: inline detail pattern
    AgentsView.tsx          # Gated: requires configured provider
  components/
    providers/
      ProviderCard.tsx      # Simplified card for grid
      ProviderDetail.tsx    # Refactored: inline config form
      ModelTable.tsx        # Enhanced: checkboxes + custom entry
    services/
      TelegramSetup.tsx     # Already inline pattern
      BraveSetup.tsx        # Already inline pattern
  hooks/
    useGatewayControl.ts    # Shell command execution for gateway
  stores/
    app-store.ts            # Add providersConfigured state
  lib/
    gateway-client.ts       # Protocol types (no changes needed)
apps/desktop/src-tauri/
  capabilities/default.json # Shell execute permission + scope
packages/gateway/src/ws/
  vault-handlers.ts         # Fix Venice test, Ollama discover
```

### Pattern 1: Inline Detail Flow (Provider/Service Config)
**What:** When user clicks a provider card, the card grid hides and the config form appears in place with a back button. This replaces the current pattern where the detail panel appears below the grid.
**When to use:** Provider and Service configuration views.
**Example:**
```typescript
// Current: grid always visible, detail below
<div className="grid ...">
  {providers.map(p => <ProviderCard ... />)}
</div>
{selected && <ProviderDetail ... />}

// Target: grid OR detail, never both
{selectedProvider ? (
  <ProviderDetail
    onBack={() => setSelectedProvider(null)}
    ...
  />
) : (
  <div className="grid ...">
    {providers.map(p => <ProviderCard ... />)}
  </div>
)}
```

### Pattern 2: Provider-Gated Navigation
**What:** Certain tabs (Agents) are disabled until at least one provider has a valid API key configured. The NavSidebar reads provider status from the app store.
**When to use:** Agents tab, and potentially Chat view.
**Example:**
```typescript
// In app-store.ts
interface AppState {
  // ... existing
  hasConfiguredProvider: boolean;
  setHasConfiguredProvider: (v: boolean) => void;
}

// In NavSidebar.tsx
<NavItem
  icon={Bot}
  label="Agents"
  disabled={!hasConfiguredProvider}
  onClick={() => hasConfiguredProvider && navigate("agents")}
/>
```

### Pattern 3: Startup Provider Check
**What:** On app startup (in App.tsx ViewRouter or LandingView), after gateway connects, check if any providers are configured. If none, redirect to providers page with a banner explaining the requirement.
**When to use:** App startup flow after gateway connection established.
**Example:**
```typescript
// In ViewRouter or a new useStartupCheck hook
useEffect(() => {
  if (!connected) return;
  // Check provider status
  request<VaultKeysListResult>(createVaultKeysList()).then(result => {
    const hasProvider = result.providers.some(p => p.configured);
    setHasConfiguredProvider(hasProvider);
    if (!hasProvider && currentView === "chat") {
      setCurrentView("providers");
    }
  });
}, [connected]);
```

### Pattern 4: Provider/Model Combo Display
**What:** Model pickers show `provider/model` format (e.g., "venice/llama-3.3-70b") instead of bare model IDs.
**When to use:** Agent create form model picker, ModelRoutingEditor, ModelSelector in chat.
**Example:**
```typescript
// ModelSelector already does this with provider:modelId format
// Agent create form and routing editor need the same treatment:
// Instead of hardcoded MODEL_OPTIONS, fetch from gateway
const allModels = await fetchConfiguredProviderModels();
// Display as "anthropic/claude-sonnet-4" instead of "claude-sonnet-4-20250514"
```

### Anti-Patterns to Avoid
- **Hardcoded model lists in agent forms:** The AgentsView and ModelRoutingEditor have hardcoded MODEL_OPTIONS arrays. These should fetch from configured providers via the gateway, matching what ModelSelector already does.
- **Silent error swallowing:** Many catch blocks are empty `catch {}`. Provider setup errors should be surfaced to the user.
- **Polling for provider status:** Don't poll. Fetch provider status on mount and after save operations. The existing pattern is correct.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Shell command scoping | Custom IPC for gateway control | Tauri v2 shell plugin scoped commands | Security model built into Tauri |
| Provider model lists | Hardcoded arrays in frontend | Gateway `provider.models.list` RPC | Single source of truth, already exists |
| Form state management | Custom form library | React useState (existing pattern) | Forms are simple enough, no library needed |

**Key insight:** The gateway already has the provider.models.list RPC and vault.keys.list/test RPCs. The frontend just needs to wire them up properly instead of maintaining duplicate hardcoded lists.

## Common Pitfalls

### Pitfall 1: Tauri v2 Shell Scoped Commands
**What goes wrong:** `Command.create("tek", ["gateway", "start"])` silently fails because `shell:default` only grants URL opening.
**Why it happens:** Tauri v2 shell plugin requires explicit `shell:allow-execute` or `shell:allow-spawn` permissions, plus a scoped command definition. The current capabilities only have `shell:default`.
**How to avoid:** Add proper shell scoping in `capabilities/default.json`:
```json
{
  "identifier": "shell:allow-execute",
  "allow": [
    {
      "name": "tek",
      "cmd": "tek",
      "args": [
        { "validator": "regex", "value": "^gateway$" },
        { "validator": "regex", "value": "^(start|stop)$" }
      ]
    }
  ]
}
```
Note: Tauri v2 uses a different scoping format than v1. The `Command.create(program, args)` call requires the `program` name to be registered in the shell scope. In Tauri 2, the scoped shell configuration goes in the capabilities JSON file with the specific program name and allowed argument patterns.
**Warning signs:** Gateway start/stop buttons click but nothing happens, no error visible. Check browser console for Tauri permission errors.

### Pitfall 2: Ollama Discovery URL Mismatch
**What goes wrong:** Ollama discovery calls `${url}/api/tags` but the URL default is `http://localhost:11434` which is correct. However, the discovery result is discarded -- `handleDiscover` in ProvidersView.tsx does `await request<OllamaDiscoverResult>(msg)` and ignores the result.
**Why it happens:** The comment says "Discovery results would feed into a ModelTable in a future iteration" -- this iteration.
**How to avoid:** Actually use the OllamaDiscoverResult to populate models:
```typescript
const handleDiscover = async (url: string) => {
  const msg = createOllamaDiscover(url);
  const result = await request<OllamaDiscoverResult>(msg);
  if (result.models.length > 0) {
    // Map ollama model names to ModelRow format for the ModelTable
    setModels(result.models.map(m => ({
      modelId: m.name, name: m.name, enabled: true, tier: "standard"
    })));
  }
};
```

### Pitfall 3: Venice Key Test Race Condition
**What goes wrong:** Venice "test key" returns "No API key configured" even after saving. The vault-handlers.ts `handleVaultKeysTest` checks `getKey(provider)` which reads from the OS keychain. If the key was just set via `handleVaultKeysSet`, there shouldn't be a race -- but the desktop UI flow may be calling test before save completes, or there's a keychain caching issue.
**Why it happens:** Looking at the code, the ProviderDetail save and test are separate actions. User saves key, then clicks "Test Key". The save calls `onSave(apiKey)` -> `handleSave(provider, value)` in ProvidersView -> `createVaultKeysSet` RPC. The test calls `onTest(provider)` which calls `createVaultKeysTest`. If these are called in sequence, save should complete first. The more likely issue is that Venice is a provider that goes through `validateProvider()` which checks against the PROVIDERS list -- "venice" IS in the list. The real issue might be that the key isn't persisted properly or the flow allows testing before saving (user clicks Test without clicking Save first).
**How to avoid:** The provider detail should either (a) auto-save when testing, or (b) combine save+test into a single "Save & Test" action. The current UI has separate Save and Test buttons which is confusing.

### Pitfall 4: Agent Model Picker Hardcoded Options
**What goes wrong:** AgentsView create form and ModelRoutingEditor use hardcoded `MODEL_OPTIONS` arrays that don't reflect what's actually configured/available.
**Why it happens:** These were built before the provider.models.list RPC existed or before the ModelSelector pattern was established.
**How to avoid:** Reuse the same fetch-from-configured-providers pattern that ModelSelector uses. Create a shared hook `useAvailableModels()` that fetches configured providers, then fetches models for each.

### Pitfall 5: Tauri v2 Shell Plugin Scope Format
**What goes wrong:** Using Tauri v1-style shell scope syntax in v2 config.
**Why it happens:** Documentation confusion between v1 and v2.
**How to avoid:** In Tauri 2, shell scoping uses a different format. The capabilities JSON needs to use the permission identifier format, and the `Command.create()` first argument must match a registered program name. The program needs to be defined in the shell scope with allowed arguments.

## Code Examples

### Tauri v2 Shell Capability Configuration
```json
// apps/desktop/src-tauri/capabilities/default.json
// Add these to the permissions array:
"shell:allow-execute",
"shell:allow-spawn",
"shell:allow-kill",
{
  "identifier": "shell:allow-execute",
  "allow": [
    { "name": "tek", "cmd": "tek", "args": true }
  ]
}
```
Note: The exact Tauri v2 scoped shell command format should be verified against the Tauri 2 documentation. The key requirement is that the `tek` program must be registered as an allowed command. The simplest approach may be to use `"shell:allow-execute"` without scope restrictions during development, then tighten scope for production.

### Inline Provider Detail Pattern
```typescript
// ProvidersView.tsx - show either grid or detail
export function ProvidersView() {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  if (selectedProvider) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => setSelectedProvider(null)}>
          <ArrowLeft className="size-4" /> Back to Providers
        </Button>
        <ProviderDetail
          provider={selectedProvider}
          onBack={() => setSelectedProvider(null)}
          // ... other props
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {providers.map(p => <ProviderCard key={p.provider} onClick={() => setSelectedProvider(p.provider)} ... />)}
      </div>
    </div>
  );
}
```

### Shared Available Models Hook
```typescript
// hooks/useAvailableModels.ts
export function useAvailableModels() {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(false);
  const { request, connected } = useGatewayRpc();

  const fetchModels = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    try {
      const providersResult = await request<VaultKeysListResult>(createVaultKeysList());
      const configured = providersResult.providers
        .filter(p => p.configured)
        .map(p => p.provider)
        .filter(p => !["telegram", "brave", "tavily"].includes(p));

      const allModels: ModelOption[] = [];
      for (const provider of configured) {
        const result = await request<ProviderModelsListResult>(
          createProviderModelsList(provider)
        );
        for (const m of result.models) {
          allModels.push({
            modelId: m.modelId,
            displayName: `${provider}/${m.name}`,
            fullId: `${provider}:${m.modelId}`,
            provider,
            tier: m.tier,
          });
        }
      }
      setModels(allModels);
    } finally {
      setLoading(false);
    }
  }, [connected, request]);

  return { models, loading, fetchModels };
}
```

### Provider-Gated Agent Navigation
```typescript
// In NavSidebar.tsx - disable Agents tab when no providers configured
const hasProvider = useAppStore(s => s.hasConfiguredProvider);

<NavItem
  icon={Bot}
  label="Agents"
  active={currentView === "agents" || currentView === "agent-detail"}
  onClick={() => hasProvider && navigate("agents")}
  disabled={!hasProvider}
  tooltip={!hasProvider ? "Configure at least one provider first" : undefined}
/>
```

### Venice Known Models with Checkboxes
```typescript
// In vault-handlers.ts, enhance Venice model list
venice: [
  { modelId: "llama-3.3-70b", name: "Llama 3.3 70B", tier: "standard" },
  { modelId: "deepseek-r1-671b", name: "DeepSeek R1 671B", tier: "high" },
  { modelId: "dolphin-2.9.3-mistral-7b", name: "Dolphin 2.9.3 Mistral 7B", tier: "budget" },
  { modelId: "llama-3.2-3b", name: "Llama 3.2 3B", tier: "budget" },
  { modelId: "nous-theta-8b", name: "Nous Theta 8B", tier: "budget" },
],
// Plus custom model entry in ProviderDetail ModelTable
```

### Startup Provider Check
```typescript
// In App.tsx ViewRouter
useEffect(() => {
  if (!config) return;
  if (config.onboardingComplete && currentView !== "onboarding") {
    // After onboarding, check if providers are configured
    // This is driven by the providers check from gateway RPC
  }
}, [config, currentView]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri v1 `allowlist` shell config | Tauri v2 capabilities + permissions | Tauri 2.0 (2024) | Must use new permission format |
| Static hardcoded model lists | Dynamic model fetching from gateway | Phase 31 (ModelSelector) | Agent forms should follow same pattern |
| Separate detail panel below grid | Inline detail replacing grid | UX feedback (Phase 35) | Better mobile/narrow-screen experience |

**Deprecated/outdated:**
- Tauri v1 `tauri.conf.json` allowlist format: replaced by capabilities JSON in v2
- Hardcoded MODEL_OPTIONS arrays: should use gateway RPC `provider.models.list`

## Open Questions

1. **Tauri v2 exact shell scope syntax**
   - What we know: `shell:default` only grants URL opening. `shell:allow-execute` exists. `Command.create("tek", args)` needs the program registered.
   - What's unclear: The exact JSON format for scoping the `tek` command in capabilities. Tauri v2 docs suggest the `name` field in Command.create must match a program configured in the shell scope, but the config format differs from v1.
   - Recommendation: Start with unrestricted `shell:allow-execute` to verify it works, then add scoped restrictions. Test with `tauri dev` mode.

2. **Venice API model listing endpoint**
   - What we know: Venice uses OpenAI-compatible API at `https://api.venice.ai/api/v1`. The models endpoint exists at `/api/v1/models`.
   - What's unclear: Whether we can dynamically fetch the Venice model list instead of hardcoding, and what the response format looks like.
   - Recommendation: Try fetching from the models endpoint. If it works, use dynamic list. If not, keep the known models list but ensure it's up to date and include a custom model entry field.

3. **Ollama discovery vs. provider.models.list integration**
   - What we know: `ollama.discover` returns `{name, size, modifiedAt}` while `provider.models.list` for ollama returns empty array `[]`. These are disconnected.
   - What's unclear: Should `provider.models.list` for ollama automatically call the discover endpoint? Or should discovery results be cached and served from provider.models.list?
   - Recommendation: Have `handleProviderModelsList` for ollama call the discover endpoint internally (fetch `http://localhost:11434/api/tags`). Fall back to empty if Ollama isn't running. This gives a unified interface.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `apps/desktop/src/` -- all views, components, hooks, stores
- Codebase analysis: `apps/desktop/src-tauri/capabilities/default.json` -- current Tauri permissions
- Codebase analysis: `packages/gateway/src/ws/vault-handlers.ts` -- gateway provider handlers
- Codebase analysis: `packages/gateway/src/llm/registry.ts` -- LLM provider registry
- Codebase analysis: `packages/core/src/vault/` -- keychain vault implementation
- Tauri v2 schema: `apps/desktop/src-tauri/gen/schemas/desktop-schema.json` -- shell permission definitions confirm `shell:default` = `allow-open` only

### Secondary (MEDIUM confidence)
- Tauri v2 shell plugin documentation patterns from schema descriptions

### Tertiary (LOW confidence)
- Exact Tauri v2 scoped shell command JSON format -- needs validation against official Tauri 2 docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing tech
- Architecture: HIGH -- patterns identified from existing code (ModelSelector, ServicesView already has inline pattern)
- Pitfalls: HIGH for shell permissions, MEDIUM for Venice/Ollama specifics (keychain behavior needs testing)
- Gateway fixes: HIGH -- clear bugs in vault-handlers.ts visible in code

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (stable -- internal codebase changes only)
