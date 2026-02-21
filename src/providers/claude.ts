import { Provider, Turn } from '../types';
import { serializeNodeToMarkdown } from '../lib/markdownUtil';

/**
 * Claude renders thinking/reasoning blocks in a 2-row grid:
 *   .row-start-1 = collapsible thinking content
 *   .row-start-2 = actual response
 * Returns the response-only element when a thinking block is present,
 * or the original element otherwise.
 */
const getResponseContent = (el: HTMLElement): HTMLElement => {
    const responseRow = el.querySelector('.row-start-2');
    return (responseRow as HTMLElement) || el;
};

export const claude: Provider = {
    name: 'claude',
    isMatch: () => window.location.hostname.includes('claude'),
    scrollContainerSelector: 'main div[class*="overflow-y-auto"]',
    getTurns: (container: HTMLElement): Turn[] => {
        const turns: Turn[] = [];
        const assistantSelectors = [
            '.font-claude-response',
            '[data-testid="assistant-response"]',
            '[data-testid="assistant-message"]'
        ].join(', ');
        const userSelector = '[data-testid="user-message"], .font-user-message';
        const containerSelectors = [
            '[data-testid="conversation-turn"]',
            '[data-is-streaming]',
            '[data-test-render-count]'
        ];

        const getBaseId = (turnContainer: HTMLElement, index: number) => {
            const attr =
                turnContainer.getAttribute('data-turn-id') ||
                turnContainer.getAttribute('data-message-id') ||
                turnContainer.getAttribute('data-uuid') ||
                turnContainer.getAttribute('data-id') ||
                turnContainer.getAttribute('id');
            return attr ? `claude-${attr}` : `claude-${index}`;
        };

        const getContainerForElement = (el: HTMLElement) => {
            for (const selector of containerSelectors) {
                const containerEl = el.closest(selector);
                if (containerEl) return containerEl as HTMLElement;
            }
            return el.closest('.group') as HTMLElement | null || el.parentElement;
        };

        const pickBestElement = (elements: HTMLElement[]) => {
            let best: HTMLElement | null = null;
            let bestLen = 0;
            elements.forEach(el => {
                const text = (el.innerText || '').trim();
                if (text.length > bestLen) {
                    best = el;
                    bestLen = text.length;
                }
            });
            return best;
        };

        const selector = `${userSelector}, ${assistantSelectors}`;
        const allItems = Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(el => {
            const text = (el.innerText || '').trim();
            if (!text) return false;
            if (el.matches(userSelector)) {
                const parentUser = el.parentElement?.closest(userSelector);
                if (parentUser && parentUser !== el) return false;
            }
            if (el.matches(assistantSelectors)) {
                const parentAssistant = el.parentElement?.closest(assistantSelectors);
                if (parentAssistant && parentAssistant !== el) return false;
            }
            return true;
        });

        const containerBuckets = new Map<HTMLElement, { users: HTMLElement[]; assistants: HTMLElement[] }>();
        allItems.forEach((el) => {
            const turnContainer = getContainerForElement(el);
            if (!turnContainer) return;
            const bucket = containerBuckets.get(turnContainer) || { users: [], assistants: [] };
            if (el.matches(userSelector)) {
                bucket.users.push(el);
            } else {
                bucket.assistants.push(el);
            }
            containerBuckets.set(turnContainer, bucket);
        });

        const containers = Array.from(containerBuckets.keys());
        containers.sort((a, b) => {
            if (a === b) return 0;
            const pos = a.compareDocumentPosition(b);
            return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });

        containers.forEach((turnContainer, index) => {
            const bucket = containerBuckets.get(turnContainer);
            if (!bucket) return;
            const baseId = getBaseId(turnContainer, index);
            const userEl = pickBestElement(bucket.users);
            const assistantEl = pickBestElement(bucket.assistants);

            if (userEl) {
                const text = (serializeNodeToMarkdown(userEl) || userEl.innerText || '').trim();
                if (text) {
                    turns.push({
                        id: `${baseId}-user`,
                        turnId: `${baseId}-user`,
                        role: 'user',
                        element: turnContainer,
                        text,
                        headings: []
                    });
                }
            }

            if (assistantEl) {
                const contentEl = getResponseContent(assistantEl);
                const text = (serializeNodeToMarkdown(contentEl) || contentEl.innerText || '').trim();
                if (text) {
                    const headings = Array.from(contentEl.querySelectorAll('h1, h2, h3, h4')).map(h => ({
                        innerText: (h as HTMLElement).innerText,
                        element: h as HTMLElement,
                        tagName: h.tagName
                    }));
                    turns.push({
                        id: `${baseId}-assistant`,
                        turnId: baseId,
                        role: 'assistant',
                        element: turnContainer,
                        text,
                        headings
                    });
                }
            }
        });

        return turns;
    },
    getChatTitle: () => {
        const titleEl = document.querySelector('[data-testid="chat-title-button"]');
        return titleEl?.textContent?.trim() || null;
    }
};
