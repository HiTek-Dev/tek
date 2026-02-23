# Architecture: v0.3 Desktop UX & Configuration Integration

**Project:** Tek — Self-hosted AI agent platform
**Milestone:** v0.3 Desktop UX & Configuration
**Researched:** 2026-02-22
**Confidence:** HIGH

---

## Executive Summary

v0.3 integrates configuration management into the desktop app (Tauri React) by extending the existing WebSocket/HTTP gateway architecture with new UI views and provider configuration flows. The system maintains separation of concerns: the gateway remains the configuration authority, while the desktop app provides the UI layer. Key integration points are WebSocket protocol extensions, Zustand state management, and Tauri file system access for configuration persistence.

**Key design principle:** Configuration persists in `~/.config/tek/config.json` (backend authority), desktop app reads/syncs via gateway WebSocket messages and Tauri FS plugin. This prevents UI-only state divergence while keeping the desktop app read-only from the file system perspective.

---

## Current Architecture (Context)

### Existing Components

**Backend (packages/gateway, packages/core, packages/db):**
- Fastify HTTP + WebSocket server listening on `127.0.0.1:3271`
- Session manager (`sessionManager`) handles agent sessions with transparent keys `agent:{agentId}:{sessionId}`
- Configuration authority: `~/.config/tek/config.json` (AppConfig schema)
- Vault (Keychain) stores API keys per provider, not in config files
- Skills/tools registry built at startup from MCP configs + built-in tools
- Gateway writes `runtime.json` (PID, port) on startup for discovery

**Desktop App (apps/desktop):**
- Tauri React (v2) bundled with `@tauri-apps/plugin-*` for OS integration
- Zustand store (`useAppStore`) tracks: current view, gateway status, selectedAgentId, sessionId
- WebSocket via `@tauri-apps/plugin-websocket` (not browser WebSocket)
- `useGateway()` polls `~/.config/tek/runtime.json` every 5 seconds for gateway discovery
- `useChat()` manages chat state: messages, streaming, tool approvals, sessions
- `useConfig()` loads config from `~/.config/tek/config.json` via Tauri FS plugin (read-only on mount)

**Protocol (WebSocket messages):**
- Client → Gateway: `chat.send`, `session.list`, `tool.approval.response`, `context.inspect`, etc.
- Gateway → Client: `chat.stream.*`, `session.created`, `session.list`, `tool.approval.request`, `error`, `todo.update`

### Data Persistence

| Data | Location | Authority | Read/Write |
|------|----------|-----------|-----------|
| Config (agents, providers, aliases) | `~/.config/tek/config.json` | Backend (core) | Backend writes, desktop reads |
| API keys | macOS Keychain | Core vault | Backend manages, desktop never reads |
| Runtime state (PID, port) | `~/.config/tek/runtime.json` | Gateway on startup | Gateway writes, desktop reads for discovery |
| Sessions, messages, memory | SQLite DB | Gateway | Backend only |

---

## v0.3 New Features & Integration

### Feature 1: First-Run Detection & Onboarding

**What changes:**
- Desktop app detects if onboarding is needed by checking config `onboardingComplete` flag
- If incomplete, show Onboarding page instead of Chat page
- Onboarding flow: Security mode → Workspace setup → Provider keys → Default model → Agents setup

**Integration points:**
1. **View switching in App.tsx:** Extend `currentView` type to include `"onboarding"` state
2. **Config bootstrap:** Onboarding creates initial config with `onboardingComplete: true`
   - Via new WebSocket message type: `config.onboarding.complete` (or written by backend during pairing flow)
3. **Desktop → Backend:** Desktop submits onboarding via HTTP POST to `/config` endpoint (new)
   - Contains: securityMode, workspaceDir, defaultModel, agentDefinitions
   - Backend validates, persists to disk, returns updated config

**New components:**
- `OnboardingFlow` (view wrapper, orchestrates sub-steps)
- `SecurityModeSelector`, `WorkspaceSetup`, `ProviderKeySetup`, `DefaultModelSelector`, `AgentSetup` (step components)

**No new database tables.** Reuse existing schema and config structure.

---

### Feature 2: Providers Page (API Keys, Model Aliases, Fallbacks)

**Current state:**
- API keys stored in macOS Keychain (core/vault)
- Model aliases + Ollama endpoints in config.json
- Desktop app has no way to manage these

**What v0.3 adds:**
1. **Providers UI page:**
   - List of known providers (Anthropic, OpenAI, Ollama, Venice, Google, Brave)
   - For each: configured status (checkbox), add/update/delete key buttons
   - Model aliases editor (add/remove aliases mapped to provider:model)
   - Ollama endpoint management (add custom Ollama instances)

