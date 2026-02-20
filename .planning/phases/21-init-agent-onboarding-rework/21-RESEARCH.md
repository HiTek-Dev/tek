# Phase 21: Init & Agent Onboarding Rework - Research

**Researched:** 2026-02-19
**Domain:** CLI command architecture, agent onboarding UX, gateway identity routing
**Confidence:** HIGH

## Summary

Phase 21 separates the monolithic `tek init` command into two distinct concerns: app-level infrastructure setup (`tek init`) and per-agent personality/identity onboarding (`tek onboard`). Currently, `tek init` (Onboarding.tsx) handles everything in one flow: security mode, API keys, Telegram, model selection, aliases, personality preset, agent name, user name, and workspace directory. The agent-specific steps (personality preset, agent name, user name, workspace) need to move into a new `tek onboard` command that can be run multiple times to create additional agents. The gateway currently resolves agentId from `config.agents.defaultAgentId` at build time -- this needs to become session-aware so `tek chat` can select which agent to use.

The codebase already has the foundational pieces: `AgentDefinitionSchema` in core/config/schema.ts, cascade identity resolution in db/memory/agent-resolver.ts, per-agent identity loading in identity-manager.ts and soul-manager.ts, and an AgentsPage in the desktop app with create/detail views. What is missing: (1) a CLI `tek onboard` command, (2) agent selection in `tek chat`, (3) per-session agentId in the WS protocol, and (4) gateway identity injection keyed to the active session's agent rather than the global default.

**Primary recommendation:** Extract agent-specific onboarding steps from Onboarding.tsx into a new AgentOnboarding.tsx component used by `tek onboard`. Strip `tek init` down to security mode + API keys + Telegram + model selection + aliases. Add `--agent <id>` flag to `tek chat` and an interactive agent picker when multiple agents exist. Extend `chat.send` WS protocol with optional `agentId` field so the gateway can inject the correct identity per session.

## Standard Stack

### Core

No new dependencies needed. This phase refactors existing code using existing libraries.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| commander | existing | CLI command definitions | Already used for all commands |
| ink / @inkjs/ui | existing | Terminal UI components (Select, TextInput, ConfirmInput) | Already used in Onboarding.tsx |
| zod | existing | Schema validation for AgentDefinition, WS protocol | Already used throughout |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tek/core | workspace | Config schema, loader, constants | Agent config persistence |
| @tek/db | workspace | Identity file management, agent-resolver | Agent directory creation, preset application |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Interactive agent picker in CLI | Always require `--agent` flag | Worse UX for multi-agent users; picker is friendlier |
| agentId in WS protocol | Per-connection config | Protocol approach is more flexible, supports agent switching mid-session |
| Separate `tek onboard` command | Keep everything in `tek init` | Separation makes conceptual distinction clear and allows onboarding additional agents independently |

## Architecture Patterns

### Current Architecture (What Exists)

```
tek init (Onboarding.tsx)
├── welcome
├── mode (security)
├── keys-ask/keys-provider/keys-input/keys-more
├── telegram-ask/telegram-input
├── model-select
├── model-alias-select/model-alias-name
├── hatch-ask (personality preset)
├── hatch-name (agent name + user name)
├── workspace
├── summary
└── done
```

All steps are in a single component with a single OnboardingResult type. The init.ts command handler writes everything to a single config.json and writes identity files to `~/.config/tek/memory/`.

### Target Architecture

```
tek init (slimmed Onboarding.tsx)
├── welcome
├── mode (security)
├── keys-ask/keys-provider/keys-input/keys-more
├── telegram-ask/telegram-input
├── model-select
├── model-alias-select/model-alias-name
├── summary (app-level only)
└── done → prompt: "Run tek onboard to create your first agent"

tek onboard [--name <name>] (new AgentOnboarding.tsx)
├── agent-name
├── user-display-name (if not already set in config)
├── personality-preset
├── model-override (optional, defaults to global default)
├── workspace-scope (full/limited)
├── workspace-dir (if limited)
├── purpose-description
├── summary
└── done → writes to config.agents.list + creates agent dir + identity files

tek chat [--agent <id>]
├── If 0 agents: prompt to run tek onboard
├── If 1 agent: auto-select
├── If multiple agents: show picker (Select component)
└── Pass agentId to gateway via chat.send
```

### Pattern 1: Slim Init + Separate Onboard

**What:** `tek init` handles only app-level infrastructure. `tek onboard` handles agent creation with personality, name, workspace, and purpose.

**When to use:** Always -- this is the core architectural change.

