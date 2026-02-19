# Phase 18: Onboarding Research - Research

**Researched:** 2026-02-18
**Domain:** AI agent personality systems, onboarding UX, soul/identity file patterns
**Confidence:** MEDIUM — based on WebSearch + official docs cross-verification; no code-level access to OpenClaw internals

## Summary

This research phase investigates how modern AI agent platforms handle personality, identity, onboarding, and memory — with OpenClaw (Peter Steinberger) as the primary reference implementation. The goal is to identify patterns, architectures, and UX flows that tek can adopt for Phase 15 (Init & Onboarding Polish) and Phase 16 (Agent Personality System).

The dominant pattern across the ecosystem is **file-driven personality**: plain markdown files (SOUL.md, IDENTITY.md, USER.md, MEMORY.md) that define agent behavior, loaded at session start and injected into the system prompt. OpenClaw has popularized a multi-file layered approach where soul (philosophy), identity (presentation), and capabilities (tools/permissions) are separate concerns. The onboarding UX trend is "conversation-first" — a guided wizard handles infrastructure setup, then the agent itself conducts its own personality bootstrapping via a BOOTSTRAP.md first-run script.

**Primary recommendation:** Adopt OpenClaw's multi-file identity architecture (separate SOUL.md for philosophy, IDENTITY.md for presentation, USER.md for user context) and add a personality onboarding step that uses presets + conversational refinement, while keeping tek's existing memory system (daily logs + MEMORY.md + vector search) which already parallels OpenClaw's approach.

## Architecture Patterns

### Pattern 1: OpenClaw's Multi-File Identity Architecture (PRIMARY REFERENCE)

**What:** Agent identity split across multiple workspace files, each loaded at session start and injected into the system prompt. Files are plain Markdown, human-editable, version-controllable.

**File inventory (OpenClaw):**

| File | Purpose | When Loaded | tek Equivalent |
|------|---------|-------------|----------------|
| `SOUL.md` | Behavioral philosophy — who the agent is, values, opinions | Every session | `SOUL.md` (exists) |
| `IDENTITY.md` | External presentation — name, emoji, avatar, vibe | Every session | None (need to add) |
| `USER.md` | User context — name, timezone, work context, preferences | Private sessions only | `MEMORY.md` (partial) |
| `MEMORY.md` | Long-term curated facts, decisions, preferences | Private sessions only | `MEMORY.md` (exists) |
| `AGENTS.md` | Multi-agent instructions and coordination | Every session | None (need for Phase 16) |
| `TOOLS.md` | Capability definitions and restrictions | Every session | Skills system (exists) |
| `BOOTSTRAP.md` | First-run setup script — agent walks user through setup | First session only | None (need to add) |
| `STYLE.md` | Writing style guide, tone calibration material | Every session | None (need to add) |
| `memory/YYYY-MM-DD.md` | Daily logs, append-only ephemeral memory | Today + yesterday | `daily/` logs (exists) |

**Confidence:** MEDIUM — based on official docs and multiple verified sources, but no direct code review.

**Source:** https://docs.openclaw.ai/concepts/memory, https://www.mmntm.net/articles/openclaw-identity-architecture

### Pattern 2: OpenClaw's Three-Layer Configuration Model

**What:** Separation of concerns across three distinct layers:
1. **Soul layer** — Philosophy and behavioral guidance (SOUL.md)
2. **Identity layer** — Presentation and persona (IDENTITY.md)
3. **Capability layer** — Tools, permissions, model selection (config JSON)

This allows agents with formal souls and playful identities, or vice versa. Internal behavior and external presentation are independent.

**Cascade resolution order:** Global config > Per-agent config > Workspace file > Default fallback. Most specific definition wins.

**Confidence:** MEDIUM — documented in MMNTM architecture article.

**Source:** https://www.mmntm.net/articles/openclaw-identity-architecture

### Pattern 3: OpenClaw's SOUL.md Template Structure

**What:** The default SOUL.md defines behavioral philosophy (not metadata or config) with these sections:

1. **Core Truths** — Behavioral principles:
   - Be genuinely helpful, not performatively helpful
   - Have opinions (disagree, prefer things, show personality)
   - Be resourceful before asking
   - Earn trust through competence
   - Remember you're a guest (respect privacy)
2. **Boundaries** — Constraints:
   - Private things stay private
   - Ask before acting externally
   - Never send incomplete replies to messaging surfaces
   - Be cautious in group chats
3. **Vibe** — Personality approach:
   - "Be the assistant you'd actually want to talk to"
   - Balance conciseness with thoroughness
   - Avoid corporate tone and sycophancy
