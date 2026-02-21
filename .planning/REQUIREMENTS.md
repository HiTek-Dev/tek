# Requirements: Tek

**Defined:** 2026-02-15
**Core Value:** Every interaction with your AI agent is transparent, secure, and under your control -- you see exactly what's being sent, what tools are running, and can approve or skip permissions at any granularity.

## v0.0 Requirements (Shipped)

Requirements from initial build (Phases 1-24). All shipped and validated.

### Gateway

- [x] **GATE-01**: Gateway server accepts WebSocket connections and routes messages between clients and LLM providers
- [x] **GATE-02**: User can send a message and receive a streaming response from an LLM
- [x] **GATE-03**: Gateway supports Anthropic, OpenAI, and Ollama providers via unified API (AI SDK 6)
- [x] **GATE-04**: User can switch between providers and models per conversation thread
- [x] **GATE-05**: Gateway manages sessions with per-agent isolation and transparent session keys
- [x] **GATE-06**: User can view the full assembled context (system prompt + memory + skills + history + tools) before it's sent to the model
- [x] **GATE-07**: Context inspector shows byte count, token count, and cost estimate per section
- [x] **GATE-08**: Gateway routes tasks to appropriate models based on complexity (planning -> high-thinking, simple Q&A -> budget)
- [x] **GATE-09**: User can see and override the routing decision before execution
- [x] **GATE-10**: Gateway tracks token usage and cost per request with running totals per model/provider

### Security

- [x] **SECR-01**: API keys are stored encrypted using OS keychain (macOS Keychain via @napi-rs/keyring)
- [x] **SECR-02**: User can add, update, and remove API keys per provider through CLI
- [x] **SECR-03**: Local API endpoint (127.0.0.1 only) serves API keys to authorized local applications
- [x] **SECR-04**: Key vault maintains audit log of which application accessed which key and when
- [x] **SECR-05**: User chooses "Full Control" or "Limited Control" mode during onboarding
- [x] **SECR-06**: Limited Control mode sandboxes agent to a designated workspace directory with its own local DB
- [x] **SECR-07**: Full Control mode grants OS-level access with explicit permission grants per capability
- [x] **SECR-08**: Only official Telegram bot and local CLI can send commands to the agent (no unauthenticated inputs)

### Agent

- [x] **AGNT-01**: Agent can discover and connect to MCP servers configured by the user
- [x] **AGNT-02**: Agent can execute MCP tool calls with results displayed inline in the conversation
- [x] **AGNT-03**: User can approve, deny, or auto-approve tool calls per tool or per session
- [x] **AGNT-04**: Before complex tasks, agent generates a pre-flight checklist showing steps, estimated cost, required permissions, and potential risks
- [x] **AGNT-05**: User can review, edit, and approve the pre-flight checklist before execution begins
- [x] **AGNT-06**: Agent can detect its own failure patterns during task execution
- [x] **AGNT-07**: Agent can draft a new skill to address a detected failure and test it in a sandbox
- [x] **AGNT-08**: User approves agent-authored skills before they are registered in the skills directory
- [x] **AGNT-09**: Agent can read and write files in its designated workspace (or system-wide in Full Control mode)
- [x] **AGNT-10**: Agent can execute shell commands with output displayed inline (with approval gates)

### CLI Interface

- [x] **CLI-01**: User can start Tek from the command line and immediately enter a chat session
- [x] **CLI-02**: CLI displays bash commands, tool calls, and reasoning inline (Claude Code style)
- [x] **CLI-03**: CLI supports slash commands for session management, model switching, and configuration
- [x] **CLI-04**: CLI renders markdown with syntax-highlighted code blocks
- [x] **CLI-05**: User can run interactive CLI applications (claude code, opencode, vim, git rebase) through a terminal proxy mode
- [x] **CLI-06**: Agent can observe and interact with proxied terminal sessions when given control

### Telegram

- [x] **TELE-01**: User can communicate with their agent via a configured Telegram bot
- [x] **TELE-02**: Telegram messages are routed through the gateway with the same session management as CLI
- [x] **TELE-03**: Agent responses are formatted for Telegram (clean text, no raw markdown artifacts)
- [x] **TELE-04**: User can approve/deny tool calls via Telegram inline buttons
- [x] **TELE-05**: Telegram bot authenticates users via pairing code (not open to arbitrary senders)

### Memory

- [x] **MEMR-01**: Agent maintains daily memory logs (markdown files, one per day) appended during conversations
- [x] **MEMR-02**: Agent maintains a curated long-term memory file with durable facts and decisions
- [x] **MEMR-03**: Memory is searchable via vector embeddings (SQLite + sqlite-vec) with semantic queries
- [x] **MEMR-04**: Agent has a soul document (SOUL.md) defining personality, core truths, boundaries, and communication style
- [x] **MEMR-05**: Soul document evolves over time as the agent learns user preferences and develops opinions
- [x] **MEMR-06**: Memory flush triggers before context compaction to preserve important information

### Workflows