**Key files to modify:**
- `packages/cli/src/commands/init.ts` -- strip agent-specific logic
- `packages/cli/src/components/Onboarding.tsx` -- remove hatch-ask, hatch-name, workspace steps
- `packages/cli/src/commands/onboard.ts` -- NEW command
- `packages/cli/src/components/AgentOnboarding.tsx` -- NEW component
- `packages/cli/src/index.ts` -- register new command

### Pattern 2: Agent Selection in Chat

**What:** `tek chat` checks config.agents.list. If multiple agents exist, presents a Select picker before connecting. The selected agentId is passed through to the gateway.

**When to use:** Every chat session start when multiple agents are configured.

**Key files to modify:**
- `packages/cli/src/commands/chat.ts` -- add `--agent` option, agent picker logic
- `packages/cli/src/components/Chat.tsx` -- accept agentId prop
- `packages/gateway/src/ws/protocol.ts` -- add agentId to ChatSendSchema
- `packages/gateway/src/ws/handlers.ts` -- pass agentId through to assembleContext and tool registry

### Pattern 3: Per-Session Agent Identity in Gateway

**What:** Currently, agentId is resolved once from `loadConfig().agents.defaultAgentId` in handleChatSend and buildToolRegistry. This needs to become per-message, using the agentId from the chat.send WS message.

**When to use:** Every chat.send message processing.

**Key files to modify:**
- `packages/gateway/src/ws/handlers.ts` -- use msg.agentId instead of config default
- `packages/gateway/src/agent/tool-registry.ts` -- accept agentId parameter
- `packages/gateway/src/context/assembler.ts` -- already accepts agentId parameter (good)
- `packages/gateway/src/tools/memory.ts` -- already accepts agentId (good)

### Anti-Patterns to Avoid

- **Merging agent selection into init flow:** The whole point is separation. `tek init` should NOT create agents.
- **Hardcoded default agent assumption:** After this phase, there may be zero agents configured. Handle the empty-list case gracefully.
- **Storing agentId on ConnectionState globally:** Agent selection should be per-session or per-message, not per-connection, to support future agent switching.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLI agent picker | Custom arrow-key navigation | ink Select component | Already used in onboarding, handles terminal rendering |
| Agent ID generation | Custom slug generator | Existing `generateId()` pattern from AgentsPage.tsx | Lowercase hyphenated, already proven |
| Identity file seeding | Custom file copy logic | Existing `ensureMemoryFile()` + `applyPersonalityPreset()` from @tek/db | Handles templates, migration, directory creation |
| Config persistence | Manual JSON read/write | Existing `loadConfig()`/`saveConfig()` from @tek/core | Handles validation, directory creation |

**Key insight:** Nearly all the building blocks exist. This phase is primarily about restructuring existing code into the right commands, not building new infrastructure.

## Common Pitfalls

### Pitfall 1: Breaking Existing Single-Agent Users

**What goes wrong:** Users who ran `tek init` before this phase have no agents in config.agents.list. Their identity lives in `~/.config/tek/memory/`.
**Why it happens:** The old flow wrote identity to global memory, not per-agent dirs.
**How to avoid:** If config.agents.list is empty or undefined AND config.agentName exists, treat it as "legacy single agent" mode. Either auto-migrate to a default agent entry or keep backward-compatible global memory fallback (already exists in agent-resolver.ts).
**Warning signs:** `tek chat` shows agent picker with 0 options after upgrade.

### Pitfall 2: Agent Selection State Leak Between Sessions

**What goes wrong:** agentId set on ConnectionState persists across multiple chat sessions on the same WS connection.
**Why it happens:** Tool registry is cached on ConnectionState (connState.tools). If agent changes, cached tools have wrong agentId for memory_read.
**How to avoid:** Invalidate connState.tools when agentId changes. Or accept agentId from each chat.send message and rebuild memory tools accordingly.
**Warning signs:** Agent A's identity loaded when chatting with Agent B.

### Pitfall 3: Init/Onboard Ordering Confusion

**What goes wrong:** User runs `tek onboard` before `tek init` -- no API keys configured, can't specify model for agent.
**Why it happens:** `tek onboard` assumes infrastructure is configured.
**How to avoid:** `tek onboard` should check `configExists()` and prompt user to run `tek init` first if not configured.
**Warning signs:** Agent created with no model and no available providers.

### Pitfall 4: Desktop AgentsPage Divergence

