# Phase 19: Desktop & Integration Polish - Research

**Researched:** 2026-02-19
**Domain:** Desktop app bug fixes, gateway lifecycle, agent identity wiring, UI polish
**Confidence:** HIGH (all findings based on direct codebase analysis)

## Summary

This phase is a targeted bug-fix and polish pass covering nine distinct issues discovered during user testing. The work spans four packages (`@tek/gateway`, `@tek/desktop`, `@tek/telegram`, `@tek/cli`) and the shared `@tek/core`/`@tek/db` layers. No new libraries are needed; every fix uses existing code patterns and dependencies.

The most impactful bugs are: (1) the chat page not passing agent identity/defaults from init to the gateway, (2) the Settings page crash, and (3) the gateway stop failure. The Agents page redesign as an onboarding flow is the largest new-feature task. Telegram's punycode issue is a known Node.js v24 deprecation affecting grammY's transitive dependency on the built-in `punycode` module.

**Primary recommendation:** Fix each bug in isolation with targeted changes, verify with end-to-end flow after all fixes are integrated. Do NOT refactor surrounding code during this phase.

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| React | ^19 | Desktop UI | Already used |
| Tailwind CSS | v4 | Styling | `@import 'tailwindcss'` pattern (no config file) |
| Zustand | ^5 | State management | Single `app-store.ts` |
| Tauri | v2 | Desktop shell | Plugins: fs, shell, websocket, process |
| grammY | ^1.40.0 | Telegram bot | Current dep |
| Fastify | (gateway) | HTTP/WS server | With @fastify/websocket |
| Zod | (core) | Config validation | `AppConfigSchema` |

### No New Dependencies Needed
This is a fix/polish phase. All nine issues can be resolved with existing dependencies.

## Architecture Patterns

### Current Desktop App Structure
```
apps/desktop/src/
├── App.tsx             # Hash-based page routing via useState
├── main.tsx            # Entry point
├── index.css           # Tailwind v4 + dark theme base
├── components/         # Shared UI: Layout, Sidebar, ChatInput, ChatMessage, etc.
├── hooks/              # useChat, useWebSocket, useGateway, useConfig, useIdentityFiles
├── lib/                # config.ts, discovery.ts, files.ts, gateway-client.ts, process.ts
├── pages/              # DashboardPage, ChatPage, AgentsPage, SettingsPage
└── stores/             # app-store.ts (Zustand)
```

### Pattern 1: Tauri FS Plugin for Config/File Access
**What:** Desktop reads/writes config and identity files via `@tauri-apps/plugin-fs` (not Node.js `fs`)
**When to use:** All file operations in the desktop app
**Key constraint:** FS scope limited to `$HOME/.config/tek/**` and `$HOME/tek/**` (defined in `capabilities/default.json`)
```typescript
// Source: apps/desktop/src/lib/files.ts
import { readTextFile, writeTextFile, exists, mkdir } from '@tauri-apps/plugin-fs';
import { homeDir, join } from '@tauri-apps/api/path';
```

### Pattern 2: Gateway Communication via WebSocket
**What:** Desktop connects to gateway at `ws://127.0.0.1:{port}/gateway`, sends typed JSON messages
**When to use:** All chat, session, and config operations that touch gateway state
**Key files:** `useWebSocket.ts` (connection), `useChat.ts` (message handling), `gateway-client.ts` (message factories)

### Pattern 3: Shell Plugin for CLI Commands
**What:** Desktop runs `tek gateway start/stop` via `@tauri-apps/plugin-shell` Command
**When to use:** Gateway lifecycle from desktop
**Key file:** `apps/desktop/src/lib/process.ts`
```typescript
const command = Command.create('tek', ['gateway', 'start']);
const output = await command.execute();
```

### Pattern 4: Agent Identity Cascade Resolution
**What:** Identity files resolve via: agent-specific > shared > global memory directory
**When to use:** Loading SOUL.md, IDENTITY.md, STYLE.md for any agent
**Key file:** `packages/db/src/memory/agent-resolver.ts`
**Resolution order:**
1. `~/.config/tek/agents/{agentId}/{filename}`
2. `~/.config/tek/agents/shared/{filename}`
3. `~/.config/tek/memory/{filename}` (global, backward-compatible)
4. Empty string

