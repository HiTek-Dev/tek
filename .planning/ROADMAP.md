# Roadmap: Tek

## Milestones

- **v0.0 Core Infrastructure** - Phases 1-24 (shipped 2026-02-20)
- **v0.1 Product Polish** - Phases 25-28 (shipped 2026-02-21)
- **v0.2 Chat Experience & Providers** - Phases 30-34 (in progress)

## Phases

<details>
<summary>v0.0 Core Infrastructure (Phases 1-24) - SHIPPED 2026-02-20</summary>

- [x] **Phase 1: Foundation & Security** - Monorepo scaffold, encrypted credential vault, security modes, onboarding
- [x] **Phase 2: Gateway Core** - WebSocket gateway, single-provider streaming, session management, context inspection
- [x] **Phase 3: CLI Interface** - Ink-based terminal UI, Claude Code-style inline display, slash commands, markdown
- [x] **Phase 4: Multi-Provider Intelligence** - Anthropic/OpenAI/Ollama providers, smart routing, cost tracking
- [x] **Phase 5: Memory & Persistence** - Two-tier memory, soul document, vector search, conversation persistence
- [x] **Phase 6: Agent Capabilities** - MCP tools, approval gates, file/shell access, skills, pre-flight checklists
- [x] **Phase 7: Agent Self-Improvement** - Self-debugging, skill authoring, sandbox testing, terminal proxy
- [x] **Phase 8: Workflows & Scheduling** - Workflow engine, heartbeat system, cron scheduling
- [x] **Phase 9: Telegram Channel** - Telegram bot, message routing, inline approvals, pairing auth
- [x] **Phase 10: Claude Code & System Skills** - Claude Code relay, web search, image gen, browser automation, Google Workspace
- [x] **Phase 11: Install & Update System** - CDN distribution, install/update scripts, version tracking
- [x] **Phase 12: Expanded Providers** - Venice AI, Google Gemini, Ollama remote hosts, provider hot-swap
- [x] **Phase 13: Rebrand to tek** - CLI command, package scope, config paths, keychain migration
- [x] **Phase 14: CLI & Setup Polish** - Gateway subcommand, skippable setup, model catalog, uninstall
- [x] **Phase 15: Init & Onboarding Polish** - Model alias flow, Telegram setup, personality Hatch step
- [x] **Phase 16: Agent Personality System** - Multi-file identity, personality evolution, agent isolation
- [x] **Phase 17: Desktop Frontend (Tauri)** - Tauri v2 app with dashboard, chat, agents, settings
- [x] **Phase 18: Onboarding Research** - AI agent personality and onboarding patterns research
- [x] **Phase 19: Desktop & Integration Polish** - Bug fixes, UI polish, Telegram bot, end-to-end verification
- [x] **Phase 20: Agent Identity & Memory Access** - Identity injection, memory tools, provider validation
- [x] **Phase 21: Init & Agent Onboarding Rework** - Separate init/onboard, agent selection, gateway identity
- [x] **Phase 22: Agent First Contact & Dashboard Polish** - First-chat identity, conversational onboarding, desktop fixes
- [x] **Phase 23: Agent Tools & Error Recovery** - Tool workspace paths, error handling, base tool set, Brave Search
- [x] **Phase 24: Tools Actually Working** - Workspace dir creation, session persistence, tool error recovery

</details>

<details>
<summary>v0.1 Product Polish (Phases 25-28) - SHIPPED 2026-02-21</summary>

- [x] **Phase 25: Foundation & Blockers** - Vault extraction, error boundaries, Vitest workspace, WS auto-reconnect
- [x] **Phase 26: CLI Visual Overhaul** - Syntax highlighting, collapsible panels, input history, StatusBar redesign
- [x] **Phase 27: Desktop UI Overhaul** - Markdown rendering, tool approval modal, conversation history, design system
- [x] **Phase 28: Testing Foundation** - WS protocol tests, config schema tests, router tests, approval gate tests

</details>

## v0.2 Chat Experience & Providers (Phases 30-34)

**Milestone Goal:** Deliver a premium chat experience across CLI and desktop — Ollama auto-discovery, opcode-style Tauri desktop app with structured JSON streaming, Claude Code-style CLI with fixed bottom input, and integrated todo display across both interfaces.

- [x] **Phase 30: Ollama Auto-Discovery & Remote Setup** - Detect local models, list in setup, manual IP/model for remote (completed 2026-02-22)
- [x] **Phase 31: Desktop Chat App Rebuild** - Opcode-style Tauri chat, gateway status landing, agent selection, streaming display (completed 2026-02-22)
- [x] **Phase 32: Structured Streaming & Chat Formatting** - JSON streaming protocol, reasoning blocks, source attribution, system prompt formatting (completed 2026-02-22)
- [x] **Phase 33: Todo System Display in CLI and Desktop** - Todo progress in CLI bottom bar and desktop chat (completed 2026-02-22)
- [x] **Phase 34: CLI Chat UX Overhaul** - Fixed bottom input, expandable entry, Claude Code/Kimicode-style terminal (completed 2026-02-22)

## Phase Details

### Phase 30: Ollama Auto-Discovery and Remote Setup

