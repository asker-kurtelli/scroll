export type CapturedTurn = {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    headings?: string[];
};

export type ExportBlock = {
    prompt: string;
    answer?: string;
    headings?: string[];
};
