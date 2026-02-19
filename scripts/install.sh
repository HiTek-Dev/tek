#!/usr/bin/env bash
set -euo pipefail

# Tek Install Script
# Builds from source and deploys to a target directory.
# Usage: scripts/install.sh [INSTALL_DIR]

INSTALL_DIR="${1:-$HOME/tek}"
SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_DIR="$HOME/.config/tek"

echo "Tek Installer"
echo "============="
echo "Source:  $SOURCE_DIR"
echo "Target:  $INSTALL_DIR"
echo "Config:  $CONFIG_DIR"
echo ""

# 1. Check Node.js >= 22
echo "Checking Node.js version..."
if ! command -v node &>/dev/null; then
  echo "Error: Node.js is not installed. Please install Node.js 22 or later."
  exit 1
fi
node -e "if(parseInt(process.version.slice(1))<22){console.error('Error: Node.js 22+ required, found '+process.version);process.exit(1)}"
echo "Node.js $(node -v) OK"

# 2. Check pnpm
if ! command -v pnpm &>/dev/null; then
  echo "Error: pnpm is not installed. Please install pnpm first."
  exit 1
fi

# 3. Build in source
echo ""
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
rm -rf "$SOURCE_DIR/packages/gateway/dist"
(cd "$SOURCE_DIR/packages/gateway" && npx tsc -p tsconfig.json)
echo "  Building telegram..."
(cd "$SOURCE_DIR/packages/telegram" && npx tsc -p tsconfig.json)
echo "Build complete."

# 4. Create install directory
mkdir -p "$INSTALL_DIR"

# 5. Migrate from old config location if present
OLD_CONFIG="$HOME/.config/agentspace"
if [ -d "$OLD_CONFIG" ] && [ ! -d "$CONFIG_DIR" ]; then
  echo "Migrating config from $OLD_CONFIG to $CONFIG_DIR..."
  mv "$OLD_CONFIG" "$CONFIG_DIR"
  # Rename database file if it exists
  if [ -f "$CONFIG_DIR/agentspace.db" ]; then
    mv "$CONFIG_DIR/agentspace.db" "$CONFIG_DIR/tek.db"
  fi
  echo "Migration complete."
fi

# 6. Sync packages (excluding source files, dev artifacts, memory-files)
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

# 7. Copy root files
echo "Copying root files..."
cp "$SOURCE_DIR/package.json" "$INSTALL_DIR/package.json"
cp "$SOURCE_DIR/pnpm-lock.yaml" "$INSTALL_DIR/pnpm-lock.yaml"
cp "$SOURCE_DIR/pnpm-workspace.yaml" "$INSTALL_DIR/pnpm-workspace.yaml"

# 8. Sync root node_modules
echo "Syncing root node_modules..."
rsync -a --delete "$SOURCE_DIR/node_modules/" "$INSTALL_DIR/node_modules/"

# 9. Sync per-package node_modules
echo "Syncing package node_modules..."
for pkg in core db cli gateway telegram; do
  if [ -d "$SOURCE_DIR/packages/$pkg/node_modules" ]; then
    mkdir -p "$INSTALL_DIR/packages/$pkg/node_modules"
    rsync -a --delete \
      "$SOURCE_DIR/packages/$pkg/node_modules/" \
      "$INSTALL_DIR/packages/$pkg/node_modules/"
  fi
done

# 10. Seed memory templates on first install
mkdir -p "$CONFIG_DIR/memory/daily"
if [ ! -f "$CONFIG_DIR/memory/SOUL.md" ]; then
  cp "$SOURCE_DIR/packages/db/memory-files/SOUL.md" "$CONFIG_DIR/memory/"
  cp "$SOURCE_DIR/packages/db/memory-files/MEMORY.md" "$CONFIG_DIR/memory/"
  echo "Seeded default personality and memory files."
fi

# 11. Create bin symlink
mkdir -p "$INSTALL_DIR/bin"
ln -sf "../packages/cli/dist/index.js" "$INSTALL_DIR/bin/tek"
chmod +x "$INSTALL_DIR/packages/cli/dist/index.js"

# 12. Write .version file
VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$SOURCE_DIR/package.json','utf-8')).version || '0.0.0')")
COMMIT=$(cd "$SOURCE_DIR" && git rev-parse --short HEAD 2>/dev/null || echo "unknown")
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
NODE_VER=$(node -v)

cat > "$INSTALL_DIR/.version" <<VEOF
{
  "version": "$VERSION",
  "sourceCommit": "$COMMIT",
  "installedAt": "$NOW",
  "updatedAt": "$NOW",
  "nodeVersion": "$NODE_VER"
}
VEOF

echo ""
echo "Tek installed successfully to $INSTALL_DIR"
echo ""
echo "To add tek to your PATH, add this line to your shell profile (~/.zshrc or ~/.bashrc):"
echo "  export PATH=\"$INSTALL_DIR/bin:\$PATH\""
echo ""
echo "Then start the gateway:"
echo "  tek gateway start"
