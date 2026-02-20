# Milestones

## v0.0: Core Infrastructure (Phases 1-24)

**Shipped:** 2026-02-20
**Phases:** 24
**Plans completed:** 36

Built the complete agent platform foundation:
- Gateway with WebSocket hub, session management, multi-provider LLM routing
- CLI with Ink-based chat, streaming, slash commands, tool approval
- Desktop app (Tauri) with dashboard, chat, agents, settings
- Telegram bot with pairing, transport, inline keyboard approvals
- Memory system (SOUL.md, MEMORY.md, daily logs, vector search)
- Tool infrastructure (MCP, built-in tools, skills, approval gates)
- Workflow engine with DAG execution, heartbeat, scheduler
- Multi-provider support (Anthropic, OpenAI, Ollama, Venice, Google)
- Smart model routing with complexity-based tier selection
- Install/update/dist pipeline with CDN distribution
- Agent personality system with multi-agent support
- Security: macOS Keychain, bearer auth, tiered approvals

**Last phase:** 24 (Tools Actually Working)
**App version at completion:** 0.0.24

---

## v0.1: Product Polish (Phases 25+) — IN PROGRESS

**Started:** 2026-02-20
**Goal:** Transform from functional infrastructure into polished product experience.

**Focus areas:**
- CLI visual overhaul (Claude Code-level terminal UI)
- Desktop app visual overhaul (Claudia-level web UI)
- Architecture cleanup (circular dependency fix)
- Testing foundation
