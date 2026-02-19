# Contributing to Scroll

Thanks for your interest in contributing!

## Setup

```bash
git clone https://github.com/asker-kurtelli/scroll.git
cd scroll
npm install
npm run dev          # Vite dev server with HMR
npm run build        # Production build to dist/
npm run build:firefox  # Firefox build to dist-firefox/
npm run typecheck    # TypeScript type checking
```

Load `dist/` as an unpacked extension in Chrome (`chrome://extensions` > Developer Mode > Load Unpacked).

## Ways to contribute

**Report bugs** — Open an issue with steps to reproduce, expected vs actual behavior, browser version, and which platform (ChatGPT/Claude/Gemini).

**Suggest features** — Open an issue describing the problem, your proposed solution, and why it benefits users.

**Submit code** — Fork the repo, create a feature branch, make your changes, and open a PR.

## Code style

- TypeScript, React, Tailwind CSS v4
- Follow existing patterns in the codebase
- Keep functions small and focused

## Testing checklist

Before submitting a PR:

- [ ] Works on ChatGPT
- [ ] Works on Claude
- [ ] Works on Gemini
- [ ] Works in Chrome and Firefox
- [ ] Keyboard shortcuts work
- [ ] Search/filter works
- [ ] No console errors
- [ ] UI looks good in light and dark mode

## Questions?

Open an issue or reach out on [X](https://x.com/askerkurtelli).
