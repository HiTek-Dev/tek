# Feature Research: Tek v0.3 Desktop UX & Configuration

**Domain:** AI Agent Desktop Application — Setup, Configuration, Monitoring
**Researched:** 2026-02-22
**Confidence:** MEDIUM-HIGH
**Scope:** First-run onboarding, provider setup, shared services config, async tool handling, sub-process monitoring

## Executive Summary

Tek v0.3 adds the desktop app's critical "getting started" experience and operational visibility. Research shows that 2026 AI agent products expect three patterns:

1. **Goal-first onboarding with escalating autonomy** — Users start with low control, increase as they build trust. This aligns with Tek's "Full Control / Limited Control" modes.

2. **Transparent context and approval workflows** — Real-time visibility into tool execution, background tasks, and system state. This is Tek's core differentiator vs. OpenClaw.

3. **Multi-provider resilience with simple configuration** — Model aliases, fallbacks, and local alternatives (Ollama). LiteLLM patterns show this is industry standard for 2026.

Expected user workflows: 1) First-run detects missing config → onboarding 2) User adds providers and services 3) User creates agents with per-agent settings 4) Async tool calls execute with live monitoring 5) Model switching preserves context.

## Table Stakes (Users Expect These)

Features that make Tek's desktop app feel production-ready. Missing these = "beta feel."

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| First-run detection & onboarding | Tk must guide users through initial setup (API keys, security mode, optional Telegram). No user should land on empty app. | MEDIUM | Requires: flagging first-run state, conditional UI routing, storing onboarding completion state. Uses existing socket/gateway. |
| Provider setup UI (API keys, models, aliases) | Users cannot configure Anthropic/OpenAI/Ollama from CLI when they own a desktop app. Keys must be added visually. | MEDIUM | Form validation, secure key storage (existing Keychain), model alias management. Dependencies: existing provider routing logic. |
| Telegram bot token + whitelist config | For v0.2 Telegram was CLI-only. v0.3 desktop users expect UI to manage it. | MEDIUM | Form + modal, token validation against Telegram API, allowlist management. Dependencies: existing Telegram integration. |
| Model switching with context carry-over option | Users switch models mid-task (e.g., "use Claude Opus for this"). Must preserve conversation history and let user choose to keep/drop context. | MEDIUM | UI selector, context preservation flag sent to gateway, model routing override. Dependencies: existing model routing. |
| Async tool monitoring (right sidebar panel) | When agent runs tools (MCP, search, web, Telegram), user sees: task list, live logs, status (running/done/error), time elapsed. | MEDIUM-HIGH | WebSocket live updates, log streaming, tree/list visualization. Dependencies: existing tool infrastructure, gateway logging. |
| Gateway overview page | Shows gateway status, live gateway logs, manual restart button. Gives users confidence system is healthy. | LOW-MEDIUM | Status check endpoint (existing gateway), log streaming, restart trigger. Simple socket query pattern. |
| Agent config UI (soul/files, model selection) | Users edit per-agent soul/memory files visually or via text editor. Per-agent model and system prompt. | MEDIUM | File editor or text area, persist to ~/.config/tek/agents/[id]/. Dependencies: existing agent system. |

## Differentiators (Competitive Advantage)

