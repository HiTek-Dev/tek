# Phase 11: Install & Update System - Research

**Researched:** 2026-02-17
**Domain:** Monorepo deployment, update-safe installation, user data preservation
**Confidence:** HIGH

## Summary

AgentSpace is a pnpm monorepo with 5 packages (core, db, cli, gateway, telegram) that currently runs from the development directory. Phase 11 needs to create a system that deploys a built copy to any target directory, updates that installation without destroying user data (personality, memory, config, database, skills), and offers a fresh-start reset.

The key architectural challenge is that **memory files (SOUL.md, MEMORY.md, daily logs) currently live inside the package directory** (`packages/db/memory-files/`), resolved via `import.meta.url` relative paths. This means an update that replaces the package directory would destroy user personality and memory data. The config, database, and runtime files already live safely in `~/.config/agentspace/`, so those are update-safe by default.

The project also has **native Node.js modules** (better-sqlite3, sqlite-vec, node-pty, @napi-rs/keyring) which complicate deployment since they contain platform-specific compiled binaries that must match the target Node.js version.

**Primary recommendation:** Use shell scripts (not `pnpm deploy`) to build in-place, then rsync/copy the built artifacts to a target directory with explicit exclusion of user data directories. Relocate memory-files from the package directory to `~/.config/agentspace/` so they survive updates. The install script handles first-time setup; the update script replaces code while preserving data; the reset script wipes user data.

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Shell scripts (bash/zsh) | N/A | Install, update, reset commands | Zero dependencies, works on macOS/Linux, users already have it |
| rsync | 3.x | Selective file synchronization | Handles include/exclude patterns, delta transfers, atomic-enough for local copies |
| pnpm | 9.x | Build orchestration (in source repo) | Already the project's package manager |
| Turbo | 2.x | Build pipeline (in source repo) | Already configured for the project |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| Node.js built-in fs | N/A | Data migration, directory structure creation | First-install setup, version tracking |
| semver comparison (bash) | N/A | Version gating for migrations | When schema or data format changes between versions |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shell scripts | `pnpm deploy` | pnpm deploy creates isolated node_modules but has known issues with native modules (better-sqlite3 bindings not found), doesn't handle the circular cli<->gateway dependency well, and adds complexity for a single-machine deployment |
| rsync | cp -r with manual exclude | rsync is more robust for incremental updates, handles symlinks correctly, and has battle-tested exclude patterns |
| Shell scripts | Node.js CLI tool | Would need to bootstrap itself; shell scripts can run before Node.js packages are installed |
| Manual scripts | npm package (global install) | Global npm packages have their own update/path problems; a simple script is more transparent for a self-hosted tool |

## Architecture Patterns

### Critical Prerequisite: Relocate Memory Files

Before the install system can work, memory files must be moved out of the package directory. This is a code change, not an install system feature.

**Current layout (BROKEN for updates):**
```
packages/db/
  memory-files/
    SOUL.md          # <-- destroyed on update
    MEMORY.md        # <-- destroyed on update
    daily/           # <-- destroyed on update
  src/memory/
    soul-manager.ts  # resolve(__dirname, "../../memory-files/SOUL.md")
    memory-curator.ts
    daily-logger.ts
```

**Required layout (update-safe):**
```
~/.config/agentspace/
  config.json        # already here
  agentspace.db      # already here
  runtime.json       # already here (transient)
  memory/
    SOUL.md          # relocated here
    MEMORY.md        # relocated here
    daily/           # relocated here
```

The `soul-manager.ts`, `memory-curator.ts`, and `daily-logger.ts` must be refactored to resolve paths from `CONFIG_DIR` (already exported from `@agentspace/core`) instead of `__dirname`. The `memory-files/` directory in the package becomes a **template source** for first-install only.

### Pattern 1: Directory Layout Convention

**What:** Standardized installation directory structure separating code from data
**When to use:** Every installation

```
<install-dir>/                    # e.g., ~/agentspace or /opt/agentspace
  packages/
    core/dist/                    # compiled JS
    db/dist/                      # compiled JS
    cli/dist/                     # compiled JS + bin entry
    gateway/dist/                 # compiled JS
    telegram/dist/                # compiled JS
  node_modules/                   # production dependencies (flat)
  package.json                    # root package.json
  pnpm-lock.yaml                  # lockfile for reproducibility
  .version                        # installed version marker
  bin/
    agentspace -> ../packages/cli/dist/index.js  # symlink

~/.config/agentspace/             # USER DATA (never touched by update)
  config.json
  agentspace.db
  runtime.json
  memory/
    SOUL.md
    MEMORY.md
    daily/
  skills/                         # managed skills directory
```

