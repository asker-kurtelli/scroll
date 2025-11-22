#!/bin/bash
# Packaging script for Scroll extension
# Creates distribution packages for Chrome and Firefox from current state

set -e  # Exit on any error

# Create dist directory if it doesn't exist
mkdir -p dist

echo "Creating distribution package from current manifest..."
# Create package from current manifest
zip -r dist/scroll-current.zip manifest.json content.js styles.css models.ts README.md LICENSE contributing.md -x "*/.*" "*.md" "FIREFOX*" "BUILDING*" "package.sh" "build.sh" "*.bat" "QWEN*" "dist/*"
echo "Package created: dist/scroll-current.zip"

echo "Distribution package created in dist/ directory"
echo "Remember to test the package before distribution!"