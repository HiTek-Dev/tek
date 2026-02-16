# Phase 1: Foundation & Security - Research

**Researched:** 2026-02-15
**Domain:** Project scaffolding, encrypted credential vault, security modes, local key-serving API, authenticated CLI
**Confidence:** HIGH (core stack verified) / MEDIUM (sandbox enforcement, audit log design)

## Summary

Phase 1 establishes the secure foundation for AgentSpace: a pnpm + Turborepo monorepo, an encrypted credential vault backed by OS keychain (`@napi-rs/keyring`), a local-only Fastify API endpoint that serves keys to authorized applications, two security modes (Full Control / Limited Control), and an onboarding flow built with Ink. The phase also delivers the CLI entry point with `commander` for credential management commands.

The credential vault is straightforward -- `@napi-rs/keyring` provides a simple `Entry` class with `setPassword`/`getPassword`/`deletePassword` methods, backed by macOS Keychain, Windows Credential Manager, or Linux Secret Service. The local API endpoint binds Fastify to `127.0.0.1` with `@fastify/bearer-auth` for token validation. Security mode selection persists to a JSON config file and is enforced at the application layer (path validation for Limited Control, permission grants for Full Control).

**Primary recommendation:** Build the monorepo scaffold first, then credential vault (keychain + CLI commands), then config/security mode system, then local API endpoint with auth, then onboarding flow last (it ties everything together).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- CLI commands for add/update/remove of API keys for Anthropic, OpenAI, and Ollama
- Keys stored encrypted in OS keychain (platform-native: macOS Keychain, Linux secret-service, Windows Credential Vault)
- Local-only API endpoint (127.0.0.1) serves keys to authorized local applications
- Audit log tracks all key access events
- Two modes: "Full Control" (OS-level access with explicit permission grants) and "Limited Control" (restricted to designated workspace directory)
- Mode selected during first-run onboarding
- Mode persists across restarts
- Only authenticated local CLI can send commands to the agent

### Claude's Discretion
- Onboarding flow design (wizard vs quick prompts, level of explanation)
- Credential management UX (interactive prompts vs CLI flags, feedback patterns)
- Security boundary enforcement approach (how restrictions are communicated, whether mode can be switched post-setup)
- Audit log format, verbosity, and storage location
- Key rotation handling
- Error messaging and feedback patterns
- Project scaffolding structure (monorepo layout, config files, build setup)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @napi-rs/keyring | 1.2.x | OS keychain access (macOS Keychain, Windows Credential Manager, Linux Secret Service) | Only maintained keytar replacement. Rust-based via napi-rs. 77K weekly downloads. Microsoft OSS fund backed. No libsecret dependency. |
| Fastify | 5.x | Local-only API endpoint for key serving | Best Node.js HTTP server performance. Schema validation built-in. Needed for 127.0.0.1-bound key-serving endpoint. |
| @fastify/bearer-auth | 10.1.x | Bearer token authentication for API endpoint | Official Fastify plugin. Constant-time key comparison prevents timing attacks. Simple keys-based or custom auth function. |
| commander | 12.x | CLI argument parsing and subcommands | Mature, well-typed, supports subcommands (`agentspace keys add`, `agentspace keys remove`, etc.). |
| Ink | 6.x | React-based terminal UI for onboarding | Component model for interactive terminal rendering. Select, TextInput, ConfirmInput from @inkjs/ui. |
| @inkjs/ui | latest | Pre-built CLI components (Select, TextInput, ConfirmInput) | Themed components for onboarding wizard. Select for mode choice, ConfirmInput for confirmations. |
| drizzle-orm | 0.45.x | SQLite ORM for audit log and config persistence | TypeScript-first, sync API for better-sqlite3. Schema-as-code with migrations. |
| better-sqlite3 | 11.x | SQLite driver | Synchronous API, fastest Node.js SQLite driver. Used for audit log storage. |
| Turborepo | 2.8.x | Monorepo build orchestration | Task caching, dependency-aware builds. Simpler than Nx for our scale. |
| pnpm | 9.x | Package manager with workspaces | Content-addressable storage, strict node_modules, native workspace support. |
| TypeScript | 5.9 | Type safety | Latest stable. Project references for incremental monorepo builds. |
| Biome | latest | Linting + formatting | Single tool replaces ESLint + Prettier. Faster. |
| Vitest | latest | Testing | Fast, ESM-native, Turborepo cache compatible. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js crypto | built-in | Generate auth tokens, HMAC signing | Token generation for API endpoint auth. `crypto.randomBytes(32).toString('hex')` for shared secrets. |
| chalk | 5.x | Terminal string coloring | Status messages, error highlighting in CLI output. |
| zod | 4.x | Runtime config validation | Validate config file schema, CLI input validation. |
| drizzle-kit | latest | Database migrations | Generate and run SQLite schema migrations for audit log. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @napi-rs/keyring | Node.js crypto AES-256-GCM file encryption | Fallback when keychain unavailable (headless Linux). Less secure than OS keychain but functional. Implement as fallback, not primary. |
| @fastify/bearer-auth | Custom preHandler hook | More control but reimplements timing-safe comparison. Use the plugin. |
| commander | yargs | yargs is heavier, more complex API. Commander is simpler for our subcommand structure. |
| SQLite audit log | JSON file audit log | JSON files don't scale, can't query efficiently. SQLite is the right tool for structured logs. |
| Ink onboarding | Plain readline prompts | Works but ugly. Ink provides consistent styled UX that matches the rest of the CLI. |

