/**
 * Human-readable export filename generation.
 */

function sanitize(s: string): string {
  return s
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function getDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Extracts a clean chat title from document.title, stripping provider suffixes.
 */
export function getChatTitle(): string {
  const raw = document.title || '';
  return raw
    .replace(/\s*[-–|·]\s*(ChatGPT|Claude|Gemini|Google Gemini|Anthropic|OpenAI).*$/i, '')
    .trim() || 'Chat';
}

export function generateExportFilename(opts: {
  type: 'chat' | 'library';
  provider?: string;
  title?: string;
  format: string;
  itemCount?: number;
}): string {
  const dateStr = getDateStr();

  if (opts.type === 'chat') {
    const titlePart = opts.title ? sanitize(opts.title) : (opts.provider || 'chat');
    return `${titlePart}-${dateStr}.${opts.format}`;
  }

  const countPart = opts.itemCount ? `-${opts.itemCount}-items` : '';
  return `scroll-library${countPart}-${dateStr}.${opts.format}`;
}
