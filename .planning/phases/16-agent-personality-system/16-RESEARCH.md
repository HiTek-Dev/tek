# Phase 16: Agent Personality System - Research

**Researched:** 2026-02-18
**Domain:** Multi-file identity architecture, personality evolution, multi-agent isolation, context assembly
**Confidence:** MEDIUM-HIGH

## Summary

Phase 16 builds the Agent Personality System as recommended by Phase 18 (Onboarding Research). The core work is expanding tek's single-file SOUL.md personality into a structured multi-file identity architecture (SOUL.md, IDENTITY.md, USER.md, STYLE.md, AGENTS.md), adding a personality evolution mechanism with user-approved diff-style proposals, creating a migration path for existing users, and implementing per-agent identity isolation under `~/.config/tek/agents/`.

The existing codebase provides strong foundations. The `packages/db/src/memory/` module already manages SOUL.md and MEMORY.md with template seeding and migration from old locations. The `packages/gateway/src/context/assembler.ts` loads soul, long-term memory, and daily logs into the system prompt with token measurement. The `packages/gateway/src/ws/protocol.ts` uses Zod discriminated unions for all WS messages. Phase 15 adds personality presets, BOOTSTRAP.md, and config fields (agentName, userDisplayName) that Phase 16 builds upon.

This phase is primarily about file management, context assembly expansion, and WS protocol additions. No new external libraries are needed. The implementation uses existing patterns: markdown files loaded by `@tek/db` functions, injected into context by the assembler, with config stored in `~/.config/tek/config.json`.

**Primary recommendation:** Implement in four work areas: (1) new identity file managers in `@tek/db`, (2) expanded context assembler loading all identity files with token budgets, (3) soul evolution WS protocol extension, (4) multi-agent directory isolation with cascade resolution.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `fs` | built-in | Read/write markdown identity files | Existing pattern in soul-manager.ts, ensure-memory.ts |
| Zod | existing | WS protocol schema for soul evolution messages | Existing pattern in protocol.ts |
| `tokenx` | existing | Token counting for identity file budget enforcement | Existing in context assembler |
| `@tek/core` | monorepo | CONFIG_DIR, AppConfig, loadConfig/saveConfig | Single source of truth for paths and config |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `nanoid` | existing | Generate unique IDs for agent directories | When creating new agent profiles |
| `diff` | npm latest | Generate readable diffs for soul evolution proposals | When rendering proposed personality changes |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain file read/write | Database-backed personality | Over-engineering; markdown IS the config language |
| `diff` npm package | Manual string comparison | `diff` produces clean unified diffs cheaply; worth the tiny dependency |
| Per-agent config.json sections | Per-agent separate config files | Config.json sections keep everything in one place; separate files fragment settings |

**Installation:**
```bash
npm install diff
npm install -D @types/diff
```

## Architecture Patterns

### Recommended Project Structure

```
packages/db/
  src/memory/
    soul-manager.ts          # Existing: loadSoul(), evolveSoul() -- EXPAND
    identity-manager.ts      # NEW: loadIdentity(), loadStyle(), loadUser()
    agent-resolver.ts        # NEW: resolveAgentDir(), cascade resolution
    ensure-memory.ts         # Existing: ensureMemoryFile() -- EXPAND for new files
    migration.ts             # NEW: migrate single-file to multi-file
    memory-curator.ts        # Existing: MEMORY.md management
    daily-logger.ts          # Existing: daily/ log management
    index.ts                 # Existing: expand exports
  memory-files/
    SOUL.md                  # EXPAND: richer 50-150 line template
    IDENTITY.md              # NEW: name, emoji, avatar template
    USER.md                  # NEW: static user context template
    STYLE.md                 # NEW: writing style guide template
    AGENTS.md                # NEW: multi-agent coordination template
    MEMORY.md                # Existing: keep as-is
    presets/                 # Added by Phase 15
    daily/

packages/gateway/
  src/context/
    assembler.ts             # EXPAND: load all identity files, token budgets
    types.ts                 # EXPAND: new section names
  src/memory/
    memory-manager.ts        # EXPAND: getMemoryContext() returns all files
  src/ws/
    protocol.ts              # EXPAND: soul.evolution.propose, soul.evolution.response
    handlers.ts              # EXPAND: handleSoulEvolutionResponse

packages/core/
  src/config/
    schema.ts                # EXPAND: agents config section in AppConfigSchema
```

