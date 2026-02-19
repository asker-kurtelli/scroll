export interface Heading {
    innerText: string;
    element: HTMLElement;
    tagName: string;
    isPlaceholder?: boolean;
}

export interface Turn {
    id: string; // Internal ID (e.g., "gpt-0")
    turnId?: string; // Provider-specific stable ID (e.g., ChatGPT's data-turn-id)
    role: 'user' | 'assistant';
    element: HTMLElement;
    text: string;
    headings: Heading[];
}

export interface Provider {
    name: 'chatgpt' | 'claude' | 'gemini';
    isMatch: () => boolean;
    scrollContainerSelector: string;
    getTurns: (container: HTMLElement) => Turn[];
    getChatTitle?: () => string | null; // Optional method to scrape chat title
}