**Installation (Phase 1 packages):**
```bash
# Root dev dependencies
pnpm add -Dw turbo typescript @types/node vitest @biomejs/biome tsx

# Core package (shared types, config, crypto)
pnpm --filter @agentspace/core add zod
pnpm --filter @agentspace/core add -D @types/node

# CLI package
pnpm --filter @agentspace/cli add ink @inkjs/ui chalk commander @napi-rs/keyring
pnpm --filter @agentspace/cli add -D @types/node

# DB package (for audit log)
pnpm --filter @agentspace/db add better-sqlite3 drizzle-orm
pnpm --filter @agentspace/db add -D drizzle-kit @types/better-sqlite3

# Gateway package (for local API endpoint -- minimal in Phase 1)
pnpm --filter @agentspace/gateway add fastify @fastify/bearer-auth
pnpm --filter @agentspace/gateway add -D @types/node
```

## Architecture Patterns

### Recommended Project Structure (Phase 1 Scope)

```
agentspace/
├── apps/                          # (empty in Phase 1, ready for web dashboard later)
├── packages/
│   ├── core/                      # @agentspace/core
│   │   ├── src/
│   │   │   ├── config/            # Config loading, schema, defaults
│   │   │   │   ├── index.ts       # Public API
│   │   │   │   ├── schema.ts      # Zod schemas for config
│   │   │   │   ├── loader.ts      # Read/write config from disk
│   │   │   │   └── types.ts       # SecurityMode, AppConfig types
│   │   │   ├── crypto/            # Token generation, HMAC utilities
│   │   │   │   ├── index.ts
│   │   │   │   └── tokens.ts      # generateAuthToken(), verifyToken()
│   │   │   ├── errors.ts          # Shared error types
│   │   │   ├── logger.ts          # Structured logging
│   │   │   └── index.ts           # Barrel export
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── cli/                       # @agentspace/cli
│   │   ├── src/
│   │   │   ├── commands/          # Commander subcommands
│   │   │   │   ├── keys.ts        # agentspace keys add|update|remove|list
│   │   │   │   ├── init.ts        # agentspace init (first-run onboarding)
│   │   │   │   └── config.ts      # agentspace config (view/set mode, etc.)
│   │   │   ├── components/        # Ink React components
│   │   │   │   ├── Onboarding.tsx  # Onboarding wizard flow
│   │   │   │   ├── KeyManager.tsx  # Interactive key management UI
│   │   │   │   └── StatusBar.tsx   # Common status display
│   │   │   ├── vault/             # Credential vault logic
│   │   │   │   ├── index.ts
│   │   │   │   ├── keychain.ts    # @napi-rs/keyring wrapper
│   │   │   │   └── providers.ts   # Provider-specific key schemas
│   │   │   └── index.ts           # CLI entry point (commander setup)
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── db/                        # @agentspace/db
│   │   ├── src/
│   │   │   ├── schema/            # Drizzle table definitions
│   │   │   │   ├── audit-log.ts   # Audit log table
│   │   │   │   └── index.ts       # Export all schemas
│   │   │   ├── connection.ts      # SQLite connection factory
│   │   │   ├── migrations/        # Generated by drizzle-kit
│   │   │   └── index.ts
│   │   ├── drizzle.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── gateway/                   # @agentspace/gateway (minimal in Phase 1)
│       ├── src/
│       │   ├── key-server/        # Local-only API endpoint
│       │   │   ├── index.ts
│       │   │   ├── server.ts      # Fastify instance bound to 127.0.0.1
│       │   │   ├── routes.ts      # GET /keys/:provider, health check
│       │   │   └── auth.ts        # Bearer token validation
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── turbo.json
├── pnpm-workspace.yaml
├── package.json                   # Root workspace config
├── tsconfig.base.json             # Shared TS config
├── biome.json                     # Biome config
└── .gitignore
```

