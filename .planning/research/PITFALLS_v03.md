# Domain Pitfalls: v0.3 Desktop UX & Configuration Features

**Project:** Tek — Self-hosted AI agent platform
**Milestone:** v0.3 Desktop UX & Configuration (adding desktop config, async tool handling, subprocess monitoring)
**Researched:** 2026-02-22
**Confidence:** HIGH (OpenClaw issues + 2026 distributed systems research + Tauri patterns)

---

## Critical Pitfalls

### Pitfall 1: Configuration State Divergence (Desktop ↔ Gateway)

**What goes wrong:**
Desktop UI displays different provider credentials or settings than what the gateway actually uses. User configures API key in UI, submits successfully, but gateway continues using stale key. On restart, UI and gateway disagree about current state (cache vs. filesystem vs. database).

**Why it happens:**
- No transactional sync between Tauri frontend, Rust backend, and gateway process
- Configuration written to disk but not invalidated in gateway memory cache
- Gateway reads config on startup only; hot reload not implemented
- UI doesn't verify backend accepted the change before showing success feedback
- Restart logic doesn't properly coordinate state reload across processes
- Network boundary between desktop app and gateway creates eventual consistency window

**Consequences:**
- User believes config is saved but agent uses old credentials
- Silent API failures (key works in test, fails in agent execution)
- Configuration "stuck" in partially applied state after restart
- Users manually restart gateway to "fix" configuration (bad UX signal)
- In production (unattended), agents fail silently with wrong credentials

**Prevention:**
1. **Always verify backend state before showing UI success**: After desktop UI submits config change, explicitly query gateway to confirm change took effect before showing "saved" feedback
2. **Implement config versioning**: Track config version number; on gateway startup, verify desktop state matches loaded config version
3. **Use two-phase commit pattern**: Config write (phase 1: validation) → cache invalidation (phase 2: confirmation) → UI update
4. **Gateway hot reload**: On config file change, gateway should detect and reload without restart (OR explicitly require user-initiated restart through UI)
5. **Add "config in flight" UI state**: While waiting for gateway confirmation, disable form and show "applying..." to prevent double-submission
6. **Configuration validation layer**: Desktop UI should perform same validation as gateway backend (share validation logic or call gateway validation endpoint)
7. **Audit trail**: Log every configuration change with timestamp, source (desktop UI vs CLI vs direct file edit), and backend confirmation
8. **Test: Intentional config corruption** — simulate stale cache, network partition, mid-flight restart; verify system recovers to consistent state

**Detection:**
- Config changed in UI but old value used by agent
- Logs show different credentials in gateway vs. desktop UI
- User reports "config won't stick" or "has to restart repeatedly"
- Gateway process state (env vars) doesn't match config file after change
- WebSocket logs show old provider in tool execution despite UI showing new provider

**Which phase handles it:**
- **Phase v0.3.1 (Config Sync)**: Implement transactional config layer, validation sharing
- **Phase v0.3.2 (Hot Reload)**: Gateway config hot reload or restart confirmation flow
- **Phase v0.3.3 (Testing)**: Integration tests for config divergence scenarios

---

### Pitfall 2: Async Tool Race Conditions in Execution Order

**What goes wrong:**
When UI submits multiple tool calls simultaneously (async batch), or tool completion callbacks arrive out of order, tools execute in wrong order or execute twice. Example: delete file runs before create, read before write. Agent sees inconsistent state halfway through execution. Tool A's output feeds into tool B, but B executes first.

**Why it happens:**
- No serialization point for tool execution; multiple async handlers race to execute
- Tool completion events processed by multiple listeners (UI update + approval center + gateway state machine)
- Message queue lacks ordering guarantees per-session
- No idempotency check; retry logic re-runs tool if confirmation message lost
- Dependency tracking between tools not enforced at execution layer
- WebSocket message ordering differs per client (browser WebSocket vs. CLI vs. gateway internal)

