# Research Summary: Tek v0.3 Desktop UX & Configuration

**Domain:** AI Agent Desktop Application — Setup, Configuration, Monitoring
**Researched:** 2026-02-22
**Overall Confidence:** MEDIUM-HIGH

## Executive Summary

Tek v0.3 aims to bring setup, configuration, and operational monitoring into the desktop app. Research across 2026 AI agent tools, onboarding patterns, and async workflow UX shows that users expect:

1. **Goal-first onboarding with escalating autonomy** — Start simple (security mode choice, one API key), increase complexity as users build trust. This aligns perfectly with Tek's existing "Full Control / Limited Control" philosophy.

2. **Transparent, real-time visibility into async operations** — When tools run, users see what's happening: task list, live logs, hierarchical execution tree, and approval gates before execution. This is Tek's core differentiator vs. OpenClaw (which just logs).

3. **Multi-provider resilience as a first-class feature** — Model aliases, fallback chains (primary → secondary → local), and simple provider switching are now standard (LiteLLM, OpenRouter). Users expect to see which model actually ran.

4. **Context preservation across model switches** — Users switch models mid-conversation and expect history to be retained. The Model Context Protocol standard (MCP) makes this architectural norm in 2026.

**Key finding:** v0.3's features are largely "UI wrappers" around existing backend infrastructure (provider routing, tool approval, Telegram, gateway). The main work is: 1) WebSocket enhancements for real-time tool events, 2) First-run detection flag, 3) Desktop forms for key/config management. Low-risk, high-value set of features.

## Key Findings

### Stack Implications
- **No new tech required** — Reuse existing Tauri + React + TypeScript stack
- **Gateway enhancement needed** — Add WebSocket topic for tool execution events (currently not streamed to UI)
- **Status endpoint required** — `/status` for gateway health check (currently missing)
- **First-run flag** — Simple config file check: `~/.config/tek/config.json` has `has_run: true`

### Architecture Implications
- **Sidebar-based navigation** — Claude Desktop and Ollama both use left sidebar for nav + settings. Follow that pattern: Chat | Agents | Settings | Gateway
- **Async monitoring panel** — Right sidebar shows hierarchical task tree (task → subtasks → tool calls). WebSocket-driven updates. Avoid constant polling.
- **Modal-based approval** — When tool call requires approval, modal appears over chat. User inspects params, can modify, approve/deny/skip.
- **Configuration as data** — Providers, Telegram token, agent settings stored as JSON in `~/.config/tek/`. Desktop UI reads/writes directly.

### Feature Categories (by dependency order)
1. **Onboarding & Setup** — First-run detection → security mode → provider setup → optional Telegram
2. **Configuration Management** — Provider CRUD, Telegram settings, agent config (soul/model)
3. **Async Tool Monitoring** — Real-time task tree, live logs, tool call inspection
4. **Model & Context Management** — Model selector, context carry-over toggle, database dumps

### Complexity Assessment
- **Low complexity (reuses existing patterns):** First-run detection, Telegram config, gateway overview
- **Medium complexity (form + file I/O):** Provider setup, agent config, model switching
- **High complexity (real-time UI + state mgmt):** Async tool monitoring with tree view, real-time approval modal