Features that set Tek apart from competitors (OpenClaw, Relevance, AnythingLLM, LM Studio).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Transparent approval gates in UI | User sees EVERY tool call before it runs, can skip or modify params. Not just async logging — live inspection before execution. | HIGH | Approval modal on tool call, param editing, skip/approve/deny flow. Dependencies: existing approval system from v0.0, needs socket integration to desktop. |
| Database context dumps before compression | Before agents train on large histories, user can export readable context (CSV, JSON, markdown) to inspect what gets sent. | MEDIUM | Export dialog, format selection, file save. Dependencies: existing database schema. |
| Real-time subprocess monitoring with tree view | Tasks shown hierarchically: main task → subtasks → tool calls. Not just flat log. User sees execution graph. | MEDIUM-HIGH | Tree component (Tauri React or similar), hierarchical log streaming, span-based updates. |
| Sub-provider chaos (fallback strategy UI) | User defines: primary → fallback → fallback model chain. UI shows which fallback is active, why. Rare in desktop apps. | MEDIUM | Chain editor (drag-drop or form), status indicator, failover logs. Dependencies: existing routing layer. |
| Agent personality training interface | User can upload docs/PDFs to "train" agent's knowledge base without fine-tuning. Vector indexing, search. | HIGH | File upload, progress, vector status. Dependencies: existing vector search (sqlite-vec from v0.0). |
| Per-agent model training vs. deployment routing | Separate config: which model to train thinking/planning on vs. which to use for responses. | MEDIUM | Dropdown pair, explanation of trade-offs (cost, speed, quality). |

## Anti-Features (Avoid These)

Features that seem valuable but create problems in Tek's design context.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| "Real-time everything" dashboard | Users think live updates = transparency. But constant WebSocket streaming kills CPU, battery, creates false sense of precision. | Hidden complexity: requires debouncing, careful state mgmt, memory leaks if not done right. Overkill for most tasks. | Show live logs only when user explicitly clicks a task. Lazy-load details. Report status at task completion, not per-token. |
| Drag-drop workflow builder in settings | Looks powerful, seems like table stakes for 2026 agent tools. But it's a separate product (like Zapier). Out of scope. | Massive scope creep. Requires visual DSL, execution engine, error recovery. Tek's workflow builder is already code-first. | Defer to v1.0. Link to workflow builder docs instead. Settings should be data, not flow definition. |
| Multi-user/team permissions model | Teams will ask: "Can I share agents with teammates?" Feels modern. | Single-user is v0.3 assumption. Adding team perms = ACL system, audit log, conflict resolution. Blocks core features for weeks. | Explicitly document: "v0.3 is single-user. Multi-user planned for v1.0." Redirect team requests to roadmap. |
| "Auto-approve trusted tools" rules | Users want to skip approval for safe tools (read-only search). Seems sensible. | Breaks transparency principle. "Trusted" is subjective and context-dependent. A read search from a phishing agent is bad. | Keep approval flow explicit. Offer approval presets ("always approve search", etc.) but require conscious opt-in per agent. |
| Chat history export formats (CSV, Excel, JSON, HTML, PDF) | Users see other apps export in multiple formats. Feels complete. | Each format = another test matrix, another bug surface, another serialization edge case. 80/20: most users never export. | Export JSON only. Users can convert with CLI tools if needed. |

## Feature Dependencies

```
Onboarding Flow
    ├──requires──> First-Run Detection
    └──requires──> Provider Setup UI
                       └──requires──> Secure Key Storage (✓ exists)

Model Switching
    ├──requires──> Provider Setup UI (to add models)
    └──enhances──> Agent Config UI
                       └──requires──> Agent routing logic (✓ exists)

Async Tool Monitoring
    ├──requires──> WebSocket streaming from gateway
    │                   └──requires──> Gateway logging enhancement
    └──enhances──> Approval Gates in UI
                       └──requires──> Tool call interception (✓ exists from v0.0)

Telegram Config UI
    ├──requires──> Telegram integration (✓ exists from v0.2)
    └──requires──> Allowlist storage/validation

Gateway Overview
    ├──requires──> Status endpoint (new)
    └──requires──> Log streaming (new)

Agent Config UI
    ├──requires──> File system access (✓ Tauri has this)
    └──enhances──> Agent personality training
                       └──requires──> Vector indexing (✓ sqlite-vec)

Database Context Dumps
    └──requires──> Connection to local db (✓ exists)

Sub-Provider Fallback UI
    ├──requires──> Provider Setup UI
    └──requires──> Provider routing logic (✓ exists)

Agent Personality Training
    ├──requires──> File upload (new)
    └──requires──> Vector indexing (✓ exists)
    └──requires──> Document processing (new or MCP)
```

