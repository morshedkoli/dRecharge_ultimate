#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# dRecharge Agent — release build script
# Produces one APK per ABI with R8 + obfuscation enabled.
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DEBUG_INFO_DIR="build/debug-info"
OUTPUT_DIR="build/app/outputs/flutter-apk"

echo "▸ Cleaning previous build artifacts..."
flutter clean

echo "▸ Fetching dependencies..."
flutter pub get

echo "▸ Building per-ABI release APKs..."
flutter build apk \
  --split-per-abi \
  --release \
  --obfuscate \
  --split-debug-info="$DEBUG_INFO_DIR"

echo ""
echo "✓ Build complete. Output APKs:"
for apk in "$OUTPUT_DIR"/*-release.apk; do
  size=$(du -sh "$apk" 2>/dev/null | cut -f1)
  echo "  ${size}  ${apk##*/}"
done

echo ""
echo "Debug symbols saved to: $DEBUG_INFO_DIR"
echo "  (Required for deobfuscating crash stack traces — keep them safe!)"