**Rationale:** This follows the Turborepo convention of `packages/` for libraries. The `apps/` directory is created empty but ready for the web dashboard in a later phase. Each package has its own `package.json` and `tsconfig.json` for proper workspace isolation.

### Pattern 1: Credential Vault (Keychain Wrapper)

**What:** A thin wrapper around `@napi-rs/keyring` that organizes keys by provider with a consistent service/account naming convention.
**When to use:** All credential storage and retrieval operations.
**Example:**

```typescript
// Source: @napi-rs/keyring npm README + project-specific wrapper
import { Entry } from '@napi-rs/keyring';

const SERVICE_NAME = 'agentspace';

type Provider = 'anthropic' | 'openai' | 'ollama';

export function setApiKey(provider: Provider, key: string): void {
  const entry = new Entry(SERVICE_NAME, `api-key:${provider}`);
  entry.setPassword(key);
}

export function getApiKey(provider: Provider): string | null {
  try {
    const entry = new Entry(SERVICE_NAME, `api-key:${provider}`);
    return entry.getPassword();
  } catch {
    return null; // Key not found
  }
}

export function deleteApiKey(provider: Provider): void {
  const entry = new Entry(SERVICE_NAME, `api-key:${provider}`);
  entry.deletePassword();
}
```

### Pattern 2: Local-Only API with Bearer Auth

**What:** Fastify server bound to `127.0.0.1` with `@fastify/bearer-auth` for token-based access control. Auth token generated on first run and stored in keychain.
**When to use:** When external local applications need to retrieve API keys programmatically.
**Example:**

```typescript
// Source: Fastify docs (listen host option) + @fastify/bearer-auth README
import Fastify from 'fastify';
import bearerAuth from '@fastify/bearer-auth';

const server = Fastify({ logger: true });

// Register bearer auth with token stored in keychain
const authToken = getAuthToken(); // Retrieved from keychain
await server.register(bearerAuth, { keys: new Set([authToken]) });

// Key-serving route
server.get('/keys/:provider', async (request, reply) => {
  const { provider } = request.params as { provider: string };
  const key = getApiKey(provider as Provider);
  if (!key) {
    return reply.code(404).send({ error: 'Key not found' });
  }
  // Log access to audit log
  await logKeyAccess(provider, request.ip, new Date());
  return { provider, key };
});

// Bind to localhost ONLY -- critical for security
await server.listen({ port: 3271, host: '127.0.0.1' });
```

### Pattern 3: Config Persistence with Security Mode

**What:** JSON config file validated by Zod schema, storing security mode and other persistent settings. Config path follows XDG convention (`~/.config/agentspace/config.json`).
**When to use:** All persistent application settings.
**Example:**

```typescript
// Source: Zod docs + Node.js path/fs
import { z } from 'zod';
import { join } from 'node:path';
import { homedir } from 'node:os';

const SecurityMode = z.enum(['full-control', 'limited-control']);

const AppConfigSchema = z.object({
  securityMode: SecurityMode,
  workspaceDir: z.string().optional(), // Required for limited-control
  apiEndpoint: z.object({
    port: z.number().default(3271),
    host: z.literal('127.0.0.1').default('127.0.0.1'),
  }).default({}),
  onboardingComplete: z.boolean().default(false),
  createdAt: z.string().datetime(),
});

type AppConfig = z.infer<typeof AppConfigSchema>;

const CONFIG_DIR = join(homedir(), '.config', 'agentspace');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');
```