### Anti-Patterns to Avoid
- **Importing Node.js modules in desktop app:** The Tauri webview runs in browser context. Use Tauri plugins instead of `node:fs`, `node:path`, etc.
- **Refactoring during bug fixing:** This phase is polish, not architecture. Avoid scope creep.
- **Relying on gateway state for desktop-only features:** Identity file editing in AgentsPage uses Tauri FS directly, not gateway.

## Bug Analysis & Findings

### Bug 1: Gateway Stop Command Fails

**Location:** `packages/cli/src/commands/gateway.ts` (lines 113-148)
**Mechanism:** CLI reads `runtime.json` to find PID, sends `SIGTERM`, polls for death.
**Gateway shutdown:** `packages/gateway/src/key-server/server.ts` (lines 89-105) has SIGTERM/SIGINT handlers that `unlinkSync(RUNTIME_PATH)` then `process.exit(0)`.

**Likely root causes:**
1. **Stale runtime.json:** Desktop's `discoverGateway()` does NOT verify PID liveness (unlike CLI's version which uses `process.kill(pid, 0)`). If gateway crashed, `runtime.json` remains and desktop shows "running" but `tek gateway stop` reports "not running" after SIGTERM fails.
2. **Race condition:** The SIGTERM handler calls `unlinkSync` then `process.exit(0)`. If the process.exit happens before the CLI's `process.kill(pid, 0)` check, the CLI may see the process as already gone. However, if `unlinkSync` fails (permissions, locked file), the cleanup doesn't happen.
3. **Fastify shutdown:** The SIGTERM handler does NOT call `server.close()` for graceful Fastify shutdown. It just removes the file and exits. This could leave sockets in TIME_WAIT state.

**Fix strategy:**
- Add `server.close()` call in SIGTERM handler before file cleanup for graceful shutdown
- In desktop's `discoverGateway()`, add PID liveness check via HTTP health endpoint (`GET /health`) or by invoking `tek gateway status` via shell
- Consider cleaning up stale runtime.json in discovery if PID is dead

**Confidence:** HIGH (code paths traced completely)

### Bug 2: Chat Doesn't Load Agent Identity Files Set During Init

**Location chain:**
1. `packages/cli/src/commands/init.ts` saves `agentName` and `userDisplayName` to `config.json`
2. `packages/gateway/src/ws/handlers.ts` line 245: `const agentId = loadConfig()?.agents?.defaultAgentId ?? "default"`
3. `packages/gateway/src/context/assembler.ts` line 76: `memoryManager.getMemoryContext(agentId)`
4. `packages/gateway/src/memory/memory-manager.ts` calls `loadSoul(agentId)`, `loadIdentity(agentId)`, `loadStyle(agentId)`, `loadUser()` (global)

**Root cause analysis:**
- The init command saves `agentName` and `userDisplayName` as top-level config fields but does NOT write these to identity files (SOUL.md, USER.md, IDENTITY.md).
- The `agentName` field in config is stored but never read by the memory/context system. The memory system loads from `.md` files in `~/.config/tek/memory/`.
- The `userDisplayName` from init is in config.json but `loadUser()` reads from `USER.md`. If `tek init` was run with a user name, that name is only in config, not in USER.md.
- The `personalityPreset` during init calls `applyPersonalityPreset()` which writes to SOUL.md, but `agentName` and `userDisplayName` are NOT injected into the identity files.

**Fix strategy:**
- During init's `onComplete`, after saving config, write `userDisplayName` into USER.md (template: `# About the User\n\nName: {name}\n`)
- During init's `onComplete`, if `agentName` is set, write it into SOUL.md or IDENTITY.md (e.g., inject `Your name is {agentName}` into the appropriate section)
- Alternatively, have the gateway's `assembleContext` inject `agentName` and `userDisplayName` from config into the system prompt alongside the file-based content

**Additional issue:** The desktop `createChatSendMessage()` does not pass an `agentId` field. The gateway handler extracts agentId from config, which defaults to `"default"`. This means the "default" agent's identity files are loaded from the global `memory/` directory. This is correct for single-agent setups but the desktop doesn't expose agent selection.

**Confidence:** HIGH (full chain traced, root cause identified)

### Bug 3: Settings Page Crashes

