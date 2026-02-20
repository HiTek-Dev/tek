#!/usr/bin/env bash
set -euo pipefail

# Tek Remote Installer
# Downloads pre-built artifacts from CDN and installs on ARM64 Mac.
# Usage: curl -fsSL https://tekpartner.b-cdn.net/tek/dist/install.sh | bash
#   or:  curl -fsSL https://tekpartner.b-cdn.net/tek/dist/install.sh | bash -s -- /custom/path

CDN_BASE="https://tekpartner.b-cdn.net/tek/dist"

echo ""
echo "  ╔════════════════════════════════════════╗"
echo "  ║          Tek Installer                 ║"
echo "  ║  AI Agent Gateway Platform             ║"
echo "  ╚════════════════════════════════════════╝"
echo ""

# 1. Platform check
OS=$(uname -s)
ARCH=$(uname -m)
if [ "$OS" != "Darwin" ]; then
  echo "Error: Tek currently supports macOS only. Detected: $OS"
  exit 1
fi
if [ "$ARCH" != "arm64" ]; then
  echo "Error: Tek currently supports Apple Silicon (ARM64) only. Detected: $ARCH"
  exit 1
fi
echo "  Platform: macOS ARM64 ✓"

# 2. Check Node.js >= 22
if ! command -v node &>/dev/null; then
  echo ""
  echo "Error: Node.js is not installed."
  echo "Install Node.js 22 or later: https://nodejs.org/"
  echo ""
  echo "Quick install with Homebrew:"
  echo "  brew install node@22"
  exit 1
fi
NODE_MAJOR=$(node -e "console.log(parseInt(process.version.slice(1)))")
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo ""
  echo "Error: Node.js 22+ required, found $(node -v)"
  echo "Upgrade: brew install node@22"
  exit 1
fi
echo "  Node.js:  $(node -v) ✓"

# 3. Determine install directory
# Accept path as argument, prompt interactively, or use default
if [ $# -gt 0 ]; then
  INSTALL_DIR="$1"
elif [ -t 0 ]; then
  printf "\n  Install directory [%s/tek]: " "$HOME"
  read -r INSTALL_DIR
  INSTALL_DIR="${INSTALL_DIR:-$HOME/tek}"
else
  INSTALL_DIR="$HOME/tek"
fi

# Expand ~ if user typed it
INSTALL_DIR="${INSTALL_DIR/#\~/$HOME}"

CONFIG_DIR="$HOME/.config/tek"

echo ""
echo "  Install to: $INSTALL_DIR"
echo "  Config at:  $CONFIG_DIR"

# 4. Check for existing install
if [ -d "$INSTALL_DIR" ] && [ -f "$INSTALL_DIR/.version" ]; then
  EXISTING_VER=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$INSTALL_DIR/.version','utf-8')).version)" 2>/dev/null || echo "unknown")
  echo ""
  echo "  ⚠  Existing installation found (v$EXISTING_VER)"
  echo "     This will overwrite the backend files."
  echo "     Config and data in ~/.config/tek/ will be preserved."
  if [ -t 0 ]; then
    printf "\n  Continue? [Y/n]: "
    read -r CONFIRM
    CONFIRM="${CONFIRM:-Y}"
    if [[ ! "$CONFIRM" =~ ^[Yy] ]]; then
      echo "  Cancelled."
      exit 0
    fi
  fi
fi

# 5. Create temp dir with cleanup trap
TMPDIR_INSTALL=$(mktemp -d)
trap 'rm -rf "$TMPDIR_INSTALL"' EXIT

# 6. Download version info
echo ""
echo "  Downloading version info..."
curl -fsSL "$CDN_BASE/version.json?t=$(date +%s)" -o "$TMPDIR_INSTALL/version.json"
VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TMPDIR_INSTALL/version.json','utf-8')).version)")
COMMIT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TMPDIR_INSTALL/version.json','utf-8')).commit)")
DMG_NAME=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TMPDIR_INSTALL/version.json','utf-8')).dmgFilename)")
BACKEND_FILENAME=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TMPDIR_INSTALL/version.json','utf-8')).backendFilename)")
BACKEND_MD5=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TMPDIR_INSTALL/version.json','utf-8')).backendMd5)")
echo "  Installing Tek v$VERSION (${COMMIT})..."

# 7. Download backend (unique filename per build avoids stale CDN cache)
echo ""
echo "  Downloading backend packages..."
curl -fSL --progress-bar "$CDN_BASE/$BACKEND_FILENAME" -o "$TMPDIR_INSTALL/backend.tar.gz"

# 7a. Verify download integrity
DL_MD5=$(md5 -q "$TMPDIR_INSTALL/backend.tar.gz")
if [ "$DL_MD5" != "$BACKEND_MD5" ]; then
  echo ""
  echo "  ✗ Download integrity check failed!"
  echo "    Expected: $BACKEND_MD5"
  echo "    Got:      $DL_MD5"
  echo "    Try running the installer again."
  exit 1
fi
echo "  Verified ✓"

# 8. Download desktop app DMG
echo "  Downloading desktop app..."
curl -fSL --progress-bar "$CDN_BASE/$DMG_NAME" -o "$TMPDIR_INSTALL/Tek.dmg"

# 9. Stop gateway if running (existing install)
if [ -f "$CONFIG_DIR/runtime.json" ]; then
  GW_PID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$CONFIG_DIR/runtime.json','utf-8')).pid)" 2>/dev/null || echo "")
  if [ -n "$GW_PID" ] && kill -0 "$GW_PID" 2>/dev/null; then
    echo ""
    echo "  Stopping running gateway (PID $GW_PID)..."
    kill "$GW_PID" 2>/dev/null || true
    sleep 2
  fi
  rm -f "$CONFIG_DIR/runtime.json"
fi

# 10. Extract backend
echo ""
echo "  Extracting backend..."
mkdir -p "$INSTALL_DIR"
tar -xzf "$TMPDIR_INSTALL/backend.tar.gz" -C "$INSTALL_DIR"

# 11. Create bin symlink
mkdir -p "$INSTALL_DIR/bin"
ln -sf "../packages/cli/dist/index.js" "$INSTALL_DIR/bin/tek"
chmod +x "$INSTALL_DIR/packages/cli/dist/index.js"

# 12. Seed memory files (first install only)
mkdir -p "$CONFIG_DIR/memory/daily"
if [ ! -f "$CONFIG_DIR/memory/SOUL.md" ] && [ -d "$INSTALL_DIR/memory-files" ]; then
  cp "$INSTALL_DIR/memory-files/SOUL.md" "$CONFIG_DIR/memory/"
  cp "$INSTALL_DIR/memory-files/MEMORY.md" "$CONFIG_DIR/memory/"
  echo "  Seeded default personality and memory files."
fi

# 13. Write .version file
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Preserve installedAt from existing install
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
  "nodeVersion": "$(node -v)"
}
VEOF