### Pattern 4: Audit Log with Drizzle + SQLite

**What:** Structured audit log in SQLite tracking every key access event. Drizzle schema defines the table; sync API via better-sqlite3 for writes.
**When to use:** Every key access through the local API endpoint.
**Example:**

```typescript
// Source: Drizzle ORM SQLite docs
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const auditLog = sqliteTable('audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: text('timestamp').notNull(), // ISO 8601
  event: text('event').notNull(),          // 'key_accessed', 'key_added', 'key_removed', 'key_updated'
  provider: text('provider'),              // 'anthropic', 'openai', 'ollama'
  sourceIp: text('source_ip'),             // Always 127.0.0.1 for API access
  sourceApp: text('source_app'),           // Application identifier from auth token metadata
  details: text('details'),                // JSON string for extra context
});
```

### Pattern 5: Onboarding Flow with Ink

**What:** First-run wizard using Ink's `Select` and `ConfirmInput` components. Steps: welcome, security mode selection, workspace directory (if Limited Control), API key setup, confirmation.
**When to use:** First time `agentspace init` is run (detected by absence of config file).
**Example:**

```tsx
// Source: @inkjs/ui npm docs
import React, { useState } from 'react';
import { render, Box, Text } from 'ink';
import { Select, ConfirmInput, TextInput } from '@inkjs/ui';

function Onboarding() {
  const [step, setStep] = useState<'mode' | 'workspace' | 'keys' | 'done'>('mode');
  const [mode, setMode] = useState<string>('');

  if (step === 'mode') {
    return (
      <Box flexDirection="column">
        <Text bold>Welcome to AgentSpace</Text>
        <Text>Choose your security mode:</Text>
        <Select
          options={[
            { label: 'Full Control - OS-level access with explicit permission grants', value: 'full-control' },
            { label: 'Limited Control - Restricted to a workspace directory', value: 'limited-control' },
          ]}
          onChange={(value) => {
            setMode(value);
            setStep(value === 'limited-control' ? 'workspace' : 'keys');
          }}
        />
      </Box>
    );
  }
  // ... subsequent steps
}
```

### Anti-Patterns to Avoid

- **Storing keys in config files:** Never write API keys to `config.json` or `.env` files. Always use the OS keychain via `@napi-rs/keyring`. The config file stores only non-secret settings (mode, paths, ports).
- **Binding to 0.0.0.0:** The key-serving API MUST bind to `127.0.0.1` only. Binding to `0.0.0.0` or `::` exposes keys to the network. Hardcode the host; do not make it configurable.
- **Rolling custom timing-safe comparison:** Use `@fastify/bearer-auth` which uses constant-time comparison. Never use `===` for token comparison (timing attack vector).
- **Trusting the Node.js Permission Model for security:** Node.js `--permission` is stable but explicitly stated as a "seat belt" not a security boundary. It does not protect against malicious code, symbolic links bypass it, and CVE-2025-55130 demonstrated a path traversal bypass. Use it as defense-in-depth, not as the primary enforcement mechanism.
- **Putting vault logic in the gateway:** The credential vault belongs in the CLI package (or a shared `core` package), not in the gateway. The gateway's key-server calls into the vault, but the vault is independent.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OS keychain access | Custom FFI bindings to Security.framework / libsecret | @napi-rs/keyring | Cross-platform, maintained Rust bindings, prebuilt binaries. Handles macOS Keychain, Windows Credential Manager, Linux Secret Service. |
| Bearer token validation | Custom authorization header parser with string comparison | @fastify/bearer-auth | Constant-time comparison prevents timing attacks. Handles edge cases in RFC 6750. |
| CLI argument parsing | Custom arg parser or regex-based | commander 12.x | Subcommands, help generation, option types, validation. Mature with 12+ years of edge case handling. |
| Config file validation | Manual if/else checking | zod 4.x | Type-safe schema validation with defaults, coercion, and clear error messages. |
| SQLite migrations | Raw CREATE TABLE statements | drizzle-kit | Tracks schema changes, generates migration files, handles rollbacks. |
| Interactive terminal prompts | Raw readline/process.stdin | Ink + @inkjs/ui | Select, TextInput, ConfirmInput components with consistent styling. Focus management, keyboard navigation built-in. |