### Pattern 2: Build-Then-Deploy

**What:** Build everything in the source repo, then copy artifacts to the install directory
**When to use:** Every install and update

```bash
# In source repo:
pnpm install
pnpm build              # turbo run build

# Deploy to target:
rsync -a --delete \
  --exclude='node_modules' \
  --exclude='.turbo' \
  --exclude='*.tsbuildinfo' \
  --exclude='src/' \
  --exclude='memory-files/' \
  --exclude='.env' \
  packages/ <install-dir>/packages/

# Install production deps at target:
cd <install-dir>
pnpm install --prod --frozen-lockfile
```

### Pattern 3: Version Tracking

**What:** Track installed version to support migration logic and skip no-op updates
**When to use:** Every install/update

```bash
# .version file at install root
{
  "version": "0.1.0",
  "installedAt": "2026-02-17T08:00:00Z",
  "updatedAt": "2026-02-17T08:00:00Z",
  "sourceCommit": "abc1234"
}
```

### Pattern 4: First-Install Data Seeding

**What:** Copy template files to `~/.config/agentspace/` on first install only
**When to use:** When `~/.config/agentspace/memory/SOUL.md` does not exist

```bash
if [ ! -f "$HOME/.config/agentspace/memory/SOUL.md" ]; then
  mkdir -p "$HOME/.config/agentspace/memory/daily"
  cp packages/db/memory-files/SOUL.md "$HOME/.config/agentspace/memory/"
  cp packages/db/memory-files/MEMORY.md "$HOME/.config/agentspace/memory/"
fi
```

### Pattern 5: Graceful Gateway Shutdown Before Update

**What:** Stop the running gateway before updating code, restart after
**When to use:** Every update

```bash
# Check if gateway is running via runtime.json
RUNTIME="$HOME/.config/agentspace/runtime.json"
if [ -f "$RUNTIME" ]; then
  PID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$RUNTIME','utf-8')).pid)")
  if kill -0 "$PID" 2>/dev/null; then
    echo "Stopping gateway (PID $PID)..."
    kill "$PID"
    # Wait for clean shutdown (runtime.json cleanup)
    for i in $(seq 1 10); do
      [ ! -f "$RUNTIME" ] && break
      sleep 0.5
    done
  fi
fi
```

### Anti-Patterns to Avoid

- **Storing user data inside the package tree:** The current memory-files location must be relocated. Any user-modifiable file inside the install directory will be destroyed on update.
- **Using `pnpm deploy` for local installation:** It creates an isolated environment but has documented issues with native module bindings (better-sqlite3, node-pty) and doesn't handle the cli<->gateway circular dependency. Shell scripts with rsync are simpler and more reliable for same-machine deployment.
- **Rebuilding native modules at the install target:** Native modules should be built once in the source repo and copied. Rebuilding requires build tools (python, make, gcc) which end-users may not have. Since source and target share the same machine/Node.js version, the binaries are compatible.
- **Global npm install:** Would fight with pnpm's workspace structure, native module resolution, and version management.
- **Symlinking from install dir to source repo:** Fragile, breaks if source repo moves, doesn't support independent update cycles.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File synchronization | Custom recursive copy with filters | rsync with `--exclude` | Battle-tested, handles edge cases (symlinks, permissions, partial failures) |
| Process management (stop/start) | Custom daemon manager | PID file check + `kill` signal | Already have runtime.json with PID; simple and reliable |
| Database migrations | Custom SQL differ | Drizzle Kit migrations (`drizzle-kit migrate`) | Already configured in the project, handles schema evolution |
| Dependency installation | Custom node_modules copy | `pnpm install --prod` at target | Correct resolution of native modules and workspace deps |
| Version comparison | Custom string parser | Node.js semver or simple bash comparison | Versions are simple enough for bash; semver available if needed |

**Key insight:** This is a deployment/devops problem, not an application feature problem. Shell scripts that orchestrate existing tools (rsync, pnpm, kill) are the right level of abstraction. The "application" parts are minimal: relocate memory file paths, seed template data on first install, track version.

## Common Pitfalls

### Pitfall 1: Destroying User Memory/Personality on Update

