# Requirements: AgentSpace

**Defined:** 2026-02-15
**Core Value:** Every interaction with your AI agent is transparent, secure, and under your control — you see exactly what's being sent, what tools are running, and can approve or skip permissions at any granularity.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Gateway

- [ ] **GATE-01**: Gateway server accepts WebSocket connections and routes messages between clients and LLM providers
- [ ] **GATE-02**: User can send a message and receive a streaming response from an LLM
- [ ] **GATE-03**: Gateway supports Anthropic, OpenAI, and Ollama providers via unified API (AI SDK 6)
- [ ] **GATE-04**: User can switch between providers and models per conversation thread
- [ ] **GATE-05**: Gateway manages sessions with per-agent isolation and transparent session keys
- [ ] **GATE-06**: User can view the full assembled context (system prompt + memory + skills + history + tools) before it's sent to the model
- [ ] **GATE-07**: Context inspector shows byte count, token count, and cost estimate per section
- [ ] **GATE-08**: Gateway routes tasks to appropriate models based on complexity (planning → high-thinking, simple Q&A → budget)
- [ ] **GATE-09**: User can see and override the routing decision before execution
- [ ] **GATE-10**: Gateway tracks token usage and cost per request with running totals per model/provider

### Security

- [ ] **SECR-01**: API keys are stored encrypted using OS keychain (macOS Keychain via @napi-rs/keyring)
- [ ] **SECR-02**: User can add, update, and remove API keys per provider through CLI
- [ ] **SECR-03**: Local API endpoint (127.0.0.1 only) serves API keys to authorized local applications
- [ ] **SECR-04**: Key vault maintains audit log of which application accessed which key and when
- [ ] **SECR-05**: User chooses "Full Control" or "Limited Control" mode during onboarding
- [ ] **SECR-06**: Limited Control mode sandboxes agent to a designated workspace directory with its own local DB
- [ ] **SECR-07**: Full Control mode grants OS-level access with explicit permission grants per capability
- [ ] **SECR-08**: Only official Telegram bot and local CLI can send commands to the agent (no unauthenticated inputs)

### Agent

- [ ] **AGNT-01**: Agent can discover and connect to MCP servers configured by the user
- [ ] **AGNT-02**: Agent can execute MCP tool calls with results displayed inline in the conversation
- [ ] **AGNT-03**: User can approve, deny, or auto-approve tool calls per tool or per session
- [ ] **AGNT-04**: Before complex tasks, agent generates a pre-flight checklist showing steps, estimated cost, required permissions, and potential risks
- [ ] **AGNT-05**: User can review, edit, and approve the pre-flight checklist before execution begins
- [ ] **AGNT-06**: Agent can detect its own failure patterns during task execution
- [ ] **AGNT-07**: Agent can draft a new skill to address a detected failure and test it in a sandbox
- [ ] **AGNT-08**: User approves agent-authored skills before they are registered in the skills directory
- [ ] **AGNT-09**: Agent can read and write files in its designated workspace (or system-wide in Full Control mode)
- [ ] **AGNT-10**: Agent can execute shell commands with output displayed inline (with approval gates)

### CLI Interface

- [ ] **CLI-01**: User can start AgentSpace from the command line and immediately enter a chat session
- [ ] **CLI-02**: CLI displays bash commands, tool calls, and reasoning inline (Claude Code style)
- [ ] **CLI-03**: CLI supports slash commands for session management, model switching, and configuration
- [ ] **CLI-04**: CLI renders markdown with syntax-highlighted code blocks
- [ ] **CLI-05**: User can run interactive CLI applications (claude code, opencode, vim, git rebase) through a terminal proxy mode
- [ ] **CLI-06**: Agent can observe and interact with proxied terminal sessions when given control

### Telegram

- [ ] **TELE-01**: User can communicate with their agent via a configured Telegram bot
- [ ] **TELE-02**: Telegram messages are routed through the gateway with the same session management as CLI
- [ ] **TELE-03**: Agent responses are formatted for Telegram (clean text, no raw markdown artifacts)
- [ ] **TELE-04**: User can approve/deny tool calls via Telegram inline buttons
- [ ] **TELE-05**: Telegram bot authenticates users via pairing code (not open to arbitrary senders)

### Memory

- [ ] **MEMR-01**: Agent maintains daily memory logs (markdown files, one per day) appended during conversations
- [ ] **MEMR-02**: Agent maintains a curated long-term memory file with durable facts and decisions
- [ ] **MEMR-03**: Memory is searchable via vector embeddings (SQLite + sqlite-vec) with semantic queries
- [ ] **MEMR-04**: Agent has a soul document (SOUL.md) defining personality, core truths, boundaries, and communication style
- [ ] **MEMR-05**: Soul document evolves over time as the agent learns user preferences and develops opinions
- [ ] **MEMR-06**: Memory flush triggers before context compaction to preserve important information