### Pattern 1: Multi-File Identity Loading

**What:** Each identity file has its own loader function in `@tek/db`, following the exact pattern of existing `loadSoul()`. Each function calls `ensureMemoryFile()` to seed from template on first run, reads the file, returns empty string if missing.

**When to use:** Always -- every identity file follows this pattern.

**Example:**
```typescript
// packages/db/src/memory/identity-manager.ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR } from "@tek/core";
import { ensureMemoryFile } from "./ensure-memory.js";

const IDENTITY_PATH = join(CONFIG_DIR, "memory", "IDENTITY.md");

export function loadIdentity(): string {
  ensureMemoryFile("IDENTITY.md", "IDENTITY.md");
  if (!existsSync(IDENTITY_PATH)) return "";
  return readFileSync(IDENTITY_PATH, "utf-8");
}
```

**Source:** Existing pattern in `packages/db/src/memory/soul-manager.ts`

### Pattern 2: Expanded Context Assembly

**What:** The assembler loads all identity files and injects them into the system prompt in priority order. Token measurement tracks each file separately. A total token budget for identity files (3000 tokens) is enforced with a warning logged if exceeded.

**When to use:** Every LLM call.

**Example:**
```typescript
// In assembler.ts - expanded getMemoryContext() return type
const memoryCtx = memoryManager.getMemoryContext();

const systemParts = [
  userSystemPrompt,
  memoryCtx.soul     ? `\n\n# Your Identity\n${memoryCtx.soul}` : "",
  memoryCtx.identity ? `\n\n# Your Presentation\n${memoryCtx.identity}` : "",
  memoryCtx.style    ? `\n\n# Communication Style\n${memoryCtx.style}` : "",
  memoryCtx.user     ? `\n\n# About the User\n${memoryCtx.user}` : "",
  memoryCtx.agents   ? `\n\n# Agent Coordination\n${memoryCtx.agents}` : "",
  memoryCtx.longTermMemory ? `\n\n# Long-Term Memory\n${memoryCtx.longTermMemory}` : "",
  memoryCtx.recentLogs     ? `\n\n# Recent Activity\n${memoryCtx.recentLogs}` : "",
].filter(Boolean).join("");
```

**Source:** Existing pattern in `packages/gateway/src/context/assembler.ts` lines 76-81

### Pattern 3: WS Protocol Extension for Soul Evolution

**What:** Add `soul.evolution.propose` (server->client) and `soul.evolution.response` (client->server) to the existing Zod discriminated union in protocol.ts. Follows the exact same pattern as tool approval request/response.

**When to use:** When the agent detects a personality adjustment opportunity.

**Example:**
```typescript
// Server message: propose a soul change
const SoulEvolutionProposeSchema = z.object({
  type: z.literal("soul.evolution.propose"),
  requestId: z.string(),
  file: z.string(),           // e.g., "SOUL.md", "STYLE.md"
  section: z.string(),        // e.g., "Learned Preferences"
  currentContent: z.string(), // existing section content
  proposedContent: z.string(),// proposed replacement
  reason: z.string(),         // why the agent suggests this
});

// Client message: approve or reject
const SoulEvolutionResponseSchema = z.object({
  type: z.literal("soul.evolution.response"),
  id: z.string(),
  requestId: z.string(),
  approved: z.boolean(),
  editedContent: z.string().optional(), // user may edit before approving
});
```

**Source:** Mirrors `tool.approval.request` / `tool.approval.response` pattern in protocol.ts

### Pattern 4: Agent Directory Isolation with Cascade Resolution

**What:** Each agent gets a directory under `~/.config/tek/agents/{agentId}/` containing its own SOUL.md, IDENTITY.md, STYLE.md, MEMORY.md, and daily/. A shared USER.md lives in `~/.config/tek/agents/shared/`. Cascade resolution: agent-specific file > shared file > global memory file > template default.

**When to use:** When loading identity files for a specific agent context.

**Example:**
```typescript
// packages/db/src/memory/agent-resolver.ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR } from "@tek/core";

