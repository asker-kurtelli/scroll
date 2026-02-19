import DOMPurify from 'dompurify';
import { marked } from 'marked';

export const serializeNodeToMarkdown = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
    }
    if (!(node instanceof HTMLElement)) return '';

    if (node.style.display === 'none' || node.style.visibility === 'hidden') return '';

    const children = Array.from(node.childNodes).map(serializeNodeToMarkdown).join('');
    const tag = node.tagName.toLowerCase();

    switch (tag) {
        case 'br':
            return '\n';
        case 'strong':
        case 'b':
            return children.trim() ? `**${children.trim()}**` : '';
        case 'em':
        case 'i':
            return children.trim() ? `*${children.trim()}*` : '';
        case 'code': {
            const isBlock = node.parentElement?.tagName.toLowerCase() === 'pre';
            if (isBlock) return children; // Handled by pre
            return children.trim() ? `\`${children}\`` : '';
        }
        case 'pre': {
            const text = node.textContent || '';
            let lang = '';
            const codeClass = node.querySelector('code')?.className || '';
            const match = codeClass.match(/language-(\w+)/);
            if (match) lang = match[1];

            return `\n\`\`\`${lang}\n${text.trim()}\n\`\`\`\n\n`;
        }
        case 'a': {
            const href = node.getAttribute('href');
            return href ? `[${children || href}](${href})` : children;
        }
        case 'ul': {
            const items = Array.from(node.children)
                .map((li) => `- ${serializeNodeToMarkdown(li).trim()}`)
                .join('\n');
            return items ? `\n${items}\n\n` : '';
        }
        case 'ol': {
            let counter = 1;
            const items = Array.from(node.children)
                .map((li) => `${counter++}. ${serializeNodeToMarkdown(li).trim()}`)
                .join('\n');
            return items ? `\n${items}\n\n` : '';
        }
        case 'li':
            return children.trim();
        case 'p':
        case 'div':
        case 'section':
        case 'article':
            return children.trim() ? `${children.trim()}\n\n` : '';
        case 'h1':
            return children.trim() ? `# ${children.trim()}\n\n` : '';
        case 'h2':
            return children.trim() ? `## ${children.trim()}\n\n` : '';
        case 'h3':
            return children.trim() ? `### ${children.trim()}\n\n` : '';
        case 'h4':
            return children.trim() ? `#### ${children.trim()}\n\n` : '';
        case 'h5':
            return children.trim() ? `##### ${children.trim()}\n\n` : '';
        case 'h6':
            return children.trim() ? `###### ${children.trim()}\n\n` : '';
        case 'blockquote':
            return children.trim() ? `> ${children.trim().replace(/\n/g, '\n> ')}\n\n` : '';
        case 'table':
            // Basic table support could be added here, but complex
            return children;
        default:
            return children;
    }
};

export const stripMarkdown = (text: string): string => {
    if (!text) return '';
    return text
        .replace(/^#+\s+/gm, '')
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        .replace(/(\*|_)(.*?)\1/g, '$2')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/^[\*\-]\s+/gm, '')
        .replace(/^\d+\.\s+/gm, '')
        .replace(/^>\s+/gm, '')
        .replace(/^-{3,}$/gm, '')
        .trim();
};

export const renderMarkdownToHtml = async (markdown: string): Promise<string> => {
    if (!markdown) return '';
    const result = await marked.parse(markdown, { async: true });
    return DOMPurify.sanitize(result);
};