**What goes wrong:** User's SOUL.md, MEMORY.md, and daily logs are deleted when code is replaced
**Why it happens:** These files currently live inside `packages/db/memory-files/` which gets overwritten during update
**How to avoid:** Relocate memory file resolution from `__dirname`-relative to `CONFIG_DIR`-relative BEFORE implementing the install system. This is a prerequisite code change.
**Warning signs:** After update, agent "forgets" everything and has default personality

### Pitfall 2: Native Module Binary Mismatch

**What goes wrong:** `better-sqlite3`, `node-pty`, `sqlite-vec`, or `@napi-rs/keyring` crash with "was compiled against a different Node.js version" or "bindings not found"
**Why it happens:** Native modules are compiled for a specific Node.js version and architecture. If source and target use different Node.js versions, binaries won't work.
**How to avoid:** Validate Node.js version matches between source build and install target. For single-machine deployment (source = target), this is automatic. Document that Node.js version changes require a full reinstall.
**Warning signs:** `Error: Could not locate the bindings file`, `NODE_MODULE_VERSION mismatch`

### Pitfall 3: Circular Dependency During pnpm Install at Target

**What goes wrong:** `pnpm install --prod` at the install target fails because `@agentspace/gateway` depends on `@agentspace/cli` and vice versa
**Why it happens:** The cli<->gateway circular dependency (vault functions in cli, used by gateway) is a known issue documented in ONESHEET.md
**How to avoid:** Copy the entire `node_modules/` from the built source repo rather than running `pnpm install` at the target. Or: restructure vault into its own package (out of scope for this phase).
**Warning signs:** Build errors, missing module errors after install

### Pitfall 4: Stale runtime.json After Update

**What goes wrong:** Gateway appears "running" but is actually dead after update replaced its code
**Why it happens:** The update killed the gateway process but runtime.json wasn't cleaned up (race condition)
**How to avoid:** The update script should explicitly remove runtime.json after stopping the gateway, and the `discoverGateway()` function already validates PID liveness
**Warning signs:** CLI says "gateway is running" but can't connect

### Pitfall 5: Skills Directory Confusion

**What goes wrong:** User-installed skills disappear or built-in skills don't load
**Why it happens:** Skills can be in workspace dir (`.agentspace/skills/`) or managed dir (`~/.config/agentspace/skills/` or custom `skillsDir`). Update must not touch these.
**How to avoid:** Skills directories are already outside the install path (in config dir or workspace). The update script just needs to not break the config that points to them.
**Warning signs:** Agent loses abilities after update

### Pitfall 6: Database Schema Migration on Update

**What goes wrong:** Updated code expects new database columns/tables that don't exist
**Why it happens:** New version adds schema changes but the existing database has the old schema
**How to avoid:** The current `getDb()` function uses `CREATE TABLE IF NOT EXISTS` which is forward-compatible for new tables. For column additions, Drizzle Kit migrations should be run as part of the update process.
**Warning signs:** SQL errors on startup after update

## Code Examples

### Example 1: Relocating Memory File Paths (prerequisite refactor)

```typescript
// packages/db/src/memory/soul-manager.ts - BEFORE
const SOUL_PATH = resolve(__dirname, "../../memory-files/SOUL.md");

// packages/db/src/memory/soul-manager.ts - AFTER
import { CONFIG_DIR } from "@agentspace/core";
const SOUL_PATH = join(CONFIG_DIR, "memory", "SOUL.md");
```

```typescript
// packages/db/src/memory/daily-logger.ts - BEFORE
const MEMORY_DIR = resolve(__dirname, "../../memory-files/daily");

// packages/db/src/memory/daily-logger.ts - AFTER
import { CONFIG_DIR } from "@agentspace/core";
const MEMORY_DIR = join(CONFIG_DIR, "memory", "daily");
```

```typescript
// packages/db/src/memory/memory-curator.ts - BEFORE
const MEMORY_PATH = resolve(__dirname, "../../memory-files/MEMORY.md");

// packages/db/src/memory/memory-curator.ts - AFTER
import { CONFIG_DIR } from "@agentspace/core";
const MEMORY_PATH = join(CONFIG_DIR, "memory", "MEMORY.md");
```

### Example 2: Install Script Skeleton

