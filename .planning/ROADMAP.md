# Roadmap: AgentSpace

## Overview

AgentSpace is a self-hosted AI agent gateway platform delivering transparency, security, and control over multi-provider LLM interactions. The roadmap delivers the platform in 10 phases: starting with foundational infrastructure (credential vault, gateway, CLI), expanding through intelligence layers (multi-provider routing, memory, agent capabilities), and culminating in advanced orchestration (workflows, Telegram, Claude Code integration, system skills). Each phase delivers a coherent, verifiable capability that builds on what came before.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Security** - Project scaffolding, encrypted credential vault, security boundaries, and onboarding modes
- [ ] **Phase 2: Gateway Core** - WebSocket gateway server, single-provider streaming, session management, and transparent context inspection
- [ ] **Phase 3: CLI Interface** - Ink-based terminal UI with Claude Code-style inline display, slash commands, and markdown rendering
- [ ] **Phase 4: Multi-Provider Intelligence** - Additional LLM providers, model switching, smart routing, cost tracking, and routing overrides
- [ ] **Phase 5: Memory & Persistence** - Two-tier memory system, soul document, vector search, conversation persistence, and system prompts
- [ ] **Phase 6: Agent Capabilities** - MCP tool integration, approval gates, file/shell access, skill directory, and pre-flight checklists
- [ ] **Phase 7: Agent Self-Improvement** - Self-debugging, skill authoring, sandbox testing, and terminal proxy for interactive CLI tools
- [ ] **Phase 8: Workflows & Scheduling** - Multi-step workflow engine, heartbeat system, cron scheduling, and workflow approval gates
- [ ] **Phase 9: Telegram Channel** - Telegram bot integration, message routing, inline approvals, and user authentication
- [ ] **Phase 10: Claude Code & System Skills** - Claude Code session management, web search, image generation, browser automation, and Google Workspace integration

## Phase Details

### Phase 1: Foundation & Security
**Goal**: Users have a secure foundation where API keys are encrypted, security modes are established, and the project infrastructure is ready for feature development
**Depends on**: Nothing (first phase)
**Requirements**: SECR-01, SECR-02, SECR-03, SECR-04, SECR-05, SECR-06, SECR-07, SECR-08
**Success Criteria** (what must be TRUE):
  1. User can add, update, and remove API keys for Anthropic/OpenAI/Ollama through a CLI command, and keys are stored encrypted in OS keychain
  2. User can choose "Full Control" or "Limited Control" mode during first-run onboarding, and mode persists across restarts
  3. Limited Control mode restricts the agent to a designated workspace directory; Full Control mode grants OS-level access with explicit permission grants
  4. Local-only API endpoint (127.0.0.1) serves API keys to authorized local applications with an audit log of access
  5. Only authenticated local CLI can send commands to the agent (no unauthenticated inputs accepted)
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Scaffold monorepo, @agentspace/core (config/crypto/types), @agentspace/db (audit log schema)
- [ ] 01-02-PLAN.md — Credential vault (OS keychain wrapper) and CLI key management commands
- [ ] 01-03-PLAN.md — Security mode enforcement, local key-serving API, onboarding wizard, config/audit CLI

### Phase 2: Gateway Core
**Goal**: Users can connect to the gateway and have a streaming conversation with an LLM, with full transparency into what context is being assembled and sent
**Depends on**: Phase 1
**Requirements**: GATE-01, GATE-02, GATE-05, GATE-06, GATE-07, GATE-10
**Success Criteria** (what must be TRUE):
  1. User can connect to the gateway via WebSocket and send a message that returns a streaming response from an LLM (Anthropic initially)
  2. Gateway creates isolated sessions per agent with transparent session keys visible to the user
  3. User can view the full assembled context (system prompt, memory, skills, history, tools) before it is sent to the model
  4. Context inspector displays byte count, token count, and cost estimate for each context section
  5. Gateway tracks and displays token usage and cost per request with running totals per model
**Plans**: 3 plans

Plans:
- [ ] 02-01-PLAN.md — DB schemas (sessions/messages/usage), WS protocol with Zod validation, session manager, WebSocket server on existing Fastify instance
- [ ] 02-02-PLAN.md — LLM streaming (AI SDK 6 + Anthropic), context assembly/inspection with token estimation, usage tracking with cost calculation, wire all WS handlers
- [ ] 02-03-PLAN.md — End-to-end human verification of streaming chat, session isolation, context inspection, and usage tracking

### Phase 3: CLI Interface
**Goal**: Users can interact with their agent through a polished terminal interface that shows every step transparently, styled after Claude Code
**Depends on**: Phase 2
**Requirements**: CLI-01, CLI-02, CLI-03, CLI-04
**Success Criteria** (what must be TRUE):
  1. User can launch AgentSpace from the terminal and immediately begin a chat session with their agent
  2. CLI displays bash commands, tool calls, and reasoning inline in the conversation flow (Claude Code style)
  3. User can use slash commands for session management, model switching, and configuration
  4. CLI renders markdown responses with syntax-highlighted code blocks
**Plans**: 2 plans