**Location:** `apps/desktop/src/pages/SettingsPage.tsx`
**Config type mismatch analysis:**
- Desktop's `AppConfig` interface (in `lib/config.ts`) defines `modelAliases` as `Record<string, string>` (key-value map)
- Core's `AppConfigSchema` defines `modelAliases` as `z.array(ModelAliasSchema)` where `ModelAliasSchema = { alias: string, modelId: string }`
- The init command's Onboarding stores `modelAliases` as an array of `{ alias, modelId }` objects
- SettingsPage accesses `config?.modelAliases` as a `Record<string, string>` and calls `Object.entries(aliases)` and `Object.keys(aliases)`

**Root cause:** If `config.json` has `modelAliases` as an array (from init), SettingsPage tries to use it as an object. `Object.entries([{alias: "x", modelId: "y"}])` returns `[["0", {alias: "x", modelId: "y"}]]`, which then tries to render `server.command` and `server.args` on what's actually a `{alias, modelId}` object. This either shows garbled content or crashes if the render logic accesses a property that doesn't exist.

**Fix strategy:**
- Normalize `modelAliases` when loading config in the desktop app: if it's an array, convert to `Record<string, string>` format
- Or: update SettingsPage to handle both formats (array of `{alias, modelId}` and record)
- The desktop's `AppConfig` type should match core's `AppConfigSchema`

**Confidence:** HIGH (type mismatch identified directly)

### Bug 4: Agents Page Redesign as Add-Agent + Onboarding Flow

**Current state:** AgentsPage is a file editor with tabs for SOUL.md, IDENTITY.md, USER.md, STYLE.md. It reads/writes identity files via Tauri FS from `~/.config/tek/`.

**Requirements:**
- Redesign as "add agent" + onboarding flow (not just file list)
- Should support creating new agents with their own config
- Agent workspace isolation with configurable access modes

**Design considerations:**
- The agent-resolver already supports per-agent directories at `~/.config/tek/agents/{agentId}/`
- Config schema has `AgentsConfigSchema` with `list` array and `defaultAgentId`
- Current AgentsPage hardcodes paths to `~/.config/tek/{filename}` (global memory dir)
- Need to add: agent creation wizard, agent list view, per-agent identity file editing, agent switching

**Fix strategy:**
- Replace AgentsPage with a two-view layout: agent list (left/top) + agent detail (right/bottom)
- Add "Create Agent" flow that: asks for name/description, creates directory at `~/.config/tek/agents/{id}/`, seeds identity files, adds to config's `agents.list`
- Per-agent file editing should load from the agent-specific directory
- Add ability to set defaultAgentId
- Keep backward compatibility: "default" agent maps to global `memory/` directory

**Confidence:** HIGH (architecture already supports it)

### Bug 5: Agent Workspace Isolation

**Current state:** `packages/db/src/memory/agent-resolver.ts` implements cascade resolution and `resolveAgentDir()` which creates `~/.config/tek/agents/{agentId}/` directories. The directory structure exists but is not fully wired.

**Requirements:** Each agent needs own config/memory directory with configurable access modes (full/limited).

**What exists:**
- Agent directories: `~/.config/tek/agents/{agentId}/` for identity files
- Global shared: `~/.config/tek/agents/shared/` for cross-agent files
- Default agent: uses `~/.config/tek/memory/` (backward-compatible)
- Config schema has `AgentDefinitionSchema` with `id`, `name`, `model`, `description`