```bash
#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${1:-$HOME/agentspace}"
SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_DIR="$HOME/.config/agentspace"

echo "Installing AgentSpace to $INSTALL_DIR..."

# 1. Build in source
cd "$SOURCE_DIR"
pnpm install
pnpm build

# 2. Create install directory
mkdir -p "$INSTALL_DIR"

# 3. Sync built artifacts (exclude source, dev files, user data)
rsync -a --delete \
  --exclude='src/' \
  --exclude='*.tsbuildinfo' \
  --exclude='.turbo/' \
  --exclude='memory-files/' \
  --exclude='.env' \
  --exclude='.git/' \
  "$SOURCE_DIR/packages/" "$INSTALL_DIR/packages/"

# 4. Copy root files needed for runtime
cp "$SOURCE_DIR/package.json" "$INSTALL_DIR/"
cp "$SOURCE_DIR/pnpm-lock.yaml" "$INSTALL_DIR/"
cp "$SOURCE_DIR/pnpm-workspace.yaml" "$INSTALL_DIR/"

# 5. Sync node_modules (includes native modules)
rsync -a --delete \
  "$SOURCE_DIR/node_modules/" "$INSTALL_DIR/node_modules/"

# Per-package node_modules (workspace symlinks resolved by pnpm)
for pkg in core db cli gateway telegram; do
  if [ -d "$SOURCE_DIR/packages/$pkg/node_modules" ]; then
    rsync -a --delete \
      "$SOURCE_DIR/packages/$pkg/node_modules/" \
      "$INSTALL_DIR/packages/$pkg/node_modules/"
  fi
done

# 6. Seed user data on first install
mkdir -p "$CONFIG_DIR/memory/daily"
if [ ! -f "$CONFIG_DIR/memory/SOUL.md" ]; then
  cp "$SOURCE_DIR/packages/db/memory-files/SOUL.md" "$CONFIG_DIR/memory/"
  cp "$SOURCE_DIR/packages/db/memory-files/MEMORY.md" "$CONFIG_DIR/memory/"
  echo "Seeded default personality and memory files."
fi

# 7. Create bin symlink
mkdir -p "$INSTALL_DIR/bin"
ln -sf "../packages/cli/dist/index.js" "$INSTALL_DIR/bin/agentspace"
chmod +x "$INSTALL_DIR/packages/cli/dist/index.js"

# 8. Write version marker
VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$SOURCE_DIR/package.json','utf-8')).version || '0.1.0')")
COMMIT=$(cd "$SOURCE_DIR" && git rev-parse --short HEAD 2>/dev/null || echo "unknown")
cat > "$INSTALL_DIR/.version" << EOF
{
  "version": "$VERSION",
  "sourceCommit": "$COMMIT",
  "installedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "nodeVersion": "$(node -v)"
}
EOF

echo "AgentSpace installed to $INSTALL_DIR"
echo "Add to PATH: export PATH=\"$INSTALL_DIR/bin:\$PATH\""
```

### Example 3: Update Script Skeleton

```bash
#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${1:-$HOME/agentspace}"
SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME="$HOME/.config/agentspace/runtime.json"

# 1. Stop gateway if running
if [ -f "$RUNTIME" ]; then
  PID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$RUNTIME','utf-8')).pid)")
  if kill -0 "$PID" 2>/dev/null; then
    echo "Stopping gateway (PID $PID)..."
    kill "$PID"
    sleep 2
  fi
  rm -f "$RUNTIME"
fi

# 2. Build fresh
cd "$SOURCE_DIR"
pnpm install
pnpm build

# 3. Sync (same as install - rsync handles delta)
# ... (same rsync commands as install)

# 4. Update version marker
# ... (same as install)

# 5. Run any needed migrations
cd "$INSTALL_DIR"
# Drizzle migrations would go here if schema changed

echo "AgentSpace updated. Start gateway with:"
echo "  node $INSTALL_DIR/packages/gateway/dist/index.js"
```

### Example 4: Fresh-Start Reset Script