Plans:
- [ ] 03-01-PLAN.md — Gateway discovery, WebSocket hook, chat state hook, chat command entry point
- [ ] 03-02-PLAN.md — UI components (MessageBubble, StatusBar, InputBar, MarkdownRenderer), slash commands, markdown rendering, default command

### Phase 4: Multi-Provider Intelligence
**Goal**: Users can leverage multiple LLM providers and the system intelligently routes tasks to the most appropriate model, with full user control over routing decisions
**Depends on**: Phase 2
**Requirements**: GATE-03, GATE-04, GATE-08, GATE-09
**Success Criteria** (what must be TRUE):
  1. User can send messages to Anthropic, OpenAI, and Ollama providers through a unified interface
  2. User can switch between providers and models mid-conversation
  3. Gateway automatically routes tasks to appropriate models based on complexity (planning to high-thinking, simple Q&A to budget models)
  4. User can see and override the routing decision before the request is sent
**Plans**: 2 plans

Plans:
- [ ] 04-01-PLAN.md — Provider registry (Anthropic/OpenAI/Ollama), unified streaming, extended pricing, backward-compat model IDs
- [ ] 04-02-PLAN.md — Complexity-based routing engine, chat.route.propose/confirm protocol, auto/manual routing modes

### Phase 5: Memory & Persistence
**Goal**: The agent remembers past interactions, maintains an evolving personality, and users can search conversation history semantically
**Depends on**: Phase 2
**Requirements**: MEMR-01, MEMR-02, MEMR-03, MEMR-04, MEMR-05, MEMR-06, SYST-01, SYST-03
**Success Criteria** (what must be TRUE):
  1. Agent maintains daily memory logs (one markdown file per day) that capture key information from conversations
  2. Agent maintains a curated long-term memory file with durable facts and decisions that persists across sessions
  3. User can search past conversations and memories using natural language queries (semantic vector search)
  4. Agent has a soul document (SOUL.md) that defines its personality and communication style, and this document evolves over time based on user interactions
  5. Conversations persist in SQLite with multiple threads, search, and archival; user can manage per-thread and global system prompts
**Plans**: 3 plans

Plans:
- [ ] 05-01-PLAN.md — DB schemas (threads/memories/global_prompts), sqlite-vec integration, memory file scaffolding (SOUL.md, MEMORY.md)
- [ ] 05-02-PLAN.md — Daily logger, memory curator, soul manager, embedding generation/storage wrapper
- [ ] 05-03-PLAN.md — Vector search, memory pressure detection, thread management, context assembler integration, WS protocol extensions

### Phase 6: Agent Capabilities
**Goal**: The agent can use tools, access the filesystem and shell, and users have granular control over what the agent is allowed to do
**Depends on**: Phase 3, Phase 5
**Requirements**: AGNT-01, AGNT-02, AGNT-03, AGNT-04, AGNT-05, AGNT-09, AGNT-10, SYST-02
**Success Criteria** (what must be TRUE):
  1. Agent can discover and connect to user-configured MCP servers and execute tool calls with results displayed inline
  2. User can approve, deny, or auto-approve tool calls per tool or per session with tiered approval levels
  3. Before complex tasks, agent generates a pre-flight checklist showing steps, estimated cost, required permissions, and risks; user can review and edit before execution begins
  4. Agent can read/write files in its workspace (or system-wide in Full Control mode) and execute shell commands with output displayed inline
  5. Skills directory exists with SKILL.md metadata format supporting workspace and managed tiers
**Plans**: 5 plans

Plans:
- [ ] 06-01-PLAN.md — Config schema extensions, MCP client manager, built-in filesystem/shell tools, tool registry, approval gate
- [ ] 06-02-PLAN.md — Skills directory with SKILL.md metadata parsing, workspace/managed tier discovery
- [ ] 06-03-PLAN.md — Tool-aware streaming (fullStream), WS protocol extensions, agent tool loop, context assembler wiring
- [ ] 06-04-PLAN.md — Pre-flight checklist generator, CLI tool rendering, approval prompt UI, /tools and /approve commands
- [ ] 06-05-PLAN.md — Gap closure: fix session-approve to call recordSessionApproval with toolName

### Phase 7: Agent Self-Improvement
**Goal**: The agent can learn from its failures, author new skills, and interact with interactive terminal applications
**Depends on**: Phase 6
**Requirements**: AGNT-06, AGNT-07, AGNT-08, CLI-05, CLI-06
**Success Criteria** (what must be TRUE):
  1. Agent detects its own failure patterns during task execution and proposes corrective actions
  2. Agent can draft a new skill to address a detected failure, test it in a sandbox environment, and present it for user approval before registration
  3. User can run interactive CLI applications (vim, git rebase, debuggers) through a terminal proxy mode
  4. Agent can observe and interact with proxied terminal sessions when given explicit control
**Plans**: 4 plans

Plans:
- [ ] 07-01-PLAN.md — Failure pattern detection in agent tool loop (onStepFinish + classifier)
- [ ] 07-02-PLAN.md — Skill authoring tools (draft + register) with approval gate and CLI prompt
- [ ] 07-03-PLAN.md — Terminal proxy mode with node-pty and /proxy slash command
- [ ] 07-04-PLAN.md — Agent PTY observation with snapshot/input WS protocol and Ctrl+\ reclaim