2. **Backend API endpoints (new):**
   - `POST /api/vault/keys/{provider}` — Set API key (req body: `{ key }`)
   - `DELETE /api/vault/keys/{provider}` — Remove API key
   - `GET /api/vault/keys/status` — List providers + configured status (no keys returned)
   - `POST /api/config/model-aliases` — Add/update model alias
   - `DELETE /api/config/model-aliases/{alias}` — Remove alias
   - `POST /api/config/ollama-endpoints` — Add Ollama endpoint
   - `DELETE /api/config/ollama-endpoints/{name}` — Remove Ollama endpoint

3. **WebSocket alternative (lower priority):**
   - Could extend protocol with `config.provider.add`, `config.alias.set` messages instead of HTTP
   - Recommend HTTP for these (idempotent, simpler error handling)

4. **Security consideration:**
   - Desktop → Backend uses bearer token auth (same as CLI)
   - Keys never leave keychain, desktop app only submits key string, backend stores it
   - Backend validates key format per provider (optional for now)

**New components:**
- `ProvidersPage` (main page)
- `ProviderCard` (provider status + key management)
- `ModelAliasEditor` (table for add/edit/delete aliases)
- `OllamaEndpointManager` (add/list custom endpoints)

**No new database tables.** Vault and config already support this.

---

### Feature 3: Shared Services Setup (Telegram, Brave, Extensible)

**Current state:**
- Telegram bot token stored in keychain (core/vault)
- Brave API key stored in keychain
- No desktop UI to configure these

**What v0.3 adds:**
1. **Shared Services page:**
   - Telegram: whitelist/deny list (saved to database or config)
   - Brave: API key management (same as providers page)
   - Extensible: future services (Discord, Slack, etc.) added here

2. **Backend support (already mostly exists):**
   - Telegram whitelist stored in database (if not already)
   - Need to verify: is whitelist in DB or hardcoded?
   - If missing, add `telegram_whitelists` table (userId, chatId, allowedAt)

3. **Backend API endpoints (new/extended):**
   - `GET /api/services/telegram/config` — Get whitelist, deny list, pairing status
   - `POST /api/services/telegram/whitelist` — Add user to whitelist
   - `DELETE /api/services/telegram/whitelist/{userId}` — Remove user
   - `GET /api/services/brave/status` — Check if Brave key is configured
   - Similar pattern for other shared services

**New components:**
- `SharedServicesPage` (main page)
- `TelegramServiceCard`, `BraveServiceCard` (service-specific UX)

**Database consideration:**
- If telegram whitelist isn't in schema yet, add simple table: `telegramWhitelists (id, userId, chatId, createdAt)`

---

### Feature 4: Agents Configuration UI (Soul/Files, Model Training)

**Current state:**
- Agent definition in config.json (id, name, model, description, etc.)
- Agent files (SOUL.md, MEMORY.md, skills) stored on filesystem
- No desktop UI to edit agent properties or files

**What v0.3 adds:**
1. **Agents page:**
   - List of agents with edit/delete buttons
   - Agent detail modal: name, description, model, workspace directory
   - SOUL.md editor (markdown textarea for personality)
   - Attach custom skills/files

2. **Backend endpoints (new):**
   - `POST /api/agents` — Create new agent (returns agentId)
   - `PUT /api/agents/{agentId}` — Update agent metadata (name, description, model)
   - `DELETE /api/agents/{agentId}` — Delete agent
   - `GET /api/agents/{agentId}/soul` — Get SOUL.md content
   - `PUT /api/agents/{agentId}/soul` — Update SOUL.md
   - `GET /api/agents/{agentId}/files` — List agent files
   - `POST /api/agents/{agentId}/files` — Upload/create file (req body: `{ filename, content }`)
   - `DELETE /api/agents/{agentId}/files/{filename}` — Delete file

3. **File handling:**
   - Backend stores agent files in `~/.config/tek/agents/{agentId}/` directory
   - Desktop app submits file content via HTTP (not binary upload, text only for v0.3)
   - For binary files later, use multipart form-data

**New components:**
- `AgentsPage` (list view with add/edit/delete)
- `AgentDetailModal` (edit form for metadata)
- `SoulEditor` (markdown textarea)
- `FilesTab` (list of attached files, add/remove)

**New database table (optional):**
- Agent metadata could be in SQLite for querying, but config.json is simpler for now
- Recommendation: keep in config.json for v0.3, migrate to DB later if needed

---

### Feature 5: Async Tool Call Handling with Background Processing

**Current state:**
- Tool calls happen inline during chat streaming
- Tool approval is synchronous: gateway waits for approval response
- Desktop shows tool approval modal, user approves/denies

