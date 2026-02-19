import { Provider, Turn } from '../types';
import { serializeNodeToMarkdown } from '../lib/markdownUtil';

export const gemini: Provider = {
    name: 'gemini',
    isMatch: () => {
        const host = window.location.hostname.toLowerCase();
        return host === 'gemini.google.com' || host.endsWith('.gemini.google.com');
    },
    scrollContainerSelector: '.mat-sidenav-content',
    getTurns: (container: HTMLElement): Turn[] => {
        const turns: Turn[] = [];
        const items = Array.from(container.querySelectorAll('user-query, model-response'));
        items.forEach((item, index) => {
            const isUser = item.tagName.toLowerCase() === 'user-query';
            let text = '';
            let headings: any[] = [];

            if (isUser) {
                const queryContainer = item.querySelector('div.query-text');
                if (queryContainer) {
                    text = serializeNodeToMarkdown(queryContainer);
                } else {
                    const queryLines = Array.from(item.querySelectorAll('div.query-text p.query-text-line'));
                    text = queryLines
                        .map(p => (p as HTMLElement).textContent?.trim() || '')
                        .filter(line => line.length > 0)
                        .join('\n');
                }
            } else {
                const markdown = item.querySelector('message-content .markdown');
                if (markdown) {
                    text = serializeNodeToMarkdown(markdown) || (markdown as HTMLElement).innerText || '';
                    headings = Array.from(markdown.querySelectorAll('h1, h2, h3, h4')).map(h => ({
                        innerText: (h as HTMLElement).innerText,
                        element: h as HTMLElement,
                        tagName: h.tagName
                    }));
                }
            }

            turns.push({
                id: `gemini-${index}`,
                turnId: `gemini-${index}`,
                role: isUser ? 'user' : 'assistant',
                element: item as HTMLElement,
                text: text,
                headings: headings
            });
        });
        return turns;
    },
    getChatTitle: () => {
        const titleEl = document.querySelector('.conversation-title');
        return titleEl?.textContent?.trim() || null;
    }
};
