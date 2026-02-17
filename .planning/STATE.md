# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Every interaction with your AI agent is transparent, secure, and under your control -- you see exactly what's being sent, what tools are running, and can approve or skip permissions at any granularity.
**Current focus:** Phase 6: Agent Capabilities

## Current Position

Phase: 6 of 10 (Agent Capabilities)
Plan: 3 of 4 in current phase
Status: Completed 06-03 (agent tool loop, WS protocol extensions, context assembler wiring)
Last activity: 2026-02-16 -- Completed 06-03 (agent tool loop, WS protocol extensions, skills/tools context wiring)

Progress: [████████████████████████░] 64%

## Performance Metrics

**Velocity:**
- Total plans completed: 14
- Average duration: 4min
- Total execution time: 0.72 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3/3 | 8min | 3min |
| 02 | 3/3 | 8min | 3min |
| 03 | 2/2 | 7min | 4min |
| 04 | 2/2 | 7min | 4min |
| 05 | 3/3 | 8min | 3min |
| 06 | 3/4 | 15min | 5min |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 10 phases derived from 65 requirements across 9 categories; comprehensive depth
- [Roadmap]: Phases 3/4/5 can parallelize after Phase 2; Phases 7/8/9/10 can parallelize after Phase 6
- [Research]: TypeScript/Node.js monorepo with Fastify, AI SDK 6, Drizzle+SQLite, Ink CLI, grammY for Telegram
- [01-01]: Used Zod 4.x with factory function defaults for nested object schemas
- [01-01]: Auto-create audit_log table in getDb() for zero-friction first run
- [01-01]: Singleton database connection pattern for SQLite
- [01-02]: Hidden input for CLI key prompts uses raw stdin, not Ink TextInput
- [01-02]: Key prefix validation is advisory-only (warnings, not enforcement)
- [01-02]: Vault functions are synchronous, matching better-sqlite3 sync API
- [01-03]: Scoped bearer-auth to /keys/* routes only, leaving /health unauthenticated
- [01-03]: Runtime.json written on server start with PID/port/timestamp, cleaned on exit
- [01-03]: Onboarding wizard uses multi-step Ink component with state machine flow
- [02-01]: Refactored createKeyServer into createServer/start for pre-listen plugin registration
- [02-01]: WeakMap for per-connection state with automatic garbage collection
- [02-01]: DEFAULT_MODEL set to claude-sonnet-4-5-20250514 (updated to 20250929 in 02-03)
- [02-01]: Localhost-only WebSocket access via preValidation hook
- [02-02]: Model pricing includes fuzzy matching for versioned model IDs
- [02-02]: Handlers dispatched from WS message handler with .catch() error boundary
- [02-02]: UsageTracker singleton pattern consistent with SessionManager
- [02-03]: Updated DEFAULT_MODEL to claude-sonnet-4-5-20250929 (previous ID returned 404)
- [03-01]: Downgraded marked to ^15.0.0 to satisfy marked-terminal peer dep
- [03-01]: WebSocket callbacks stored in refs to prevent stale closures in useEffect
- [03-01]: setStreamingText callback form for atomic promotion of streaming text to messages
- [03-02]: ChatMessage refactored to discriminated union on type field for forward-compatible tool_call/bash_command/reasoning
- [03-02]: Plain text during streaming, markdown only on completion (avoids partial-parse artifacts)
- [03-02]: Used markedTerminal() extension API with marked.use() for marked v15 compatibility
- [03-02]: Custom type declarations for marked-terminal (no @types package available)
- [04-01]: Singleton provider registry pattern with lazy init, consistent with SessionManager/UsageTracker
- [04-01]: resolveModelId() prefixes bare model names with "anthropic:" for backward compatibility
- [04-01]: Ollama always registered even without a key (local, keyless)
- [04-01]: Provider-qualified model IDs as standard format ("provider:model")
- [04-01]: Pricing keeps both bare and provider-prefixed Anthropic entries for backward compat
- [04-01]: Cast model to `never` for registry.languageModel() due to dynamic registry type parameter
- [04-02]: Default routing mode is auto (routes silently, shows tier in stream.start)
- [04-02]: Explicit msg.model bypasses routing entirely (user choice takes precedence)
- [04-02]: streamToClient helper extracted to avoid code duplication between normal and route-confirm flows
- [04-02]: Confidence scoring: 1.0 keyword, 0.7 length/history, 0.5 default fallback
- [04-02]: Protocol extension pattern: add schema, add to discriminated union, wire handler in server.ts
- [05-01]: sqlite-vec loaded before table creation in getDb() initialization sequence
- [05-01]: vec_memories uses application-level join with memories.id (virtual tables don't support FK constraints)
- [05-01]: 1536 dimensions for OpenAI text-embedding-3-small compatibility
- [05-02]: File paths resolved via import.meta.url for ESM compatibility regardless of CWD
- [05-02]: All file-based memory operations are synchronous, consistent with better-sqlite3 sync API
- [05-02]: Raw better-sqlite3 client via (db as any).$client for vec0 virtual table operations
- [05-02]: embedAndStore combines memory record + vector storage in single async call
- [05-03]: Lazy-init singletons for MemoryManager/ThreadManager consistent with SessionManager/UsageTracker pattern
- [05-03]: Memory pressure flushes older half of conversation history to daily log (best-effort, non-blocking)
- [05-03]: System prompt assembly: global prompts by priority desc + thread-specific prompt, soul/memory added by assembler
- [05-03]: Vector search uses raw SQL via $client for sqlite-vec KNN MATCH queries with Drizzle metadata join
- [06-01]: AI SDK v6 uses inputSchema (not parameters) for tool() definitions
- [06-01]: Zod 4 z.record requires explicit key schema: z.record(z.string(), valueSchema)
- [06-01]: MCP tools namespaced as serverName.toolName to avoid collisions with built-in tools
- [06-01]: Approval gate stores session approvals in a Set for O(1) lookup
- [Phase 06]: [06-02]: Used readdirSync instead of glob for flat skill directory scanning (avoids unnecessary dependency)
- [Phase 06]: [06-02]: safeParse for SKILL.md validation to skip invalid files silently without crashing
- [Phase 06]: [06-02]: Cast Dirent entries for Node.js v24 type compatibility with withFileTypes
- [Phase 06]: [06-03]: AI SDK tool-result uses 'output' property not 'result'
- [Phase 06]: [06-03]: Tool registry lazily built on first chat.send and cached on ConnectionState
- [Phase 06]: [06-03]: Approval timeout auto-denies after 60s to prevent indefinite blocking
- [Phase 06]: [06-03]: ConnectionState extended with pendingApprovals/tools/approvalPolicy for agent loop

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-16
Stopped at: Completed 06-03-PLAN.md (agent tool loop, WS protocol extensions, context assembler wiring)
Resume file: None
