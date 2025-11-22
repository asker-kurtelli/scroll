# Scroll 🧭

> Navigate ChatGPT, Claude & Gemini conversations without endless scrolling

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.2.0-green.svg)

## The Problem

AI chat interfaces weren't designed for knowledge work. When you're deep in a long conversation with ChatGPT, Claude, or Gemini, finding that brilliant response from 20 minutes ago means scrolling... and scrolling... and hoping you remember where it was.

## The Solution

Scroll adds a floating navigation panel to AI chat interfaces. Jump to any prompt or response instantly. Navigate by headings. Never lose your place again.

## Features

- **One-Click Navigation** - Jump to any turn in the conversation instantly
- **Heading Navigation** - Navigate long AI responses by their headings
- **Adaptive UI** - Seamlessly matches each platform's design language
- **Keyboard Shortcuts** - Navigate without touching your mouse
- **Search & Filter** - Find specific conversations or responses
- **Progress Tracking** - Always know where you are in long threads
- **View Modes** - Toggle between all messages or prompts only
- **Universal** - Works on ChatGPT, Claude, and Gemini (so far)

## Installation

### From Chrome Web Store (Coming Soon)
[Link will be added once published]

### From Firefox Add-ons (Coming Soon)
[Link will be added once published]

### From Source

First clone this repository:
```bash
git clone https://github.com/asker-kurtelli/scroll.git
cd scroll
```

#### Chrome/Chromium/Edge/Brave

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer Mode** (toggle in top-right corner)
3. Click **Load unpacked** and select the `scroll` folder
4. Navigate to [ChatGPT](https://chatgpt.com), [Claude](https://claude.ai), or [Gemini](https://gemini.google.com)
5. Look for the Scroll button on the right side of your screen!

#### Firefox

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Navigate to the `scroll` folder and select the `manifest.json` file
4. Navigate to [ChatGPT](https://chatgpt.com), [Claude](https://claude.ai), or [Gemini](https://gemini.google.com)
5. Look for the Scroll button on the right side of your screen!

**Note:** Temporary add-ons in Firefox are removed when you close the browser. For permanent installation, you can either install from Firefox Add-ons (when published) or sign the extension yourself.

## Usage

### Basic Navigation

- **Open/Close**: Click the Scroll button or press `Cmd+;` (Mac) / `Ctrl+;` (Windows/Linux)
- **Jump to Message**: Click any item in the navigation panel
- **Navigate by Keyboard**:
  - `↓` or `j` - Move down
  - `↑` or `k` - Move up
  - `Enter` - Jump to selected item
  - `←` - Switch to "Prompts Only" view
  - `→` - Switch to "All" view
  - `Esc` - Close panel

### Advanced Features

- **Search**: Type in the search box to filter messages
- **Copy Text**: Right-click any navigation item to copy its content
- **View Modes**: Toggle between "Prompts" (user messages only) or "All" (including AI responses)
- **Progress Indicator**: See how far you've scrolled through the conversation

## Keyboard Shortcuts

| Shortcut       | Action                  |
|----------------|-------------------------|
| `Cmd/Ctrl + ;` | Toggle navigation panel |
| `↓` or `j`     | Navigate down           |
| `↑` or `k`     | Navigate up             |
| `Enter`        | Jump to selected item   |
| `←`            | Prompts only view       |
| `→`            | All messages view       |
| `Esc`          | Close panel             |

## Privacy

Scroll runs **entirely in your browser**. No data is collected, stored, or transmitted anywhere. The extension only reads page content to build the navigation panel.

[View the source code](https://github.com/asker-kurtelli/scroll) - it's all here.

## Roadmap

- [x] Basic navigation
- [x] Keyboard shortcuts
- [x] Search and filter
- [x] Heading navigation
- [x] Firefox support
- [ ] Pin favorite responses
- [ ] Export conversations
- [ ] Custom themes
- [ ] Markdown export
- [ ] Conversation bookmarks

Have an idea? [Open an issue](https://github.com/asker-kurtelli/scroll/issues)!

## Contributing

Contributions are welcome! Whether it's:

- 🐛 Bug reports
- 💡 Feature requests
- 📖 Documentation improvements
- 🔧 Code contributions

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

1. Fork and clone the repository
2. Make your changes
3. Test on ChatGPT, Claude, and Gemini
4. Submit a pull request

The codebase is vanilla JavaScript - no build step required!

## Built With

- Vanilla JavaScript (no frameworks)
- CSS3 with backdrop-filter for glass effects
- Chrome Extension Manifest V3
- MutationObserver for real-time updates

## Why Open Source?

I believe AI tools should work better for serious work. Open sourcing Scroll means:

- **Transparency** - You can see exactly what the extension does
- **Community** - Faster iteration with feedback and contributions
- **Trust** - No black boxes, no data collection
- **Learning** - Others can learn from and build on these ideas

## Browser Support

- ✅ Chrome/Chromium (tested)
- ✅ Firefox (supported)
- ⏳ Edge (needs testing)
- ⏳ Brave (needs testing)
- ⏳ Safari (investigating)

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

Built with frustration (from scrolling) and curiosity (about better UX for AI tools).

Inspired by everyone who's ever lost a great AI response in a long conversation.

## Support

- 🐛 [Report a bug](https://github.com/yourusername/scroll/issues)
- 💡 [Request a feature](https://github.com/yourusername/scroll/issues)
- 💬 [Discussions](https://github.com/yourusername/scroll/discussions)

## Author

Built by [Asker Kurt-Elli](https://x.com/askerkurtelli)

Building tools to make AI better for knowledge work. Follow along for more experiments.

---

**If Scroll saved you some scrolling, give it a ⭐️ on GitHub!**
