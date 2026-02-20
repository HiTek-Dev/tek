# Tek

## What This Is

A product-grade, self-hosted AI agent platform that serves as a unified gateway for managing AI agents across CLI, web dashboard, and Telegram. Inspired by OpenClaw's architecture but rebuilt with transparency, security, and polish — designed for daily use managing development work, business operations, and personal tasks. Built to eventually become a product others can run.

## Core Value

Every interaction with your AI agent is transparent, secure, and under your control — you see exactly what's being sent, what tools are running, and can approve or skip permissions at any granularity.

## Requirements

### Validated

<!-- Shipped in v0.0.1–v0.0.24 (Phases 1-24) -->

- ✓ Agent gateway with WebSocket hub, session isolation, Fastify server — Phase 1-2
- ✓ CLI interface with Ink-based chat, streaming, slash commands — Phase 3
- ✓ Multi-provider support — Anthropic, OpenAI, Ollama, Venice AI, Google Gemini — Phase 4, 12
- ✓ Smart model routing — complexity-based tier selection with user overrides — Phase 4
- ✓ Soul/memory system — SOUL.md personality, MEMORY.md, daily logs, vector search (sqlite-vec) — Phase 5, 16
- ✓ Tool infrastructure — MCP integration, built-in tools, skill discovery, approval gates — Phase 6
- ✓ Self-debugging — step inspection, skill drafting, terminal proxy — Phase 7
- ✓ Workflow builder — DAG-style steps, durable execution, heartbeat/scheduler — Phase 8
- ✓ Telegram bot integration — pairing, transport, tool approval via inline keyboard — Phase 9
- ✓ Claude Code relay — session management, approval proxy, run-to-completion — Phase 10
- ✓ Web search (Tavily, Brave) + image generation (OpenAI, Stability, Venice) — Phase 10, 23
- ✓ Google Workspace integration — Gmail, Drive, Calendar, Docs tools — Phase 10
- ✓ Browser automation via Playwright MCP — Phase 10
- ✓ Install/update/dist pipeline — CDN distribution, one-line install — Phase 11
- ✓ Secure API key management — macOS Keychain, bearer auth, key serving — Phase 1
- ✓ Rebrand from AgentSpace to Tek — Phase 13
- ✓ Onboarding with Full Control / Limited Control modes — Phase 14-15
- ✓ Agent personality system — multi-agent, per-agent soul/memory/identity — Phase 16, 21-22
- ✓ Desktop app (Tauri) — dashboard, chat, agents, settings pages — Phase 17, 19
- ✓ Session management with transparent context — Phase 2
- ✓ Heartbeat system — configurable cron-based check-ins — Phase 8
- ✓ Pre-flight thinking — checklist generation before complex operations — Phase 6
- ✓ Approval center — tiered approval (auto/session/always) with CLI + Telegram UI — Phase 6, 9

### Active

## Current Milestone: v0.1 Product Polish

**Goal:** Transform Tek from functional infrastructure into a polished, product-grade experience — CLI that feels like Claude Code, desktop app that feels like Claudia.

**Target features:**
- CLI visual overhaul (StatusBar, MessageBubble, InputBar, collapsible sections, syntax highlighting)
- Desktop app visual overhaul (markdown rendering, tool approval UI, conversation history, design system)
- Architecture cleanup (extract vault, fix circular dependency)
- Testing foundation (WS protocol, agent loop, router, config tests)
- Quick wins (error boundaries, auto-reconnect, empty states, timestamps)

### Out of Scope

- Mobile apps (iOS/Android) — web-first, native mobile later
- WhatsApp/Discord/Slack/iMessage channels — Telegram first, expand later
- Multi-user/team features — single-user focus for v1
- Cloud hosting/SaaS — self-hosted only for now
- Custom model training/fine-tuning — use existing models

## Context

### Reference Architecture — OpenClaw

AgentSpace draws architectural inspiration from OpenClaw (github.com/openclaw/openclaw), a mature multi-channel AI gateway. Key patterns adopted and improved:

**Adopted patterns:**
- Gateway as central WebSocket-based hub routing all communication
- Session isolation keyed by agent and context (`agent:{id}:{key}`)
- Two-tier memory: daily markdown logs + curated long-term memory file
- Skills as directories with metadata frontmatter + instruction documents
- Auth profile rotation with cooldown/failover for rate-limited keys
- Heartbeat system with configurable intervals and delivery targets
- Channel plugin architecture for messaging platform integration