const AGENTS_DIR = join(CONFIG_DIR, "agents");
const SHARED_DIR = join(AGENTS_DIR, "shared");
const GLOBAL_MEMORY_DIR = join(CONFIG_DIR, "memory");

export function resolveIdentityFile(
  agentId: string | undefined,
  filename: string,
): string {
  // 1. Agent-specific
  if (agentId) {
    const agentPath = join(AGENTS_DIR, agentId, filename);
    if (existsSync(agentPath)) return readFileSync(agentPath, "utf-8");
  }

  // 2. Shared (for USER.md)
  const sharedPath = join(SHARED_DIR, filename);
  if (existsSync(sharedPath)) return readFileSync(sharedPath, "utf-8");

  // 3. Global memory directory (backward-compatible)
  const globalPath = join(GLOBAL_MEMORY_DIR, filename);
  if (existsSync(globalPath)) return readFileSync(globalPath, "utf-8");

  return "";
}
```

### Pattern 5: Migration from Single-File to Multi-File

**What:** A migration function that runs on first startup after upgrade. Reads existing SOUL.md from `~/.config/tek/memory/SOUL.md`, splits its content into new files (SOUL.md philosophy, IDENTITY.md presentation, STYLE.md tone), preserves Learned Preferences verbatim, extracts static user facts from MEMORY.md into USER.md. Creates backup before splitting. Idempotent (checks if migration already ran via a marker file or presence of new files).

**When to use:** Once, automatically on first startup after upgrade.

**Example:**
```typescript
// packages/db/src/memory/migration.ts
const MIGRATION_MARKER = join(CONFIG_DIR, "memory", ".v2-migrated");

export function migrateToMultiFile(): { migrated: boolean; backup?: string } {
  if (existsSync(MIGRATION_MARKER)) return { migrated: false };

  const soulContent = loadSoul();
  if (!soulContent) {
    // No existing soul -- just ensure new templates
    writeFileSync(MIGRATION_MARKER, new Date().toISOString());
    return { migrated: false };
  }

  // Create backup
  const backupPath = join(CONFIG_DIR, "memory", `SOUL.md.backup-${Date.now()}`);
  copyFileSync(getSoulPath(), backupPath);

  // Split content into new files
  // ... (section extraction logic)

  writeFileSync(MIGRATION_MARKER, new Date().toISOString());
  return { migrated: true, backup: backupPath };
}
```

### Anti-Patterns to Avoid

- **Database-backed personality:** Adding personality tables to SQLite when markdown files loaded into system prompt work identically. The soul IS the file.
- **Custom NLP for style calibration:** Building a style analysis pipeline when the LLM itself is the best style analyzer. Feed writing samples to the LLM, let it generate STYLE.md.
- **Personality CRUD APIs:** Files do not need an API layer. Direct read/write with git versioning is the right pattern.
- **SOUL.md over 150 lines:** Token waste and instruction dilution. Split into multiple files instead.
- **Form-based personality editing:** Use the conversational model (agent proposes, user approves) instead of forms.
- **Auto-evolving without approval:** Always require user confirmation for any identity file changes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Diff rendering | Custom string diff algorithm | `diff` npm package | Battle-tested, handles edge cases, unified diff format |
| Markdown section extraction | Full markdown parser | Regex on `## ` headers | Identity files are simple markdown; full parser is overkill |
| Token counting | Custom tokenizer | Existing `tokenx` (already in context assembler) | Already integrated, proven accuracy |
| File template seeding | Custom template engine | `ensureMemoryFile()` pattern (already exists) | Copy-on-first-use is the established pattern |
| Agent routing | Custom routing engine | Config-driven binding rules in config.json | Config is declarative and user-editable |

**Key insight:** This phase is pure file management + context assembly. No new external services, no databases, no complex algorithms. The LLM reads markdown natively -- markdown IS the configuration language.