**What v0.3 adds:**
1. **Background tool processing:**
   - Long-running tools (web search, image generation, file operations) don't block chat
   - Desktop app can queue tool calls, gateway processes them in background thread pool
   - Desktop polls for tool completion status

2. **New WebSocket messages:**
   - `tool.call.queued` — Gateway acknowledges tool call, will process in background
   - `tool.call.started` — Gateway begins execution
   - `tool.call.completed` — Tool finished, result available
   - `tool.call.failed` — Tool errored
   - `tool.result.query` — Client asks for result of a specific tool call

3. **Gateway changes:**
   - Maintain in-memory queue of pending tool calls per session
   - Worker thread pool (Node.js `worker_threads` or clustering)
   - Desktop polls `tool.result.query` to fetch completed results
   - Alternative: push model — gateway sends completion messages unsolicited

4. **Desktop state:**
   - Track tool call status in `useChat()`: pending, running, completed, error
   - Show tool card with spinner during execution
   - Don't block chat submission

**New components:**
- `ToolProgressIndicator` (inline spinner during tool execution)
- New state in `useChat()`: `toolCallStatus` map

**Gateway architectural change:**
- Async tool pipeline (separate from synchronous chat flow)
- Event emitter pattern: `toolCompleted`, `toolFailed` events
- Connection can subscribe to tool events by session/tool-call ID

---

### Feature 6: Sub-Process Event Stream to UI

**Current state:**
- Gateway spawns subprocess for Telegram bot on startup
- Desktop has no visibility into subprocess health, logs, or events

**What v0.3 adds:**
1. **Sub-process monitoring panel (right sidebar or modal):**
   - List of running subprocesses (Telegram bot, custom MCPs, etc.)
   - Live logs from each subprocess (last 100 lines, streaming)
   - Status indicator (running, stopped, error, restarting)
   - Manual start/stop buttons for each subprocess

2. **Backend event stream (new WebSocket message type):**
   - `subprocess.started` — A subprocess began
   - `subprocess.log` — New log line from subprocess (contains: processName, level, message)
   - `subprocess.error` — Subprocess crashed
   - `subprocess.stopped` — Subprocess stopped (manual or by request)
   - `subprocess.health` — Periodic health check result (e.g., "Telegram bot responding")

3. **Gateway implementation:**
   - Attach stdout/stderr listeners to spawned processes
   - Buffer recent logs (100 lines per process)
   - Send `subprocess.log` messages to connected desktop clients
   - Track process health via periodic pings (e.g., check Telegram bot via API)

4. **Desktop state:**
   - Extend Zustand store to track subprocess status
   - New hook: `useSubprocessMonitoring()` to subscribe to subprocess events
   - Display component: `SubProcessPanel` with scrollable logs

**New components:**
- `SubProcessPanel` (right sidebar or modal, shows all subprocesses)
- `SubProcessCard` (individual process status + logs)
- `ProcessLogViewer` (scrollable log lines with timestamp)

**New database table (optional):**
- `subprocess_logs (id, processName, level, message, createdAt)` — optional persistence for logs
- Recommendation: in-memory only for v0.3, persist later if audit trail needed

---

### Feature 7: Model Switching with Context Carry-Over

**Current state:**
- Desktop app shows current model in chat
- Switching model requires new chat (via session list)

**What v0.3 adds:**
1. **Mid-conversation model switching:**
   - Model selector dropdown in chat header
   - User selects new model → gateway updates session model → subsequent messages use new model
   - Optional: "Carry over context" checkbox to re-inject full message history before next query
   - Option to create a summary of conversation so far and prepend to next message

2. **Backend changes:**
   - `chat.route.confirm` message extended with `model` field (already supported)
   - Session manager updates model mid-stream (already supports via `updateSessionModel`)
   - Pre-flight prompt before switching: "Starting new message with [MODEL]. Re-send message? [Yes/Cancel]"

3. **Gateway considerations:**
   - If model is switched, next message uses new model
   - Session.model field is updated (visible in session list)
   - Token usage tracked per model switch
   - Usage report aggregates across models

**New components:**
- `ModelSwitcher` (dropdown in chat header with confirmation)

**No new database tables.** Session schema already has model field.

---

### Feature 8: Local Database Context Dumps Before Compression

**Current state:**
- Memory compression happens automatically per agent
- No visibility into what's being compressed or when

**What v0.3 adds:**
1. **Context dump feature:**
   - Desktop shows button: "Export context dump"
   - Triggers backend to dump current session context to local file
   - File contains: session ID, messages, memory, embeddings, parsed for readability
   - Saved to `~/.config/tek/exports/context-{sessionId}-{timestamp}.json`
   - Desktop app provides "open in folder" link