**Improvements over OpenClaw:**
- **Transparent context**: OpenClaw sends up to 7 bootstrap files (24K chars) plus conversation history with no visibility into what's sent. AgentSpace shows every byte going to the model.
- **Secure key storage**: OpenClaw stores API keys in plain JSON files. AgentSpace uses encrypted storage with the ability to serve keys to local development projects.
- **CLI experience**: OpenClaw uses a custom TUI framework. AgentSpace adopts Claude Code's approach — showing bash commands, tool calls, and reasoning inline.
- **Approval UX**: OpenClaw manages approvals via CLI commands and JSON files. AgentSpace provides a web dashboard with notification system.
- **Workflow system**: OpenClaw's Lobster runtime is a separate plugin. AgentSpace integrates workflow building as a first-class feature with visual, code, and conversational creation.
- **Context efficiency**: OpenClaw's bootstrap + soul + memory + skills creates bloated prompts. AgentSpace streamlines what gets sent and makes each piece visible and controllable.
- **Onboarding**: OpenClaw has a setup wizard. AgentSpace has explicit "Full Control" vs "Limited Control" modes with clear security boundaries.

### Technical References

- **OpenClaw source**: `/tmp/openclaw/` (cloned for architectural study)
- **GSD build system**: github.com/gsd-build/get-shit-done (used for building this project)
- **Claude Code CLI**: Reference for CLI UX patterns (inline tool display, bash command visibility)

### Design Principles

1. **Transparency over magic** — every step visible, every context byte accounted for
2. **Security by default** — encrypted keys, sandboxed modes, explicit permissions
3. **Iterative delivery** — gateway + CLI first, then GUI, then Telegram, then expand
4. **Product-grade from day one** — clean code, proper error handling, no half-finished features
5. **Agent self-improvement** — agents can debug themselves and extend their own capabilities
6. **Companion to developer tools** — works alongside Claude Code, opencode, and other coding tools

## Constraints

- **Build system**: Using GSD (get-shit-done) for project management and execution
- **Platform priority**: macOS first (Darwin), Linux support planned
- **Tech stack**: Research-driven — will be determined during research phase
- **Architecture**: Monorepo structure inspired by OpenClaw but cleaner separation
- **Security**: API keys must never be stored in plain text config files
- **Context management**: Every piece of context sent to models must be visible and controllable by the user

## Build & Deploy Workflow

**All builds happen on the dev machine, distribute to CDN, install on sandbox/target machines via curl.**

### Procedure (after code changes):

1. **Build dist locally** (dev machine):
   ```bash
   bash scripts/dist.sh
   ```
   This builds all backend packages (core, db, cli, gateway, telegram), builds the Tauri desktop app, creates `dist/tek-backend-arm64.tar.gz` + DMG + `version.json`.

2. **Upload to CDN**:
   ```bash
   bash scripts/upload-cdn.sh
   ```
   Pushes artifacts to `tekpartner.b-cdn.net/tek/dist/`.

3. **Install on sandbox/target machine**:
   ```bash
   curl -fsSL https://tekpartner.b-cdn.net/tek/dist/install.sh | bash
   ```

### Important Notes:
- `scripts/update.sh` only rebuilds backend packages — it does NOT rebuild the Tauri desktop app
- The desktop app (Tek.app) is bundled by Tauri during `dist.sh` — source changes to `apps/desktop/src/` require a full `dist.sh` build to take effect
- After every phase execution that touches code, run `dist.sh` → `upload-cdn.sh` before testing on sandbox
- Config/data at `~/.config/tek/` is preserved across installs — never overwritten

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Inspired by OpenClaw, not forked | OpenClaw is mature but messy — clean rebuild gives us control over quality and architecture | — Pending |
| Gateway + CLI first | Core agent loop must work reliably before adding UI layers | — Pending |
| Telegram as first messaging channel | Simplest setup (bot token), good mobile coverage, user already uses it | — Pending |
| Research-driven tech stack | Don't assume TypeScript — let research determine best fit for our goals | — Pending |
| Full Control vs Limited Control modes | Product needs to serve both power users and cautious users from day one | — Pending |
| Encrypted API key storage | Security is a core differentiator over OpenClaw's plain file approach | — Pending |
| Claude Code-style CLI over custom TUI | Better UX pattern — shows real commands and reasoning, not a chat bubble interface | — Pending |

---
*Last updated: 2026-02-20 after milestone v0.1 start*