## Common Pitfalls

### Pitfall 1: Breaking Existing SOUL.md Users

**What goes wrong:** Upgrade silently overwrites customized SOUL.md with the new expanded template, losing user-added Learned Preferences and custom personality content.
**Why it happens:** Template seeding logic (`ensureMemoryFile`) copies template when file doesn't exist, but an upgrade might change the template without checking existing content.
**How to avoid:** Migration must be explicit and backup-first. `ensureMemoryFile()` already skips copy if file exists (line 35-37 of ensure-memory.ts). Migration script handles the split separately with backup + confirmation.
**Warning signs:** User complaints about lost personality after upgrade.

### Pitfall 2: Token Budget Explosion

**What goes wrong:** Loading 5+ identity files into every system prompt exceeds reasonable token budgets, increasing cost and reducing conversation context window.
**Why it happens:** Each file is loaded unconditionally without size checking.
**How to avoid:** Enforce a 3000-token combined budget for soul + identity + style (as specified in Phase 18 recommendations). Log a warning when budget is exceeded. Add per-section token estimates to the context inspector so users can see the cost. Make USER.md and AGENTS.md loadable conditionally (private vs group sessions).
**Warning signs:** Context inspection shows identity sections consuming >5000 tokens.

### Pitfall 3: Agent Directory Sprawl

**What goes wrong:** Creating agent directories for every config entry even when the user only has one agent, cluttering the filesystem.
**Why it happens:** Eager directory creation during init.
**How to avoid:** Lazy directory creation -- only create agent-specific directories when the user explicitly adds a second agent. The default agent uses the existing `~/.config/tek/memory/` directory (backward-compatible). Only when `agents.list` has >1 entry do per-agent directories get created.
**Warning signs:** Empty directories under `~/.config/tek/agents/` for users who never configured multi-agent.

### Pitfall 4: Circular Soul Evolution

**What goes wrong:** Agent proposes a personality change, user approves, but the change causes the agent to behave differently, which triggers another proposal, creating an unstable feedback loop.
**Why it happens:** Evolution proposals are triggered reactively without cooldown.
**How to avoid:** Add a cooldown period (e.g., 1 evolution proposal per session maximum, or per-section cooldown). Track last evolution timestamp in a `.evolution-log` file. Rate-limit proposals server-side.
**Warning signs:** Multiple soul evolution proposals in a single conversation.

### Pitfall 5: Inconsistent File Loading Between Gateway and DB

**What goes wrong:** `@tek/db` and `@tek/gateway` both load identity files but with different logic (e.g., different fallback paths, different agent resolution).
**Why it happens:** Identity loading logic leaks into the gateway layer instead of being centralized in `@tek/db`.
**How to avoid:** All file loading MUST go through `@tek/db` functions. The gateway's `MemoryManager.getMemoryContext()` calls `@tek/db` functions. The assembler receives data, never reads files directly.
**Warning signs:** `readFileSync` calls for identity files appearing in gateway code.

## Code Examples

### Loading All Identity Files (MemoryManager expansion)

```typescript
// packages/gateway/src/memory/memory-manager.ts
import {
  loadSoul,
  loadLongTermMemory,
  loadRecentLogs,
  loadIdentity,
  loadStyle,
  loadUser,
  loadAgentsConfig,
} from "@tek/db";

export interface MemoryContext {
  soul: string;
  identity: string;
  style: string;
  user: string;
  agents: string;
  longTermMemory: string;
  recentLogs: string;
}

export class MemoryManager {
  getMemoryContext(agentId?: string): MemoryContext {
    return {
      soul: loadSoul(agentId),
      identity: loadIdentity(agentId),
      style: loadStyle(agentId),
      user: loadUser(),            // Shared, not per-agent
      agents: loadAgentsConfig(),
      longTermMemory: loadLongTermMemory(),
      recentLogs: loadRecentLogs(agentId),
    };
  }
  // ... existing methods
}
```

**Source:** Expansion of existing `packages/gateway/src/memory/memory-manager.ts`

### AppConfig Schema Extension for Agents