2. **Compression preview (optional):**
   - Before compressing memory, show what will be removed
   - Allow manual archival of important memories before auto-compression

3. **Backend endpoints (new):**
   - `POST /api/context/export` — Trigger context dump for current session
   - Returns file path and contents
   - `GET /api/context/archives` — List recent exports

**New components:**
- `ContextExportButton` (button in chat UI)
- `ExportHistoryModal` (list recent exports, download links)

**No new schema changes.** Reuse existing memory tables.

---

### Feature 9: Gateway Overview with Live Logs and Manual Restart

**Current state:**
- Desktop polls gateway status via `useGateway()` (5-second interval)
- No visibility into gateway logs or control over restart

**What v0.3 adds:**
1. **Gateway page (Settings-like view):**
   - Overview: PID, port, uptime, version
   - Live log viewer (last 500 lines from gateway, streaming)
   - Button to manually restart gateway
   - Health check: latency, response time, resource usage

2. **Backend changes:**
   - Gateway logs to file AND memory buffer (last 500 lines)
   - New endpoint: `GET /api/gateway/logs` — Returns buffered logs
   - New endpoint: `POST /api/gateway/restart` — Graceful restart (kill process, desktop relaunches it)
   - New endpoint: `GET /api/gateway/health` — Returns uptime, version, resource usage

3. **Desktop control:**
   - Gateway is a long-running process (child of desktop app or managed separately)
   - Desktop can detect gateway crash and auto-restart
   - Manual restart button forces stop + start

**Implementation consideration:**
- Is gateway managed by desktop app (spawned child process) or independently?
- Current setup: Tauri might spawn gateway, or it's started independently by user
- For v0.3: assume desktop can detect and restart (if privileges allow)

**New components:**
- `GatewayPage` (overview, logs, restart button)
- `GatewayLogViewer` (scrollable logs with filters)
- `GatewayHealthCard` (status, uptime, resources)

---

## Integration Data Flows

### Data Flow 1: First-Run Onboarding → Config Persistence

```
1. Desktop detects onboarding needed (config.onboardingComplete === false)
2. User fills onboarding form (security mode, workspace, provider keys, model, agents)
3. Desktop POSTs to backend: POST /api/onboarding/complete
   └─ Body: { securityMode, workspaceDir, defaultModel, agents[], providerKeys? }
4. Backend:
   ├─ Validates input against AppConfigSchema
   ├─ Stores API keys to keychain (via vault)
   ├─ Saves config to ~/.config/tek/config.json with onboardingComplete: true
   ├─ Initializes agent directories (~/.config/tek/agents/{agentId}/)
   └─ Returns updated config
5. Desktop receives config, updates useConfig() state
6. Desktop switches from Onboarding view to Chat view
```

**Persistence:** config.json (backend authority) ← HTTP ← Desktop

---

### Data Flow 2: Provider Configuration (Add API Key)

```
1. Desktop user opens Providers page, clicks "Add key for OpenAI"
2. User enters API key in text field
3. Desktop POSTs to backend: POST /api/vault/keys/openai
   └─ Body: { key: "sk-..." }
   └─ Headers: Authorization: Bearer {token}
4. Backend:
   ├─ Validates authorization token
   ├─ Stores key to macOS Keychain (encrypted)
   ├─ Returns { success: true, configured: true }
5. Desktop receives success, updates Providers page UI (OpenAI now marked "Configured")
6. Optional: Desktop polls GET /api/vault/keys/status to refresh provider list
```

**Persistence:** macOS Keychain ← HTTP ← Desktop (read) + Backend (write)

---

### Data Flow 3: Model Alias Configuration

```
1. Desktop user opens Providers page, Model Aliases section
2. User clicks "Add alias", enters: alias="gpt4", modelId="openai:gpt-4"
3. Desktop POSTs to backend: POST /api/config/model-aliases
   └─ Body: { alias: "gpt4", modelId: "openai:gpt-4" }
4. Backend:
   ├─ Loads config.json
   ├─ Appends to modelAliases array
   ├─ Saves config.json
   └─ Returns updated config
5. Desktop receives updated config, updates state
6. Desktop now shows "gpt4 → openai:gpt-4" in aliases list
7. When user sends message with model="gpt4", gateway resolves via resolveAlias()
```

**Persistence:** config.json ← HTTP ← Desktop (read) + Backend (write)

---

### Data Flow 4: Tool Call with Background Processing

```
1. User sends message that triggers a tool call (e.g., web search)
2. Gateway detects tool call, queues it for background processing
3. Gateway sends to desktop: { type: "tool.call.queued", toolCallId, toolName, ... }
4. Desktop shows tool card with spinner
5. Gateway background worker executes tool (may take 5-30 seconds)
6. Gateway sends: { type: "tool.call.completed", toolCallId, result }
7. Desktop receives, stops spinner, shows result inline
8. User can see tool result before next LLM call continues
```

