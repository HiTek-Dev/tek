#!/usr/bin/env bash
set -euo pipefail

# Tek CDN Upload Script
# Uploads dist/ artifacts to BunnyCDN storage zone.
# Requires .env with BunnyCDN credentials.
# Usage: scripts/upload-cdn.sh

SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Tek CDN Uploader"
echo "================"
echo ""

# 1. Load .env
if [ ! -f "$SOURCE_DIR/.env" ]; then
  echo "Error: .env file not found at $SOURCE_DIR/.env"
  echo "Copy .env.example to .env and fill in your BunnyCDN API key."
  exit 1
fi
set -a
# shellcheck source=/dev/null
source "$SOURCE_DIR/.env"
set +a

# 2. Validate required env vars
MISSING=""
for var in BUNNYCDN_API_KEY BUNNYCDN_STORAGE_ZONE BUNNY_STORAGE_URL BUNNY_UPLOAD_BASE_PATH; do
  if [ -z "${!var:-}" ]; then
    MISSING="$MISSING $var"
  fi
done
if [ -n "$MISSING" ]; then
  echo "Error: Missing required environment variables:$MISSING"
  echo "Check your .env file."
  exit 1
fi

# 3. Read version.json for dynamic filenames
DIST_DIR="$SOURCE_DIR/dist"
if [ ! -f "$DIST_DIR/version.json" ]; then
  echo "Error: dist/version.json not found. Run scripts/dist.sh first."
  exit 1
fi
BACKEND_FILENAME=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$DIST_DIR/version.json','utf-8')).backendFilename)")
BACKEND_MD5=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$DIST_DIR/version.json','utf-8')).backendMd5)")

if [ ! -f "$DIST_DIR/$BACKEND_FILENAME" ]; then
  echo "Error: dist/$BACKEND_FILENAME not found. Run scripts/dist.sh first."
  exit 1
fi
DMG_FILE=$(ls "$DIST_DIR/"*.dmg 2>/dev/null | head -1)
if [ -z "$DMG_FILE" ]; then
  echo "Error: No .dmg file found in dist/. Run scripts/dist.sh first."
  exit 1
fi
DMG_NAME=$(basename "$DMG_FILE")

# 4. Upload artifacts
UPLOAD_BASE="$BUNNY_STORAGE_URL/$BUNNYCDN_STORAGE_ZONE/$BUNNY_UPLOAD_BASE_PATH"

upload_file() {
  local file="$1"
  local name="$2"
  local size
  size=$(du -h "$file" | cut -f1)
  echo -n "Uploading $name ($size)..."
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --fail \
    -H "AccessKey: $BUNNYCDN_API_KEY" \
    -H "Content-Type: application/octet-stream" \
    -T "$file" \
    "$UPLOAD_BASE/$name")
  echo " $HTTP_CODE OK"
}

upload_file "$DIST_DIR/version.json" "version.json"
upload_file "$DIST_DIR/$BACKEND_FILENAME" "$BACKEND_FILENAME"
upload_file "$DMG_FILE" "$DMG_NAME"
upload_file "$SOURCE_DIR/scripts/remote-install.sh" "install.sh"

# 5. Purge CDN edge cache for version.json and install.sh (backend uses unique filenames)
PULL_ZONE="${BUNNY_PULL_ZONE_URL:-https://tekpartner.b-cdn.net}"
if [ -n "${BUNNY_ACCOUNT_API_KEY:-}" ]; then
  echo ""
  echo "Purging CDN cache (version.json + install.sh)..."
  for name in version.json install.sh; do
    curl -s -o /dev/null -X POST \
      "https://api.bunny.net/purge?url=$PULL_ZONE/$BUNNY_UPLOAD_BASE_PATH/$name" \
      -H "AccessKey: $BUNNY_ACCOUNT_API_KEY"
    echo "  Purged $name"
  done
  echo "  Backend tarball uses unique filename — no purge needed."
else
  echo ""
  echo "⚠  BUNNY_ACCOUNT_API_KEY not set — skipping cache purge."
fi

# 6. Verify upload integrity
echo ""
echo "Verifying upload integrity..."
DL_MD5=$(curl -fsSL "$PULL_ZONE/$BUNNY_UPLOAD_BASE_PATH/$BACKEND_FILENAME" | md5 -q)
if [ "$DL_MD5" = "$BACKEND_MD5" ]; then
  echo "  ✓ Checksum verified: $BACKEND_MD5"
else
  echo "  ✗ Checksum MISMATCH!"
  echo "    Expected: $BACKEND_MD5"
  echo "    Got:      $DL_MD5"
  echo "    CDN may need time for cache propagation. Try again in 30 seconds."
  exit 1
fi

# 7. Print success
echo ""
echo "Upload complete!"
echo ""
echo "CDN URLs:"
echo "  $PULL_ZONE/$BUNNY_UPLOAD_BASE_PATH/version.json"
echo "  $PULL_ZONE/$BUNNY_UPLOAD_BASE_PATH/$BACKEND_FILENAME"
echo "  $PULL_ZONE/$BUNNY_UPLOAD_BASE_PATH/$DMG_NAME"
echo "  $PULL_ZONE/$BUNNY_UPLOAD_BASE_PATH/install.sh"
echo ""
echo "Install command for users:"
echo "  curl -fsSL $PULL_ZONE/$BUNNY_UPLOAD_BASE_PATH/install.sh | bash"