```typescript
// Addition to packages/core/src/config/schema.ts
const AgentDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  model: z.string().optional(),
  description: z.string().optional(),
});

const AgentsConfigSchema = z.object({
  list: z.array(AgentDefinitionSchema).default([]),
  defaultAgentId: z.string().default("default"),
});

// Add to AppConfigSchema:
// agents: AgentsConfigSchema.optional(),
```

**Source:** Pattern from Phase 18 research (OpenClaw agents config)

### Soul Evolution Handler

```typescript
// In packages/gateway/src/ws/handlers.ts
export function handleSoulEvolutionResponse(
  _transport: Transport,
  msg: SoulEvolutionResponse,
): void {
  if (!msg.approved) return;

  const content = msg.editedContent ?? msg.proposedContent;
  // Write to the specific file and section
  updateIdentityFileSection(msg.file, msg.section, content);
}
```

### Richer SOUL.md Template (50-150 lines)

```markdown
# Agent Identity

## Core Truths
- Be genuinely helpful, not performatively helpful
- Have opinions -- disagree, prefer things, show personality
- Be resourceful before asking -- try first, ask second
- Earn trust through competence, not compliance
- Remember you are a guest in the user's world

## Communication Style
- Concise when users need quick answers
- Detailed and exploratory when users seek understanding
- Use technical precision without unnecessary jargon
- Lead with the answer, then explain if needed
- Code examples over theory when relevant

## Vibe
- Be the assistant you would actually want to talk to
- Balance directness with warmth
- Avoid corporate-speak, sycophancy, and filler
- It is okay to say "I don't know" or "I'm not sure"
- An assistant with no personality is just a search engine

## Boundaries
- Never fabricate information when uncertain
- Always cite sources for factual claims
- Private things stay private
- Ask before taking external actions
- Respect user privacy and security boundaries

## Continuity
- These files ARE your memory -- read them, update them
- If you change this file, tell the user
- SOUL.md defines who you are; MEMORY.md stores what you know
- Daily logs capture conversation history

## Learned Preferences
(Updated as the agent learns user preferences)
```

**Source:** Synthesis of existing `packages/db/memory-files/SOUL.md` + Phase 18 OpenClaw template research

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single SOUL.md (20 lines, generic) | Multi-file identity (SOUL + IDENTITY + STYLE + USER) | 2025-2026 | Richer personality, better token budget control |
| Append-only soul evolution | Diff-style proposals with user approval | 2025-2026 | Users control personality changes precisely |
| Global single agent | Per-agent isolated directories | 2025-2026 | Multiple agents with different personalities/capabilities |
| All context loaded every session | Conditional loading (USER.md private-only) | 2025-2026 | Privacy + token efficiency |

## Codebase Integration Points

### Files That Must Change

| File | Change | Scope |
|------|--------|-------|
| `packages/db/memory-files/SOUL.md` | Replace 20-line generic template with 50-line opinionated version | Template content |
| `packages/db/memory-files/IDENTITY.md` | NEW template file | Template content |
| `packages/db/memory-files/USER.md` | NEW template file | Template content |
| `packages/db/memory-files/STYLE.md` | NEW template file | Template content |
| `packages/db/memory-files/AGENTS.md` | NEW template file | Template content |
| `packages/db/src/memory/soul-manager.ts` | Add `agentId` parameter to loadSoul, expand evolveSoul | Function signature change |
| `packages/db/src/memory/identity-manager.ts` | NEW: loaders for IDENTITY, STYLE, USER, AGENTS | New module |
| `packages/db/src/memory/agent-resolver.ts` | NEW: cascade resolution for agent directories | New module |
| `packages/db/src/memory/migration.ts` | NEW: single-to-multi file migration | New module |
| `packages/db/src/memory/ensure-memory.ts` | Expand to handle new files and agent directories | Function additions |
| `packages/db/src/memory/index.ts` | Export new functions | Export additions |
| `packages/gateway/src/memory/memory-manager.ts` | Expand getMemoryContext() return type | Interface change |
| `packages/gateway/src/context/assembler.ts` | Load all identity files, add token budget warning | Context composition |
| `packages/gateway/src/ws/protocol.ts` | Add soul.evolution schemas to discriminated unions | Schema additions |
| `packages/gateway/src/ws/handlers.ts` | Add handleSoulEvolutionResponse | Handler addition |
| `packages/core/src/config/schema.ts` | Add AgentsConfig section to AppConfigSchema | Schema extension |