### Workflows

- [ ] **WKFL-01**: User can define multi-step workflows in TypeScript or YAML with sequential and conditional logic
- [ ] **WKFL-02**: Workflows support pass/fail/decision branching with configurable outcomes per branch
- [ ] **WKFL-03**: Workflows can invoke tools, call models, and chain results between steps
- [ ] **WKFL-04**: Workflows pause at approval gates for user confirmation before destructive or external actions
- [ ] **WKFL-05**: User can configure a heartbeat that runs at a set interval (default 30 min)
- [ ] **WKFL-06**: Heartbeat follows a user-defined checklist (HEARTBEAT.md) and only alerts when action is needed
- [ ] **WKFL-07**: User can configure active hours for heartbeat to avoid off-hours alerts
- [ ] **WKFL-08**: User can schedule one-shot and recurring tasks via cron expressions

### Claude Code Integration

- [ ] **CCDE-01**: AgentSpace can spawn and manage Claude Code CLI sessions via JSON streaming mode
- [ ] **CCDE-02**: Claude Code's interactive prompts (permission requests, questions, confirmations) are proxied to the active channel (CLI, Telegram, or dashboard)
- [ ] **CCDE-03**: User can respond to proxied Claude Code prompts from any connected channel and responses are relayed back
- [ ] **CCDE-04**: Claude Code session output (tool calls, file edits, bash commands) streams in real-time to the user's active interface
- [ ] **CCDE-05**: AgentSpace can orchestrate Claude Code as a tool within workflows and agent tasks

### System

- [ ] **SYST-01**: System prompt management with per-thread and global system prompts
- [ ] **SYST-02**: Skills directory (filesystem-based) with SKILL.md metadata format compatible with workspace/managed tiers
- [ ] **SYST-03**: Conversation persistence in SQLite with multiple threads, search, and archival
- [ ] **SYST-04**: Web search capability via API or model-integrated search
- [ ] **SYST-05**: Image generation skill connecting to major APIs (DALL-E, Stability, Midjourney)
- [ ] **SYST-06**: Google Workspace integration skill (Gmail, Drive, Calendar, Docs)
- [ ] **SYST-07**: Browser automation via Playwright MCP for testing and web interaction

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Dashboard

- **DASH-01**: Web dashboard for real-time conversation monitoring and configuration
- **DASH-02**: Approval center in dashboard with notification delivery
- **DASH-03**: Visual workflow canvas (drag-and-drop builder)
- **DASH-04**: Context inspector UI with collapsible sections per context component

### Native App

- **NAPP-01**: macOS companion app with microphone access and system notifications
- **NAPP-02**: Native notification system for approval requests and alerts

### Advanced Workflows

- **AWFL-01**: Conversational workflow creation ("describe what you want and it builds the workflow")
- **AWFL-02**: Triple-mode workflow sync (visual ↔ code ↔ conversational bidirectional sync)

### Advanced Agent

- **AAGN-01**: Multi-agent orchestration (sub-agents spawned for parallel tasks)
- **AAGN-02**: Agent-to-agent communication within the gateway

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Cloud-hosted SaaS mode | Destroys core value of transparency and control. Self-hosted only. |
| Built-in LLM hosting | Ollama already solves this. Treat local models as a provider, not built-in. |
| Plugin marketplace | Premature. Filesystem skills directory + Git sharing first. Marketplace is v3+. |
| Real-time collaboration | CRDT complexity unjustified for single-user/small-team product. |
| Voice/video input | Not core to agent gateway. Optional Whisper integration in v2+. |
| Fully autonomous background agents | AutoGPT proved this is dangerous. Approval gates required at all checkpoints. |
| WhatsApp/Discord/Slack/iMessage | Telegram first. Channel expansion after core is solid. |
| Mobile apps (iOS/Android) | Web-first. Native mobile is v3+. |
| Multi-user team features | Single-user focus for v1. Multi-user is v2+. |
| Custom model training/fine-tuning | Use existing models. Not a training platform. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| (Populated during roadmap creation) | | |

**Coverage:**
- v1 requirements: 54 total
- Mapped to phases: 0
- Unmapped: 54 ⚠️

---
*Requirements defined: 2026-02-15*
*Last updated: 2026-02-15 after initial definition*