**Data flow:** WebSocket ← Gateway (push) ← Backend (async worker)

---

### Data Flow 5: Gateway Logs Streaming

```
1. Desktop connects to /gateway WebSocket endpoint
2. Desktop POSTs to backend: POST /api/gateway/logs/subscribe
   └─ Or sends message: { type: "gateway.logs.subscribe", limit: 100 }
3. Gateway starts pushing buffered logs + new log lines
4. Each log line: { type: "gateway.log", level, message, timestamp }
5. Desktop accumulates logs in state, shows last 100 in Sub-process Panel
6. User can see logs updating in real-time as gateway operates
```

**Data flow:** WebSocket push ← Gateway ← Backend logging

---

## New Components & Routing

### Desktop App Views (Add to currentView type)

```typescript
type View =
  | "landing"
  | "chat"
  | "onboarding"           // NEW: First-run setup
  | "settings-gateway"     // NEW: Gateway overview + logs
  | "settings-providers"   // NEW: API keys, model aliases, Ollama
  | "settings-services"    // NEW: Telegram, Brave, shared services
  | "settings-agents"      // NEW: Agent management
```

### New Hooks

- `useOnboarding()` — Manages onboarding form state, submits to backend
- `useProviderConfig()` — Manage provider keys and aliases
- `useSubprocessMonitoring()` — Subscribe to subprocess events, buffer logs
- `useAgentEditor()` — Create/edit agent definitions and files
- `useToolQueue()` — Track background tool call status

### New Zustand Store Extensions

```typescript
interface ConfigState {
  config: AppConfig | null;
  loading: boolean;
  error: Error | null;
  updateConfig: (updates: Partial<AppConfig>) => Promise<void>;
}

interface SubprocessState {
  processes: Record<string, ProcessInfo>;
  logs: Record<string, LogLine[]>;
  addLog: (processName, level, message) => void;
  updateProcessStatus: (processName, status) => void;
}

interface ToolQueueState {
  toolCalls: Record<toolCallId, ToolCallStatus>;
  updateToolStatus: (toolCallId, status) => void;
}
```

### Layout Changes

**Current sidebar:**
- Chat
- (Agent selector)
- Sessions list

**New sidebar (left, navigation menu):**
```
├─ Chat
├─ Gateway (Settings)
│  ├─ Overview
│  ├─ Logs & Health
│  └─ Restart
├─ Configuration (Settings)
│  ├─ Providers
│  ├─ Shared Services
│  ├─ Agents
│  └─ Model Aliases
└─ (onboarding if first-run)

Right sidebar: Sub-process Panel (collapsible)
```

---

## Modified Components

### `App.tsx`
- Add `onboarding` view check at top level
- Route to Onboarding before Chat if `config.onboardingComplete === false`

### `ChatView.tsx`
- Add model switcher in header
- Show tool execution status (inline spinners)
- Add "Export context" button

### `Layout.tsx`
- Extend sidebar to include Settings menu with Providers, Services, Agents
- Add right sidebar for Sub-process Panel (collapsible toggle)

### `useAppStore` (Zustand)
- Add `currentView` states: "onboarding", "settings-*"
- Add subprocess state with processes and logs
- Add tool queue state

---

## Backend API Routes (New Endpoints Summary)

### Onboarding
- `POST /api/onboarding/complete` — Submit onboarding form

### Configuration
- `POST /api/config/model-aliases` — Add/update alias
- `DELETE /api/config/model-aliases/{alias}` — Remove alias
- `POST /api/config/ollama-endpoints` — Add Ollama endpoint
- `DELETE /api/config/ollama-endpoints/{name}` — Remove endpoint

### Vault/Keys
- `GET /api/vault/keys/status` — List providers + configured status
- `POST /api/vault/keys/{provider}` — Set API key
- `DELETE /api/vault/keys/{provider}` — Remove API key

### Agents
- `GET /api/agents` — List agents (from config)
- `POST /api/agents` — Create agent
- `PUT /api/agents/{agentId}` — Update agent metadata
- `DELETE /api/agents/{agentId}` — Delete agent
- `GET /api/agents/{agentId}/soul` — Get SOUL.md
- `PUT /api/agents/{agentId}/soul` — Update SOUL.md
- `GET /api/agents/{agentId}/files` — List files
- `POST /api/agents/{agentId}/files` — Create/update file
- `DELETE /api/agents/{agentId}/files/{filename}` — Delete file