**What goes wrong:** Desktop agents page already has a create flow (AgentsPage.tsx). CLI `tek onboard` creates agents differently, leading to inconsistent agent state.
**Why it happens:** Two separate UIs managing the same config.
**How to avoid:** Both should write to the same config.agents.list schema and create the same directory structure. Extract shared logic into @tek/db or @tek/core. Desktop work is deferred (phase goal says "Full code review and CLI verification before desktop work").
**Warning signs:** Agent created via desktop missing fields that CLI onboard adds.

### Pitfall 5: Workspace Dir Ownership Ambiguity

**What goes wrong:** Currently workspace dir is a global config field. With per-agent onboarding, workspace scope is per-agent but the old global field still exists.
**Why it happens:** AgentDefinitionSchema has `accessMode` but no `workspaceDir` field. Global config has `workspaceDir`.
**How to avoid:** Add optional `workspaceDir` to AgentDefinitionSchema. Per-agent workspace overrides global. Global workspace becomes fallback for agents without their own.
**Warning signs:** Limited-mode agent using wrong workspace directory.

## Code Examples

### Current: AgentDefinitionSchema (packages/core/src/config/schema.ts)

```typescript
export const AgentDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  model: z.string().optional(),
  description: z.string().optional(),
  accessMode: z.enum(["full", "limited"]).default("full"),
});
```

Needs extension:
```typescript
export const AgentDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  model: z.string().optional(),
  description: z.string().optional(),
  accessMode: z.enum(["full", "limited"]).default("full"),
  workspaceDir: z.string().optional(),
  personalityPreset: z.string().optional(),
  purpose: z.string().optional(),
  createdAt: z.string().datetime().optional(),
});
```

### Current: agentId Resolution in Handlers (packages/gateway/src/ws/handlers.ts)

```typescript
// Line 247 - hardcoded to global config default
const agentId = loadConfig()?.agents?.defaultAgentId ?? "default";
```

Needs to become:
```typescript
// Use agentId from the chat.send message, fallback to config default
const agentId = msg.agentId ?? loadConfig()?.agents?.defaultAgentId ?? "default";
```

### Current: ChatSendSchema (packages/gateway/src/ws/protocol.ts)

```typescript
const ChatSendSchema = z.object({
  type: z.literal("chat.send"),
  id: z.string(),
  sessionId: z.string().optional(),
  content: z.string(),
  model: z.string().optional(),
});
```

Needs extension:
```typescript
const ChatSendSchema = z.object({
  type: z.literal("chat.send"),
  id: z.string(),
  sessionId: z.string().optional(),
  content: z.string(),
  model: z.string().optional(),
  agentId: z.string().optional(),
});
```

### Current: Tool Registry Agent ID (packages/gateway/src/agent/tool-registry.ts)

```typescript
// Lines 276-278 - reads from global config at build time
const agentConfig = loadConfig();
const currentAgentId = agentConfig?.agents?.defaultAgentId;
const memoryRead = createMemoryReadTool(currentAgentId === "default" ? undefined : currentAgentId);
```

Needs to accept agentId as parameter:
```typescript
// Accept agentId from caller (handleChatSend passes from msg.agentId)
export async function buildToolRegistry(options: ToolRegistryOptions): Promise<Record<string, unknown>> {
  // ... existing code ...
  const memoryRead = createMemoryReadTool(options.agentId === "default" ? undefined : options.agentId);
```

### Agent Onboarding Command Pattern

