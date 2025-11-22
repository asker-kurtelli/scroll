#!/bin/bash
# Build script for Scroll extension
# Use this script to prepare the extension for different browsers

# Function to show usage
show_usage() {
    echo "Usage: $0 [chrome|firefox]"
    echo "  chrome  - Prepare extension directory for Chrome development"
    echo "  firefox - Prepare extension directory for Firefox and create Firefox package"
    exit 1
}

# Set default target to chrome if no argument provided
TARGET=${1:-chrome}

if [ "$TARGET" = "chrome" ]; then
    echo "Preparing extension directory for Chrome development..."
    if [ -f "manifest.backup.json" ]; then
        cp manifest.backup.json manifest.json
        rm manifest.backup.json
        echo "Restored original manifest.json for Chrome development"
    else
        echo "Original manifest.json already in place for Chrome development"
    fi
elif [ "$TARGET" = "firefox" ]; then
    echo "Preparing extension directory for Firefox and creating distribution package..."

    # Create dist directory if it doesn't exist
    mkdir -p dist

    # Backup current manifest if not already backed up
    if [ ! -f "manifest.backup.json" ]; then
        cp manifest.json manifest.backup.json
        echo "Backed up original manifest.json"
    fi

    # Use Firefox manifest
    cp manifest.firefox.json manifest.json
    echo "Updated manifest.json for Firefox compatibility"

    # Create Firefox package
    echo "Creating Firefox distribution package..."
    zip -r dist/scroll-firefox.zip manifest.json content.js styles.css models.ts README.md LICENSE contributing.md -x "*/.*" "*.md" "FIREFOX*" "BUILDING*" "package.sh" "build.sh" "*.bat" "QWEN*" "dist/*"
    echo "Firefox package created: dist/scroll-firefox.zip"

    # Restore original manifest for Chrome
    cp manifest.backup.json manifest.json
    rm manifest.backup.json
    echo "Restored original manifest.json for Chrome development"
else
    echo "Invalid target: $TARGET"
    show_usage
fi

echo "Build complete for $TARGET!"