4. **Continuity** — Persistence mechanics:
   - "These files ARE your memory. Read them. Update them."
   - Notify users of changes to this file

**Key insight:** SOUL.md is 50-150 lines. Short and opinionated beats long and comprehensive. It defines philosophy, not behavior rules.

**How this compares to tek's current SOUL.md:**
- tek's current template is 20 lines with generic values ("Operate as a thoughtful partner")
- OpenClaw's is more opinionated and personality-forward ("Have opinions... an assistant with no personality is just a search engine")
- tek lacks the Continuity section (self-modification instructions)
- tek lacks the Vibe section (explicit personality tone)

**Confidence:** HIGH — verified directly from GitHub template file.

**Source:** https://github.com/openclaw/openclaw/blob/main/docs/reference/templates/SOUL.md

### Pattern 4: BOOTSTRAP.md — Conversational First-Run Onboarding

**What:** OpenClaw creates a BOOTSTRAP.md file in new workspaces. On the agent's very first conversation, the user tells the agent to read BOOTSTRAP.md, and the agent walks the user through setup conversationally:
- Agent asks for its own name
- Agent asks how to address the user
- Agent fills in USER.md with user context
- Agent personalizes SOUL.md based on responses
- BOOTSTRAP.md is deleted after completion (one-time file)

**Why this matters:** This is "conversation-first" onboarding — the agent itself handles personality setup, not a configuration wizard. The user talks TO the agent to set it up, rather than filling in forms ABOUT the agent.

**Confidence:** MEDIUM — documented in multiple tutorials but exact BOOTSTRAP.md template not directly verified.

**Source:** https://www.codecademy.com/article/open-claw-tutorial-installation-to-first-chat-setup, https://amankhan1.substack.com/p/how-to-make-your-openclaw-agent-useful

### Pattern 5: OpenClaw's Onboarding Wizard (CLI)

**What:** OpenClaw's `openclaw onboard` command runs a 7-step TUI wizard:

1. **Model/Auth** — Select API provider, authenticate
2. **Workspace** — Define agent file location
3. **Gateway** — Configure port, binding, auth, Tailscale
4. **Channels** — Choose messaging platforms (WhatsApp, Telegram, Discord, etc.)
5. **Daemon** — Install persistent background service
6. **Health Check** — Start gateway, verify operational
7. **Skills** — Install recommended skill dependencies

Two modes: **QuickStart** (safe defaults, skip decisions) vs **Advanced** (full control, every option exposed).

After infrastructure setup, the "Hatch in TUI" step starts personality configuration where the agent asks:
- Bot's name (e.g., "Atlas", "Sage")
- How to address the user
- Personality preset: Professional, Friendly, Technical, or Custom

Re-running the wizard does NOT wipe config unless user explicitly chooses Reset.

**Confidence:** MEDIUM-HIGH — verified from official docs + multiple tutorial cross-references.

**Source:** https://docs.openclaw.ai/start/wizard

### Pattern 6: Multi-Agent Identity Isolation (OpenClaw)

**What:** Each agent receives complete isolation:
- Separate workspace directory (files, SOUL.md, IDENTITY.md, USER.md)
- Dedicated state directory (auth profiles, config)
- Independent session store (chat history, routing state)
- Agent-specific model selection and tool restrictions
- Binding rules route messages to specific agents by channel/platform

Config example:
```json
{
  "agents": {
    "list": [
      { "id": "chat", "model": "claude-sonnet-4-5" },
      { "id": "opus", "model": "claude-opus-4-5" }
    ]
  }
}
```

**Confidence:** MEDIUM — from MMNTM architecture article.

**Source:** https://www.mmntm.net/articles/openclaw-identity-architecture

### Pattern 7: Personality Self-Evolution

**What:** OpenClaw explicitly invites agents to modify their own soul files: "If you change this file, tell the user — it's your soul, and they should know." The agent can append to MEMORY.md, create daily logs, and even modify SOUL.md (with user notification).

The "soul-evil" hook demonstrates dynamic identity: random activation (10% chance) swaps SOUL.md with SOUL_EVIL.md in memory at bootstrap — no on-disk modification.

**tek's current approach:** `evolveSoul()` appends to "Learned Preferences" section after user approval. This is more conservative than OpenClaw's approach but safer.

**Confidence:** MEDIUM — from architecture article.

**Source:** https://www.mmntm.net/articles/openclaw-identity-architecture

## Comparative Analysis: Other Systems

### Claude Code: CLAUDE.md + Output Styles

