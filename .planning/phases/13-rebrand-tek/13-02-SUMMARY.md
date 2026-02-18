---
phase: 13-rebrand-tek
plan: 02
subsystem: infra
tags: [rebrand, cli, keychain, migration, scripts, documentation]

# Dependency graph
requires:
  - phase: 13-rebrand-tek/01
    provides: centralized constants and @tek/* package scope
provides:
  - CLI binary named "tek"
  - All user-facing strings use Tek branding
  - Silent keychain migration from agentspace to tek
  - Config path migration from ~/.config/agentspace to ~/.config/tek
  - Updated install/update/reset scripts with tek paths
  - Uninstall documentation
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [migration-on-first-access, backward-compat-alias]

key-files:
  created: []
  modified:
    - packages/cli/package.json
    - packages/cli/src/index.ts
    - packages/cli/src/commands/config.ts
    - packages/cli/src/commands/init.ts
    - packages/cli/src/commands/chat.ts
    - packages/cli/src/components/Onboarding.tsx
    - packages/cli/src/components/StatusBar.tsx
    - packages/cli/src/vault/keychain.ts
    - packages/cli/src/hooks/useSlashCommands.ts
    - packages/core/src/skills/loader.ts
    - packages/core/src/errors.ts
    - packages/core/src/index.ts
    - packages/gateway/src/mcp/client-manager.ts
    - packages/gateway/src/agent/tool-registry.ts
    - packages/gateway/src/llm/provider.ts
    - packages/db/drizzle.config.ts
    - packages/db/src/memory/ensure-memory.ts
    - packages/telegram/src/handlers/commands.ts
    - scripts/install.sh
    - scripts/update.sh
    - scripts/reset.sh
    - INSTALL.md
    - ONESHEET.md

key-decisions:
  - "TekError replaces AgentSpaceError with backward-compat alias export"
  - "Keychain migration runs once on first keychainGet() call using module-level flag"
  - "Config dir migration runs at CLI startup before configExists() check"
  - "SERVICE_NAME typed as string (not literal) to allow comparison with old service name"

patterns-established:
  - "Migration-on-first-access: keychain entries migrate transparently on first read"
  - "Startup migration: config directory renamed before any config access"

requirements-completed: [CLI command rename to tek, config path migration, install/update script updates, documentation updates, verify clean uninstall]

# Metrics
duration: 6min
completed: 2026-02-18
---

# Phase 13 Plan 02: Runtime References Summary

**CLI command renamed to tek, all display strings rebranded, keychain/config path migration, scripts and docs fully updated with uninstall documentation**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-18T09:15:13Z
- **Completed:** 2026-02-18T09:21:45Z
- **Tasks:** 2
- **Files modified:** 23

## Accomplishments
- CLI binary is "tek" with all display strings using DISPLAY_NAME/CLI_COMMAND constants
- Keychain service migrates silently from "agentspace" to "tek" on first key access
- Config directory auto-migrates from ~/.config/agentspace to ~/.config/tek at CLI startup
- All 3 scripts (install/update/reset) use tek paths with migration support in install.sh
- INSTALL.md and ONESHEET.md fully rebranded with uninstall documentation added
- TekError class with backward-compatible AgentSpaceError alias
- Zero remaining hardcoded "agentspace" in source (only migration code references old name)

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename CLI command, display strings, keychain, and hardcoded paths** - `2fd5422` (feat)
2. **Task 2: Update install/update/reset scripts and documentation** - `6ac2513` (feat)

## Files Created/Modified
- `packages/cli/package.json` - bin entry changed from agentspace to tek
- `packages/cli/src/index.ts` - Config migration at startup, CLI_COMMAND/DISPLAY_NAME usage
- `packages/cli/src/commands/config.ts` - Display strings use constants
- `packages/cli/src/commands/init.ts` - Display strings use DISPLAY_NAME
- `packages/cli/src/commands/chat.ts` - CLI_COMMAND for resume message
- `packages/cli/src/components/Onboarding.tsx` - Welcome text uses DISPLAY_NAME, commands use CLI_COMMAND
- `packages/cli/src/components/StatusBar.tsx` - Status bar title uses DISPLAY_NAME
- `packages/cli/src/vault/keychain.ts` - KEYCHAIN_SERVICE from constants, migration function
- `packages/cli/src/hooks/useSlashCommands.ts` - tek.json config reference
- `packages/core/src/skills/loader.ts` - CONFIG_DIR_NAME for skills paths
- `packages/core/src/errors.ts` - TekError base class with AgentSpaceError alias
- `packages/core/src/index.ts` - Exports TekError alongside backward-compat alias
- `packages/gateway/src/mcp/client-manager.ts` - PROJECT_NAME for MCP client names
- `packages/gateway/src/agent/tool-registry.ts` - PROJECT_NAME and CONFIG_DIR_NAME for sandbox/skills paths
- `packages/gateway/src/llm/provider.ts` - CLI_COMMAND in error message
- `packages/db/drizzle.config.ts` - DB_PATH from @tek/core replaces hardcoded path
- `packages/db/src/memory/ensure-memory.ts` - tek log prefix and CONFIG_DIR_NAME in migration message
- `packages/telegram/src/handlers/commands.ts` - DISPLAY_NAME and CLI_COMMAND for Telegram messages
- `scripts/install.sh` - Tek paths, migration block, bin/tek symlink
- `scripts/update.sh` - Tek paths and display strings
- `scripts/reset.sh` - Tek paths, database name, command references
- `INSTALL.md` - Full rebrand with uninstall section
- `ONESHEET.md` - Full rebrand with @tek/* packages and phase 13 entry

## Decisions Made
- TekError replaces AgentSpaceError with backward-compat alias to avoid breaking any external consumers
- Keychain migration runs once on first keychainGet() call using a module-level boolean flag
- Config directory migration runs at CLI startup (before configExists check) so git-pull users get automatic migration
- SERVICE_NAME typed as `string` (not const literal) to allow TypeScript comparison with "agentspace" string

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript errors in keychain migration**
- **Found during:** Task 1 (keychain.ts)
- **Issue:** KEYCHAIN_SERVICE is a const literal type "tek", so `=== "agentspace"` comparison was flagged as impossible; getPassword() returns `string | null` but setPassword expects `string`
- **Fix:** Typed SERVICE_NAME as `string` instead of const literal; added null guard on password before setPassword call
- **Files modified:** packages/cli/src/vault/keychain.ts
- **Verification:** Full two-pass build passes with zero errors
- **Committed in:** 2fd5422 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Type-level fix necessary for TypeScript correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 13 rebrand is complete. All user-facing references are now "tek"
- Existing users get automatic migration of config directory and keychain entries on first run
- No further phases planned

---
*Phase: 13-rebrand-tek*
*Completed: 2026-02-18*