### Table Stakes vs. Differentiators
**Table stakes (non-negotiable):**
- First-run onboarding (users can't set up via CLI when desktop app exists)
- Provider setup UI (API keys, model selection)
- Agent config (model, soul file)
- Async tool monitoring (what's actually running?)

**Differentiators (set Tek apart):**
- Real-time approval modal with param inspection (vs. async approval)
- Hierarchical task tree (vs. flat logs)
- Database context dumps (show exactly what gets sent to model)
- Sub-provider fallback UI (show why fallback model was used)

### Pitfalls to Avoid
- ❌ "Real-time everything" — Don't stream every token. Show summaries, drill-down on click.
- ❌ Drag-drop workflow builder — Out of scope. Redirect to code-first builder.
- ❌ Multi-user permissions — Save for v1.0. Explicitly single-user in v0.3.
- ❌ "Auto-approve trusted tools" — Breaks transparency. Keep approvals explicit.
- ❌ Multiple export formats — JSON only. Users can convert externally.

## Implications for Roadmap

Based on research, suggested phase structure for v0.3:

### Phase 1: Core Setup & Visibility (v0.3.0)
**Goal:** Unblock first-time desktop users, give real-time visibility into operations.

**Features to build:**
1. First-run detection + onboarding flow
2. Provider setup UI (Anthropic, OpenAI, Ollama)
3. Telegram config UI (token + allowlist)
4. Async tool monitoring (right sidebar with task tree)
5. Gateway overview + restart
6. Agent config (model selection, soul editing)
7. Model switching with context carry-over toggle

**Dependencies addressed:**
- ✓ Onboarding depends on first-run flag → add to config
- ✓ Provider setup reuses existing routing logic → just UI
- ✓ Tool monitoring requires WebSocket topic for tool events → add gateway event stream
- ✓ Agent config reuses existing file I/O → Tauri fs module
- ✓ Model switching reuses existing routing → just add UI toggle

**Rationale:** These are all prerequisite features. Can't ship desktop app without onboarding. Can't have users blindly approve tool calls without seeing what's running. Addresses "table stakes" features entirely.

**Risk:** LOW. All reuse existing validated infrastructure.

### Phase 2: Polish & Approval (v0.3.1)
**Goal:** Add real-time approval gates, better error handling, advanced monitoring.

**Features to build:**
1. Real-time approval modal (tool call inspection + param editing)
2. Sub-provider fallback chain UI
3. Database context dumps (export conversation as JSON/markdown)
4. Error details + retry UX
5. Subprocess spawning visibility

**Dependencies addressed:**
- ✓ Approval modal wraps existing v0.0 approval system
- ✓ Fallback UI reuses provider logic
- ✓ Context dumps query existing database

**Rationale:** Polish phase after v0.3.0 validation. Real-time approvals are the killer differentiator. Defer to ensure core works first.

**Risk:** MEDIUM. Real-time modal requires careful WebSocket state management.

### Phase 3+: Advanced (v1.0+)
**Goal:** Model training, multi-workspace, team features.

**Defer to v1.0:**
- Agent personality training (upload docs, vector indexing)
- Multi-workspace/team permissions
- Per-agent model training vs. deployment split
- Workflow builder in UI (vs. code-first)

**Rationale:** These are high-complexity features without clear user demand in v0.3 window. Better to validate core setup UX first.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Onboarding patterns** | HIGH | UserGuiding, LogRocket, Smashing Magazine 2026 all align on goal-first + escalating autonomy |
| **Provider setup UX** | HIGH | Google Cloud, OneUpTime, API Stronghold confirm best practices. Tek's approach matches industry standard. |
| **Telegram integration** | MEDIUM-HIGH | Home Assistant, OpenClaw, Telegram docs confirm patterns. Specific desktop UX less documented. |
| **Async monitoring UI** | MEDIUM-HIGH | LogRocket article on async workflows + Braintrust/Langfuse observability confirm patterns. Hierarchical tree view less common in desktop, but validates well. |
| **Model switching & context** | MEDIUM | MCP protocol standard is clear. User workflow inference based on Claude Desktop, Cursor. Some uncertainty on context carry-over UX details. |
| **Approval modal UX** | MEDIUM | Microsoft AG-UI and workflow approval patterns exist. Specific real-time + param-editing approach less documented. |
| **Sub-provider fallback UI** | MEDIUM | LiteLLM, OpenRouter, Portkey confirm routing patterns. Visual UI for fallback chains less common — may need user testing. |
| **Database context dumps** | MEDIUM | PostgreSQL, Oracle docs cover technical side. UI/UX patterns barely documented — likely needs iteration. |

## Gaps to Address

### Needs Phase-Specific Research (v0.3 sprints)
- **Real-time approval modal UX:** Need to validate param editing flow, approval decision workflow
- **Task tree visualization:** Confirm hierarchy depth (task → step → tool call → result?) through user testing
- **Sub-provider fallback visibility:** Confirm users want to see "why this fallback ran" vs. just auto-switching silently
- **Telegram allowlist UX:** Confirm Telegram user ID validation + deny list workflow
- **Agent soul/file editing:** Validate text editor vs. form vs. markdown preview approach

### Dependency Validation Needed
- **WebSocket tool event stream:** Confirm gateway can emit `tool.started`, `tool.ended`, `tool.error` events without breaking existing connections
- **First-run detection:** Validate config file path and fallback logic if ~/.config/tek/ doesn't exist yet
- **Model context carry-over:** Confirm conversation history is accessible to gateway when switching models (may need new query)

### User Research Gaps
- Do users want "drill-down on demand" (fast UI, lazy logs) or "real-time everything" (CPU-intensive)?
- For approval modal: prefer param editing UI or JSON view?
- Context dumps: JSON export, markdown, CSV, or just JSON?

## Roadmap Ordering Rationale

**Why this order:**
1. **Onboarding first** — Blocking issue. Can't ship desktop without first-run guidance.
2. **Provider setup + Telegram** — Unblock users from CLI-only workflows. High user value, low risk.
3. **Async monitoring** — Transparency differentiator. High effort but validates core execution.
4. **Model switching** — Completes provider feature set. Users need this to explore fallbacks.
5. **Real-time approvals (v0.3.1)** — Killer feature but can validate async monitoring first.

**Why defer agent training to v1.0:**
- Requires document processing (OCR for PDFs? MCP server?)
- Vector indexing needs testing
- No clear "minimum" scope — could open huge feature scope

**Why defer multi-workspace/teams:**
- v0.3 explicit assumption is single-user
- Adds ACL system, audit, conflict resolution
- Not validated yet whether teams want Tek

## Sources

**Onboarding & UX Patterns:**
- Smashing Magazine: [Designing Agentic AI: Practical UX Patterns](https://www.smashingmagazine.com/2026/02/designing-agentic-ai-practical-ux-patterns/)
- UserGuiding: [What is an Onboarding Wizard](https://userguiding.com/blog/what-is-an-onboarding-wizard-with-examples)
- LogRocket: [Creating setup wizards](https://blog.logrocket.com/ux-design/creating-setup-wizard-when-you-shouldnt/)

**Provider & Security:**
- Google Cloud: [API Key Best Practices](https://docs.cloud.google.com/docs/authentication/api-keys-best-practices)
- OneUpTime: [API Key Management 2026](https://oneuptime.com/blog/post/2026-02-20-api-key-management-best-practices/view)

**Async Monitoring:**
- LogRocket: [UI Patterns for Async Workflows](https://blog.logrocket.com/ui-patterns-for-async-workflows-background-jobs-and-data-pipelines/)
- Braintrust: [LLM Monitoring Tools 2026](https://www.braintrust.dev/articles/best-llm-monitoring-tools-2026)

**Model Routing:**
- LiteLLM: [Routing & Load Balancing](https://docs.litellm.ai/docs/routing-load-balancing)
- LogRocket: [LLM Routing in Production](https://blog.logrocket.com/llm-routing-right-model-for-requests/)

**Related Tools:**
- OpenClaw: [Setup & Telegram Integration](https://macaron.im/blog/openclaw-telegram-bot-setup)
- Claude Desktop: [Documentation](https://code.claude.com/docs/en/desktop)

---

**Research type:** v0.3 Features for Desktop UX & Configuration
**Confidence:** MEDIUM-HIGH
**Ready for:** REQUIREMENTS.md phase planning