### Phase 8: Workflows & Scheduling
**Goal**: Users can define automated multi-step workflows with branching logic, schedule recurring tasks, and configure heartbeat monitoring
**Depends on**: Phase 6
**Requirements**: WKFL-01, WKFL-02, WKFL-03, WKFL-04, WKFL-05, WKFL-06, WKFL-07, WKFL-08
**Success Criteria** (what must be TRUE):
  1. User can define multi-step workflows in TypeScript or YAML with sequential and conditional (pass/fail/decision) branching
  2. Workflows can invoke tools, call models, and chain results between steps; workflows pause at approval gates before destructive actions
  3. User can configure a heartbeat that runs at a set interval, follows a user-defined checklist, and only alerts when action is needed
  4. User can set active hours for heartbeat to avoid off-hours alerts
  5. User can schedule one-shot and recurring tasks via cron expressions
**Plans**: 5 plans

Plans:
- [ ] 08-01-PLAN.md — DB schemas (workflows/executions/schedules), Zod types, install croner+yaml
- [ ] 08-02-PLAN.md — Workflow engine (loader, executor, state persistence, templates, branching)
- [ ] 08-03-PLAN.md — Cron scheduler with active hours, heartbeat runner with HEARTBEAT.md
- [ ] 08-04-PLAN.md — WS protocol extensions and gateway handler wiring for all workflow/schedule/heartbeat messages
- [ ] 08-05-PLAN.md — Gap closure: wire handleHeartbeatConfigure to scheduleHeartbeat with real onAlert

### Phase 9: Telegram Channel
**Goal**: Users can communicate with their agent from mobile via Telegram with the same capabilities as the CLI
**Depends on**: Phase 6
**Requirements**: TELE-01, TELE-02, TELE-03, TELE-04, TELE-05
**Success Criteria** (what must be TRUE):
  1. User can send messages to their agent via a configured Telegram bot and receive formatted responses
  2. Telegram messages route through the gateway with the same session management as CLI (sessions are unified across channels)
  3. User can approve or deny tool calls via Telegram inline buttons
  4. Telegram bot authenticates users via pairing code; unauthenticated users cannot interact with the agent
**Plans**: 4 plans

Plans:
- [ ] 09-01-PLAN.md — Transport abstraction (Transport interface, WebSocketTransport, refactor handlers to channel-agnostic)
- [ ] 09-02-PLAN.md — Telegram package scaffold (DB schemas, grammY setup, TelegramTransport, response formatter)
- [ ] 09-03-PLAN.md — Bot core (pairing-code auth, command handlers, text message routing to gateway)
- [ ] 09-04-PLAN.md — Streaming accumulator, inline tool approval buttons, response formatting

### Phase 10: Claude Code & System Skills
**Goal**: AgentSpace can orchestrate Claude Code as a development tool and provides built-in skills for web search, image generation, browser automation, and Google Workspace
**Depends on**: Phase 6
**Requirements**: CCDE-01, CCDE-02, CCDE-03, CCDE-04, CCDE-05, SYST-04, SYST-05, SYST-06, SYST-07
**Success Criteria** (what must be TRUE):
  1. AgentSpace can spawn and manage Claude Code CLI sessions with output streaming in real-time to the user's active interface
  2. Claude Code's interactive prompts (permission requests, questions) are proxied to the active channel and user can respond from any connected channel
  3. AgentSpace can orchestrate Claude Code as a tool within workflows and agent tasks
  4. User can invoke web search, image generation (DALL-E, Stability), and browser automation (Playwright) as agent skills
  5. Google Workspace integration skill provides access to Gmail, Drive, Calendar, and Docs
**Plans**: 4 plans

Plans:
- [ ] 10-01-PLAN.md — Claude Code session manager, event relay, and types (CCDE-01, CCDE-04)
- [ ] 10-02-PLAN.md — Claude Code approval proxying, WS protocol, handlers, and workflow tool (CCDE-02, CCDE-03, CCDE-05)
- [ ] 10-03-PLAN.md — System skills: web search, image generation, browser automation (SYST-04, SYST-05, SYST-07)
- [ ] 10-04-PLAN.md — Google Workspace integration skill (SYST-06)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10
Note: Phases 3, 4, and 5 can execute in parallel after Phase 2. Phases 7, 8, 9, and 10 can execute in parallel after Phase 6.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Security | 0/3 | Not started | - |
| 2. Gateway Core | 0/3 | Not started | - |
| 3. CLI Interface | 0/2 | Not started | - |
| 4. Multi-Provider Intelligence | 0/2 | Not started | - |
| 5. Memory & Persistence | 0/3 | Not started | - |
| 6. Agent Capabilities | 0/3 | Not started | - |
| 7. Agent Self-Improvement | 0/2 | Not started | - |
| 8. Workflows & Scheduling | 0/3 | Not started | - |
| 9. Telegram Channel | 0/2 | Not started | - |
| 10. Claude Code & System Skills | 0/3 | Not started | - |
