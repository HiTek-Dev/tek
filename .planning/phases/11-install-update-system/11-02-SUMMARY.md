---
phase: 11-install-update-system
plan: 02
subsystem: infra
tags: [bash, rsync, deployment, install, update, shell-scripts]

# Dependency graph
requires:
  - phase: 11-01
    provides: Memory files relocated to ~/.config/agentspace/ (update-safe)
provides:
  - install.sh script for first-time source-to-target deployment
  - update.sh script for safe code-only updates preserving user data
affects: [11-03-reset]

# Tech tracking
tech-stack:
  added: [rsync, bash-scripts]
  patterns: [individual-package-build-order, rsync-exclude-patterns, version-marker-json]

key-files:
  created:
    - scripts/install.sh
    - scripts/update.sh
  modified: []

key-decisions:
  - "Build packages individually via tsc instead of turbo (cyclic cli<->gateway dependency breaks turbo)"
  - "rsync with --delete for atomic directory sync with explicit exclude patterns"
  - "Preserve installedAt timestamp in .version across updates"

patterns-established:
  - "Individual package build order: core, db, gateway, cli, telegram"
  - "Shared rsync exclude list between install and update scripts"
  - "Version marker (.version JSON) at install root with sourceCommit tracking"

# Metrics
duration: 4min
completed: 2026-02-17
---

# Phase 11 Plan 02: Install & Update Scripts Summary

**Shell scripts for source-to-target deployment (install.sh) and safe code-only updates (update.sh) using rsync with user data preservation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-17T07:49:07Z
- **Completed:** 2026-02-17T07:53:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- install.sh builds from source, rsyncs built artifacts, seeds memory templates, creates bin symlink, writes version marker
- update.sh stops gateway via runtime.json PID, rebuilds, syncs code without touching user data in ~/.config/agentspace/
- Both scripts share identical rsync exclude patterns ensuring consistency
- Version marker (.version) preserves installedAt across updates

## Task Commits

Each task was committed atomically:

1. **Task 1: Create install.sh script** - `a9ac9ea` (feat)
2. **Task 2: Create update.sh script** - `e692462` (feat)

## Files Created/Modified
- `scripts/install.sh` - First-time installation: build, rsync, seed memory, create bin symlink, write .version
- `scripts/update.sh` - Update: stop gateway, rebuild, rsync code, update .version preserving installedAt

## Decisions Made
- **Individual package builds instead of turbo:** The cli<->gateway cyclic workspace dependency causes `turbo run build` to fail with "Invalid package dependency graph". Building each package individually with `npx tsc -p tsconfig.json` in dependency order (core, db, gateway, cli, telegram) works correctly.
- **rsync --delete with excludes:** Ensures clean sync while protecting source files, dev artifacts, memory-files, and environment files from being deployed.
- **Preserve installedAt:** update.sh reads the existing .version file to preserve the original installation timestamp while updating updatedAt and sourceCommit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced `pnpm build` with individual package builds**
- **Found during:** Task 1 (install.sh creation)
- **Issue:** `pnpm build` invokes turbo which fails due to cyclic dependency between @agentspace/cli and @agentspace/gateway
- **Fix:** Build each package individually in dependency order using `npx tsc -p tsconfig.json` in a for loop
- **Files modified:** scripts/install.sh, scripts/update.sh
- **Verification:** Full install and update cycle completed successfully
- **Committed in:** a9ac9ea (Task 1), e692462 (Task 2)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary workaround for pre-existing turbo cyclic dependency issue. No scope creep.

## Issues Encountered
- turbo 2.8.9 cannot handle the cyclic workspace dependency between cli and gateway packages. This is a pre-existing issue not caused by this plan. Individual tsc builds work correctly as all packages use simple `tsc` build scripts.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Install and update scripts ready for use
- Plan 11-03 (reset.sh) can proceed -- reset script already exists from a prior commit (e322626)
- Both scripts tested with real install/update cycle to /tmp/agentspace-test

---
*Phase: 11-install-update-system*
*Completed: 2026-02-17*
