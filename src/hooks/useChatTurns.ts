import { useEffect, useState, useRef, useCallback } from 'react';
import { Provider, Turn } from '../types';
import { chatgpt } from '../providers/chatgpt';
import { claude } from '../providers/claude';
import { gemini } from '../providers/gemini';

const PROVIDERS: Provider[] = [chatgpt, claude, gemini];

const TURN_SELECTORS: Record<Provider['name'], string> = {
    chatgpt: 'section[data-turn], section[data-testid^="conversation-turn"], article[data-turn], article[data-testid^="conversation-turn"], [data-message-author-role]',
    claude: '[data-testid="conversation-turn"], [data-testid="user-message"], [data-testid="assistant-response"], [data-testid="assistant-message"], .font-user-message, .font-claude-response',
    gemini: 'user-query, model-response'
};

const hasTurns = (provider: Provider, root: ParentNode) =>
    root.querySelector(TURN_SELECTORS[provider.name]) !== null;

export function useChatTurns() {
    const [turns, setTurns] = useState<Turn[]>([]);
    const [provider, setProvider] = useState<Provider | null>(null);
    const [container, setContainer] = useState<HTMLElement | null>(null);
    const observerRef = useRef<MutationObserver | null>(null);
    const bodyObserverRef = useRef<MutationObserver | null>(null);
    const headingCacheRef = useRef<Map<string, string>>(new Map());
    const turnTextCacheRef = useRef<Map<string, string>>(new Map());

    useEffect(() => {
        const handleChatChange = () => {
            headingCacheRef.current.clear();
            turnTextCacheRef.current.clear();
            setTurns([]);
        };

        window.addEventListener('scroll:chatChanged', handleChatChange);
        return () => window.removeEventListener('scroll:chatChanged', handleChatChange);
    }, []);

    useEffect(() => {
        const matched = PROVIDERS.find(p => p.isMatch());
        setProvider(matched || null);
    }, []);

    const findContainer = useCallback(() => {
        if (!provider) return null;

        const turnSelector = TURN_SELECTORS[provider.name];
        const hasAnyTurns = hasTurns(provider, document);

        if (container && container.isConnected) {
            if (hasTurns(provider, container) || !hasAnyTurns) {
                return container;
            }
        }

        const candidates = Array.from(document.querySelectorAll<HTMLElement>(provider.scrollContainerSelector));
        let bestCandidate: HTMLElement | null = null;
        let bestCount = 0;

        candidates.forEach((candidate) => {
            const count = candidate.querySelectorAll(turnSelector).length;
            if (count > bestCount) {
                bestCount = count;
                bestCandidate = candidate;
            }
        });

        if (bestCandidate && bestCount > 0) {
            return bestCandidate;
        }

        return (document.querySelector('main') as HTMLElement | null) || document.body;
    }, [provider, container]);

    useEffect(() => {
        if (!provider) return;

        const checkContainer = () => {
            const found = findContainer();
            if (found && found !== container) {
                setContainer(found);
            }
        };

        checkContainer();

        bodyObserverRef.current = new MutationObserver(checkContainer);
        bodyObserverRef.current.observe(document.body, { childList: true, subtree: true });

        return () => bodyObserverRef.current?.disconnect();
    }, [provider, container, findContainer]);

    useEffect(() => {
        if (!provider || !container) return;

        const parse = () => {
            const newTurns = provider.getTurns(container);

            if (provider.name === 'chatgpt') {
                newTurns.forEach((turn, turnIdx) => {
                    if (turn.text && turn.text.trim()) {
                        turnTextCacheRef.current.set(turn.id, turn.text);
                    } else {
                        const cachedText = turnTextCacheRef.current.get(turn.id);
                        if (cachedText) {
                            turn.text = cachedText;
                        }
                    }

                    turn.headings.forEach((heading, headingIdx) => {
                        const cacheKey = `${turn.id}-${headingIdx}`;

                        if (!heading.isPlaceholder && heading.innerText) {
                            headingCacheRef.current.set(cacheKey, heading.innerText);
                        }
                        else if (heading.isPlaceholder) {
                            const cached = headingCacheRef.current.get(cacheKey);
                            if (cached) {
                                heading.innerText = cached;
                                heading.isPlaceholder = false;
                            }
                        }
                    });
                });
            }

            setTurns(newTurns);
        };

        parse();

        observerRef.current = new MutationObserver(() => {
            parse();
        });

        observerRef.current.observe(container, { childList: true, subtree: true });

        return () => observerRef.current?.disconnect();
    }, [provider, container]);

    // Periodic refresh for ChatGPT virtualized content
    useEffect(() => {
        if (!provider || !container || provider.name !== 'chatgpt') return;

        const hasPlaceholders = turns.some(turn =>
            turn.headings.some(h => h.isPlaceholder)
        );

        if (!hasPlaceholders) return;

        const intervalId = setInterval(() => {
            const newTurns = provider.getTurns(container);

            const hasChanges = newTurns.some((newTurn, idx) => {
                const oldTurn = turns[idx];
                if (!oldTurn) return true;

                return newTurn.headings.some((newHeading, hIdx) => {
                    const oldHeading = oldTurn.headings[hIdx];
                    if (!oldHeading) return true;

                    return oldHeading.isPlaceholder && !newHeading.isPlaceholder;
                });
            });

            if (hasChanges) {
                setTurns(newTurns);
            }
        }, 2000);

        return () => clearInterval(intervalId);
    }, [provider, container, turns]);

    return { turns, provider, container };
}