### Dependency Notes

- **First-Run Detection requires Onboarding Flow**: User can't be onboarded without first-run flag. Must check: ~/.config/tek/has-run or similar.
- **Provider Setup UI prerequisite for Model Switching**: Can't switch models if no providers are configured.
- **Async Tool Monitoring requires WebSocket streaming**: Gateway must push tool execution events in real-time. Requires new gateway logging enhancement.
- **Approval Gates depend on existing tool infrastructure**: v0.0 already has approval system (CLI + Telegram). Desktop UI just wraps it.
- **Agent Config UI depends on file access**: Tauri's fs module already supports this. No new infrastructure needed.
- **Telegram Config needs Telegram integration**: v0.2 Telegram bot exists. UI just manages token + allowlist config.
- **Conflicts**: Agent personality training (ML-heavy) should NOT run during onboarding. It should be optional post-setup.

## Feature Category Breakdown

### Onboarding & Setup (v0.3 Phase 1)

**User flow:**
1. App launches
2. First-run detection → show onboarding modal
3. Choose security mode (Full Control vs Limited Control)
4. Add primary provider (Anthropic API key)
5. Optional: Add secondary providers
6. Optional: Set up Telegram bot
7. Create first agent or load from defaults
8. Start chatting

**Features in this category:**
- First-run detection
- Security mode selection (re-use existing modes)
- Provider setup (Anthropic, OpenAI, Ollama)
- Telegram optional setup
- Initial agent creation or template selection

**Complexity:** MEDIUM (mostly UI wiring, reuses existing auth/provider logic)
**Risk:** None — reuses validated patterns from v0.0-v0.2

### Configuration & Management (v0.3 Phase 1-2)

**Features:**
- Providers page: Add/edit/delete API keys, model aliases, fallback chains
- Telegram settings: Token, allowlist, deny list
- Agent config: Soul, system prompt, model selection, training mode
- Gateway settings: Restart, status check

**Complexity:** MEDIUM-HIGH (form validation, state mgmt, file I/O)
**Risk:** Key storage security, model routing validation

### Async Tool Monitoring (v0.3 Phase 2-3)

**User flow:**
1. User sends message
2. Agent executes multi-step workflow
3. Right sidebar shows: "Thinking..." → "Searching the web..." → "Approving tool call..." → "Done"
4. Each step is clickable, shows logs
5. Tool calls show params and results
6. Errors show stack trace

**Features:**
- Async task queue visualization (right sidebar)
- Live log streaming
- Task tree view (hierarchical)
- Tool call inspection + approval modal
- Error details + retry options
- Sub-process monitoring (spawned subprocesses, MCP servers)

**Complexity:** HIGH (real-time updates, tree rendering, log management)
**Risk:** WebSocket connection stability, memory leaks with constant updates

### Model & Context Management (v0.3 Phase 3)

**Features:**
- Model selector in chat header
- Context carry-over toggle (on model switch)
- Provider fallback indicator (which model actually ran)
- Database context dumps (export conversation as JSON/markdown)
- Model training vs. deployment config (per agent)

**Complexity:** MEDIUM (mostly UI selectors + context preservation logic in gateway)
**Risk:** None — reuses existing routing, just adds visibility

## MVP Definition

### Launch With v0.3.0

Minimum viable product for desktop setup & configuration. Users can:
- Start the app, get guided through onboarding
- Add API keys without touching files
- Create agents with custom models
- See async tools running in real time
- Restart gateway if needed

**Must have:**
- [x] First-run detection
- [x] Onboarding flow (security mode, provider setup)
- [x] Provider setup UI (Anthropic, OpenAI, Ollama)
- [x] Telegram token config UI
- [x] Async tool monitoring (live logs, status)
- [x] Gateway overview + restart
- [x] Agent config UI (model selection, soul editing)
- [x] Model switching with context carry-over option