### Shared Services
- `GET /api/services/telegram/config` — Get Telegram config
- `POST /api/services/telegram/whitelist` — Add to whitelist
- `DELETE /api/services/telegram/whitelist/{userId}` — Remove from whitelist
- `GET /api/services/brave/status` — Check Brave key configured

### Context/Export
- `POST /api/context/export` — Trigger context dump
- `GET /api/context/archives` — List exports

### Gateway
- `GET /api/gateway/health` — Health check + uptime
- `GET /api/gateway/logs` — Return buffered logs
- `POST /api/gateway/restart` — Restart gateway process

### WebSocket Extensions
- `subprocess.started` — New subprocess event
- `subprocess.log` — Log line from subprocess
- `subprocess.error` — Subprocess crash
- `subprocess.stopped` — Subprocess stopped
- `tool.call.queued` — Tool queued for async execution
- `tool.call.started` — Tool execution begun
- `tool.call.completed` — Tool finished with result
- `tool.call.failed` — Tool error
- `gateway.log` — Gateway log line (subscription-based)

---

## Database Schema Changes

### New Tables (Minimal)

**`telegram_whitelists` (if not already present)**
```sql
CREATE TABLE telegram_whitelists (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  chatId TEXT NOT NULL,
  allowedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(userId, chatId)
);
```

**`subprocess_logs` (optional, in-memory preferred for v0.3)**
```sql
CREATE TABLE subprocess_logs (
  id TEXT PRIMARY KEY,
  processName TEXT NOT NULL,
  level TEXT, -- 'info', 'warn', 'error'
  message TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Existing Tables (No Changes)
- Config persists to file, not database
- Agents can be stored in config.json (existing approach)
- Sessions, messages, memories unchanged
- Agent metadata extensible in schema

---

## Build Order & Dependencies

### Phase Structure (Recommended for v0.3)

1. **Phase 1: Backend API Foundation**
   - Implement all new HTTP endpoints (/api/onboarding, /api/vault, /api/config, /api/agents, /api/services, /api/context, /api/gateway)
   - Add request validation, authorization checks
   - Wire to existing config, vault, agent systems
   - **Deliverable:** Backend passing all new endpoint tests

2. **Phase 2: WebSocket Extensions**
   - Add subprocess event messages (subprocess.started, subprocess.log, etc.)
   - Extend tool pipeline for async processing (tool.call.queued, tool.call.completed)
   - Add gateway log streaming (optional for this phase)
   - **Deliverable:** Gateway sending new message types, desktop can receive

3. **Phase 3: Desktop Views & State (Onboarding)**
   - Add Onboarding view (route, components, state)
   - Implement onboarding form → POST /api/onboarding/complete
   - Update App.tsx to check onboardingComplete and route correctly
   - **Deliverable:** First-run flow works end-to-end

4. **Phase 4: Desktop Views & State (Settings - Providers)**
   - Add Providers page view
   - Implement ProviderCard, ModelAliasEditor, OllamaEndpointManager
   - Connect to new HTTP endpoints
   - **Deliverable:** Users can add/edit API keys and model aliases in UI

5. **Phase 5: Desktop Views & State (Settings - Services & Agents)**
   - Add SharedServices page (Telegram, Brave, extensible)
   - Add Agents page (create, edit, delete agents)
   - Add SoulEditor for agent personality
   - **Deliverable:** Full configuration UX in desktop app

6. **Phase 6: Subprocess Monitoring & Advanced Features**
   - Implement Sub-process Panel (right sidebar)
   - Connect to subprocess WebSocket events
   - Add Gateway overview page with logs
   - Implement tool queue status display
   - Model switcher with context carry-over
   - Context export feature
   - **Deliverable:** Complete observability + advanced UX

### Dependency Graph

```
Phase 1 (Backend API)
  ↓
Phase 2 (WebSocket Extensions)
  ↓