**Goal:** Ollama provider detects locally available models automatically (no API key needed), lists them during setup like other providers, and supports manual IP:port + model entry for remote Ollama instances on the network
**Depends on:** None (fresh start)
**Requirements:** [OLLM-01, OLLM-02, OLLM-03, OLLM-04]
**Plans:** 1/1 plans complete

Plans:
- [ ] 30-01-PLAN.md -- Ollama discovery client, dynamic model catalog, and onboarding integration

### Phase 31: Desktop Chat App Rebuild

**Goal:** Rebuild the Tauri desktop app as a polished chat session system modeled on [opcode](https://github.com/winfunc/opcode) — landing page shows gateway connection status and stats, chat selects from available agents (or auto-selects if only one), clean message cards with real-time streaming display
**Depends on:** Phase 32
**Requirements:** [DESK-01, DESK-02, DESK-03, DESK-04, DESK-05, DESK-06, DESK-07, DESK-08]
**Plans:** 5/5 plans complete

Plans:
- [ ] 31-01-PLAN.md -- Tauri app scaffold with React, Vite, Tailwind v4, shadcn/ui, Rust plugins
- [ ] 31-02-PLAN.md -- Gateway discovery and Landing view with status display
- [ ] 31-03-PLAN.md -- WebSocket connection hook and chat state management
- [ ] 31-04-PLAN.md -- Chat view with message rendering (Streamdown) and input
- [ ] 31-05-PLAN.md -- Tool approval flow, session list panel, and verification

### Phase 32: Structured Streaming and Chat Formatting

**Goal:** Gateway streams structured JSON data to clients (CLI + desktop) enabling real-time stylized rendering — markdown formatting, code highlighting, reasoning blocks, tool call displays — with base system prompt instructing agents on response format for clean presentation
**Depends on:** None (fresh start)
**Requirements:** [STRM-01, STRM-02, STRM-03, STRM-04, STRM-05, STRM-06, STRM-07]
**Plans:** 3/3 plans complete

Plans:
- [ ] 32-01-PLAN.md -- Protocol extension, gateway fullStream refactor, reasoning options, formatting system prompt
- [ ] 32-02-PLAN.md -- Desktop reasoning block display, source attribution rendering
- [ ] 32-03-PLAN.md -- CLI reasoning display, source attribution rendering

### Phase 33: Todo System Display in CLI and Desktop

**Goal:** Build a todo tracking system where agents call a `todo_write` tool to track progress on multi-step tasks, with real-time display in both CLI (Ink) and desktop (React/Tailwind) via `todo.update` WS protocol messages
**Depends on:** Phase 31
**Requirements:** [TODO-01, TODO-02, TODO-03, TODO-04, TODO-05, TODO-06, TODO-07]
**Plans:** 3/3 plans complete

Plans:
- [ ] 33-01-PLAN.md -- Gateway todo tool, WS protocol extension, tool registry wiring, system prompt
- [ ] 33-02-PLAN.md -- CLI TodoPanel component and useChat todo.update handler
- [ ] 33-03-PLAN.md -- Desktop TodoPanel component and useChat todo.update handler

### Phase 34: CLI Chat UX Overhaul

**Goal:** CLI chat mimics Claude Code / Kimicode UX — fixed bottom input area that expands as user types, status section pinned below input, streaming responses scroll above, clean separation between user entry zone and conversation history
**Depends on:** None (fresh start)
**Requirements:** [CLIX-01, CLIX-02, CLIX-03, CLIX-04, CLIX-05, CLIX-06, CLIX-07, CLIX-08]
**Plans:** 2/2 plans complete

Plans:
- [ ] 34-01-PLAN.md -- Fullscreen layout skeleton, cursor-aware input zone, bottom status bar
- [ ] 34-02-PLAN.md -- Inline tool calls, approval dialogs, file diffs, todo restyle

## Progress

**Execution Order:**
Phases 30, 32, and 34 can start in parallel (no dependencies). Phase 31 follows 32. Phase 33 follows 31 + 34.

| Phase | Plans | Status |
|-------|-------|--------|
| 30. Ollama Auto-Discovery & Remote Setup | 1/1 | Complete |
| 31. Desktop Chat App Rebuild | 5/5 | Complete |
| 32. Structured Streaming & Chat Formatting | 3/3 | Complete |
| 33. Todo System Display | 3/3 | Complete |
| 34. CLI Chat UX Overhaul | 0/2 | Not started |

### Phase 35: Desktop app UX polish - provider setup flow, agent gating, service UI, Ollama/Venice fixes, gateway controls

**Goal:** Polish desktop app UX with inline provider/service config flows, fix gateway shell controls, fix Ollama discovery and Venice key testing, gate agents behind provider configuration, and replace hardcoded model lists with dynamic provider/model pickers
**Depends on:** Phase 34
**Requirements:** [UXP-01, UXP-02, UXP-03, UXP-04, UXP-05, UXP-06, UXP-07, UXP-08, UXP-09]
**Plans:** 2/3 plans executed

Plans:
- [ ] 35-01-PLAN.md -- Gateway shell fix, provider inline detail pattern, service inline detail pattern
- [ ] 35-02-PLAN.md -- Ollama discovery wiring and Venice key test fix with expanded models
- [ ] 35-03-PLAN.md -- Provider gating for agents, startup check, dynamic model pickers