**Key insight:** Phase 1 is deceptively simple in concept but full of security-sensitive edge cases. Timing attacks on token comparison, keychain error handling across platforms, config file race conditions -- each of these has a well-tested library solution. Hand-rolling any of them introduces unnecessary risk.

## Common Pitfalls

### Pitfall 1: @napi-rs/keyring Platform-Specific Failures

**What goes wrong:** `@napi-rs/keyring` works perfectly on macOS but fails silently or throws cryptic errors on headless Linux (no D-Bus / secret-service daemon) or in CI environments.
**Why it happens:** The library requires a running secret-service daemon (like `gnome-keyring-daemon`) on Linux. Headless servers and CI often don't have one.
**How to avoid:** Implement an AES-256-GCM encrypted file fallback. On first access, try keychain. If it throws, fall back to encrypted file storage at `~/.config/agentspace/vault.enc` with a key derived from machine-specific entropy (hostname + user + salt). Log a warning that keychain is unavailable.
**Warning signs:** Tests pass locally but fail in CI. Users on headless Linux report "entry not found" errors.

### Pitfall 2: Config File Race Conditions

**What goes wrong:** Two processes (CLI and API server) read/write `config.json` simultaneously, causing data loss or corruption.
**Why it happens:** JSON file read-modify-write is not atomic. Two processes can read the same state, modify different fields, and overwrite each other.
**How to avoid:** Use `better-sqlite3` for ALL persistent state, including config. SQLite handles concurrent access with WAL mode. Alternatively, use file locking (`proper-lockfile` npm package) if sticking with JSON config, but SQLite is the better path since we already have it for audit logs.
**Warning signs:** Config settings mysteriously revert after concurrent CLI and API operations.

### Pitfall 3: Auth Token Leakage in Logs

**What goes wrong:** The bearer auth token for the local API endpoint appears in Fastify request logs, making it discoverable in log files.
**Why it happens:** Fastify's default logger includes request headers. The `Authorization: Bearer <token>` header gets logged verbatim.
**How to avoid:** Configure Fastify's serializer to redact the Authorization header: `serializers: { req(request) { return { method: request.method, url: request.url, headers: { ...request.headers, authorization: '[REDACTED]' } }; } }`.
**Warning signs:** Grep log files for the auth token value -- if it appears, you have a leak.

### Pitfall 4: Onboarding Flow Not Detecting Existing Setup

**What goes wrong:** Running `agentspace init` a second time overwrites existing config and keys without warning.
**Why it happens:** No check for existing config file before starting onboarding.
**How to avoid:** Check for config file existence first. If found, prompt "AgentSpace is already configured. Re-run setup? This will not delete existing API keys." Make re-onboarding opt-in, not default.
**Warning signs:** Users lose their security mode setting after accidentally re-running init.

### Pitfall 5: Limited Control Mode Not Actually Enforcing Limits

**What goes wrong:** The agent claims to be in "Limited Control" mode but can still access files outside the workspace directory.
**Why it happens:** Path validation only checks the initial path, not resolved symlinks. Or path validation uses string prefix matching (`path.startsWith(workspace)`) which fails for `../` traversal.
**How to avoid:** Always resolve paths with `path.resolve()` before comparison. Use `path.resolve(candidatePath).startsWith(path.resolve(workspaceDir) + path.sep)` to prevent prefix attacks. Additionally, check that the resolved path does not contain symlinks pointing outside the workspace with `fs.realpathSync()`.
**Warning signs:** Creating a symlink inside the workspace that points to `/etc/passwd` succeeds in Limited Control mode.

### Pitfall 6: Hardcoded Port Conflicts

