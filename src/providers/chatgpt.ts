import { Provider, Turn } from '../types';
import { serializeNodeToMarkdown } from '../lib/markdownUtil';

export const chatgpt: Provider = {
    name: 'chatgpt',
    isMatch: () => window.location.hostname.includes('chatgpt') || window.location.hostname.includes('openai'),
    scrollContainerSelector: 'main div[class*="overflow-y-auto"]',
    getTurns: (container: HTMLElement): Turn[] => {
        const articleSelector = 'article[data-turn], article[data-testid^="conversation-turn"]';
        let articles = Array.from(container.querySelectorAll<HTMLElement>(articleSelector));
        if (!articles.length) {
            articles = Array.from(document.querySelectorAll<HTMLElement>(articleSelector));
        }
        return articles.map((article, index) => {
            const roleAttr = article.getAttribute('data-turn');
            const role = roleAttr === 'user'
                ? 'user'
                : roleAttr === 'assistant'
                    ? 'assistant'
                    : (article.querySelector('[data-message-author-role="user"]') ? 'user' : 'assistant');
            const turnId = article.getAttribute('data-turn-id') ||
                article.querySelector('[data-message-id]')?.getAttribute('data-message-id') ||
                undefined; // Stable ID from ChatGPT
            let text = '';
            let headings: any[] = [];

            if (role === 'user') {
                const textEl = article.querySelector('[data-message-author-role="user"]');
                if (textEl) {
                    // Prefer the text bubble only, excluding file attachment tiles
                    const textBubble = textEl.querySelector('.whitespace-pre-wrap');
                    if (textBubble) {
                        text = serializeNodeToMarkdown(textBubble as HTMLElement) || (textBubble as HTMLElement).innerText || '';
                    }
                    // Fallback to full content for file-only messages
                    if (!text) {
                        text = serializeNodeToMarkdown(textEl) || (textEl as HTMLElement).innerText || '';
                    }
                }
            } else {
                const contentEl = article.querySelector('[data-message-author-role="assistant"]');
                if (contentEl) {
                    text = serializeNodeToMarkdown(contentEl) || (contentEl as HTMLElement).innerText || '';
                    const headingElements = Array.from(contentEl.querySelectorAll('h1, h2, h3, h4'));
                    headings = headingElements.map((h, idx) => {
                        const innerText = (h as HTMLElement).innerText.trim();
                        return {
                            innerText: innerText || `Section ${idx + 1}`,
                            element: h as HTMLElement,
                            tagName: h.tagName,
                            isPlaceholder: !innerText
                        };
                    });
                }
            }
            return {
                id: `gpt-${index}`,
                turnId, // Add stable turn ID
                role,
                element: article as HTMLElement,
                text,
                headings
            };
        });
    },
    getChatTitle: () => {
        return document.title || null;
    }
};
