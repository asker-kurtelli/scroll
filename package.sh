#!/bin/bash
# Package script for Scroll extension
# Creates distribution packages for Chrome and Firefox

set -e  # Exit on any error

# Create dist directory if it doesn't exist
mkdir -p dist

echo "Creating Chrome distribution package..."
# Backup current manifest if not already backed up
if [ ! -f "manifest.backup.json" ]; then
    cp manifest.json manifest.backup.json
fi
# Ensure Chrome manifest is in place
cp manifest.backup.json manifest.json
# Create Chrome package
zip -r dist/scroll-chrome.zip manifest.json content.js styles.css models.ts README.md LICENSE contributing.md -x "*/.*" "*.md" "FIREFOX*" "BUILDING*" "package.sh" "build.sh" "*.bat" "QWEN*" "dist/*"
echo "Chrome package created: dist/scroll-chrome.zip"

echo "Creating Firefox distribution package..."
# Use Firefox manifest
cp manifest.firefox.json manifest.json
# Create Firefox package
zip -r dist/scroll-firefox.zip manifest.json content.js styles.css models.ts README.md LICENSE contributing.md -x "*/.*" "*.md" "FIREFOX*" "BUILDING*" "package.sh" "build.sh" "*.bat" "QWEN*" "dist/*"
echo "Firefox package created: dist/scroll-firefox.zip"

# Restore original manifest
cp manifest.backup.json manifest.json

echo "Distribution packages created in dist/ directory"
echo "Remember to test both packages before distribution!"