**System:** Three customization layers:
1. **CLAUDE.md** — Project-specific context and instructions, loaded as user message following system prompt
2. **Output Styles** — Replace the default system prompt entirely with domain-specific behavioral instructions
3. **--append-system-prompt** — Append content to the system prompt

Output styles created via `/output-style:new` command. Stored as Markdown files at project or user level.

**Key difference from OpenClaw:** CLAUDE.md is project-scoped (per-repo), not agent-scoped. No personality persistence across projects. No onboarding wizard.

**Relevance to tek:** The output-style pattern (domain-specific behavioral replacement) could inform Phase 16's personality presets.

**Confidence:** MEDIUM — from official docs + community articles.

**Source:** https://ainativedev.io/news/claude-code-now-lets-you-customize-its-communication-style

### Cursor: .cursorrules / .mdc Files

**System:** Project-root rules files that define AI assistant behavior:
- Global rules in Settings > Rules for AI
- Project rules in `.cursor/rules/*.mdc` (modern) or `.cursorrules` (deprecated)
- Plain English natural language instructions

**Key insight:** Cursor evolved from single-file (`.cursorrules`) to directory-based (`.cursor/rules/`) for better organization. tek should plan for directory-based from the start.

**Confidence:** MEDIUM — from official docs + community guides.

### ChatGPT: Custom Instructions + Memory

**System:** Two-layer personalization:
1. **Custom Instructions** — Two text boxes (about you + response preferences), 1500 char limit each
2. **Memory** — Two types: explicit "Saved Memories" (user-approved) + implicit insights from chat history

Personality presets: default, cynical, robotic, listener, nerd.

**Key insight:** The two-layer memory (explicit + implicit) parallels tek's MEMORY.md + daily logs pattern.

**Confidence:** HIGH — from official OpenAI docs.

**Source:** https://help.openai.com/en/articles/8096356-chatgpt-custom-instructions

### agent-soul-kit (Community)

**System:** Lightweight, file-driven, zero-database soul persistence. Core concept: SOUL.md + STYLE.md + SKILL.md templates.

**Key insight:** The three-file pattern (soul + style + skill) is becoming a de facto standard across the ecosystem.

**Source:** https://github.com/ttian226/agent-soul-kit

### aaronjmars/soul.md (Community Tool)

**System:** Tool for generating personality files from user data:
- Three pathways: Guided Interview, Data-Driven (ingest tweets/blogs), Manual
- Generates SOUL.md (identity), STYLE.md (voice), SKILL.md (operations)
- Uses `data/` folder for source materials and `examples/` for calibration

**Key insight for tek:** A guided interview flow for soul creation is a proven pattern. The "ingest your writing to create your style" approach is compelling for advanced users.

**Confidence:** MEDIUM — from GitHub README.

**Source:** https://github.com/aaronjmars/soul.md

## Recommendations for tek

### For Phase 15: Init & Onboarding Polish

1. **Add personality presets to onboarding wizard:**
   - Professional (concise, formal, business-appropriate)
   - Friendly (conversational, warm, asks follow-up questions)
   - Technical (detailed, code-heavy, precise)
   - Opinionated (has preferences, disagrees, personality-forward — OpenClaw style)
   - Custom (user writes their own)

2. **Add agent naming step:**
   - "What should your agent be called?" (default: "tek")
   - "How should the agent address you?" (default: first name)
   - Store in config, inject into system prompt

3. **Add BOOTSTRAP.md pattern:**
   - On first chat after `tek init`, agent detects it's a fresh install
   - Agent asks personality questions conversationally
   - Agent fills in SOUL.md and USER.md based on responses
   - First-run flag prevents re-triggering

4. **Make existing wizard steps skippable (already partially done in Phase 14):**
   - Show current values for all configured items
   - "Keep current" option for each step

### For Phase 16: Agent Personality System

1. **Expand file architecture to match OpenClaw pattern:**
   - `SOUL.md` — Behavioral philosophy (expand current template significantly)
   - `IDENTITY.md` — Name, presentation style, emoji, avatar
   - `USER.md` — User context (split from MEMORY.md)
   - `STYLE.md` — Writing style guide, tone calibration
   - `AGENTS.md` — Multi-agent coordination instructions
   - Keep existing: `MEMORY.md` (long-term facts), `daily/` (logs)

2. **Multi-agent support:**
   - Per-agent workspace directories with isolated files
   - Agent-specific model selection and tool restrictions
   - Cascade resolution: global > per-agent > workspace > default
   - Agent switching via config + routing rules

