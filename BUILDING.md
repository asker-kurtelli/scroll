# Building Scroll Extension for Different Browsers

This document explains how to build and package the Scroll extension for different browsers while maintaining compatibility.

## Build System

The build system uses simple scripts to switch between Chrome and Firefox manifests:

### For Chrome
```bash
./build.sh chrome
```
or on Windows:
```
build.bat chrome
```

### For Firefox
```bash
./build.sh firefox
```
or on Windows:
```
build.bat firefox
```

## Implementation Details

### Chrome Build (Default)
- Uses the original `manifest.json`
- Maintains Manifest V3 compatibility
- Preserves all original Chrome functionality

### Firefox Build
- Uses `manifest.firefox.json` (Manifest V2)
- Includes explicit host permissions
- Adds browser-specific settings for Firefox

## Development Workflow

1. Make your changes to the source files (content.js, styles.css, etc.)
2. Test in Chrome using the original manifest.json
3. When ready to test in Firefox:
   ```bash
   ./build.sh firefox
   ```
4. Load the extension in Firefox to test
5. When done with Firefox testing:
   ```bash
   ./build.sh chrome
   ```

## Packaging for Distribution

### Chrome Web Store
- Use the original manifest.json
- Package all files into a ZIP archive

### Firefox Add-ons
- Use the manifest.json generated with `build.sh firefox`
- Package all files into a ZIP archive

## Testing Checklist

Before releasing an update, make sure to test on both browsers:

### Chrome
- [ ] Extension loads properly
- [ ] All UI elements display correctly
- [ ] Navigation works on all supported platforms (Claude, ChatGPT, Gemini)
- [ ] Keyboard shortcuts work properly
- [ ] Search and filtering works
- [ ] No console errors

### Firefox
- [ ] Extension loads as temporary add-on
- [ ] All UI elements display correctly
- [ ] Navigation works on all supported platforms (Claude, ChatGPT, Gemini)
- [ ] Keyboard shortcuts work properly
- [ ] Search and filtering works
- [ ] No console errors