**Consequences:**
- Tool executes multiple times despite being submitted once
- Workflow steps run out of sequence (delete before create, read before write)
- State corruption in external systems (file system, database, API)
- Agent receives garbled tool results (B runs, fails because A didn't run yet)
- Approval flow broken: tool approved once but executed twice
- Silent failures: tool internally runs twice, second run fails silently, approval shows success

**Prevention:**
1. **Idempotent tool execution**: Every tool call includes unique request ID; if same ID seen within timeout, return cached result instead of re-executing
2. **Per-session execution queue**: All tool calls for a session funnel through single serialized queue; guarantees FIFO ordering
3. **Dependency graph validation**: Before execution, verify all tool dependencies are satisfied; if not, queue tool and wait
4. **Tool execution state machine**: Explicit states: submitted → approved → queued → executing → completed → confirmed. Each transition logged and transactional.
5. **Double-submission prevention**: UI disables tool form after first submission until result confirmed; don't rely on user behavior
6. **Tool completion confirmation**: Execution layer explicitly confirms completion back to approval center before allowing next tool; don't assume fire-and-forget works
7. **Distributed tracing**: Assign unique trace ID to each tool request; propagate through all async handlers so logs show complete execution path
8. **Add "execution ordering" metadata**: Each tool call includes predecessor tool IDs; executor validates dependencies before running

**Detection:**
- Tool executed twice (same request ID in logs)
- Tools ran in wrong order (log shows B completed before A, but B depends on A)
- Agent error: "expected file not found" for file that should exist
- Approval center shows tool approved once, but tool metrics show 2 executions
- User sees "tool completed" in UI but external state unchanged (tool didn't actually run)

**Which phase handles it:**
- **Phase v0.3.2 (Async Tool Core)**: Implement execution queue, idempotency check, dependency validation
- **Phase v0.3.3 (Approval Integration)**: Connect approval flow to execution state machine
- **Phase v0.3.4 (Testing)**: Chaos tests: submit 100 simultaneous tools, kill process mid-execution, reorder WebSocket messages

---

### Pitfall 3: Permission State Not Propagated to Agent Execution

**What goes wrong:**
User approves tool in desktop UI's approval center. Gateway receives approval but agent process (separate process or thread) doesn't see it. Agent blocks tool execution waiting for approval that already happened. Or, approval cache is stale; tool blocks despite being pre-approved in approval center. Toggling "auto-approve" in UI doesn't take effect mid-execution.

**Why it happens:**
- Approval state (approved/denied) cached in gateway process; desktop config change doesn't invalidate cache
- Agent execution runs in separate thread/process with its own copy of approval rules
- No event broadcast when approval state changes; agent only reads state on startup or session begin
- WebSocket connection between desktop and gateway breaks; approval message lost in flight
- Approval stored in database, but gateway keeps in-memory cache without TTL
- No "approval changed" event system; agent polls stale cached state

**Consequences:**
- Tool waits for approval that's already granted (user frustrated: "I already approved this!")
- Pre-approved tool blocked incorrectly (agent sees old approval config)
- Approval workflow appears broken: approve in UI but agent doesn't accept
- Security issue: User denies tool, but agent still executes it (uses stale approval cache)
- Tier system doesn't work: User switches from "always ask" to "auto-approve", agent still asks

**Prevention:**
1. **Approval state with version**: Each approval tier has version number; agent checks version on tool execution, if stale, re-fetch from gateway
2. **Approval event broadcast**: When approval state changes (via UI or CLI), broadcast invalidation event to all connected agents; they clear cache and re-fetch
3. **TTL on approval cache**: In-memory approval cache expires after 30s; force re-fetch from source of truth
4. **Approval as part of tool execution request**: Instead of agent checking approval cache, gateway evaluates approval on tool execution call; agent doesn't cache
5. **Confirmation handshake**: Desktop UI doesn't show "approved" until agent has acknowledged seeing the new approval state
6. **Approval diff on each change**: Log what changed (e.g., "auto-approve: false → true") and when; verify agent sees change in logs
7. **Separate approval service**: Create dedicated approval state service (separate from gateway state machine) that agents query; easier to debug, update, test

**Detection:**
- Tool waits for approval despite approval center showing "approved"
- Logs show approval granted at time T, tool executed after T but still checking approval as if T didn't happen
- User changes tier in UI, switches to next tool, old tier still in effect
- Tool blocked with "approval required" but approval logs show it was pre-approved
- Agent restart clears block (indicates cache issue, not permission issue)

**Which phase handles it:**
- **Phase v0.3.2 (Config/Approval State)**: Implement approval versioning, event invalidation
- **Phase v0.3.3 (Integration)**: Approval service integration with agent execution
- **Phase v0.3.4 (Testing)**: Chaos tests: toggle approval while tool running, restart agent mid-execution, gateway restart

---

## Moderate Pitfalls

### Pitfall 4: First-Run Detection Edge Cases

**What goes wrong:**
On first app launch, desktop app's onboarding flow runs. User completes onboarding, but on next launch, onboarding runs again (system forgot first-run happened). Or, crash during first-run means app is in "partially initialized" state; launching again tries to run first-run but parts of it already exist. Configuration file exists but is corrupted; first-run marker exists but config invalid.

**Why it happens:**
- First-run flag stored only in-memory; not persisted across app restarts
- Onboarding completion marker written to file after partial onboarding completes
- No atomic write: first-run flag and config written separately; one succeeds, other fails
- Config file corruption detected too late (in runtime, not on startup)
- Tauri plugin-store not initialized on startup; first-run check fails, falls back to always showing onboarding
- Migration path missing: app updates with new onboarding steps; old first-run markers don't account for new steps

**Consequences:**
- Users see onboarding repeatedly on every launch (annoying, breaks perceived product quality)
- Onboarding step partially complete (e.g., API key saved but model list not fetched); retry runs again but skips done steps (confusing)
- New onboarding feature added in update; old users with "first-run done" marker never see new setup
- Corrupted config treated as "fresh" on next launch; user must redo entire setup
- Silent skip: app detects first-run skipped, silently uses broken config

**Prevention:**
1. **Atomic initialization**: Write first-run marker, config, and database schema all in one transaction; if any step fails, entire first-run rolls back
2. **Config validation on startup**: Before skipping first-run, validate config file: parse JSON/YAML, check required keys, attempt one test API call; if fails, re-run first-run
3. **Versioned first-run state**: Instead of boolean flag, store first-run version (e.g., "v1" in 0.3, "v2" after adding new onboarding steps); on upgrade, detect version mismatch and run new-step flow
4. **Persistent marker in reliable location**: Use Tauri's plugin-store (not in-memory or session storage); create marker file in config directory with timestamp + hash of config; verify on startup
5. **First-run state machine with recovery**: States: not-started → api-keys-entered → providers-verified → agents-setup → gateway-running → completed. On startup, detect state and resume, don't restart
6. **Dry-run validation**: Before persisting first-run config, run "dry run" of all checks (API key validation, model fetch, etc.); only mark first-run done after dry-run passes
7. **User-accessible "reset first-run"**: Settings menu option to manually trigger first-run again; lets users recover from stuck state without uninstalling

**Detection:**
- User reports "onboarding shows every time I open app"
- App logs show first-run check running on every launch
- Config file corrupted but app skipped validation and used broken config
- Update to v0.3.1 adds new provider setup; users with v0.3.0 first-run marker don't see it
- Crash during onboarding leaves marker file incomplete; app restarted mid-onboarding

**Which phase handles it:**
- **Phase v0.3.1 (First-Run)**: Implement atomic initialization, config validation, versioning
- **Phase v0.3.2 (Fallback)**: Manual reset option, recovery UI
- **Phase v0.3.3 (Testing)**: Intentional crashes during onboarding, config corruption, version upgrades

---

### Pitfall 5: Subprocess Log Streaming Gets Out of Sync

**What goes wrong:**
Subprocess (CLI tool, background process) outputs logs. Desktop app subscribes to logs via WebSocket. Logs arrive out of order (log line 3 appears before line 2). Logs stream briefly then stop, though process still running (hanging read). Log buffer overflows; older logs lost. Process crashes but app still shows "running". User kills process externally; app doesn't detect it.

**Why it happens:**
- Subprocess stdout buffered; logs flush in non-FIFO order if multiple threads write to same buffer
- WebSocket message ordering not guaranteed if gateway uses multiple event handlers
- Tail -f style streaming doesn't account for log rotation or file truncation
- No heartbeat between subprocess and desktop app; silent death undetected
- Circular log buffer (fixed size) overwrites old logs without app knowing
- Subprocess fork/exec doesn't copy parent threads; parent-side logging thread exits, child's stdout becomes orphaned
- Log capture uses dup2() to redirect stdout; if subprocess changes stdout later, logs go to wrong place

**Consequences:**
- User reads logs in desktop UI, sees wrong sequence; confusing and unhelpful
- Logs stop flowing mid-execution but app shows "still running" (misleading)
- Process crashes (stderr shows "connection lost") but app still shows green "running" indicator
- Important debug logs lost due to buffer overflow; user can't troubleshoot issues
- User kills subprocess manually (^C on CLI), desktop app unaware; continues showing process as running
- Timeline of events wrong; logs show out-of-order execution, makes debugging impossible

**Prevention:**
1. **Sequence numbers on log lines**: Each log line tagged with monotonic sequence number (1, 2, 3, ...); UI detects gaps and alerts or reorders
2. **Line-buffered subprocess output**: Force subprocess to line-buffer (Python `-u`, Node `--no-warnings`, stdbuf in shell); log each line completely before next write
3. **Heartbeat from subprocess**: Subprocess sends "alive" message every 5s; if desktop app doesn't receive within 10s, mark as "stalled" then "dead" after 30s
4. **Process exit event**: Subprocess explicitly sends "exiting with code X" before exit; desktop app waits for this message, doesn't rely on detecting closed pipe
5. **Log file with rotation awareness**: Subprocess logs to file (not just stdout); desktop app tails file, detects rotation (file size reset to 0) and opens new file
6. **Bounded circular buffer with metadata**: If log buffer is fixed size, include metadata: "buffer wrapped X times", "oldest log timestamp", "newest log timestamp"; UI shows user logs were discarded
7. **Multiple log streams (separate): Separate stdout (normal logs) from stderr (errors/warnings); don't mix; UI shows both streams with different styling
8. **WebSocket orderly delivery**: Use message sequence numbers on all WebSocket messages; client detects gaps and requests retransmit

**Detection:**
- Log timestamps show logs arrived out of chronological order
- Process shows "running" but no new logs in 30+ seconds
- User manually kills process; app still shows "running"
- Important warning log missing from log viewer but visible in raw process output
- "Process exited" event never arrives; log viewer hangs on empty read

**Which phase handles it:**
- **Phase v0.3.2 (Subprocess Monitoring Core)**: Implement heartbeat, sequence numbers, exit events
- **Phase v0.3.3 (Log Streaming)**: Log file tailing, circular buffer metadata, error stream handling
- **Phase v0.3.4 (Testing)**: Kill -9 subprocess, rotate logs mid-stream, high-frequency logging load test

---

### Pitfall 6: Context Lost or Corrupted During Model Switching

**What goes wrong:**
User is in conversation with Claude 3.5, switches to Ollama local model mid-conversation. Agent should carry over conversation history. Instead: conversation history lost, agent starts fresh, or worse, history gets corrupted (truncated, mixed with different agent's history). Switching back to Claude loses any work done with Ollama.

**Why it happens:**
- Context history stored in format specific to first model (e.g., Claude's message format); Ollama doesn't understand it
- Context database query doesn't include session/agent filter; fetches wrong agent's history
- Model switch doesn't flush pending tool executions; tool results from first model applied to second model
- Context tokenization differs per model; truncation logic assumes one model, breaks with another
- No "checkpoint" before switch; if switch fails mid-way, no rollback point
- Database read cached in memory; model switch doesn't invalidate cache

**Consequences:**
- Agent forgets previous conversation context after model switch (looks like app bug)
- Conversation history from Agent A mixed with Agent B's history (data corruption)
- Incomplete tool results applied to wrong model (agent confused)
- User forced to restart conversation after model switch (bad UX)
- Model switches don't persist; on app restart, reverts to original model (breaking workflow)
- Context tokens consumed by corrupted history; model sees garbage and fails

**Prevention:**
1. **Context checkpoint before switch**: Before changing models, write current context to timestamped snapshot; if switch fails, rollback to snapshot
2. **Standardized context format**: All models use same context representation internally (e.g., canonical message format); convert on model entry/exit
3. **Per-model context filters**: When fetching context, always include agent ID + session ID + model ID; verify database query actually filtered
4. **Flush pending tool executions**: Before model switch, ensure all outstanding tool results from previous model are processed; don't carry pending state to new model
5. **Model-specific context truncation**: Each model has its own truncation strategy (Claude: trim from middle; Ollama: trim from beginning); apply correct strategy per model
6. **Context carry-over option**: UI checkbox: "Carry over context?" Before switch, show user: "This will include X tokens of history. Proceed?" Let user decline and start fresh
7. **Model compatibility check**: Verify models support same feature set (tools, vision, etc.); warn user if incompatible
8. **Test context round-trip**: When switching models, export context, re-import to new model, verify parse succeeds and no data lost

**Detection:**
- After model switch, agent doesn't remember previous messages
- Context history contains messages from multiple different agents mixed together
- Conversation shows gaps ("last message from user, then immediately from assistant" — tool results missing)
- Model switch completes but old model still shown in UI (change didn't persist)
- On app restart after model switch, reverted to original model (switch not persisted)

**Which phase handles it:**
- **Phase v0.3.3 (Model Switching)**: Implement checkpoint system, standardized context format, carry-over UI
- **Phase v0.3.4 (Context Management)**: Model-specific context filters, truncation strategies
- **Phase v0.3.5 (Testing)**: Switch models during execution, restart app mid-switch, incompatible model tests

---

### Pitfall 7: Gateway Restart Breaks Active Sessions Without Graceful Shutdown

**What goes wrong:**
User has active conversation running. Admin initiates gateway restart from desktop UI. Active WebSocket connections drop immediately. Pending tool approvals disappear without user notification. User's browser shows connection error. No recovery mechanism; user must manually reconnect and lose conversation context.

**Why it happens:**
- Gateway restart kills all WebSocket connections without warning
- Pending approvals stored in memory; lost on restart
- No session recovery mechanism; restarted gateway has no record of interrupted sessions
- Desktop UI doesn't preserve session state across gateway restarts
- Tool execution can get stuck in partial state; on restart, tool might execute twice
- No "graceful shutdown" period; clients don't get warning to save state

**Consequences:**
- Active agent execution interrupted; partial tool runs lost
- User's approval queue cleared; approved tools still waiting re-appear as new
- Conversation context lost; no way to resume where left off
- Pending notifications lost (approval requests, tool completions)
- External systems (via tools) left in inconsistent state (partial writes)
- User experience: "app crashed" perception, loss of trust

**Prevention:**
1. **Graceful shutdown sequence**: Gateway doesn't kill connections immediately; sends "shutdown in 30s" notification to all clients; clients save state
2. **Session persistence**: Before shutdown, gateway writes active sessions to persistent store (SQLite); on restart, loads sessions and notifies clients they're "reconnected"
3. **Approval persistence**: Pending approvals written to database immediately when received; survives restart
4. **Tool execution checkpointing**: Before tool execution, checkpoint request (inputs + metadata) to database; on restart, check for orphaned checkpoints and resolve them
5. **Restart notification in UI**: Don't silently restart gateway; show countdown in desktop app UI and send notification to CLI clients
6. **Automatic client reconnect**: Clients detect disconnect, automatically reconnect to gateway; gateway recognizes session ID and restores context
7. **Stale connection detection**: Gateway tracks last heartbeat per client; if heartbeat stopped but connection thinks it's alive, gateway force-closes it to prevent zombie sessions

**Detection:**
- Active tool execution stops abruptly (logs show incomplete execution)
- Approval notifications gone without completion (UI shows cleared queue)
- User reports "gateway kept crashing and losing my work"
- Approval audit trail shows approval "created and immediately deleted" (system restart)
- Database query on startup finds orphaned tool checkpoints (partial executions)

**Which phase handles it:**
- **Phase v0.3.3 (Gateway Management)**: Implement graceful shutdown, restart notification
- **Phase v0.3.4 (Resilience)**: Session persistence, approval persistence, tool checkpointing
- **Phase v0.3.5 (Testing)**: Force kill -9 gateway, active tool execution, graceful shutdown under load

---

## Minor Pitfalls

### Pitfall 8: Desktop App Tray/Background Process State Confusion

**What goes wrong:**
Desktop app minimized to tray. Gateway process stops (error, user killed it). User doesn't notice because app is in tray. Tries to use agent via CLI; gets "gateway not running" error. User doesn't connect the dots (gateway stopped because app crashed). Or, user thinks "app open in tray" means "gateway running" but it's actually stopped.

**Why it happens:**
- No clear indicator of gateway status in tray icon (icon doesn't change)
- No notification when gateway crashes/stops
- Tray application doesn't validate gateway health on launch; assumes it's running
- No separate "gateway health check" menu in tray; users don't know how to check status

**Consequences:**
- User blames "app broken" when actually gateway crashed
- Silent failure: agent commands hang with no feedback
- User frustrated trying to debug non-obvious failures
- CLI users can't tell if issue is their tool or gateway
- Gap in observability: no central dashboard showing "gateway running: yes/no"

**Prevention:**
1. **Tray icon status**: Change tray icon color or overlay (green dot = running, red dot = stopped)
2. **Periodic gateway health check**: Tray app pings gateway every 10s; if no response, alert user
3. **Tray context menu**: "Gateway Status" option showing real-time status + last error
4. **Desktop notification on gateway failure**: If gateway stops unexpectedly, send OS notification: "Gateway stopped. Restart?"
5. **"Restart Gateway" quick action**: Tray right-click menu has "Restart Gateway" option
6. **Status page in desktop app**: "System Status" section showing gateway health, last startup time, error count
7. **CLI integration**: When CLI detects gateway down, suggest "Open Tek.app to restart"

**Detection:**
- Tray icon never shows "offline" state; always shows "running"
- User reports "app frozen" but tray shows icon present
- Gateway stopped but desktop app still has green checkmark
- CLI user gets "connection refused" but doesn't know gateway stopped

**Which phase handles it:**
- **Phase v0.3.3 (Gateway Overview UI)**: Add gateway status indicator
- **Phase v0.3.4 (Health Monitoring)**: Periodic health checks, notifications
- **Phase v0.3.5 (Polish)**: Tray UI enhancements, status dashboard

---

### Pitfall 9: Configuration Serialization Format Incompatibility After Upgrade

**What goes wrong:**
v0.3 config format is JSON. v0.4 adds new fields and uses YAML. User upgrades from v0.3 to v0.4. Desktop app can't read old JSON config. Or, app auto-converts but loses some data. Tool configurations from v0.3 not compatible with v0.4 agent model (changed field names).

**Why it happens:**
- No migration path documented; upgrade script doesn't handle format change
- Old config format not backward-compatible with new code
- Auto-conversion doesn't preserve custom fields; only maps known fields
- No validation that converted config is functionally equivalent
- Test coverage doesn't include upgrade scenarios

**Consequences:**
- Users must manually redo configuration after app upgrade
- Some config lost or corrupted during upgrade (custom fields, advanced options)
- App crashes on startup trying to parse old config in new app
- Data loss: users blame app, lose trust in updates
- Support burden: users complaining about "update broke my setup"

**Prevention:**
1. **Config versioning**: Each config file starts with "version: 2" (or YAML version: v0.4); code checks version
2. **Migration functions**: For each version jump (v0.3 → v0.4), write explicit migration function: `migrate_v3_to_v4(old_config)`
3. **Backward compatibility layer**: Keep old config parser working; parse old format, immediately re-save in new format with user confirmation
4. **Pre-upgrade backup**: Before upgrade, copy entire config directory to timestamped backup (e.g., `~/.config/tek/backup-2026-02-22/`)
5. **Upgrade dry-run**: Before applying upgrade, run migration in dry-run mode; report what will change; let user confirm
6. **Test migration roundtrip**: For each new version, test: old config → migrate → new config → parse → verify all fields present
7. **Changelog with migration notes**: Release notes document "if you have custom X, it's now called Y"

**Detection:**
- User upgrades app, sees "config parse error" on launch
- Logs show "unknown config field: old_field_name"
- User's custom tool config disappeared after upgrade
- Upgrade works but user loses advanced settings (timeouts, retry counts)

**Which phase handles it:**
- **Phase v0.3.1 (Config Versioning)**: Add version field, migration function template
- **Phase v0.4 planning**: Document format changes and write migration scripts
- **Phase v0.4.1 (Testing)**: Upgrade test: v0.3 config → v0.4 → verify all fields present

---

### Pitfall 10: Provider Rate-Limit Cascade Not Detected Early

**What goes wrong:**
API provider starts rate-limiting (429 responses). Desktop UI doesn't show rate limit warning. Agent tries tools anyway, all fail silently. User sees blank "error" messages. Only on clicking logs does user discover "rate limit exceeded". By then, many tokens wasted on failed requests.

**Why it happens:**
- Rate limit errors aggregated into generic "tool failed" message UI
- Rate limit info not extracted from API response (429 headers have Retry-After)
- No circuit breaker; agent retries immediately instead of backing off
- Rate limit state not shared with UI; UI doesn't warn user to stop using provider
- Configuration UI doesn't show provider health/rate-limit status

**Consequences:**
- Silent tool failures; user doesn't know why tools aren't working
- Rapid token spend on retry loops
- User experience: "app broken" when actually provider rate-limited
- No way to switch to fallback provider until user manually edits config
- Rate limit info lost after error; not logged with timestamp for audit

**Prevention:**
1. **Rate limit detector**: Parse 429 responses, extract Retry-After header, broadcast to UI
2. **Circuit breaker pattern**: After 3 consecutive 429s from provider, immediately fail with "rate limit, try again in X seconds"
3. **Provider health indicator**: Configuration UI shows each provider's status: healthy, rate-limited (with timestamp), down
4. **Rate limit alert**: Show banner in desktop app UI when provider is rate-limited; recommend switching provider
5. **Automatic fallback**: Option to auto-switch to fallback provider if primary is rate-limited
6. **Rate limit metrics**: Track and display: request count, 429 count, time in rate limit
7. **Per-provider retry strategy**: Different retry backoff for different providers (OpenAI vs Anthropic vs Ollama)

**Detection:**
- Multiple tool failures with generic error; only logs show "429"
- User discovers rate limit via logs, not UI notification
- Rate limiting happened but no alert in configuration UI
- User forced to manually edit provider config because UI didn't warn

**Which phase handles it:**
- **Phase v0.3.3 (Tool Execution)**: Rate limit detection, circuit breaker
- **Phase v0.3.4 (UI Alerts)**: Provider health status, rate limit banner
- **Phase v0.4 (Provider Management)**: Automatic fallback, retry strategy per provider

---

## Phase-Specific Risk Matrix

| Phase Topic | Likely Pitfalls | Mitigation |
|-------------|--------------|-----------|
| **v0.3.1: Desktop Config UI** | State divergence, first-run detection, config serialization | Transactional sync, atomic initialization, versioning |
| **v0.3.2: Async Tool Core** | Race conditions, execution order, idempotency | Execution queue, request IDs, dependency graph |
| **v0.3.3: Approval + Subprocess** | Permission propagation, log streaming, graceful restart | Event invalidation, heartbeat, session persistence |
| **v0.3.4: Model Switching + Context** | Context loss, database query filters | Checkpoint system, per-model formatting |
| **v0.3.5: Testing + Polish** | Edge cases, provider rate limits, status indicators | Chaos testing, circuit breaker, health UI |

---

## Verification Checklist for Each Phase

### Before Phase v0.3.1 Ships
- [ ] Config changes sync from desktop to gateway without restart
- [ ] Restart test: change config, restart app, config persists correctly
- [ ] First-run detection doesn't run on subsequent launches
- [ ] Backup config exists before first onboarding

### Before Phase v0.3.2 Ships
- [ ] Idempotent tool execution: submit tool twice, verify it runs once
- [ ] Tool execution order: 3 dependent tools, verify FIFO order
- [ ] Approval flow: approve tool, verify it executes without re-asking

### Before Phase v0.3.3 Ships
- [ ] Subprocess heartbeat: subprocess logs stream without gaps
- [ ] Gateway graceful shutdown: pending approvals persist across restart
- [ ] Tool checkpoint: kill -9 gateway mid-tool, verify orphaned checkpoint detected

### Before Phase v0.3.4 Ships
- [ ] Model switch: switch models mid-conversation, context carries over
- [ ] Database filters: verify history doesn't leak between agents
- [ ] Checkpoint restoration: switch model, switch back, verify all context intact

### Before Phase v0.3.5 (Release Candidate)
- [ ] Upgrade test: v0.3.0 config → v0.3.5, no data loss
- [ ] Rate limit detection: 429 response triggers UI alert + circuit breaker
- [ ] Tray status: gateway stops, tray icon changes to red
- [ ] Chaos test: simultaneous model switch + approval + tool completion

---

## Sources

- [Microsoft Agent Framework State Management](https://learn.microsoft.com/en-us/agent-framework/workflows/state)
- [Agentic Frameworks in 2026: What Actually Works in Production](https://zircon.tech/blog/agentic-frameworks-in-2026-what-actually-works-in-production/)
- [SagaLLM: Context Management, Validation, and Transaction](https://www.vldb.org/pvldb/vol18/p4874-chang.pdf)
- [LLM Agents and Race Conditions: Debugging Multi-Tool AI with LangGraph](https://medium.com/@bhagyarana80/llm-agents-and-race-conditions-debugging-multi-tool-ai-with-langgraph-b0dcbf14fa67)
- [Building Reliable Tool Calling in AI Agents with Message Queues](https://www.inferable.ai/blog/posts/distributed-tool-calling-message-queues)
- [AsyncTool: Evaluating the Asynchronous Function Calling Capability under Multi-Task Scenarios](https://openreview.net/forum?id=FfedFHs6Tx)
- [OpenClaw Gateway Issues: Compaction hangs, session stuck, connection loss](https://github.com/openclaw/openclaw/issues)
- [State Management in Tauri Applications](https://v2.tauri.app/develop/state-management/)
- [Unifying State Across Frontend and Backend in Tauri](https://medium.com/@ssamuel.sushant/unifying-state-across-frontend-and-backend-in-tauri-a-detailed-walkthrough-3b73076e912c)
- [Persistent Settings in Desktop Applications](https://info.erdosmiller.com/blog/persistent-settings-in-desktop-applications/)
- [OpenClaw API Key Errors and Configuration Troubleshooting Guide (2026)](https://www.aifreeapi.com/en/posts/openclaw-api-key-error-troubleshooting-guide)
- [Hot Reload in API Gateways: KrakenD Documentation](https://www.krakend.io/docs/developer/hot-reload/)
- [Policy-Aware Agent Loop with Cedar and OpenClaw](https://www.windley.com/archives/2026/02/a_policy-aware_agent_loop_with_cedar_and_openclaw.shtml)
- [Tool Approval Propagation and Agent-Oriented MCP Server Design](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/1203)
- [State of AI Agent Security 2026 Report](https://www.gravitee.io/blog/state-of-ai-agent-security-2026-report-when-adoption-outpaces-control/)
- [Human-in-the-Loop for AI Agents: Best Practices](https://www.permit.io/blog/human-in-the-loop-for-ai-agents-best-practices-frameworks-use-cases-and-demo/)
- [Overcoming Distributed Systems Challenges for AI and Blockchain in 2026](https://www.webpronews.com/overcoming-distributed-systems-challenges-for-ai-and-blockchain-in-2026/)
- [CAP Theorem and Distributed Consensus](https://sre.google/sre-book/managing-critical-state/)
- [Approval Process: Ultimate Guide to Automated Approval Processes 2026](https://kissflow.com/workflow/approval-process/)
- [Consensus Algorithms and System Design](https://algomaster.io/learn/system-design/consensus-algorithms)
- [Context Window Overflow in 2026](https://redis.io/blog/context-window-overflow/)
- [Top Techniques to Manage Context Lengths in LLMs](https://agenta.ai/blog/top-6-techniques-to-manage-context-length-in-llms/)
- [Prompt Compression Techniques for Reducing Context Window Costs](https://medium.com/@kuldeep.paul08/prompt-compression-techniques-reducing-context-window-costs-while-improving-llm-performance-afec1e8f1003/)
- [Context Management Overview](https://www.emergentmind.com/topics/llm-context-management/)
- [Architecting LLM-Based Multi-Agent Systems](https://www.techrxiv.org/doi/pdf/10.36227/techrxiv.176827304.41872996/v1/)
- [AdaptOrch: Task-Adaptive Multi-Agent Orchestration in the Era of LLM Performance Convergence](https://arxiv.org/html/2602.16873)
- [When Refusals Fail: Unstable Safety Mechanisms in Long-Context LLM Agents](https://arxiv.org/pdf/2512.02445)
- [Python Subprocess Race Conditions](https://bugs.python.org/issue24909)
- [How to Trace Python subprocess Calls with OpenTelemetry](https://oneuptime.com/blog/post/2026-02-06-trace-python-subprocess-calls-opentelemetry/view)
- [Authorization Model and Architecture Planning](https://www.permit.io/blog/planning-authorization-model-and-architecture-full-2025-guide/)
- [Configuration Drift Management: Detection & Prevention](https://www.puppet.com/blog/configuration-drift)
- [API Error Handling and Retry Logic Guide 2026](https://easyparser.com/blog/api-error-handling-retry-strategies-python-guide)

---

*Last updated: 2026-02-22 during v0.3 research phase*