**What goes wrong:** The local API endpoint fails to start because port 3271 (or whatever default) is already in use.
**Why it happens:** Other development tools, databases, or a previous AgentSpace instance occupy the port.
**How to avoid:** Try the configured port first. If `EADDRINUSE`, try the next 10 ports. Log which port was actually bound. Store the active port in a PID file or lock file so CLI can discover it.
**Warning signs:** "Address already in use" error on startup with no recovery.

## Code Examples

### Complete Credential Vault Module

```typescript
// Source: @napi-rs/keyring npm + Node.js crypto docs
import { Entry } from '@napi-rs/keyring';
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'node:crypto';

const SERVICE = 'agentspace';
const PROVIDERS = ['anthropic', 'openai', 'ollama'] as const;
type Provider = typeof PROVIDERS[number];

// Primary: OS keychain
function keychainSet(account: string, password: string): void {
  new Entry(SERVICE, account).setPassword(password);
}

function keychainGet(account: string): string | null {
  try {
    return new Entry(SERVICE, account).getPassword();
  } catch {
    return null;
  }
}

function keychainDelete(account: string): void {
  try {
    new Entry(SERVICE, account).deletePassword();
  } catch {
    // Already deleted or never existed -- fine
  }
}

// Public API
export function addKey(provider: Provider, key: string): void {
  if (!PROVIDERS.includes(provider)) {
    throw new Error(`Unknown provider: ${provider}. Valid: ${PROVIDERS.join(', ')}`);
  }
  keychainSet(`api-key:${provider}`, key);
}

export function getKey(provider: Provider): string | null {
  return keychainGet(`api-key:${provider}`);
}

export function removeKey(provider: Provider): void {
  keychainDelete(`api-key:${provider}`);
}

export function listProviders(): { provider: Provider; configured: boolean }[] {
  return PROVIDERS.map((p) => ({ provider: p, configured: keychainGet(`api-key:${p}`) !== null }));
}
```

### Auth Token Generation and Storage

```typescript
// Source: Node.js crypto docs
import { randomBytes } from 'node:crypto';

export function generateAuthToken(): string {
  return randomBytes(32).toString('hex'); // 256-bit token
}

// Store the API endpoint auth token in keychain too
export function getOrCreateAuthToken(): string {
  const existing = keychainGet('api-endpoint-token');
  if (existing) return existing;

  const token = generateAuthToken();
  keychainSet('api-endpoint-token', token);
  return token;
}
```

### Fastify Key Server Setup

```typescript
// Source: Fastify docs + @fastify/bearer-auth README
import Fastify from 'fastify';
import bearerAuth from '@fastify/bearer-auth';

export async function createKeyServer(authToken: string, port: number) {
  const server = Fastify({
    logger: {
      level: 'info',
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: request.url,
            remoteAddress: request.ip,
            // NEVER log the Authorization header
          };
        },
      },
    },
  });

  await server.register(bearerAuth, {
    keys: new Set([authToken]),
  });

  server.get('/health', { config: { rawBody: false } }, async () => {
    return { status: 'ok' };
  });

  server.get<{ Params: { provider: string } }>('/keys/:provider', async (request, reply) => {
    const { provider } = request.params;
    const key = getKey(provider as Provider);
    if (!key) {
      return reply.code(404).send({ error: `No key configured for provider: ${provider}` });
    }
    // Audit log entry
    await recordAuditEvent({
      event: 'key_accessed',
      provider,
      sourceIp: request.ip,
      timestamp: new Date().toISOString(),
    });
    return { provider, key };
  });

  // Bind to localhost ONLY
  await server.listen({ port, host: '127.0.0.1' });
  return server;
}
```

### Drizzle Audit Log Schema

```typescript
// Source: Drizzle ORM SQLite docs
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const auditLog = sqliteTable('audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: text('timestamp').notNull(),
  event: text('event', {
    enum: ['key_accessed', 'key_added', 'key_removed', 'key_updated', 'mode_changed', 'auth_failed'],
  }).notNull(),
  provider: text('provider'),
  sourceIp: text('source_ip'),
  sourceApp: text('source_app'),
  details: text('details'), // JSON string
});
```

### Security Mode Enforcement (Limited Control)