**Complexity:** Medium. All features reuse existing backend infrastructure.

### Add in v0.3.1 (Post-Launch Refinement)

After v0.3.0 validation:
- Sub-provider fallback UI (manage fallback chains visually)
- Real-time approval modal for tool calls (vs. async approval)
- Database context dumps (export conversation)
- Better error messages + retry UX

### Future (v1.0+)

Defer until core is stable:
- Agent personality training (upload docs, vector indexing)
- Multi-workspace support
- Per-agent model training vs. deployment routing
- Team/multi-user permissions
- Workflow builder in UI (vs. code-first)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Phase |
|---------|------------|---------------------|----------|-------|
| First-run detection | HIGH | LOW | P1 | v0.3.0 |
| Onboarding flow | HIGH | MEDIUM | P1 | v0.3.0 |
| Provider setup UI | HIGH | MEDIUM | P1 | v0.3.0 |
| Telegram config UI | MEDIUM | MEDIUM | P1 | v0.3.0 |
| Async tool monitoring | HIGH | HIGH | P1 | v0.3.0 |
| Gateway overview | MEDIUM | LOW | P1 | v0.3.0 |
| Agent config UI | HIGH | MEDIUM | P1 | v0.3.0 |
| Model switching + context | HIGH | MEDIUM | P1 | v0.3.0 |
| Approval modal (real-time) | HIGH | MEDIUM | P2 | v0.3.1 |
| Sub-provider fallback UI | MEDIUM | MEDIUM | P2 | v0.3.1 |
| Database context dumps | MEDIUM | MEDIUM | P2 | v0.3.1 |
| Agent personality training | MEDIUM | HIGH | P3 | v1.0 |
| Multi-workspace | LOW | HIGH | P3 | v1.0 |
| Workflow UI builder | LOW | VERY HIGH | P3 | v1.0+ |

## Competitor Feature Analysis

How similar products in 2026 handle these features:

| Feature | OpenClaw | Claude Desktop | LM Studio | Tek Approach |
|---------|----------|----------------|-----------|--------------|
| **Onboarding** | CLI setup, config files | Web-based setup, VS Code integration | Simple launcher, local defaults | Goal-first modal with security mode choice |
| **Provider config** | CLI commands, JSON files | Not applicable (Anthropic-only) | Web UI form | Visual form, secure key storage (Keychain), model aliases |
| **Telegram setup** | CLI config, token file | N/A | N/A | Visual form, @BotFather link, allowlist UI |
| **Tool monitoring** | JSON logs, tail -f | Per-step inline display | Chat bubble, hidden background | Real-time sidebar tree, approval gates, live logs |
| **Model switching** | Manual re-config restart | Context retained automatically | Chat selector | Selector in header, explicit context carry-over toggle |
| **Async tool approval** | CLI "approve" command or Telegram | Not user-facing | Not applicable | Real-time modal with param inspection |
| **Gateway restart** | `openclaw gateway restart` (CLI) | N/A | N/A | UI button with status check |
| **Agent config** | SOUL.md file, MEMORY.md file | N/A | Chat settings | Visual UI for soul/prompt, model per-agent |

**Key differentiators for Tek v0.3:**
1. **Approval gates in the UI** — Not just logging, live inspection + skip/modify/approve
2. **Context visibility** — Users see what gets sent to models (database dumps)
3. **Async monitoring tree** — Hierarchical task view, not flat logs
4. **Security modes preserved** — Full Control vs Limited Control built into onboarding
5. **Multi-provider resilience** — Fallback chains visible and testable

## Industry Patterns & 2026 Trends

