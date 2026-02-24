#!/usr/bin/env bash
set -euo pipefail

# Tek Install Script
# Builds from source and deploys to a target directory.
# Handles both fresh installs and updates (merges update.sh functionality).
# Usage: scripts/install.sh [INSTALL_DIR]

INSTALL_DIR="${1:-$HOME/tek}"
SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_DIR="$HOME/.config/tek"
RUNTIME="$CONFIG_DIR/runtime.json"

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

# 3. Stop gateway if running (prevents file-in-use issues during sync)
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

# 4. Build in source
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
echo "  Building telegram..."
(cd "$SOURCE_DIR/packages/telegram" && npx tsc -p tsconfig.json)
echo "  Building gateway (pass 2)..."
rm -rf "$SOURCE_DIR/packages/gateway/dist"
(cd "$SOURCE_DIR/packages/gateway" && npx tsc -p tsconfig.json)
echo "Build complete."

# 5. Create install directory
mkdir -p "$INSTALL_DIR"

# 6. Migrate from old config location if present
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

# 7. Sync packages (excluding source files, dev artifacts, memory-files)
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

# 8. Copy root files
echo "Copying root files..."
cp "$SOURCE_DIR/package.json" "$INSTALL_DIR/package.json"
cp "$SOURCE_DIR/pnpm-lock.yaml" "$INSTALL_DIR/pnpm-lock.yaml"
cp "$SOURCE_DIR/pnpm-workspace.yaml" "$INSTALL_DIR/pnpm-workspace.yaml"

# 9. Install dependencies at install location
#    pnpm uses symlinks that break when copied via rsync, so we install fresh
echo "Installing dependencies at $INSTALL_DIR..."
cd "$INSTALL_DIR" && pnpm install --prod --frozen-lockfile 2>/dev/null || pnpm install --prod

# 11. Seed memory templates on first install
mkdir -p "$CONFIG_DIR/memory/daily"
if [ ! -f "$CONFIG_DIR/memory/SOUL.md" ]; then
  cp "$SOURCE_DIR/packages/db/memory-files/SOUL.md" "$CONFIG_DIR/memory/"
  cp "$SOURCE_DIR/packages/db/memory-files/MEMORY.md" "$CONFIG_DIR/memory/"
  echo "Seeded default personality and memory files."
fi

# 12. Build and install desktop app to /Applications (macOS)
if [ "$(uname)" = "Darwin" ]; then
  TAURI_DIR="$SOURCE_DIR/apps/desktop"
  if [ -f "$TAURI_DIR/src-tauri/tauri.conf.json" ]; then
    echo ""
    echo "Building desktop app..."
    cd "$TAURI_DIR" && pnpm tauri build --target aarch64-apple-darwin --bundles app 2>&1 | tail -3
    APP_BUNDLE="$TAURI_DIR/src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Tek.app"
    if [ -d "$APP_BUNDLE" ]; then
      echo "Installing Tek.app to /Applications..."
      rm -rf /Applications/Tek.app
      cp -R "$APP_BUNDLE" /Applications/
      echo "Tek.app installed."
    else
      echo "Warning: Tek.app bundle not found, skipping desktop install."
    fi
  fi
fi

# 13. Create bin symlink
mkdir -p "$INSTALL_DIR/bin"
ln -sf "../packages/cli/dist/index.js" "$INSTALL_DIR/bin/tek"
chmod +x "$INSTALL_DIR/packages/cli/dist/index.js"

# 14. Record install path
mkdir -p "$CONFIG_DIR"
echo "$INSTALL_DIR" > "$CONFIG_DIR/install-path"

# 15. Write .version file (preserve installedAt from existing install)
VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$SOURCE_DIR/package.json','utf-8')).version || '0.0.0')")
COMMIT=$(cd "$SOURCE_DIR" && git rev-parse --short HEAD 2>/dev/null || echo "unknown")
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
NODE_VER=$(node -v)

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
  "nodeVersion": "$NODE_VER",
  "installDir": "$INSTALL_DIR"
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