### Dependency on Phase 15

Phase 16 depends on Phase 15 having completed:
- `agentName` and `userDisplayName` fields in AppConfigSchema
- Personality preset templates in `packages/db/memory-files/presets/`
- BOOTSTRAP.md template for deferred personality setup
- Phase 16 builds ON TOP of these (does not duplicate them)

## Open Questions

1. **Should the migration run automatically or require `tek migrate`?**
   - What we know: `ensureMemoryFile()` runs on every startup. Migration is heavier (splits files, creates backups).
   - What's unclear: Is automatic migration safe enough, or should it be user-initiated?
   - Recommendation: Automatic with backup. The migration creates a `.v2-migrated` marker and is idempotent. Backup files are preserved. This matches the existing `ensureMemoryFile()` pattern of "just make it work on first run."

2. **Should AGENTS.md be loaded for single-agent setups?**
   - What we know: AGENTS.md contains multi-agent coordination instructions. Most users will initially have one agent.
   - What's unclear: Does loading it waste tokens when there is only one agent?
   - Recommendation: Only load AGENTS.md when `config.agents.list` has >1 entry. For single-agent setups, skip it entirely to save tokens.

3. **How should soul evolution proposals be triggered?**
   - What we know: The agent needs to detect patterns (e.g., user always asks for more detail) and propose SOUL.md changes.
   - What's unclear: Should this be LLM-driven (the agent decides when to propose) or heuristic-driven (code detects patterns)?
   - Recommendation: LLM-driven with rate limiting. The agent's system prompt includes instructions from the Continuity section of SOUL.md. The gateway enforces a max-1-proposal-per-session cooldown. The actual "detect and propose" logic lives in the system prompt, not in hand-written heuristics.

4. **Token budget allocation across identity files**
   - What we know: Phase 18 recommends soul + identity + style under 3000 tokens total.
   - What's unclear: How to allocate within that budget (e.g., 1500 soul + 500 identity + 500 style + 500 buffer?).
   - Recommendation: Enforce the 3000 total budget but don't hard-allocate per-file. Log a warning when exceeded. Let users decide how to distribute content. The context inspector already shows per-section token counts.

## Sources

### Primary (HIGH confidence)
- `packages/db/src/memory/soul-manager.ts` -- existing soul loading pattern (verified by code review)
- `packages/db/src/memory/ensure-memory.ts` -- template seeding pattern (verified by code review)
- `packages/gateway/src/context/assembler.ts` -- context assembly pattern (verified by code review)
- `packages/gateway/src/ws/protocol.ts` -- WS protocol extension pattern (verified by code review)
- `packages/core/src/config/schema.ts` -- AppConfig extension pattern (verified by code review)
- `.planning/phases/18-onboarding-research/18-RECOMMENDATIONS.md` -- Phase 18 recommendations (verified by doc review)

### Secondary (MEDIUM confidence)
- `.planning/phases/18-onboarding-research/18-RESEARCH.md` -- OpenClaw architecture patterns (based on web research, not code review)
- `.planning/phases/15-init-onboarding-polish/15-01-PLAN.md` -- Phase 15 dependencies (verified plan docs)

### Tertiary (LOW confidence)
- `diff` npm package for soul evolution rendering -- needs validation that unified diff output is suitable for CLI rendering

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries needed beyond optional `diff`; all patterns already exist in codebase
- Architecture: HIGH -- direct extension of existing file loaders, context assembler, and WS protocol
- Pitfalls: MEDIUM-HIGH -- based on Phase 18 research synthesis and codebase analysis
- Migration: MEDIUM -- migration logic is new code with no existing parallel in the codebase

**Research date:** 2026-02-18
**Valid until:** 2026-03-20 (30 days -- stable domain, no fast-moving external dependencies)