- [x] **WKFL-01**: User can define multi-step workflows in TypeScript or YAML with sequential and conditional logic
- [x] **WKFL-02**: Workflows support pass/fail/decision branching with configurable outcomes per branch
- [x] **WKFL-03**: Workflows can invoke tools, call models, and chain results between steps
- [x] **WKFL-04**: Workflows pause at approval gates for user confirmation before destructive or external actions
- [x] **WKFL-05**: User can configure a heartbeat that runs at a set interval (default 30 min)
- [x] **WKFL-06**: Heartbeat follows a user-defined checklist (HEARTBEAT.md) and only alerts when action is needed
- [x] **WKFL-07**: User can configure active hours for heartbeat to avoid off-hours alerts
- [x] **WKFL-08**: User can schedule one-shot and recurring tasks via cron expressions

### Claude Code Integration

- [x] **CCDE-01**: Tek can spawn and manage Claude Code CLI sessions via JSON streaming mode
- [x] **CCDE-02**: Claude Code's interactive prompts (permission requests, questions, confirmations) are proxied to the active channel
- [x] **CCDE-03**: User can respond to proxied Claude Code prompts from any connected channel and responses are relayed back
- [x] **CCDE-04**: Claude Code session output (tool calls, file edits, bash commands) streams in real-time to the user's active interface
- [x] **CCDE-05**: Tek can orchestrate Claude Code as a tool within workflows and agent tasks

### System

- [x] **SYST-01**: System prompt management with per-thread and global system prompts
- [x] **SYST-02**: Skills directory (filesystem-based) with SKILL.md metadata format compatible with workspace/managed tiers
- [x] **SYST-03**: Conversation persistence in SQLite with multiple threads, search, and archival
- [x] **SYST-04**: Web search capability via API or model-integrated search
- [x] **SYST-05**: Image generation skill connecting to major APIs (DALL-E, Stability, Midjourney)
- [x] **SYST-06**: Google Workspace integration skill (Gmail, Drive, Calendar, Docs)
- [x] **SYST-07**: Browser automation via Playwright MCP for testing and web interaction

---

## v0.1 Requirements

Requirements for the Product Polish milestone. Each maps to roadmap phases.

### Foundation & Architecture

- [x] **FOUND-01**: Vault code extracted from @tek/cli to @tek/core, circular dependency eliminated, Turbo builds in one pass
- [x] **FOUND-02**: Desktop app has per-page React error boundaries with recovery UI
- [x] **FOUND-03**: CLI and desktop WebSocket clients auto-reconnect with exponential backoff (1s->2s->4s->8s->max 30s)

### CLI Visual

- [x] **CLIV-01**: Code blocks in CLI chat display syntax highlighting via shiki
- [x] **CLIV-02**: Tool call panels are collapsible -- default collapsed showing tool name + status, expand to show args/output
- [x] **CLIV-03**: User can cycle through previous messages with up/down arrow keys in input
- [x] **CLIV-04**: Tool output truncated at ~20 lines with "... (N more lines)" indicator
- [x] **CLIV-05**: Empty chat state shows welcome message with agent name, slash commands, and keyboard shortcuts
- [x] **CLIV-06**: Messages display timestamps (HH:MM) right-aligned and dimmed
- [x] **CLIV-07**: User can enter multi-line input (Shift+Enter for newline, Enter to submit)
- [x] **CLIV-08**: StatusBar redesigned with multi-zone layout: logo/connection, model/provider, token count + cost in compact format

### Desktop Visual

- [ ] **DSKV-01**: Assistant messages render full markdown (headers, code blocks, lists, tables, inline code, links) with syntax highlighting
- [ ] **DSKV-02**: Code blocks have a copy-to-clipboard button
- [ ] **DSKV-03**: User can approve/deny/session-approve tool calls from the desktop app via modal with argument preview
- [ ] **DSKV-04**: Async operations show loading states (skeleton loaders, spinners, disabled states)
- [ ] **DSKV-05**: Conversation history sidebar lists past sessions with preview, timestamp, and click-to-resume
- [ ] **DSKV-06**: Brand color palette defined and applied (primary, secondary, accent colors replacing generic blue/gray)
- [ ] **DSKV-07**: Typography system applied (UI font + monospace code font with consistent scale)
- [ ] **DSKV-08**: Chat messages redesigned as polished cards (user right-aligned, assistant with model badge, tool calls expandable)
- [ ] **DSKV-09**: Page transitions with subtle fade animation
- [ ] **DSKV-10**: Sidebar is collapsible to icon-only mode with smooth transition
- [ ] **DSKV-11**: Dashboard shows usage stats, recent sessions, memory activity, system health
- [ ] **DSKV-12**: Settings page organized with tabs/accordion, provider health indicators

### Testing