# 14. Install desktop app
echo ""
echo "  Installing Tek desktop app..."
MOUNT_POINT=""
if hdiutil attach "$TMPDIR_INSTALL/Tek.dmg" -nobrowse -quiet -mountpoint "/Volumes/Tek-Install" 2>/dev/null; then
  MOUNT_POINT="/Volumes/Tek-Install"
fi

if [ -z "$MOUNT_POINT" ]; then
  # Fallback: find mount point from hdiutil output
  MOUNT_POINT=$(hdiutil attach "$TMPDIR_INSTALL/Tek.dmg" -nobrowse 2>/dev/null | grep "/Volumes" | sed 's/.*\(\/Volumes\/.*\)/\1/' | xargs)
fi

if [ -n "$MOUNT_POINT" ] && [ -d "$MOUNT_POINT" ]; then
  # Remove existing app first for clean install
  if [ -d "/Applications/Tek.app" ]; then
    rm -rf "/Applications/Tek.app"
  fi
  cp -R "$MOUNT_POINT/Tek.app" /Applications/
  hdiutil detach "$MOUNT_POINT" -quiet 2>/dev/null || true
  echo "  Tek.app installed to /Applications/ ✓"
else
  echo "  ⚠  Could not mount DMG automatically."
  echo "     The DMG is at: $TMPDIR_INSTALL/Tek.dmg"
  echo "     Open it manually to drag Tek.app to Applications."
  # Keep temp dir alive so user can access the DMG
  trap '' EXIT
fi

# 15. Set up PATH
echo ""
PATH_LINE="export PATH=\"$INSTALL_DIR/bin:\$PATH\""
SHELL_RC="$HOME/.zshrc"
PATH_ALREADY_SET=false

if grep -q "$INSTALL_DIR/bin" "$SHELL_RC" 2>/dev/null; then
  PATH_ALREADY_SET=true
fi

if [ "$PATH_ALREADY_SET" = false ]; then
  # Add PATH automatically (both interactive and piped curl modes)
  echo "" >> "$SHELL_RC"
  echo "# Tek AI Agent Gateway" >> "$SHELL_RC"
  echo "$PATH_LINE" >> "$SHELL_RC"
  echo "  Added to $SHELL_RC ✓"
else
  echo "  PATH already configured ✓"
fi

# 16. Success!
echo ""
echo "  ╔════════════════════════════════════════╗"
echo "  ║  Tek v$VERSION installed!                "
echo "  ╚════════════════════════════════════════╝"
echo ""
echo "  Get started:"
echo ""
echo "    source ~/.zshrc              # load PATH in this terminal"
echo "    tek init                     # setup wizard (API keys, model)"
echo "    tek onboard                  # create your first agent"
echo "    tek gateway start            # start the gateway server"
echo "    tek chat                     # start chatting"
echo ""
echo "  Or use the full path directly:"
echo ""
echo "    $INSTALL_DIR/bin/tek init"
echo ""
echo "  Desktop app: open /Applications/Tek.app"
echo "  Uninstall:   tek uninstall"
echo ""