**What's missing:**
- No `accessMode` field on `AgentDefinitionSchema` (needs `full` | `limited`)
- No per-agent config (model preferences, MCP servers, security mode)
- No isolation enforcement in the gateway (agent doesn't scope workspace/tools)
- Desktop doesn't expose agent management

**Fix strategy:**
- Add `accessMode` field to `AgentDefinitionSchema`: `z.enum(["full", "limited"]).default("full")`
- When gateway handles `chat.send`, use the agent's `accessMode` to scope tool availability
- Desktop's agent creation flow should let user pick access mode
- Per-agent config is a stretch goal; start with identity files + access mode only

**Confidence:** MEDIUM (core support exists but enforcement layer needs design)

### Bug 6: Desktop UI/UX Spacing and Polish

**Current state observations:**
- Sidebar: 224px wide (`w-56`), uses Unicode characters for icons (e.g., `\u2302`, `\u2709`, `\u2663`, `\u2699`). These render inconsistently across platforms.
- Dashboard: Quick actions use a 3-column grid. Spacing is tight.
- Chat: Message list has `space-y-0` (zero spacing between messages). Header bar and input bar are functional but minimal.
- Settings: Uses `ConfigSection` wrapper component. Layout is functional.
- No consistent padding/margin system. Mix of `p-4`, `p-6`, `px-4 py-3`, etc.

**Polish areas:**
- Replace Unicode icons with SVG icons (e.g., Lucide React or inline SVGs) for consistent rendering
- Standardize page padding and section spacing
- Add subtle animations/transitions for page switches
- Improve ChatMessage styling (avatar indicators, timestamp formatting)
- Add loading states for gateway start/stop operations
- Improve empty states across all pages
- Better visual hierarchy between sections

**Fix strategy:**
- Install `lucide-react` for icon consistency, or use inline SVGs
- Create a spacing/layout convention: consistent page padding, section gaps
- Focus on the most impactful visual issues first: icons, spacing, chat bubbles

**Confidence:** HIGH (UI code fully reviewed)

### Bug 7: Telegram Bot Fails to Start (Punycode Deprecation)

**Context:** Node.js v24.1.0 is in use. Node.js v21+ deprecated the built-in `punycode` module with a warning. Node.js v24 may make this a hard error or more disruptive warning.

**Root cause:** grammY (or its dependency chain, likely via `node:punycode` in URL handling) triggers the `punycode` deprecation warning. The warning itself shouldn't kill the bot, but if it's being treated as an error (e.g., `--throw-deprecation` flag, or if the process exits due to an unhandled rejection triggered by the warning), it would fail.

**Investigation:** The `startTelegramBot` function in `packages/telegram/src/bot.ts` calls `bot.start()` with long polling. The grammY library uses `fetch` internally which may use `node:url` which in turn may use `node:punycode`.

**Fix strategies:**
1. **Suppress warning:** Set `NODE_OPTIONS=--no-deprecation` when starting the gateway/telegram process
2. **Pin punycode userland package:** Add `punycode` (the userland npm package) as a dependency to resolve the import to the npm version instead of the deprecated built-in
3. **Update grammY:** Check if a newer version has fixed this (the grammY team may have addressed it)
4. **Root cause may be elsewhere:** Need to actually capture the full error output to determine if punycode is the real issue or just a warning before the actual failure

**Confidence:** MEDIUM (punycode is documented Node.js v24 issue; actual bot death may have a different root cause)

### Bug 8: End-to-End Verification

**Flow to verify:**
1. `tek init` -> creates config, sets agent name, user name, personality, API keys
2. `tek gateway start` -> starts Fastify + WebSocket on port 3271
3. Desktop app -> discovers gateway via `runtime.json`, connects WebSocket
4. Chat -> sends message, gateway assembles context with identity files, streams response
5. Agent setup -> identity files readable/writable from desktop
6. `tek gateway stop` -> clean shutdown, runtime.json removed
7. Uninstall -> `tek uninstall` cleans up

**Key verification points:**
- Identity files from init are loaded by gateway during chat
- `agentName` and `userDisplayName` are reflected in chat behavior
- Settings page loads without crash
- Gateway start/stop from desktop works
- Telegram bot starts if token is configured

**Confidence:** HIGH (verification plan is straightforward)

### Bug 9: Chat in Desktop Did Not Work / Not Using Defaults from Init

**This is Bug 2 restated from the desktop perspective.** Additional considerations:
- The desktop's `createChatSendMessage()` sends `{ type: "chat.send", id, content, sessionId?, model? }` but does not send `agentId`
- The gateway extracts `agentId` from config's `agents.defaultAgentId` which defaults to `"default"`
- For "default" agent, identity files come from `~/.config/tek/memory/` (global)
- If init didn't create/populate these files, the chat gets the generic `DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant."` with empty identity sections

**Additional fix:** The desktop could optionally send `agentId` in chat.send messages. The protocol's `ChatSend` schema in `packages/gateway/src/ws/protocol.ts` would need to accept it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG icons | Custom icon components | `lucide-react` or inline SVG set | Consistency, accessibility, maintenance |
| Config type normalization | Manual type conversion | Zod `.transform()` or shared types | Type safety, single source of truth |
| Agent directory management | Custom file tree logic | Existing `resolveAgentDir()` from `@tek/db` | Already handles creation and path resolution |
| PID liveness checking | Custom process checking | `process.kill(pid, 0)` pattern (already in CLI discovery) | Standard POSIX pattern, battle-tested |

## Common Pitfalls

### Pitfall 1: Config Schema Mismatch Between Desktop and Core
**What goes wrong:** Desktop's `AppConfig` interface doesn't match core's `AppConfigSchema`. Fields like `modelAliases` have different types (Record vs Array).
**Why it happens:** Desktop defines its own `AppConfig` type in `lib/config.ts` instead of importing from `@tek/core`. This is intentional (browser context can't import Node.js modules) but creates drift.
**How to avoid:** Keep a shared type definition that both can use, or add runtime normalization in the desktop's `loadConfig()`.
**Warning signs:** Settings or Agents pages crash when loading config; data shows as `[object Object]` in UI.

### Pitfall 2: Tauri Shell Plugin Command Resolution
**What goes wrong:** `Command.create('tek', [...])` fails because `tek` is not in PATH when launched from Finder/Spotlight.
**Why it happens:** GUI apps on macOS don't inherit shell PATH modifications. The `tek` binary may be in `~/tek/bin/` which was added to `~/.zshrc`.
**How to avoid:** Use absolute path to the `tek` binary, or look up the path from config/known locations.
**Warning signs:** "Gateway start" button in desktop app silently fails or returns error.

### Pitfall 3: Identity File Not Found After Init
**What goes wrong:** User runs `tek init`, sets personality/name, but chat shows generic assistant behavior.
**Why it happens:** Init saves `agentName` to config.json but doesn't inject it into identity files. The memory system loads identity from `.md` files, not from config.json fields.
**How to avoid:** Init must write user-provided names into the actual identity files, or the assembler must inject config values into the system prompt.
**Warning signs:** Chat responses don't use the agent's name or acknowledge the user by name.

### Pitfall 4: Fastify Server Not Gracefully Closed
**What goes wrong:** Gateway stop leaves port in TIME_WAIT state; next start fails with EADDRINUSE.
**Why it happens:** SIGTERM handler calls `process.exit(0)` without `server.close()`, so TCP connections aren't cleanly terminated.
**How to avoid:** Call `await server.close()` in the SIGTERM handler before cleanup/exit.
**Warning signs:** `tek gateway start` fails immediately after `tek gateway stop` with port-in-use errors.

### Pitfall 5: Tailwind v4 Has No Config File
**What goes wrong:** Developer tries to add `tailwind.config.js` or uses `@apply` directives that don't work.
**Why it happens:** Tailwind v4 uses `@import 'tailwindcss'` in CSS, auto-detects content, and needs no config file. Adding one conflicts.
**How to avoid:** Use Tailwind v4 patterns. Custom theme values go in CSS `@theme` blocks, not JS config.
**Warning signs:** Build warnings about unknown directives, styles not applying.

## Code Examples

### Example 1: Graceful Gateway Shutdown
```typescript
// packages/gateway/src/key-server/server.ts
// Current: just unlinkSync + process.exit
// Fixed: graceful server close first
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`);
  try {
    await server.close();
  } catch {
    // Server close may fail if already closed
  }
  try {
    unlinkSync(RUNTIME_PATH);
  } catch {
    // Ignore cleanup errors
  }
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

### Example 2: Writing Identity Files from Init
```typescript
// In packages/cli/src/commands/init.ts onComplete handler:
// After saving config, inject names into identity files
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR } from "@tek/core";

const memoryDir = join(CONFIG_DIR, "memory");

// Inject userDisplayName into USER.md
if (result.userDisplayName) {
  const userPath = join(memoryDir, "USER.md");
  const existing = existsSync(userPath) ? readFileSync(userPath, "utf-8") : "";
  if (!existing.includes(result.userDisplayName)) {
    const content = existing
      ? existing.replace(/^# About the User\n/, `# About the User\n\nName: ${result.userDisplayName}\n`)
      : `# About the User\n\nName: ${result.userDisplayName}\n`;
    writeFileSync(userPath, content, "utf-8");
  }
}
```

### Example 3: Config Normalization in Desktop
```typescript
// In apps/desktop/src/lib/config.ts loadConfig():
// Normalize modelAliases from array format to record format
export async function loadConfig(): Promise<AppConfig | null> {
  // ... existing loading code ...
  const raw = JSON.parse(content);

  // Normalize modelAliases: array -> record
  if (Array.isArray(raw.modelAliases)) {
    const record: Record<string, string> = {};
    for (const entry of raw.modelAliases) {
      if (entry.alias && entry.modelId) {
        record[entry.alias] = entry.modelId;
      }
    }
    raw.modelAliases = record;
  }

  return raw as AppConfig;
}
```

### Example 4: Desktop PID Liveness Check
```typescript
// In apps/desktop/src/lib/discovery.ts
// Can't use process.kill in browser - use HTTP health check instead
export async function discoverGateway(): Promise<RuntimeInfo | null> {
  // ... existing file reading ...
  if (!data.pid || !data.port) return null;

  // Verify gateway is actually reachable
  try {
    const res = await fetch(`http://127.0.0.1:${data.port}/health`);
    if (!res.ok) return null;
  } catch {
    return null; // Gateway not reachable, stale runtime.json
  }

  return data;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Identity in single SOUL.md | Multi-file (SOUL, IDENTITY, STYLE, USER) | Phase 16 | Each aspect is separate, cascade resolution |
| Config `modelAliases` as Record | Config `modelAliases` as Array<{alias, modelId}> | Phase 15/core schema | Desktop still expects Record format |
| Node.js built-in punycode | Userland punycode package | Node.js v21 deprecation | Affects grammY's URL handling in v24 |
| react-router for pages | useState + hash-based routing | Phase 17 decision | Simpler, fewer deps, works with Tauri |

## Open Questions

1. **Settings crash exact error**
   - What we know: Likely caused by `modelAliases` type mismatch (array vs record)
   - What's unclear: Is there another crash path? Could be MCP server config format issue too
   - Recommendation: Add try/catch error boundary around SettingsPage content; test with actual config.json from init

2. **Telegram bot actual failure mode**
   - What we know: punycode deprecation warning, then dies
   - What's unclear: Is the punycode warning the actual cause of death, or is there a separate error after? Is the bot started standalone or as part of gateway?
   - Recommendation: Run `node packages/telegram/dist/index.ts` manually to capture actual error output; the bot is not auto-started by gateway, so it may need a separate start mechanism

3. **Agent onboarding scope**
   - What we know: Requirement says "add-agent + onboarding flow"
   - What's unclear: How much UX polish vs. functional completeness? Is this a full wizard or just a create form?
   - Recommendation: Start with a minimal "Create Agent" form (name, description, access mode) + per-agent identity file editing. Defer complex wizard for future phase.

4. **Desktop `tek` command PATH issue**
   - What we know: Tauri shell plugin uses `Command.create('tek', [...])` which relies on PATH
   - What's unclear: Does this work when launching desktop from Finder vs. terminal? macOS GUI apps may not have PATH configured
   - Recommendation: Test launching from Finder. If broken, resolve `tek` binary path from known install locations (`~/tek/bin/tek`, or derive from app bundle location)

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all files listed in this document
- `packages/core/src/config/schema.ts` - Config type definitions (AppConfigSchema, AgentDefinitionSchema)
- `packages/db/src/memory/agent-resolver.ts` - Agent cascade resolution implementation
- `packages/gateway/src/key-server/server.ts` - Gateway lifecycle (startup, shutdown, runtime.json)
- `packages/gateway/src/ws/handlers.ts` - Chat handler, agent identity loading
- `packages/gateway/src/context/assembler.ts` - Context assembly with identity files
- `packages/gateway/src/memory/memory-manager.ts` - Memory context building
- `packages/cli/src/commands/init.ts` - Init command, onboarding flow
- `packages/cli/src/commands/gateway.ts` - Gateway start/stop CLI
- `apps/desktop/src/` - All desktop app source files

### Secondary (MEDIUM confidence)
- Node.js v24 punycode deprecation is a well-documented breaking change
- Tauri v2 shell plugin PATH behavior on macOS GUI apps

## Metadata

**Confidence breakdown:**
- Bug analysis: HIGH - all code paths traced through actual source files
- Fix strategies: HIGH - each fix uses existing patterns from the codebase
- Pitfalls: HIGH - derived from direct observation of code structure
- Agent onboarding design: MEDIUM - scope unclear without user feedback
- Telegram fix: MEDIUM - punycode is known issue but root cause needs runtime verification

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (stable codebase, no external API changes expected)
