# Phase 1: Foundation & Security - Context

**Gathered:** 2026-02-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Project scaffolding, encrypted credential vault (OS keychain), security mode selection (Full Control / Limited Control), local-only key-serving API endpoint, and authenticated CLI access. This phase delivers the secure foundation all other phases build on.

</domain>

<decisions>
## Implementation Decisions

### Credential management
- CLI commands for add/update/remove of API keys for Anthropic, OpenAI, and Ollama
- Keys stored encrypted in OS keychain (platform-native: macOS Keychain, Linux secret-service, Windows Credential Vault)
- Local-only API endpoint (127.0.0.1) serves keys to authorized local applications
- Audit log tracks all key access events

### Security modes
- Two modes: "Full Control" (OS-level access with explicit permission grants) and "Limited Control" (restricted to designated workspace directory)
- Mode selected during first-run onboarding
- Mode persists across restarts
- Only authenticated local CLI can send commands to the agent

### Claude's Discretion
- Onboarding flow design (wizard vs quick prompts, level of explanation)
- Credential management UX (interactive prompts vs CLI flags, feedback patterns)
- Security boundary enforcement approach (how restrictions are communicated, whether mode can be switched post-setup)
- Audit log format, verbosity, and storage location
- Key rotation handling
- Error messaging and feedback patterns
- Project scaffolding structure (monorepo layout, config files, build setup)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The roadmap success criteria are well-defined and provide sufficient specification for research and planning.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-security*
*Context gathered: 2026-02-15*
