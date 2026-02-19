# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Every interaction with your AI agent is transparent, secure, and under your control -- you see exactly what's being sent, what tools are running, and can approve or skip permissions at any granularity.
**Current focus:** Phase 15 — Init & Onboarding Polish

## Current Position

Phase: 15 of 18 (Init & Onboarding Polish)
Plan: 2 of 3 in current phase
Status: Executing phase 15
Last activity: 2026-02-18 - Completed 15-01: Config schema and onboarding foundation

Progress: [████████████████████████████████████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 36
- Average duration: 3min
- Total execution time: 1.25 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3/3 | 8min | 3min |
| 02 | 3/3 | 8min | 3min |
| 03 | 2/2 | 7min | 4min |
| 04 | 2/2 | 7min | 4min |
| 05 | 3/3 | 8min | 3min |
| 06 | 5/5 | 20min | 4min |
| 07 | 4/4 | 11min | 3min |
| 08 | 5/5 | 13min | 3min |
| 09 | 4/4 | 12min | 3min |
| 10 | 4/4 | 7min | 2min |
| 11 | 3/3 | 7min | 2min |
| 12 | 2/2 | 6min | 3min |
| 13 | 2/2 | 8min | 4min |
| 14 | 2/2 | 4min | 2min |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 12 P01 | 3min | 2 tasks | 7 files |
| Phase 12 P02 | 3min | 2 tasks | 5 files |
| Phase 13 P01 | 2min | 2 tasks | 68 files |
| Phase 13 P02 | 6min | 2 tasks | 23 files |
| Phase 14 P01 | 2min | 2 tasks | 5 files |
| Phase 14 P02 | 2min | 2 tasks | 3 files |
| Phase 18 P01 | 2min | 2 tasks | 2 files |
| Phase 15 P01 | 1min | 2 tasks | 8 files |

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
- [Phase 06]: [06-04]: Preflight generation fails gracefully -- proceed without checklist if generateObject errors
- [Phase 06]: [06-04]: PendingPreflight stores full context on ConnectionState for post-approval agent loop resumption
- [Phase 06]: [06-04]: ToolApprovalPrompt and PreflightChecklist replace InputBar when active (mutual exclusion)
- [Phase 06]: [06-04]: /tools and /approve are local-only MVP slash commands (no server round-trip)
- [07-01]: StepRecord adapts AI SDK StepResult via mapping in onStepFinish (SDK has no stepType field)
- [07-01]: Failure detection is informational only -- emits WS message, does not stop agent loop
- [07-01]: Used logger.info instead of logger.debug since createLogger has no debug level
- [07-02]: Skipped custom WS protocol messages (skill.proposed/skill.registered) -- existing tool flow is sufficient for MVP
- [07-02]: skill_register uses "always" approval tier; skill_draft uses default tier (sandbox is safe)
- [07-02]: Per-connection sandbox temp directory via randomUUID for skill draft isolation
- [07-02]: Tool-specific approval prompt pattern: SkillApprovalPrompt overrides generic for skill_register
- [07-03]: Callback prop pattern (onProxyRequest) to pass data from Ink component to post-exit entrypoint
- [07-03]: xterm-256color TERM for full color support in proxied terminal apps
- [07-03]: isTTY guard on setRawMode for safety in non-interactive environments
- [07-04]: WS connection opened separately for terminal messages (not reusing Ink's connection which unmounts)
- [07-04]: Rolling 4000-char buffer with 500ms throttled emission for snapshots (avoids flooding)
- [07-04]: Agent control revoke via Ctrl+backslash consumes keystroke, does not forward to PTY
- [07-04]: Snapshot buffer and agent input both gated on agentControlActive flag
- [08-01]: Workflow steps use action enum (tool|model|noop) for extensible step types
- [08-01]: Branching via condition/goto pairs on steps for DAG-style workflow execution
- [08-01]: Schedule active hours stored as JSON string columns for flexible day-of-week filtering
- [08-02]: Condition evaluation via new Function with restricted scope (only result variable accessible)
- [08-02]: Durable execution: state persisted to SQLite after every step transition
- [08-02]: Approval gates pause execution and store paused status in stepResults for resume
- [08-02]: Template resolver only processes prompt/args fields (prevents template injection)
- [08-03]: AI SDK v6 uses LanguageModel type import and stopWhen: stepCountIs() instead of maxSteps
- [08-03]: Heartbeat checks run sequentially (not parallel) per research anti-pattern guidance
- [08-03]: Croner protect=true prevents overlapping heartbeat runs
- [08-03]: Schedule store maps ScheduleConfig to/from SQLite with JSON serialization for activeHoursDays
- [08-04]: Dynamic imports in handlers for workflow/scheduler modules to avoid circular dependencies
- [08-04]: Workflow approval gates use ConnectionState pendingWorkflowApprovals map keyed by executionId:stepId
- [08-04]: Heartbeat configure creates cron schedule with WS-based alert callback pattern
- [08-05]: Used anthropic:claude-sonnet-4-5-20250514 as heartbeat model via registry (same pattern as executor.ts)
- [08-05]: heartbeatPath is a required field on HeartbeatConfigureSchema (client must specify HEARTBEAT.md location)
- [09-01]: Used crypto.randomUUID() for transport IDs in server.ts (synchronous, no async import needed in WS handler)
- [09-01]: Transport interface uses send(ServerMessage) method matching existing send helper pattern
- [09-01]: WebSocketTransport exposes raw getter for close/error event binding only
- [09-02]: tool.result formatter uses msg.result (not msg.output) matching ToolResultNotify schema field name
- [09-02]: HTML parse_mode over MarkdownV2 for predictable escaping in Telegram messages
- [09-03]: drizzle-orm added as direct dependency in telegram package for pairing code DB queries
- [09-03]: Module-level Map<number, TelegramTransport> reuses transports per chatId across messages
- [09-03]: /pair always generates new code (supports re-pairing); /start shows code only if unpaired
- [09-03]: handleChatSend, initConnection, getConnectionState exported from gateway for cross-channel use
- [09-04]: Accumulator edits at 2s intervals to stay within Telegram rate limits
- [09-04]: InlineKeyboard from grammy imported directly in transport for tool approval rendering
- [09-04]: Chat-transport map in callback module for resolving Telegram chatId to gateway transportId
- [09-04]: Typing indicator kept alive via setInterval(4s) cleared in finally block
- [10-01]: Query.close() for post-completion timeout instead of abortController.abort() (SDK-native cleanup)
- [10-01]: RelayCallbacks pattern (onResult/onDone) to decouple session manager from relay internals
- [10-01]: SDK events mapped to existing ServerMessage types (no new protocol types for Claude Code)
- [10-01]: 30-second post-completion timeout to handle known CLI hanging bug
- [10-02]: Read-only tools (Read, Grep, Glob, WebFetch) auto-approved in approval proxy
- [10-02]: Approval proxy reuses existing pendingApprovals Map and tool.approval.response handler
- [10-02]: runToCompletion uses acceptEdits permission mode for workflow automation
- [10-02]: Dynamic imports for claude-code module in handlers to avoid circular dependencies
- [10-03]: Raw fetch for Tavily and Stability AI APIs (no SDK dependencies)
- [10-03]: gpt-image-1.5 model for OpenAI image gen (not deprecated DALL-E 3)
- [10-03]: Conditional tool registration: skills only registered when API keys provided
- [10-03]: Web search uses auto approval tier (read-only); image gen uses session tier (costs money)
- [10-03]: Playwright browser automation via existing MCP infrastructure with zero custom code
- [10-04]: OAuth 2.0 for personal accounts via googleapis built-in token refresh
- [10-04]: inputSchema (AI SDK v6) not parameters for tool definitions
- [10-04]: Conditional registration: Google tools only added when googleAuth config provided
- [10-04]: Read ops use auto approval tier; write ops use session approval tier
- [11-01]: Shared ensure-memory.ts utility over inline logic in each module
- [11-01]: import.meta.url kept only in ensure-memory.ts for template path derivation
- [11-01]: Template files retained in packages/db/memory-files/ as seeding source
- [11-02]: Build packages individually via tsc (turbo fails on cli<->gateway cyclic dependency)
- [11-02]: rsync --delete with shared exclude patterns between install.sh and update.sh
- [11-02]: .version JSON at install root preserves installedAt across updates
- [11-03]: Reset script does NOT delete keychain entries (stored in macOS Keychain, not filesystem)
- [11-03]: Destructive scripts require explicit confirmation string (RESET), not just y/n
- [11-03]: Reset exits 0 on cancellation (not an error condition)
- [12-01]: Venice AI uses OpenAI-compatible adapter with bearer token auth (no dedicated SDK)
- [12-01]: Google Gemini uses dedicated @ai-sdk/google for native API support
- [12-01]: Ollama endpoints configurable via ollamaEndpoints array; first keeps "ollama" name for backward compat
- [12-01]: Venice wildcard pricing defaults to $0.50/MTok; PROVIDER_KEY_PREFIXES null for venice and google
- [12-02]: Venice image tool uses raw fetch POST to /image/generate (same pattern as Stability AI)
- [12-02]: Venice video tool uses two-step queue/poll pattern: /video/queue then /video/retrieve every 10s
- [12-02]: Both Venice tools use session approval tier (paid API operations)
- [12-02]: API keys wired from vault in handlers.ts for openai and venice providers
- [Phase 13]: [13-01]: Centralized constants in constants.ts with 7 exports for single-file rebrand capability
- [Phase 13]: [13-01]: types.ts derives CONFIG_DIR and DB_PATH from constants (no hardcoded strings)
- [Phase 13]: [13-02]: TekError replaces AgentSpaceError with backward-compat alias export
- [Phase 13]: [13-02]: Keychain migration runs once on first keychainGet() call using module-level flag
- [Phase 13]: [13-02]: Config dir migration runs at CLI startup before configExists() check
- [Phase 13]: [13-02]: SERVICE_NAME typed as string (not literal) to allow comparison with old service name
- [Phase 14]: [14-01]: Derive install dir at runtime via realpathSync(process.argv[1]) with ~/tek fallback
- [Phase 14]: [14-01]: Uninstall uses readline createInterface for UNINSTALL confirmation prompt
- [Phase 14]: [14-01]: Uninstall prints PATH removal instructions rather than editing shell profile
- [Phase 14]: [14-02]: Star prefix for recommended models in Select UI (e.g. "★ Llama 3.3 70B (low-cost)")
- [Phase 14]: [14-02]: Provider-qualified model IDs as Select values consistent with gateway model resolution
- [Phase 14]: [14-02]: buildAvailableModels merges newly-entered keys with existingConfig.configuredProviders
- [Phase 14]: [14-02]: Alias "keep" command preserves all existing aliases at once
- [Phase 15]: [15-01]: Custom personality preset mirrors existing SOUL.md; telegram vault provider uses null key prefix

### Roadmap Evolution

- Phase 11 added: Install & Update System — deploy to destination directory, update without destroying personality/config, fresh-start option
- Phase 12 added: Expanded Providers — Venice AI (text/image/video), Google AI Studio (Gemini), Ollama remote/cloud hosts, provider hot-swap
- Phase 13 added: Rebrand to tek — rename CLI/packages/paths from agentspace to tek with centralized project name constant
- Phase 14 added: CLI & Setup Polish — gateway subcommand, skippable setup steps, full model catalog with recommendations, tek uninstall
- Phase 15 added: Init & Onboarding Polish — fix model alias flow (checkbox multi-select, clear input), integrate Telegram setup into init, streamline onboarding sequence
- Phase 16 added: Agent Personality System — multi-agent support with individual soul/memory/personality, personality onboarding wizard, humor/tone settings, OpenClaw-inspired patterns
- Phase 17 added: Desktop Frontend (Tauri) — Tauri-based desktop app for install/update/reset, gateway management, agent management, chat interface
- Phase 18 added: Onboarding Research — deep research on OpenClaw (Peter Steinberger's soul files/agents) and other systems to improve personality and onboarding flows
- [Phase 18]: [18-01]: Two-phase onboarding: infrastructure wizard then conversational Hatch step for personality
- [Phase 18]: [18-01]: 5 personality presets (Professional/Friendly/Technical/Opinionated/Custom) as markdown templates
- [Phase 18]: [18-01]: Multi-file identity architecture: SOUL.md + IDENTITY.md + USER.md + STYLE.md + AGENTS.md
- [Phase 18]: [18-01]: Conservative personality evolution with diff-style proposals requiring user approval
- [Phase 18]: [18-01]: Anti-patterns: no database-backed personality, no custom NLP, no form-based setup

### Pending Todos

- **Daemon mode for gateway** — Add option during `tek init` to install a launchd service (macOS) so the gateway runs in the background and survives terminal close / restarts
- **Uninstall / offboard process** — Clean uninstall that removes installed files, launchd service, PATH entry, config, keychain entries, and database. Should be a `tek uninstall` command or standalone script
- **Verify update process end-to-end** — Ensure `update.sh` works correctly with daemon service (restart after update), config migration, and all recent changes (rebrand, model aliases, etc.)

### Blockers/Concerns

None yet.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | Fix install.sh build order: cli must build before gateway | 2026-02-18 | 744d831 | [1-fix-install-sh-build-order-gateway-depen](./quick/1-fix-install-sh-build-order-gateway-depen/) |
| 2 | Update install docs and source with new tek naming | 2026-02-18 | 504900a | [2-update-install-docs-with-new-tek-naming](./quick/2-update-install-docs-with-new-tek-naming/) |
| 3 | Model selection with aliases + /swap command | 2026-02-18 | 0c8ba7c | [3-add-model-selection-with-aliases-to-setu](./quick/3-add-model-selection-with-aliases-to-setu/) |
| 4 | Update INSTALL.md for Phase 14 CLI changes | 2026-02-18 | c8259db | [4-update-install-docs-and-scripts-for-phas](./quick/4-update-install-docs-and-scripts-for-phas/) |
| 5 | Gateway console UI with live log streaming | 2026-02-18 | f040ef1 | [5-gateway-console-ui-with-live-log-streami](./quick/5-gateway-console-ui-with-live-log-streami/) |
| 6 | Complete Venice text model catalog from API with recommendations | 2026-02-18 | 72fc317 | [6-complete-venice-text-model-catalog-from-](./quick/6-complete-venice-text-model-catalog-from-/) |

## Session Continuity

Last session: 2026-02-18
Stopped at: Completed 15-01-PLAN.md
Resume file: None
