export function getPdfStyles(): string {
  return `<style>
  @page {
    margin: 18mm 16mm;
    size: A4;
    orphans: 3;
    widows: 3;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.65;
    color: #1a1a1a;
    font-size: 10.5pt;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Header ─────────────────────────────────────── */

  .header {
    margin-bottom: 1.8em;
    padding-bottom: 1em;
    border-bottom: 1px solid #e5e5e5;
  }

  .header h1 {
    font-size: 17pt;
    font-weight: 600;
    color: #1a1a1a;
    letter-spacing: -0.01em;
    margin-bottom: 0.3em;
  }

  .header-meta {
    display: flex;
    gap: 1.5em;
    font-size: 9pt;
    color: #888;
  }

  /* ── Chat turns ─────────────────────────────────── */

  .turn {
    margin-bottom: 1.2em;
  }

  .turn-number {
    display: none;
  }

  .content-section {
    margin-bottom: 0.6em;
  }

  .role {
    font-size: 8.5pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #999;
    margin-bottom: 0.25em;
  }

  .section-label {
    font-size: 8.5pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #999;
    margin-bottom: 0.25em;
  }

  /* User message — light background bubble, no border accents */
  .prompt {
    background: #f7f7f5;
    border-radius: 6px;
    padding: 0.7em 0.9em;
    margin-bottom: 0.15em;
    font-size: 10.5pt;
    line-height: 1.6;
    color: #1a1a1a;
  }

  /* Assistant message — no background, just clean text */
  .response {
    padding: 0.4em 0;
    font-size: 10.5pt;
    line-height: 1.65;
    color: #1a1a1a;
  }

  /* ── Turn separator ─────────────────────────────── */

  .turn + .turn {
    padding-top: 1em;
    border-top: 1px solid #f0f0ee;
  }

  /* ── Markdown content ───────────────────────────── */

  .prompt p, .response p { margin-bottom: 0.6em; }
  .prompt p:last-child, .response p:last-child { margin-bottom: 0; }

  .prompt ul, .response ul { list-style-type: disc; margin-left: 1.4em; margin-bottom: 0.6em; }
  .prompt ol, .response ol { list-style-type: decimal; margin-left: 1.4em; margin-bottom: 0.6em; }
  .prompt li, .response li { margin-bottom: 0.2em; }

  /* Code */
  pre {
    background: #fafaf8;
    border: 1px solid #e8e8e4;
    border-radius: 5px;
    padding: 0.75em 1em;
    font-family: "SF Mono", "JetBrains Mono", Consolas, monospace;
    font-size: 9pt;
    line-height: 1.5;
    overflow-x: auto;
    margin-bottom: 0.7em;
    page-break-inside: avoid;
  }

  code {
    background: rgba(0,0,0,0.04);
    padding: 0.15em 0.35em;
    border-radius: 3px;
    font-family: "SF Mono", "JetBrains Mono", Consolas, monospace;
    font-size: 0.88em;
  }

  pre code {
    background: transparent;
    padding: 0;
    border-radius: 0;
  }

  /* Headings in content */
  .prompt h1, .response h1 { font-size: 1.3em; font-weight: 600; margin: 0.8em 0 0.4em; }
  .prompt h2, .response h2 { font-size: 1.2em; font-weight: 600; margin: 0.7em 0 0.35em; }
  .prompt h3, .response h3 { font-size: 1.1em; font-weight: 600; margin: 0.6em 0 0.3em; }
  .prompt h4, .response h4 { font-size: 1.05em; font-weight: 600; margin: 0.5em 0 0.25em; }

  /* Blockquotes */
  blockquote {
    border-left: 2px solid #ddd;
    padding-left: 0.8em;
    margin: 0 0 0.6em;
    color: #555;
  }

  /* Tables */
  table {
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 0.7em;
    font-size: 9.5pt;
  }

  th, td {
    border: 1px solid #e5e5e5;
    padding: 0.4em 0.6em;
    text-align: left;
  }

  th {
    background: #fafaf8;
    font-weight: 600;
  }

  /* Links */
  a { color: #1a6dd4; text-decoration: none; }

  .empty-chat-notice {
    font-style: italic;
    color: #999;
    padding: 0.8em;
    background: #fafaf8;
    border-radius: 4px;
    font-size: 9.5pt;
  }

  /* ── Library-specific (multi-chat) ──────────────── */

  .bookmark {
    margin-bottom: 2em;
  }

  .bookmark + .bookmark {
    padding-top: 1.5em;
    border-top: 1px solid #e5e5e5;
  }

  .bookmark-header {
    margin-bottom: 1em;
  }

  .bookmark-title {
    font-size: 13pt;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 0.25em;
    line-height: 1.3;
  }

  .bookmark-number {
    font-size: 8.5pt;
    font-weight: 600;
    color: #999;
    margin-right: 0.4em;
  }

  .bookmark-meta {
    display: flex;
    gap: 0.8em;
    flex-wrap: wrap;
    font-size: 8.5pt;
    color: #999;
    margin-top: 0.2em;
  }

  .badge {
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .badge-full-chat {}

  /* Tags */
  .tags {
    margin-top: 1em;
    padding-top: 0.6em;
    border-top: 1px solid #f0f0ee;
    font-size: 8.5pt;
    color: #888;
  }

  .tag {
    display: inline-block;
    background: #f5f5f3;
    color: #555;
    padding: 0.15em 0.4em;
    border-radius: 3px;
    margin-right: 0.3em;
    font-size: 8.5pt;
  }

  .url {
    margin-top: 0.3em;
    font-size: 8.5pt;
    color: #999;
    word-break: break-all;
  }

  /* TOC */
  .toc {
    page-break-after: always;
    margin-bottom: 2em;
  }

  .toc h2 {
    font-size: 13pt;
    font-weight: 600;
    margin-bottom: 0.8em;
    color: #1a1a1a;
  }

  .toc ol {
    list-style-type: decimal;
    margin-left: 1.4em;
  }

  .toc li {
    margin-bottom: 0.3em;
    font-size: 10pt;
    line-height: 1.4;
  }

  .toc a { color: #1a6dd4; }
</style>`;
}

export function getPdfFooter(): string {
  return '';
}

export function formatPdfDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}
