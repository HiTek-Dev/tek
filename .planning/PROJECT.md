# AgentSpace

## What This Is

A product-grade, self-hosted AI agent platform that serves as a unified gateway for managing AI agents across CLI, web dashboard, and Telegram. Inspired by OpenClaw's architecture but rebuilt with transparency, security, and polish — designed for daily use managing development work, business operations, and personal tasks. Built to eventually become a product others can run.

## Core Value

Every interaction with your AI agent is transparent, secure, and under your control — you see exactly what's being sent, what tools are running, and can approve or skip permissions at any granularity.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Agent gateway that routes between models, manages sessions, and coordinates tools
- [ ] CLI interface styled after Claude Code — showing bash commands, tool calls, and every step
- [ ] Web dashboard for configuration, monitoring, and approval management
- [ ] Telegram bot integration for mobile communication with agents
- [ ] Soul/memory system — evolving personality + two-tier memory (daily logs + long-term)
- [ ] Skill system — directory-based plugins with workspace/managed/bundled tiers
- [ ] Secure API key management — encrypted storage, not plain config files
- [ ] Multi-provider support — Anthropic, OpenAI, Ollama (local/network/cloud)
- [ ] Session management with transparent context — show what's being sent to the model
- [ ] Heartbeat system — configurable periodic check-ins with clear control UI
- [ ] Approval center — web-based dashboard for permissions with per-task skip/ask controls
- [ ] OS-level control capabilities — file system access, admin controls in designated folders
- [ ] Workflow builder — visual, code-based, and conversational creation of step-by-step agent logic (pass/fail/decision branching)
- [ ] Browser automation — starting with Playwright MCP, expanding to Chrome extension-style control
- [ ] Terminal proxy — interactive mode for running CLI apps (claude code, opencode, etc.)
- [ ] Image generation skills — connecting to major APIs (DALL-E, Midjourney, Stability, etc.)
- [ ] Web search — API-based search and model-integrated search capabilities
- [ ] Self-debugging — agents can inspect their own steps and add to their own skills
- [ ] Google Workspace integration — Gmail, Drive, Calendar, Docs connectivity
- [ ] Smart model routing — swap to high-thinking models for planning, budget models for simple tasks
- [ ] Onboarding with control modes — "Full Control" (OS-level access) vs "Limited Control" (sandboxed workspace)
- [ ] Notification system — native macOS app companion or web browser notifications
- [ ] Secure input channels — only official Telegram bot or RDC-like system can send signals
- [ ] API key serving — ability to serve keys to local apps so projects can reference AgentSpace's encrypted store at build time
- [ ] Pre-flight thinking — built-in logic paths to walk through proper preparation checklists before executing complex requests

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
*Last updated: 2026-02-15 after initialization*