3. **Personality evolution:**
   - Agent can propose SOUL.md modifications (with user approval — tek's existing pattern)
   - Style calibration: agent adjusts STYLE.md over time based on user feedback
   - Soul versioning: git-style history of personality changes

4. **Richer SOUL.md template** (inspired by OpenClaw):
   - Core Truths (behavioral principles)
   - Communication Style (detail and examples, not just bullet points)
   - Vibe (personality tone — what to embrace, what to avoid)
   - Boundaries (hard constraints)
   - Continuity (self-modification instructions)
   - Learned Preferences (keep existing, auto-populated)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Personality presets | Custom preset format | Markdown template files in `memory-files/presets/` | Standard files, user-editable, version-controllable |
| Style calibration | Custom NLP pipeline | LLM-powered style analysis from user writing samples | The LLM itself is the best style analyzer |
| Soul generation | Form-based questionnaire | Guided conversation with the agent (BOOTSTRAP.md pattern) | Conversation-first is more natural, generates richer results |
| Multi-agent routing | Custom routing engine | Config-driven binding rules (channel > agent mapping) | OpenClaw's binding system is proven at scale |
| Identity resolution | Custom cascade logic | Simple priority chain: config > per-agent > workspace > default | Predictable, debuggable, no magic |

**Key insight:** The personality system IS the markdown files. Don't over-engineer the infrastructure — the LLM reads markdown, so markdown IS the configuration language. The code only needs to load, inject, and (with approval) write these files.

## Common Pitfalls

### Pitfall 1: Over-Engineering the Soul System
**What goes wrong:** Building a complex database-backed personality system when markdown files loaded into the system prompt work just as well.
**Why it happens:** Developer instinct to normalize data into schemas and databases.
**How to avoid:** Follow OpenClaw's file-first philosophy. The soul IS the file, not a database record rendered as a file.
**Warning signs:** Adding personality tables to SQLite, building personality CRUD APIs.

### Pitfall 2: Generic Default Personality
**What goes wrong:** Default SOUL.md is so generic ("helpful assistant") that it adds no value. Users never customize it because the default feels adequate.
**Why it happens:** Fear of being too opinionated scares developers into bland defaults.
**How to avoid:** Make the default SOUL.md opinionated and personality-forward (OpenClaw: "have opinions... an assistant with no personality is just a search engine"). Users who want generic can choose the "Professional" preset.
**Warning signs:** Default personality is indistinguishable from ChatGPT's default behavior.

### Pitfall 3: Configuration-First Instead of Conversation-First Onboarding
**What goes wrong:** Users fill in forms about their agent's personality, resulting in shallow, disconnected configurations.
**Why it happens:** Wizard-based setup is familiar developer UX. Conversational setup requires the agent to be running first.
**How to avoid:** Use a two-phase approach: wizard handles infrastructure (keys, gateway, security), then the FIRST conversation handles personality (agent asks questions, fills in files).
**Warning signs:** Personality setup happens entirely in the CLI wizard with no agent involvement.

### Pitfall 4: Personality Files Too Long
**What goes wrong:** SOUL.md grows to 500+ lines, consuming excessive tokens every session, diluting the most important instructions.
**Why it happens:** Users and agents keep appending without pruning.
**How to avoid:** Target 50-150 lines for SOUL.md (OpenClaw guidance). Use separate files (STYLE.md, USER.md) to offload content. Add token budget warnings.
**Warning signs:** Soul + identity + user context exceeds 5000 tokens.

### Pitfall 5: No Personality Migration Path
**What goes wrong:** Existing tek users with customized SOUL.md lose their personality when upgrading to the new multi-file system.
**Why it happens:** New architecture replaces old file layout.
**How to avoid:** Migration script that reads existing SOUL.md, splits content into new files (soul, identity, style), preserves Learned Preferences verbatim.
**Warning signs:** Update process silently overwrites personality files.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single system prompt string | Multi-file markdown personality (SOUL.md pattern) | 2025-2026 (OpenClaw popularized) | Agent personality is version-controllable, human-readable, portable |
| Form-based personality setup | Conversation-first onboarding (BOOTSTRAP.md) | Late 2025 (OpenClaw) | Richer, more natural personality configuration |
| Global single agent | Per-agent isolated workspaces | 2025-2026 | Users can have multiple agents with different personalities/capabilities |
| Static personality | Self-evolving soul with user approval | 2025-2026 | Personality improves over time based on interactions |
| Personality presets only | Presets + guided interview + data-driven generation | 2026 (aaronjmars/soul.md) | Multiple onboarding paths for different user sophistication levels |

## Open Questions

1. **How should tek handle the two-phase onboarding?**
   - What we know: Infrastructure setup (wizard) should precede personality setup (conversation). OpenClaw uses BOOTSTRAP.md as a first-run flag.
   - What's unclear: Should tek's personality onboarding happen in the same `tek init` session, or require a separate `tek chat` session after init?
   - Recommendation: Add a final "Hatch" step to `tek init` that starts a mini chat session with the agent for personality setup. If user skips, BOOTSTRAP.md triggers on first `tek chat`.

2. **How aggressive should personality self-evolution be?**
   - What we know: OpenClaw allows agents to modify their own SOUL.md with notification. tek currently only appends to Learned Preferences with user approval.
   - What's unclear: Do users want agents that change their own personality, or is this unsettling?
   - Recommendation: Keep tek's conservative approach (user approval required) but add a "soul evolution proposal" mechanism where the agent can suggest SOUL.md changes that the user reviews.

3. **How should multi-agent identities be stored?**
   - What we know: OpenClaw uses per-agent workspace directories. tek currently has a single agent.
   - What's unclear: Should agents share MEMORY.md (common user facts) or each have their own?
   - Recommendation: Shared USER.md (user context), separate SOUL.md/IDENTITY.md/STYLE.md per agent. Shared long-term memory for facts, per-agent for preferences.

4. **What should the default SOUL.md look like?**
   - What we know: OpenClaw's default is opinionated and personality-forward. tek's current default is generic.
   - What's unclear: What personality fits tek's brand and user base?
   - Recommendation: Write a new default that is opinionated about being direct, competent, and having personality — but customizable via presets during onboarding.

5. **Should USER.md be split from MEMORY.md?**
   - What we know: OpenClaw separates USER.md (about the user) from MEMORY.md (learned facts). tek combines both in MEMORY.md.
   - What's unclear: Is the split worth the additional file management?
   - Recommendation: Yes — USER.md is relatively static (name, timezone, work context) while MEMORY.md is dynamic (learned facts, decisions). Split enables selective loading (USER.md in group chats, MEMORY.md in private only).

## Sources

### Primary (HIGH confidence)
- [OpenClaw GitHub Repository](https://github.com/openclaw/openclaw) — README, project structure
- [OpenClaw SOUL.md Template](https://github.com/openclaw/openclaw/blob/main/docs/reference/templates/SOUL.md) — Default soul file structure
- [OpenClaw Memory Docs](https://docs.openclaw.ai/concepts/memory) — Memory system architecture
- [OpenClaw Wizard Docs](https://docs.openclaw.ai/start/wizard) — Onboarding wizard reference
- [ChatGPT Custom Instructions](https://help.openai.com/en/articles/8096356-chatgpt-custom-instructions) — OpenAI's approach

### Secondary (MEDIUM confidence)
- [OpenClaw Identity Architecture (MMNTM)](https://www.mmntm.net/articles/openclaw-identity-architecture) — Multi-agent identity, cascade resolution, three-layer model
- [Codecademy OpenClaw Tutorial](https://www.codecademy.com/article/open-claw-tutorial-installation-to-first-chat-setup) — Onboarding flow walkthrough
- [aaronjmars/soul.md](https://github.com/aaronjmars/soul.md) — Soul generation tool, template patterns
- [Claude Code Output Styles](https://ainativedev.io/news/claude-code-now-lets-you-customize-its-communication-style) — Alternative customization approach
- [Habr OpenClaw Setup Guide](https://habr.com/en/articles/992720/) — Detailed setup walkthrough

### Tertiary (LOW confidence)
- [SOUL.md Pattern Guide (CrewClaw)](https://www.crewclaw.com/blog/soul-md-create-ai-agent) — Community interpretation of SOUL.md pattern
- [agent-soul-kit](https://github.com/ttian226/agent-soul-kit) — Community soul persistence library
- [souls.directory](https://souls.directory/) — Community SOUL.md template directory
- Various tutorial sites (advenboost, openclaw-setup.me) — Cross-referenced for consistency

## Metadata

**Confidence breakdown:**
- OpenClaw SOUL.md pattern: MEDIUM-HIGH — verified from official GitHub + docs, multiple cross-references
- OpenClaw onboarding wizard: MEDIUM — official docs verified, multiple tutorials consistent
- Multi-agent architecture: MEDIUM — single detailed source (MMNTM), cross-verified with GitHub structure
- Comparative analysis (Claude Code, Cursor, ChatGPT): MEDIUM — official docs for each
- Best practices / recommendations: MEDIUM — synthesized from multiple sources, but recommendations are editorial

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (30 days — OpenClaw is fast-moving, check for major version changes)