```typescript
// packages/cli/src/commands/onboard.ts
export const onboardCommand = new Command("onboard")
  .description("Create and configure a new agent")
  .option("-n, --name <name>", "Agent name")
  .action(async (options) => {
    if (!configExists()) {
      console.error("Run 'tek init' first to set up API keys and global config.");
      process.exit(1);
    }
    // Render AgentOnboarding component
    // On complete: write to config.agents.list, create agent dir, seed identity files
  });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single `tek init` for everything | Separate init + onboard | Phase 21 | Cleaner conceptual separation, rerunnable agent creation |
| Global defaultAgentId in config | Per-session agentId in protocol | Phase 21 | Multi-agent chat sessions possible |
| Global workspace dir | Per-agent workspace dir | Phase 21 | Agent-specific workspace isolation |
| Agent created only via desktop | Agent created via CLI onboard | Phase 21 | CLI-first workflow restored |

## Key Files Inventory

### Files to MODIFY

| File | Changes | Confidence |
|------|---------|------------|
| `packages/cli/src/commands/init.ts` | Strip agent-specific logic (personality, name, workspace), add "run tek onboard" prompt | HIGH |
| `packages/cli/src/components/Onboarding.tsx` | Remove hatch-ask, hatch-name, workspace steps and related state | HIGH |
| `packages/cli/src/index.ts` | Register onboard command | HIGH |
| `packages/core/src/config/schema.ts` | Extend AgentDefinitionSchema with workspaceDir, purpose, createdAt | HIGH |
| `packages/gateway/src/ws/protocol.ts` | Add agentId to ChatSendSchema | HIGH |
| `packages/gateway/src/ws/handlers.ts` | Use msg.agentId for identity injection and tool registry | HIGH |
| `packages/gateway/src/agent/tool-registry.ts` | Accept agentId in options, pass to memory tools | HIGH |
| `packages/cli/src/commands/chat.ts` | Add --agent flag, agent picker, pass agentId to Chat component | HIGH |
| `packages/cli/src/components/Chat.tsx` | Accept agentId prop, pass in chat.send messages | HIGH |
| `packages/cli/src/lib/gateway-client.ts` | Update createChatSendMessage to include agentId | HIGH |

### Files to CREATE

| File | Purpose | Confidence |
|------|---------|------------|
| `packages/cli/src/commands/onboard.ts` | New `tek onboard` command | HIGH |
| `packages/cli/src/components/AgentOnboarding.tsx` | Onboarding wizard for agent creation | HIGH |

### Files ALREADY CORRECT (no changes needed)

| File | Why | Confidence |
|------|-----|------------|
| `packages/db/src/memory/agent-resolver.ts` | Cascade resolution already works per-agent | HIGH |
| `packages/db/src/memory/identity-manager.ts` | Already accepts agentId parameter | HIGH |
| `packages/db/src/memory/soul-manager.ts` | Already accepts agentId parameter | HIGH |
| `packages/gateway/src/context/assembler.ts` | Already accepts agentId parameter | HIGH |
| `packages/gateway/src/memory/memory-manager.ts` | Already accepts agentId parameter | HIGH |
| `packages/gateway/src/tools/memory.ts` | Already accepts agentId for memory_read | HIGH |
| `packages/db/src/memory/ensure-memory.ts` | applyPersonalityPreset works for any agent | HIGH |

## Open Questions

1. **Should `tek onboard` auto-set defaultAgentId to the newly created agent?**
   - What we know: Currently config.agents.defaultAgentId defaults to "default"
   - What's unclear: If user creates "atlas" agent, should "atlas" become the default?
   - Recommendation: Yes, first created agent becomes default. User can change via `tek config` later.

2. **Should legacy users (pre-phase-21) be auto-migrated to have a "default" agent entry in config.agents.list?**
   - What we know: agent-resolver.ts handles agentId=undefined/"default" by falling back to global memory dir
   - What's unclear: Whether to create an explicit config entry or keep the implicit fallback
   - Recommendation: Keep implicit fallback. No migration needed. `tek chat` with no agents list should work as before (use global identity). Only prompt for onboarding when user hasn't set agentName at all.

3. **Should the workspace step move entirely to `tek onboard` or remain as optional in `tek init`?**
   - What we know: workspace dir is currently global config. AgentDefinitionSchema has accessMode but no workspaceDir.
   - What's unclear: Whether global workspaceDir still makes sense alongside per-agent workspaceDir
   - Recommendation: Move workspace to `tek onboard` entirely. Remove from init. Per-agent workspace is cleaner. Global workspace becomes legacy fallback.

4. **Should `tek chat --agent` accept agent name or agent ID?**
   - What we know: Agent IDs are lowercase hyphenated from name. Names can have spaces/caps.
   - What's unclear: Which is more ergonomic for CLI
   - Recommendation: Accept both. Try exact ID match first, then case-insensitive name match. `tek chat --agent atlas` and `tek chat --agent "Research Assistant"` both work.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of all files listed in Key Files Inventory
- `packages/core/src/config/schema.ts` -- AgentDefinitionSchema, AppConfigSchema
- `packages/cli/src/components/Onboarding.tsx` -- current step flow, 677 lines
- `packages/gateway/src/ws/handlers.ts` -- current agentId resolution, tool registry build
- `packages/db/src/memory/agent-resolver.ts` -- cascade identity resolution

### Secondary (MEDIUM confidence)
- Phase 18 research and recommendations (18-RESEARCH.md, 18-RECOMMENDATIONS.md)
- Phase 19/20 decisions documented in STATE.md

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all existing libraries
- Architecture: HIGH - clear separation pattern, all building blocks exist
- Pitfalls: HIGH - identified from direct codebase analysis of current state

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (stable -- internal refactoring, no external dependencies)