```typescript
// Source: Node.js path docs
import { resolve, sep } from 'node:path';
import { realpathSync } from 'node:fs';

export function isPathWithinWorkspace(candidatePath: string, workspaceDir: string): boolean {
  const resolvedCandidate = resolve(candidatePath);
  const resolvedWorkspace = resolve(workspaceDir);

  // Check resolved path is within workspace
  if (!resolvedCandidate.startsWith(resolvedWorkspace + sep) && resolvedCandidate !== resolvedWorkspace) {
    return false;
  }

  // Also check real path (resolves symlinks) to prevent symlink escapes
  try {
    const realCandidate = realpathSync(resolvedCandidate);
    const realWorkspace = realpathSync(resolvedWorkspace);
    return realCandidate.startsWith(realWorkspace + sep) || realCandidate === realWorkspace;
  } catch {
    // Path doesn't exist yet (e.g., file to be created) -- allow if resolved path was OK
    return true;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| keytar (Atom/GitHub) | @napi-rs/keyring | keytar archived Dec 2022 | Must use @napi-rs/keyring. keytar no longer receives updates or security patches. |
| Node.js Permission Model experimental | Node.js Permission Model stable | Node.js v23.5.0 / v22.13.0 | Available as defense-in-depth for filesystem restrictions. Not a security boundary by itself (CVE-2025-55130). |
| dotenv for secrets | OS keychain + encrypted fallback | Industry trend 2023-2025 | Plain .env files are a security liability. OS keychain is the standard for desktop applications. |
| Express middleware auth | @fastify/bearer-auth | Fastify 5.x ecosystem | Plugin-based auth with timing-safe comparison is the Fastify standard. |

**Deprecated/outdated:**
- keytar: Archived. Use @napi-rs/keyring.
- node-keytar: Same as keytar, different npm name. Also archived.
- dotenv for API keys: Insecure for production secrets. Use OS keychain.

## Recommendations for Claude's Discretion Areas

### Onboarding Flow Design
**Recommendation: Step-by-step wizard with clear explanations.**
Use Ink's Select and TextInput components in a multi-step flow: (1) Welcome + explain modes, (2) Mode selection, (3) Workspace directory if Limited Control, (4) Optional API key setup, (5) Summary + confirm. Keep each step focused. Show what was configured at the end. Rationale: First impressions matter. A clear wizard builds trust, especially since security mode choice is permanent-ish.

### Credential Management UX
**Recommendation: CLI flags for scripting, interactive prompts as fallback.**
Support both `agentspace keys add anthropic --key sk-ant-...` (scriptable) and `agentspace keys add anthropic` (prompts for key with hidden input). The key should be masked in terminal output. Use Ink's TextInput with a mask character for interactive mode. Rationale: Power users want flags; new users want prompts. Support both without complexity.

### Security Boundary Enforcement
**Recommendation: Application-layer path validation + optional Node.js --permission as defense-in-depth.**
For Limited Control mode, validate all file paths against the workspace directory at the application level (see `isPathWithinWorkspace` code example). Optionally, when launching the agent process, use `--permission --allow-fs-read=/workspace --allow-fs-write=/workspace` as a second layer. Allow mode switching post-setup via `agentspace config set mode full-control` with a confirmation prompt. Rationale: Application-layer enforcement is reliable and testable. Node.js Permission Model adds depth but has known bypasses.

### Audit Log Format and Storage
**Recommendation: SQLite table via Drizzle, structured JSON for details field.**
Store audit events in the SQLite database (same file used for other Phase 1 data). Each event has a type, timestamp, provider, source IP, and optional JSON details field. Audit log lives at `~/.config/agentspace/agentspace.db`. Add a CLI command `agentspace audit` to view recent events. Rationale: SQLite is already a dependency for audit logs. Structured storage enables querying. A CLI viewer makes audit accessible.

### Key Rotation Handling
**Recommendation: Update-in-place with audit trail.**
`agentspace keys update <provider>` overwrites the existing key in the keychain and logs a `key_updated` audit event with timestamp but NOT the old or new key value. No automatic rotation -- user-initiated only. Rationale: Automatic rotation requires provider-specific APIs that don't exist for most providers. Manual rotation with audit trail is practical and sufficient.

### Project Scaffolding Structure
**Recommendation: Turborepo with packages/ directory, no apps/ usage in Phase 1.**
Follow the structure documented above. Use `pnpm-workspace.yaml` pointing at `packages/*`. TypeScript project references for incremental builds. Shared `tsconfig.base.json` at root. Biome for linting/formatting from day one. Rationale: Matches Turborepo conventions. Consistent with prior STACK.md research decisions.

## Open Questions

1. **AES-256-GCM Fallback Key Derivation**
   - What we know: When OS keychain is unavailable, we need an encrypted file fallback. AES-256-GCM is the right algorithm.
   - What's unclear: What machine-specific entropy should seed the key derivation? Hostname + username is guessable. Hardware UUID is better but platform-specific to retrieve.
   - Recommendation: Use `scryptSync(hostname() + userInfo().username, hardcodedSalt, 32)` as a reasonable default. Accept that this is weaker than keychain. Document the tradeoff. Revisit if users request stronger fallback.

2. **API Endpoint Port Discovery**
   - What we know: The local API endpoint needs a port. CLI and other local apps need to find it.
   - What's unclear: Should the port be fixed (from config) or dynamic? How do consuming apps discover it?
   - Recommendation: Use a fixed default port (e.g., 3271) from config. If occupied, try next 10 ports. Write actual bound port to `~/.config/agentspace/runtime.json` (PID file with port). CLI reads this file to find the running server.

3. **Auth Token Rotation for API Endpoint**
   - What we know: The bearer token for the local API endpoint is generated once and stored in keychain.
   - What's unclear: Should it rotate? Per-session or persistent?
   - Recommendation: Generate once, persist in keychain, only rotate on explicit user action (`agentspace config rotate-token`). Per-session tokens would break integrations that cache the token. Log rotation events in audit log.

## Sources

### Primary (HIGH confidence)
- [@napi-rs/keyring npm](https://www.npmjs.com/package/@napi-rs/keyring) - API surface (Entry class), platform support, version 1.2.x
- [@napi-rs/keyring GitHub](https://github.com/Brooooooklyn/keyring-node) - setPassword/getPassword/deletePassword methods, keytar compatibility
- [Fastify Server Reference](https://fastify.dev/docs/latest/Reference/Server/) - listen() host option for 127.0.0.1 binding
- [@fastify/bearer-auth GitHub](https://github.com/fastify/fastify-bearer-auth) - Plugin API, keys option, constant-time comparison, v10.1.2
- [Node.js Permissions API](https://nodejs.org/api/permissions.html) - Stable as of v23.5.0, --allow-fs-read/--allow-fs-write flags, limitations
- [Drizzle ORM SQLite Docs](https://orm.drizzle.team/docs/get-started/sqlite-new) - sqliteTable, column types, better-sqlite3 integration
- [Turborepo Structuring Guide](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository) - apps/ vs packages/ convention
- [@inkjs/ui npm](https://www.npmjs.com/package/@inkjs/ui) - Select, TextInput, ConfirmInput components

### Secondary (MEDIUM confidence)
- [Nhost pnpm + Turborepo Guide](https://nhost.io/blog/how-we-configured-pnpm-and-turborepo-for-our-monorepo) - Real-world monorepo configuration patterns
- [pnpm Workspaces Docs](https://pnpm.io/workspaces) - pnpm-workspace.yaml format
- [Fastify Issue #3027](https://github.com/fastify/fastify/issues/3027) - Default binding behavior on different platforms

### Tertiary (LOW confidence)
- [JFrog CVE-2025-55130](https://research.jfrog.com/vulnerabilities/nodejs-fs-permissions-bypass-cve-2025-55130/) - Node.js Permission Model filesystem bypass (needs validation of whether patched in Node 24 LTS)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via npm, GitHub, and official docs. Versions confirmed current.
- Architecture: HIGH - Patterns follow established Fastify/Turborepo conventions with project-specific adaptations.
- Pitfalls: MEDIUM - Keychain fallback and sandbox enforcement are well-understood problems but implementation details need validation during development.
- Onboarding UX: MEDIUM - Ink component API verified but exact flow needs user testing.

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (30 days -- stable domain, slow-moving libraries)
