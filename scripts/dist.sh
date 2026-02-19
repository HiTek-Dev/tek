#!/usr/bin/env bash
set -euo pipefail

# Tek Distribution Build Script
# Builds all backend packages and Tauri app, producing dist/ artifacts.
# Usage: scripts/dist.sh

SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Tek Distribution Builder"
echo "========================"
echo "Source: $SOURCE_DIR"
echo ""

# 1. Clean and create dist directories
echo "Cleaning dist/..."
rm -rf "$SOURCE_DIR/dist"
mkdir -p "$SOURCE_DIR/dist" "$SOURCE_DIR/dist/staging"

# 2. Build all Node.js packages (same order as install.sh)
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

# 3. Build Tauri desktop app
echo ""
echo "Building Tauri desktop app..."
cd "$SOURCE_DIR/apps/desktop" && pnpm tauri build --target aarch64-apple-darwin
echo "Tauri build complete."

# 4. Create backend staging directory (mirrors install.sh rsync)
echo ""
echo "Staging backend artifacts..."
rsync -a \
  --exclude='src/' \
  --exclude='*.tsbuildinfo' \
  --exclude='.turbo/' \
  --exclude='memory-files/' \
  --exclude='.env' \
  --exclude='tsconfig*.json' \
  --exclude='vitest.config.*' \
  --exclude='biome.json' \
  "$SOURCE_DIR/packages/" "$SOURCE_DIR/dist/staging/packages/"

# Copy root files
cp "$SOURCE_DIR/package.json" "$SOURCE_DIR/dist/staging/package.json"
cp "$SOURCE_DIR/pnpm-lock.yaml" "$SOURCE_DIR/dist/staging/pnpm-lock.yaml"
cp "$SOURCE_DIR/pnpm-workspace.yaml" "$SOURCE_DIR/dist/staging/pnpm-workspace.yaml"

# Sync root node_modules
rsync -a "$SOURCE_DIR/node_modules/" "$SOURCE_DIR/dist/staging/node_modules/"

# Sync per-package node_modules
for pkg in core db cli gateway telegram; do
  if [ -d "$SOURCE_DIR/packages/$pkg/node_modules" ]; then
    mkdir -p "$SOURCE_DIR/dist/staging/packages/$pkg/node_modules"
    rsync -a \
      "$SOURCE_DIR/packages/$pkg/node_modules/" \
      "$SOURCE_DIR/dist/staging/packages/$pkg/node_modules/"
  fi
done

# Copy memory template files (so remote installer can seed them)
mkdir -p "$SOURCE_DIR/dist/staging/memory-files"
cp "$SOURCE_DIR/packages/db/memory-files/"*.md "$SOURCE_DIR/dist/staging/memory-files/"

# 5. Create tarball
echo "Creating backend tarball..."
tar -czf "$SOURCE_DIR/dist/tek-backend-arm64.tar.gz" -C "$SOURCE_DIR/dist/staging" .

# 6. Copy DMG from Tauri build output
echo "Copying DMG..."
DMG_FILE=$(ls "$SOURCE_DIR/apps/desktop/src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/"*.dmg 2>/dev/null | head -1)
if [ -z "$DMG_FILE" ]; then
  echo "Error: No DMG file found in Tauri build output."
  exit 1
fi
DMG_NAME=$(basename "$DMG_FILE")
cp "$DMG_FILE" "$SOURCE_DIR/dist/$DMG_NAME"

# 7. Create version.json (includes DMG filename for remote installer)
VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$SOURCE_DIR/package.json','utf-8')).version || '0.0.0')")
COMMIT=$(cd "$SOURCE_DIR" && git rev-parse --short HEAD 2>/dev/null || echo "unknown")
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > "$SOURCE_DIR/dist/version.json" <<VEOF
{
  "version": "$VERSION",
  "commit": "$COMMIT",
  "date": "$NOW",
  "arch": "aarch64",
  "platform": "darwin",
  "dmgFilename": "$DMG_NAME",
  "backendFilename": "tek-backend-arm64.tar.gz"
}
VEOF

# 8. Print summary
echo ""
echo "Distribution artifacts:"
echo "======================="
for f in "$SOURCE_DIR/dist/tek-backend-arm64.tar.gz" "$SOURCE_DIR/dist/$DMG_NAME" "$SOURCE_DIR/dist/version.json"; do
  SIZE=$(du -h "$f" | cut -f1)
  echo "  $SIZE  $(basename "$f")"
done

# 9. Clean up staging
rm -rf "$SOURCE_DIR/dist/staging"

echo ""
echo "Done! Artifacts in $SOURCE_DIR/dist/"
echo ""
echo "Next: scripts/upload-cdn.sh"