- [ ] **TEST-01**: WebSocket protocol tests validate serialization/deserialization for all ClientMessage/ServerMessage types
- [ ] **TEST-02**: Agent loop unit tests with mock Transport and mock streamText cover tool execution flow
- [x] **TEST-03**: LLM router unit tests cover classifyComplexity and model selection logic
- [ ] **TEST-04**: Config/schema tests validate Zod schema round-trips and migration from older formats
- [x] **TEST-05**: Approval gate policy tests cover auto/session/always tier logic
- [ ] **TEST-06**: Context assembly tests verify system prompt construction with soul/memory/identity

## Future Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### CLI Enhancements

- **CLIF-01**: File diff rendering with green/red line coloring for write operations
- **CLIF-02**: Live step counter during agent loop (Step 3/10: bash_command)
- **CLIF-03**: Compact vs expanded tool display toggle (global session toggle)
- **CLIF-04**: File tree rendering for directory operations

### Desktop Enhancements

- **DSKF-01**: Session search across conversation history
- **DSKF-02**: Dark/light theme toggle
- **DSKF-03**: API key management directly in desktop (currently CLI-only)
- **DSKF-04**: MCP server add/edit/delete UI in settings
- **DSKF-05**: Desktop-based agent onboarding (currently CLI-only)

### Dashboard

- **DASH-01**: Visual workflow canvas (drag-and-drop builder)
- **DASH-02**: Context inspector UI with collapsible sections per context component

### Native App

- **NAPP-01**: macOS companion app with microphone access and system notifications
- **NAPP-02**: Native notification system for approval requests and alerts

### Advanced Workflows

- **AWFL-01**: Conversational workflow creation ("describe what you want and it builds the workflow")
- **AWFL-02**: Triple-mode workflow sync (visual <-> code <-> conversational bidirectional sync)

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
| Real-time collaboration | CRDT complexity unjustified for single-user product. |
| Voice/video input | Not core to agent gateway. Optional Whisper integration in v2+. |
| Fully autonomous background agents | AutoGPT proved this is dangerous. Approval gates required at all checkpoints. |
| WhatsApp/Discord/Slack/iMessage | Telegram first. Channel expansion after core is solid. |
| Mobile apps (iOS/Android) | Web-first. Native mobile is v3+. |
| Multi-user team features | Single-user focus. Multi-user is v2+. |
| Custom model training/fine-tuning | Use existing models. Not a training platform. |
| File tree view in CLI | High Ink complexity for marginal gain; defer to later milestone |
| Real-time message search in desktop | Requires FTS5 schema; ship history sidebar first |
| E2E tests with real LLM API | Slow, costly, tests LLM not Tek; mock at AI SDK level |
| 100% code coverage target | Chasing coverage couples tests to internals; target critical paths |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

### v0.0 (Shipped -- Phases 1-24)

| Requirement | Phase | Status |
|-------------|-------|--------|
| GATE-01 through GATE-10 | Phases 1-4 | Complete |
| SECR-01 through SECR-08 | Phases 1, 14-15 | Complete |
| AGNT-01 through AGNT-10 | Phases 6-7 | Complete |
| CLI-01 through CLI-06 | Phases 3, 7 | Complete |
| TELE-01 through TELE-05 | Phase 9 | Complete |
| MEMR-01 through MEMR-06 | Phases 5, 16 | Complete |
| WKFL-01 through WKFL-08 | Phase 8 | Complete |
| CCDE-01 through CCDE-05 | Phase 10 | Complete |
| SYST-01 through SYST-07 | Phases 5-6, 10 | Complete |

### v0.1 (Current Milestone)

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 25 | Complete |
| FOUND-02 | Phase 25 | Complete |
| FOUND-03 | Phase 25 | Complete |
| CLIV-01 | Phase 26 | Complete |
| CLIV-02 | Phase 26 | Complete |
| CLIV-03 | Phase 26 | Complete |
| CLIV-04 | Phase 26 | Complete |
| CLIV-05 | Phase 26 | Complete |
| CLIV-06 | Phase 26 | Complete |
| CLIV-07 | Phase 26 | Complete |
| CLIV-08 | Phase 26 | Complete |
| DSKV-01 | Phase 27 | Pending |
| DSKV-02 | Phase 27 | Pending |
| DSKV-03 | Phase 27 | Pending |
| DSKV-04 | Phase 27 | Pending |
| DSKV-05 | Phase 27 | Pending |
| DSKV-06 | Phase 27 | Pending |
| DSKV-07 | Phase 27 | Pending |
| DSKV-08 | Phase 27 | Pending |
| DSKV-09 | Phase 27 | Pending |
| DSKV-10 | Phase 27 | Pending |
| DSKV-11 | Phase 27 | Pending |
| DSKV-12 | Phase 27 | Pending |
| TEST-01 | Phase 28 | Pending |
| TEST-02 | Phase 28 | Pending |
| TEST-03 | Phase 28 | Complete |
| TEST-04 | Phase 28 | Pending |
| TEST-05 | Phase 28 | Complete |
| TEST-06 | Phase 28 | Pending |

**Coverage:**
- v0.1 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0

---
*Requirements defined: 2026-02-15*
*Last updated: 2026-02-20 after v0.1 roadmap creation*