Phase 3 (Onboarding) ← Must complete before v0.3 release
Phase 4 (Providers) ← Can run parallel with Phase 3 after Phase 1-2
Phase 5 (Services & Agents) ← Can run parallel with Phase 4
Phase 6 (Subprocess, advanced) ← Can run parallel with Phase 4-5
```

**Critical path:** Phase 1 → Phase 2 → Phase 3 (mandatory for v0.3)
**Parallel work:** Phase 4, 5, 6 can progress in parallel once Phase 1-2 complete

---

## Security Considerations

### API Authentication
- All new HTTP endpoints use bearer token auth (from keychain)
- Desktop app sends token in Authorization header
- Backend validates token before processing config changes

### Key Management
- API keys never transmitted in desktop logs
- Keys stored in macOS Keychain by backend, not accessed by desktop
- Desktop only submits key strings in POST body over HTTPS (localhost, so unencrypted but secure)

### Configuration Authority
- Backend is single source of truth for config
- Desktop reads only, submits changes via API
- Config on disk cannot be directly modified by UI (prevents divergence)

### Subprocess Access
- Logs may contain sensitive information (e.g., tool results)
- Recommend log filtering to omit API keys/secrets
- Store logs in memory (not persisted) for v0.3

---

## New vs Modified Components

### New Components (v0.3)
| Component | Type | Location | Purpose |
|-----------|------|----------|---------|
| OnboardingFlow | View | apps/desktop/src/views | First-run setup orchestrator |
| SettingsGatewayPage | View | apps/desktop/src/views | Gateway overview + logs |
| SettingsProvidersPage | View | apps/desktop/src/views | Provider key + alias management |
| SettingsServicesPage | View | apps/desktop/src/views | Shared services (Telegram, Brave) |
| SettingsAgentsPage | View | apps/desktop/src/views | Agent configuration |
| ProviderCard | Component | apps/desktop/src/components | Provider status + key mgmt |
| ModelAliasEditor | Component | apps/desktop/src/components | Alias table UI |
| OllamaEndpointManager | Component | apps/desktop/src/components | Ollama endpoint list |
| SubProcessPanel | Component | apps/desktop/src/components | Sub-process monitoring |
| ToolProgressIndicator | Component | apps/desktop/src/components | Tool execution status |
| GatewayLogViewer | Component | apps/desktop/src/components | Gateway log scrollable view |
| useOnboarding | Hook | apps/desktop/src/hooks | Onboarding form state + submission |
| useProviderConfig | Hook | apps/desktop/src/hooks | Provider config state |
| useSubprocessMonitoring | Hook | apps/desktop/src/hooks | Subscribe to subprocess events |
| useAgentEditor | Hook | apps/desktop/src/hooks | Agent CRUD operations |
| useToolQueue | Hook | apps/desktop/src/hooks | Tool call queue tracking |

### Modified Components (v0.3)
| Component | Change | Impact |
|-----------|--------|--------|
| App.tsx | Add "onboarding" view routing | Routes to Onboarding on first run |
| ChatView.tsx | Add model switcher, tool status, context export | Enhanced chat UX |
| Layout.tsx | Extend sidebar to Settings menu, add right panel | Navigation + subprocess visibility |
| useAppStore | Add config, subprocess, tool queue state | Global state management |
| useChat | Track tool execution status, add model switching | Chat state enhancement |

### New Backend Routes
| Route | Method | Purpose |
|-------|--------|---------|
| /api/onboarding/complete | POST | Submit onboarding |
| /api/vault/keys/status | GET | List provider status |
| /api/vault/keys/{provider} | POST, DELETE | Manage API keys |
| /api/config/model-aliases | POST, DELETE | Manage aliases |
| /api/config/ollama-endpoints | POST, DELETE | Manage Ollama |
| /api/agents | GET, POST | List/create agents |
| /api/agents/{id} | PUT, DELETE | Update/delete agent |
| /api/agents/{id}/soul | GET, PUT | Manage SOUL.md |
| /api/agents/{id}/files | GET, POST, DELETE | Manage agent files |
| /api/services/{service}/config | GET | Get service config |
| /api/context/export | POST | Export context dump |
| /api/gateway/health | GET | Gateway health |
| /api/gateway/logs | GET | Gateway logs |
| /api/gateway/restart | POST | Restart gateway |

---

## Key Architectural Patterns

### 1. Configuration Authority
**Pattern:** Backend-driven config persistence
- Desktop never writes to filesystem directly
- All config changes via HTTP API
- Backend validates and persists to `config.json`
- Desktop reads from file on mount, syncs via WebSocket events

**Benefit:** Single source of truth, prevents UI state divergence

### 2. WebSocket + HTTP Hybrid
**Pattern:** WebSocket for streaming/events, HTTP for stateless CRUD
- Chat messages, tool approvals, logs → WebSocket (push-based)
- Config changes, key management, agent CRUD → HTTP (stateless, idempotent)

**Benefit:** Appropriate transport for each use case

### 3. Async Tool Processing
**Pattern:** Queue + worker threads, push completion events
- Tool calls queued in gateway, processed in background
- Gateway sends completion/failure events via WebSocket
- Desktop shows progress, polls for results if needed

**Benefit:** Non-blocking chat, better UX for long-running operations

### 4. Subprocess Isolation
**Pattern:** Main process (gateway) spawns subprocesses (Telegram, MCPs), event stream to UI
- Subprocesses run independently, gateway monitors them
- Logs streamed to desktop via WebSocket
- Desktop observes but doesn't control (except manual start/stop)

**Benefit:** Observability without tight coupling

### 5. Vault Separation
**Pattern:** API keys never leave keychain, only referenced by provider name
- Desktop submits key string in POST, backend stores to keychain
- Desktop never reads keys (they're encrypted)
- Config has provider names, vault has key mapping

**Benefit:** Keys secure, configuration public

---

## Potential Pitfalls & Mitigations

### Pitfall 1: Config Drift Between Desktop and Backend
**Risk:** User edits config.json manually, desktop reads stale copy
**Mitigation:**
- Desktop invalidates config cache on file change (watch ~/.config/tek/config.json)
- On any config change via API, backend sends WebSocket message to trigger desktop reload
- Desktop re-fetches config after any settings change

### Pitfall 2: Race Conditions on Config Write
**Risk:** Multiple clients update config simultaneously (e.g., CLI + desktop), last write wins
**Mitigation:**
- Add config version/checksum to config.json
- Before writing, backend verifies checksum matches
- If mismatch, return conflict error, client re-fetches
- For v0.3, recommend single-user workflow

### Pitfall 3: Async Tool Timeouts
**Risk:** Tool call queued but never completes, client stuck waiting
**Mitigation:**
- Timeout on tool execution (e.g., 30 seconds), gateway marks as failed
- Retry logic with exponential backoff
- Desktop has timeout on polling for result

### Pitfall 4: Subprocess Crash Loop
**Risk:** Telegram bot crashes, desktop tries to restart repeatedly
**Mitigation:**
- Exponential backoff on restart attempts
- Max restart count per interval
- Alert user if subprocess keeps crashing
- Suggest manual intervention or config change

### Pitfall 5: Large Context Dumps
**Risk:** Exporting context for large session dumps gigabytes of data to desktop
**Mitigation:**
- Limit export to last N messages (e.g., 1000)
- Compress export as gzip
- Show estimated size before export
- Stream to file instead of in-memory for large dumps

### Pitfall 6: API Authorization Bypass
**Risk:** Desktop app's bearer token stored unencrypted, attacker gains access
**Mitigation:**
- Token stored in macOS Keychain (encrypted)
- Desktop retrieves token from keychain on app start
- Token only used for localhost connections (127.0.0.1)
- Consider token rotation for sensitive operations (config changes)

---

## Testing Strategy

### Unit Tests (per component)
- `useProviderConfig.test.ts` — Config state transitions, API calls
- `useToolQueue.test.ts` — Tool status updates, timeout handling
- `useSubprocessMonitoring.test.ts` — Event subscription, log buffering

### Integration Tests (desktop ↔ backend)
- Onboarding end-to-end: form submission → config persisted → view switches
- Provider key update: desktop POST → backend writes to keychain → desktop reads updated status
- Async tool call: desktop receives queued message → polls for result → handles timeout
- Subprocess event: gateway logs subprocess event → desktop receives → UI updates

### E2E Tests (full flow)
- First-run: app launches → detects onboarding needed → user completes flow → app ready
- Configuration: user adds provider key → user adds model alias → user creates agent → all persisted
- Gateway restart: user clicks restart → gateway stops → desktop detects offline → gateway restarts → desktop reconnects

---

## v0.3 Success Metrics

- **First-run flow completes in <2 minutes** (user perspective)
- **Provider key management UI is responsive (<200ms per action)**
- **Agent editor saves without data loss**
- **Sub-process logs stream with <1 second latency**
- **Async tool calls complete without blocking chat**
- **Gateway restart succeeds 100% (no orphan processes)**
- **No config drift between desktop and disk**
- **All API endpoints have <500ms response time (localhost)**

---

## Deferred to v0.4+

- **Mobile configuration UI** — Web dashboard for remote access
- **Config backups/versioning** — Automatic config snapshots
- **Advanced tool scheduling** — Cron-based tool execution from UI
- **Multi-device sync** — Sync config across machines
- **Audit trail** — Log all configuration changes
- **Role-based access** — Team user permissions (out of v1 scope anyway)
- **Custom model fine-tuning UI** — Train models from chat history
- **Distributed gateway** — Run gateway on separate machine from desktop

---

## Conclusion

v0.3 integrates desktop configuration management into Tek by extending the existing WebSocket/HTTP gateway with configuration APIs, adding WebSocket events for async operations and subprocess monitoring, and building out the desktop UI with new settings pages. The architecture maintains backend authority over configuration, uses HTTP for stateless CRUD, and WebSocket for streaming events. Build order prioritizes backend API foundation, then WebSocket extensions, then desktop views, with onboarding as critical path and other settings pages parallelizable.

**Key success factor:** Desktop reads from backend/disk, never writes to disk directly — all changes via API to maintain consistency.