### Goal-First Onboarding (Key 2026 Pattern)
Modern AI apps (2026 research) show that outcome-focused onboarding beats feature tours. Instead of "here's the sidebar," users should see: "What do you want to do?" (chat, automate, search). Tek's approach: lead with security mode choice, then "Add your API key," then "Start chatting." ✓ Aligned.

### Escalating Autonomy
Users start with low autonomy (Full Control: approve every action), increase as trust grows (Limited Control: auto-approve safe operations). 2026 agents expect this as standard. Tek already has this pattern from v0.0. ✓ Aligned.

### Transparency Without Bombarding
Users want to see what's happening, but not 100 log lines per second. Solution: Show summaries, allow drill-down on demand. Tek's right sidebar monitoring with clickable details follows this. ✓ Aligned.

### Multi-Provider Resilience
LiteLLM (100K+ users) shows: teams standardize on fallback chains. Primary Claude (cost), fallback GPT-4 (if Claude times out), fallback Ollama (local). Tek's provider setup should surface this pattern.

### Local-First + Cloud Hybrid
2026 products offer: run locally (Ollama, LM Studio) or cloud (Anthropic, OpenAI). Users want simple switching. Tek's Ollama support + multi-provider is standard here.

## Expected User Workflows (Personas)

### Developer (Power User)
1. Install Tek
2. Onboarding: Choose "Full Control" mode
3. Add: Anthropic API key, Brave API key, Telegram bot token
4. Configure: 1 agent with custom system prompt
5. Usage: Chat → see async tools → approve complex operations → export logs for debugging
6. Benefit: Transparent control over everything

### Non-Technical User (Cautious)
1. Install Tek
2. Onboarding: Choose "Limited Control" mode
3. Add: Anthropic API key only
4. Use defaults: 1 agent, standard model
5. Usage: Chat → system handles approvals automatically
6. Benefit: Simple, safe, no decisions

### AI Researcher
1. Install Tek
2. Onboarding: Full Control
3. Add: Multiple providers (Anthropic, OpenAI, Ollama)
4. Configure: Model fallback chain for cost optimization
5. Usage: Chat → switch models mid-task → export context for analysis
6. Benefit: Test multiple models, preserve research context

## Implementation Priority & Phase Notes

### Phase 1 (v0.3.0 — Core Setup & Monitoring)
Focus: Unblock first-time users, give visibility into async operations.

**Dependencies on existing features:**
- First-run detection: Use existing config file path (`~/.config/tek/version`)
- Onboarding: Reuse security modes from v0.0
- Provider setup: Reuse existing provider routing + Keychain
- Async monitoring: New WebSocket topic from gateway for tool events
- Gateway status: New `/status` endpoint

**Estimated complexity:** Medium (mostly UI wiring)

### Phase 2 (v0.3.1 — Polish & Approval)
Focus: Real-time approvals, better error handling.

**New features:**
- Real-time approval modal with param editing
- Sub-provider fallback UI
- Database context dumps
- Better error messages + retry

**Estimated complexity:** Medium-High

### Phase 3+ (v1.0 — Advanced)
Defer: Agent training, multi-workspace, workflow UI builder.

## Data Sources & Research Confidence

**HIGH confidence areas:**
- First-run onboarding patterns: Supported by UserGuiding, LogRocket design patterns
- Provider setup UI & API key security: Confirmed by Google Cloud, OneUpTime, API Stronghold
- Async task monitoring patterns: LiteLLM, LogRocket article on UI patterns for async workflows
- Real-time logging: Braintrust, Langfuse observability patterns
- Model routing & fallbacks: LiteLLM docs, OpenRouter docs, Portkey patterns

**MEDIUM confidence areas:**
- Agent config UI specifics: Inferred from HubSpot Breeze, OpenAI Agent Builder, Freshdesk patterns
- Subprocess monitoring: Observed in LangWatch, AgentOps, but limited public docs on desktop UI
- Context preservation on model switch: MCP protocol defines standards, but user workflow varies

