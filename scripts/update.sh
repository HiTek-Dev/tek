#!/usr/bin/env bash
set -euo pipefail

# Tek Update Script
# Rebuilds from source and syncs updated code to install directory.
# Does NOT touch user data in ~/.config/tek/ (except reading runtime.json to stop gateway).
# Usage: scripts/update.sh [INSTALL_DIR]

INSTALL_DIR="${1:-$HOME/tek}"
SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_DIR="$HOME/.config/tek"
RUNTIME="$CONFIG_DIR/runtime.json"

echo "Tek Updater"
echo "==========="
echo "Source:  $SOURCE_DIR"
echo "Target:  $INSTALL_DIR"
echo ""

# 1. Verify install directory exists
if [ ! -d "$INSTALL_DIR" ]; then
  echo "Error: $INSTALL_DIR does not exist. Run install.sh first."
  exit 1
fi

# 2. Stop gateway if running
if [ -f "$RUNTIME" ]; then
  PID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$RUNTIME','utf-8')).pid)" 2>/dev/null || echo "")
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "Stopping gateway (PID $PID)..."
    kill "$PID"
    for i in $(seq 1 10); do
      [ ! -f "$RUNTIME" ] && break
      sleep 0.5
    done
  fi
  rm -f "$RUNTIME"
fi

# 3. Build fresh
echo "Building from source..."
cd "$SOURCE_DIR" && pnpm install

# Build packages individually in dependency order
# cli and gateway have a cyclic dependency (cli imports gateway types,
# gateway imports cli/vault). Two-pass build resolves this.
echo "  Building core..."
(cd "$SOURCE_DIR/packages/core" && npx tsc -p tsconfig.json)
echo "  Building db..."
(cd "$SOURCE_DIR/packages/db" && npx tsc -p tsconfig.json)
echo "  Building gateway (pass 1)..."
(cd "$SOURCE_DIR/packages/gateway" && npx tsc -p tsconfig.json 2>/dev/null) || true
echo "  Building cli..."
(cd "$SOURCE_DIR/packages/cli" && npx tsc -p tsconfig.json)
echo "  Building gateway (pass 2)..."
(cd "$SOURCE_DIR/packages/gateway" && npx tsc -p tsconfig.json)
echo "  Building telegram..."
(cd "$SOURCE_DIR/packages/telegram" && npx tsc -p tsconfig.json)
echo "Build complete."

# 4. Sync packages (excluding source files, dev artifacts, memory-files)
echo ""
echo "Syncing packages..."
rsync -a --delete \
  --exclude='src/' \
  --exclude='*.tsbuildinfo' \
  --exclude='.turbo/' \
  --exclude='memory-files/' \
  --exclude='.env' \
  --exclude='tsconfig*.json' \
  --exclude='vitest.config.*' \
  --exclude='biome.json' \
  "$SOURCE_DIR/packages/" "$INSTALL_DIR/packages/"

# 5. Copy root files
echo "Copying root files..."
cp "$SOURCE_DIR/package.json" "$INSTALL_DIR/package.json"
cp "$SOURCE_DIR/pnpm-lock.yaml" "$INSTALL_DIR/pnpm-lock.yaml"
cp "$SOURCE_DIR/pnpm-workspace.yaml" "$INSTALL_DIR/pnpm-workspace.yaml"

# 6. Sync root node_modules
echo "Syncing root node_modules..."
rsync -a --delete "$SOURCE_DIR/node_modules/" "$INSTALL_DIR/node_modules/"

# 7. Sync per-package node_modules
echo "Syncing package node_modules..."
for pkg in core db cli gateway telegram; do
  if [ -d "$SOURCE_DIR/packages/$pkg/node_modules" ]; then
    mkdir -p "$INSTALL_DIR/packages/$pkg/node_modules"
    rsync -a --delete \
      "$SOURCE_DIR/packages/$pkg/node_modules/" \
      "$INSTALL_DIR/packages/$pkg/node_modules/"
  fi
done

# 8. Update .version file (preserve installedAt from existing)
VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$SOURCE_DIR/package.json','utf-8')).version || '0.0.0')")
COMMIT=$(cd "$SOURCE_DIR" && git rev-parse --short HEAD 2>/dev/null || echo "unknown")
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
NODE_VER=$(node -v)

# Read existing installedAt or use current time
if [ -f "$INSTALL_DIR/.version" ]; then
  INSTALLED_AT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$INSTALL_DIR/.version','utf-8')).installedAt)" 2>/dev/null || echo "$NOW")
else
  INSTALLED_AT="$NOW"
fi

cat > "$INSTALL_DIR/.version" <<VEOF
{
  "version": "$VERSION",
  "sourceCommit": "$COMMIT",
  "installedAt": "$INSTALLED_AT",
  "updatedAt": "$NOW",
  "nodeVersion": "$NODE_VER"
}
VEOF

echo ""
echo "Tek updated successfully."
echo "Start the gateway:"
echo "  tek gateway start"