```bash
#!/usr/bin/env bash
set -euo pipefail

CONFIG_DIR="$HOME/.config/agentspace"
RUNTIME="$CONFIG_DIR/runtime.json"

echo "WARNING: This will delete ALL AgentSpace user data:"
echo "  - Configuration ($CONFIG_DIR/config.json)"
echo "  - Database ($CONFIG_DIR/agentspace.db)"
echo "  - Memory files ($CONFIG_DIR/memory/)"
echo "  - Keychain credentials (agentspace service)"
echo ""
read -p "Type 'RESET' to confirm: " confirm
[ "$confirm" != "RESET" ] && echo "Cancelled." && exit 1

# Stop gateway
if [ -f "$RUNTIME" ]; then
  PID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$RUNTIME','utf-8')).pid)" 2>/dev/null)
  kill "$PID" 2>/dev/null || true
  sleep 1
fi

# Remove user data
rm -rf "$CONFIG_DIR"
echo "User data removed."

# Note: Keychain entries must be removed via `security delete-generic-password`
# or via the agentspace CLI (agentspace keys remove)
echo "Keychain credentials must be removed manually or via 'agentspace keys remove'."
echo "Run 'agentspace init' to set up from scratch."
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pnpm deploy` for production | Direct rsync of built artifacts + node_modules | 2024-2025 (community shift) | Avoids native module binding issues, simpler for single-machine |
| Global npm install for CLI tools | Local directory install with PATH addition | Ongoing | Better version isolation, avoids global npm permission issues |
| In-place updates (overwrite everything) | Separate code and data directories | Standard practice | User data survives updates |
| Configuration in app directory | XDG-style config directory (`~/.config/`) | Standard practice | AgentSpace already does this for config/db; memory files need to follow |

**Deprecated/outdated:**
- `pnpm deploy` with native modules: Known binding resolution issues with better-sqlite3 and similar packages. Not suitable when native modules are involved and the deployment target matches the build machine.

## Open Questions

1. **Should the install system support cross-machine deployment?**
   - What we know: Current design assumes source repo and install target are on the same machine (same Node.js version, same OS/arch for native modules)
   - What's unclear: Whether users will want to build on one machine and deploy to another
   - Recommendation: Design for single-machine first. Cross-machine would require either Docker or prebuilt native module binaries (prebuild-install). Defer unless explicitly needed.

2. **Should the vault (keychain) be part of the reset?**
   - What we know: API keys are stored in macOS Keychain via `@napi-rs/keyring`, not in the filesystem
   - What's unclear: Whether `fresh-start` should also wipe keychain entries or just filesystem data
   - Recommendation: Fresh-start should remove filesystem data only. Keychain cleanup should be a separate explicit step (keys are harder to re-enter than re-running onboarding). The reset script should print instructions for manual keychain cleanup.

3. **How should the memory-files relocation handle existing dev-mode data?**
   - What we know: Developers using AgentSpace from the source repo have memory data in `packages/db/memory-files/`
   - What's unclear: Whether to auto-migrate on first run or require manual migration
   - Recommendation: Add migration logic to `getDb()` or a new startup hook: if files exist at old location but not at new location, copy them. Log a deprecation warning. Keep the old `memory-files/` directory as a template source only.

4. **pnpm workspace symlinks in node_modules**
   - What we know: pnpm creates symlinks in node_modules for workspace packages. These may not work correctly when the entire node_modules is copied to a new location.
   - What's unclear: Whether rsync preserves the symlink targets correctly or if they break.
   - Recommendation: Test this during implementation. If symlinks break, the install script may need to re-run `pnpm install --prod` at the target, or restructure the node_modules layout. Alternative: copy the entire source repo (excluding .git, src/) and let pnpm handle resolution.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** - Direct reading of all package.json files, config/types.ts, soul-manager.ts, memory-curator.ts, daily-logger.ts, connection.ts, server.ts, discovery.ts, init.ts, loader.ts
- **ONESHEET.md** - Project architecture documentation including data locations and known issues
- [pnpm deploy documentation](https://pnpm.io/cli/deploy) - Official docs on deploy command behavior and limitations

### Secondary (MEDIUM confidence)
- [pnpm deploy native module issues](https://github.com/pnpm/pnpm/issues/9073) - Community reports of binding resolution failures
- [better-sqlite3 binding issues with pnpm](https://github.com/kottster/kottster/issues/94) - Documented cases of native module failures
- [pnpm monorepo deployment discussion](https://github.com/orgs/pnpm/discussions/4478) - Community patterns for production deployment

### Tertiary (LOW confidence)
- Shell script deployment patterns from web search - General community practices, not project-specific

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Shell scripts + rsync are well-understood, no novel tooling needed
- Architecture: HIGH - Memory file relocation path is clear from code analysis; directory layout follows established XDG patterns
- Pitfalls: HIGH - Identified from direct code reading (memory-files location, native modules, circular dependency)
- Code examples: MEDIUM - Script skeletons are illustrative; pnpm workspace symlink behavior at install target needs testing during implementation

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (stable domain, no fast-moving dependencies)