**LOW confidence areas:**
- Database dump UI patterns: Limited public examples (mostly backend documentation)
- Agent personality training UX: Inferred from training dashboards, needs validation

## Source References

**Onboarding & Setup:**
- [UserGuiding: What is an Onboarding Wizard](https://userguiding.com/blog/what-is-an-onboarding-wizard-with-examples)
- [LogRocket: Creating setup wizards](https://blog.logrocket.com/ux-design/creating-setup-wizard-when-you-shouldnt/)
- [Smashing Magazine: Designing Agentic AI UX Patterns](https://www.smashingmagazine.com/2026/02/designing-agentic-ai-practical-ux-patterns/)

**Provider & API Key Management:**
- [Google Cloud: API Key Best Practices](https://docs.cloud.google.com/docs/authentication/api-keys-best-practices)
- [OneUpTime: API Key Management Best Practices 2026](https://oneuptime.com/blog/post/2026-02-20-api-key-management-best-practices/view)
- [API Stronghold: Multi-Provider API Key Management](https://www.apistronghold.com/blog/the-complete-guide-to-multi-provider-api-key-management)

**Async Tool Monitoring:**
- [LogRocket: UI Patterns for Async Workflows](https://blog.logrocket.com/ui-patterns-for-async-workflows-background-jobs-and-data-pipelines/)
- [OneUpTime: Implement Async Processing Patterns 2026](https://oneuptime.com/blog/post/2026-01-25-implement-async-processing-patterns/view)
- [Braintrust: Best LLM Monitoring Tools 2026](https://www.braintrust.dev/articles/best-llm-monitoring-tools-2026)

**Model Routing & Fallbacks:**
- [LiteLLM: Routing, Load Balancing & Fallbacks](https://docs.litellm.ai/docs/routing-load-balancing)
- [LogRocket: LLM Routing in Production](https://blog.logrocket.com/llm-routing-right-model-for-requests/)
- [Portkey: Failover Routing Strategies](https://portkey.ai/blog/failover-routing-strategies-for-llms-in-production/)

**Telegram Integration:**
- [Home Assistant: Telegram Bot Integration](https://www.home-assistant.io/integrations/telegram_bot/)
- [OpenClaw Docs: Telegram Setup & Multi-Agent](https://macaron.im/blog/openclaw-telegram-bot-setup)
- [Telegram Core: Bots API](https://core.telegram.org/bots)

**Agent Configuration & Personality:**
- [HubSpot Breeze Agent Configuration](https://www.eesel.ai/blog/breeze-agent-configuration)
- [OpenAI Agent Builder Guide](https://generect.com/blog/openai-agent-builder)
- [Freshdesk AI Training](https://www.eesel.ai/blog/freshdesk-ai-assistant-training)

**Context & Model Switching:**
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- [AI Context Switching & Preservation](https://plurality.network/blogs/universal-ai-context-to-switch-ai-tools/)
- [Cursor: Project Switching in AI Memory](https://egghead.io/context-mastering-project-switching-in-cursors-ai-memory-system~fiyzv)

**Desktop App Patterns:**
- [Claude Desktop App Documentation](https://code.claude.com/docs/en/desktop)
- [Claude Desktop for Windows 2026](https://www.pasqualepillitteri.it/en/news/260/claude-desktop-windows-cowork-guide)
- [Ollama Desktop App GUI Options 2026](https://askimo.chat/blog/best-ollama-clients-2026/)

**Approval Workflows:**
- [Microsoft: Human-in-the-Loop with AG-UI](https://learn.microsoft.com/en-us/agent-framework/integrations/ag-ui/human-in-the-loop)
- [Dapr: Workflow Patterns](https://docs.dapr.io/developing-applications/building-blocks/workflow/workflow-patterns/)

---

**Feature research for:** Tek v0.3 Desktop UX & Configuration
**Researched:** 2026-02-22
**Updated:** 2026-02-22
