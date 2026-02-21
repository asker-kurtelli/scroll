import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Turn } from '../types';
import type { CapturedTurn, ExportBlock } from '../types/messages';
import { scrollToElement } from '../lib/scroll';
import { chatgpt } from '../providers/chatgpt';
import { claude } from '../providers/claude';
import { gemini } from '../providers/gemini';
import { showToast as emitToast, type ToastType } from '../services/toast';
import { serializeNodeToMarkdown, renderMarkdownToHtml, stripMarkdown } from '../lib/markdownUtil';
import { downloadFile } from '../lib/download';
import { generateExportFilename, getChatTitle } from '../lib/exportFilenames';
import { getPdfStyles, getPdfFooter, formatPdfDate } from '../lib/pdfStyles';
import { printHtmlAsPdf } from '../lib/pdfPrint';
import DOMPurify from 'dompurify';
import whatsNextImg from '../../assets/whats-next.png';

const UPDATE_BANNER_KEY = 'scroll-pro-update-21-seen';
const CONTEXT_HINT_KEY = 'scroll-pro-context-hint-seen';
const LINE_CLAMP_KEY = 'scroll-pro-line-clamp';
const COPY_MARKDOWN_KEY = 'scroll-pro-copy-markdown';
const CHATGPT_CAPTURE_CONSENT_KEY = 'scroll-pro-chatgpt-capture-consent';
const SIDEBAR_POSITION_KEY_PREFIX = 'scroll-pro-sidebar-position';
const SIDEBAR_TOGGLE_SIZE = 42;
const SIDEBAR_MARGIN = 18;
const SIDEBAR_DEFAULT_TOP = 72;
const SIDEBAR_GAP = 10;
const SIDEBAR_LONG_PRESS_MS = 450;

type SidebarAnchorX = 'left' | 'right';

type SidebarPosition = {
    x: number;
    y: number;
    anchorX: SidebarAnchorX;
    offsetX: number;
};

type SidebarOpenDirection = {
    x: 'left' | 'right';
    y: 'up' | 'down';
};

const clampNumber = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getSidebarBounds = () => {
    const minX = SIDEBAR_MARGIN;
    const minY = SIDEBAR_MARGIN;
    if (typeof window === 'undefined') {
        return { minX, minY, maxX: minX, maxY: SIDEBAR_DEFAULT_TOP };
    }

    return {
        minX,
        minY,
        maxX: Math.max(minX, window.innerWidth - SIDEBAR_MARGIN - SIDEBAR_TOGGLE_SIZE),
        maxY: Math.max(minY, window.innerHeight - SIDEBAR_MARGIN - SIDEBAR_TOGGLE_SIZE),
    };
};

const getSidebarAnchorX = (x: number): SidebarAnchorX => {
    if (typeof window === 'undefined') return 'right';
    const leftDistance = x - SIDEBAR_MARGIN;
    const rightDistance = window.innerWidth - SIDEBAR_MARGIN - (x + SIDEBAR_TOGGLE_SIZE);
    return rightDistance < leftDistance ? 'right' : 'left';
};

const resolveSidebarPosition = (anchorX: SidebarAnchorX, offsetX: number, y: number): SidebarPosition => {
    const fallback = {
        x: SIDEBAR_MARGIN,
        y: SIDEBAR_DEFAULT_TOP,
        anchorX,
        offsetX,
    };

    if (typeof window === 'undefined') return fallback;
    const bounds = getSidebarBounds();
    const rawX = anchorX === 'left'
        ? offsetX
        : window.innerWidth - SIDEBAR_TOGGLE_SIZE - offsetX;
    const clampedX = clampNumber(rawX, bounds.minX, bounds.maxX);
    const clampedY = clampNumber(y, bounds.minY, bounds.maxY);
    return {
        x: clampedX,
        y: clampedY,
        anchorX,
        offsetX,
    };
};

const createSidebarPositionFromPoint = (pos: { x: number; y: number }, anchorX?: SidebarAnchorX): SidebarPosition => {
    if (typeof window === 'undefined') {
        return {
            x: SIDEBAR_MARGIN,
            y: SIDEBAR_DEFAULT_TOP,
            anchorX: anchorX ?? 'right',
            offsetX: SIDEBAR_MARGIN,
        };
    }

    const bounds = getSidebarBounds();
    const clampedX = clampNumber(pos.x, bounds.minX, bounds.maxX);
    const clampedY = clampNumber(pos.y, bounds.minY, bounds.maxY);
    const resolvedAnchor = anchorX ?? getSidebarAnchorX(clampedX);
    const rawOffsetX = resolvedAnchor === 'left'
        ? clampedX
        : window.innerWidth - SIDEBAR_TOGGLE_SIZE - clampedX;
    return {
        x: clampedX,
        y: clampedY,
        anchorX: resolvedAnchor,
        offsetX: rawOffsetX,
    };
};

const getDefaultSidebarPosition = (): SidebarPosition => (
    resolveSidebarPosition('right', SIDEBAR_MARGIN, SIDEBAR_DEFAULT_TOP)
);

const getSidebarStorageKey = (providerName: string) => `${SIDEBAR_POSITION_KEY_PREFIX}:${providerName || 'unknown'}`;

const loadSidebarPosition = (storageKey: string): SidebarPosition => {
    const fallback = getDefaultSidebarPosition();
    if (typeof window === 'undefined') return fallback;

    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        if (parsed?.anchorX === 'left' || parsed?.anchorX === 'right') {
            if (typeof parsed?.offsetX === 'number' && typeof parsed?.y === 'number') {
                return resolveSidebarPosition(parsed.anchorX, parsed.offsetX, parsed.y);
            }
        }
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
            return createSidebarPositionFromPoint({ x: parsed.x, y: parsed.y });
        }
        return fallback;
    } catch {
        return fallback;
    }
};

const getEstimatedSidebarSize = () => {
    if (typeof window === 'undefined') {
        return { width: 360, height: 480 };
    }

    const width = Math.min(360, window.innerWidth * 0.94);
    const maxHeight = Math.max(140, window.innerHeight - SIDEBAR_MARGIN * 2);
    const height = Math.min(window.innerHeight * 0.72, maxHeight);
    return { width, height };
};

const getSidebarOpenDirection = (pos: SidebarPosition): SidebarOpenDirection => {
    if (typeof window === 'undefined') {
        return { x: 'right', y: 'down' };
    }

    const { width, height } = getEstimatedSidebarSize();
    const spaceLeft = pos.x + SIDEBAR_TOGGLE_SIZE - SIDEBAR_MARGIN;
    const spaceRight = window.innerWidth - SIDEBAR_MARGIN - pos.x;
    const spaceUp = pos.y - SIDEBAR_MARGIN;
    const spaceDown = window.innerHeight - SIDEBAR_MARGIN - (pos.y + SIDEBAR_TOGGLE_SIZE);

    const fitsRight = spaceRight >= width;
    const fitsLeft = spaceLeft >= width;
    const openX = fitsRight === fitsLeft
        ? (spaceRight >= spaceLeft ? 'right' : 'left')
        : (fitsRight ? 'right' : 'left');

    const fitsDown = spaceDown >= height + SIDEBAR_GAP;
    const fitsUp = spaceUp >= height + SIDEBAR_GAP;
    const openY = fitsDown === fitsUp
        ? (spaceDown >= spaceUp ? 'down' : 'up')
        : (fitsDown ? 'down' : 'up');

    return { x: openX, y: openY };
};

const isScrollable = (el: HTMLElement | null) => {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY || style.overflow;
    const canScroll = /(auto|scroll|overlay)/.test(overflowY);
    return canScroll && el.scrollHeight - el.clientHeight > 4;
};

const findScrollable = (start: HTMLElement | null): HTMLElement | null => {
    let current: HTMLElement | null = start;
    while (current) {
        if (isScrollable(current)) return current;
        if (current === document.body || current === document.documentElement) break;
        current = current.parentElement;
    }
    const docEl = document.scrollingElement as HTMLElement | null;
    return docEl || document.documentElement || document.body;
};

const getLineClamp = () => {
    try {
        const raw = localStorage.getItem(LINE_CLAMP_KEY);
        const parsed = raw ? parseInt(raw, 10) : 2;
        if (Number.isNaN(parsed)) return 2;
        return Math.min(Math.max(parsed, 1), 8);
    } catch {
        return 2;
    }
};

const copyToClipboard = (text: string) => {
    if (!text) return;
    if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(err => {
            console.error('Failed to copy text:', err);
        });
        return;
    }

    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    } catch (err) {
        console.error('Failed to copy text (fallback):', err);
    }
};

type SidebarProps = {
    turns: Turn[];
    providerName: string;
    container: HTMLElement | null;
    isOpen: boolean;
    isPaused: boolean;
    onToggle: () => void;
};

export default function Sidebar({ turns, providerName, container, isOpen, isPaused, onToggle }: SidebarProps) {
    const [viewLevel, setViewLevel] = useState<1 | 2>(2); // 1=Prompts, 2=All
    const [search, setSearch] = useState('');
    const [progress, setProgress] = useState(0);
    const [lineClamp, setLineClamp] = useState<number>(() => getLineClamp());
    const [focusedIndex, setFocusedIndex] = useState<number>(-1);
    const [lastFocusedKey, setLastFocusedKey] = useState<string | null>(null);
    const [exportFormat, setExportFormat] = useState<'md' | 'pdf' | 'txt' | 'json'>('md');
    const captureInProgressRef = useRef(false);
    const [showCaptureConsent, setShowCaptureConsent] = useState(false);
    const [hasCaptureConsent, setHasCaptureConsent] = useState<boolean>(() => {
        try {
            return localStorage.getItem(CHATGPT_CAPTURE_CONSENT_KEY) === 'true';
        } catch {
            return false;
        }
    });
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; block: Block } | null>(null);
    const contextMenuRef = useRef<HTMLDivElement | null>(null);
    const [exportFormatMenu, setExportFormatMenu] = useState<{ x: number; y: number } | null>(null);
    const exportFormatMenuRef = useRef<HTMLDivElement | null>(null);
    const [copyFormatMenu, setCopyFormatMenu] = useState<{ x: number; y: number } | null>(null);
    const copyFormatMenuRef = useRef<HTMLDivElement | null>(null);
    const [copyWithMarkdown, setCopyWithMarkdown] = useState<boolean>(false);
    const [showUpdateBanner, setShowUpdateBanner] = useState(false);
    const [bannerDismissed, setBannerDismissed] = useState(true);
    const [showHelp, setShowHelp] = useState(false);
    const contextHintShown = useRef(false);
    const storageKey = getSidebarStorageKey(providerName);
    const [sidebarPosition, setSidebarPosition] = useState<SidebarPosition>(() => loadSidebarPosition(storageKey));
    const [isDragging, setIsDragging] = useState(false);
    const itemRefs = useRef<Map<string, HTMLElement>>(new Map());
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const sidebarShellRef = useRef<HTMLDivElement | null>(null);
    const toggleButtonRef = useRef<HTMLButtonElement | null>(null);
    const sidebarPositionRef = useRef<SidebarPosition>(sidebarPosition);
    const dragPositionRef = useRef<SidebarPosition | null>(null);
    const dragOpenDirectionRef = useRef<SidebarOpenDirection | null>(null);
    const dragStateRef = useRef({
        pointerId: null as number | null,
        offsetX: 0,
        offsetY: 0,
        lastX: 0,
        lastY: 0,
        isDragging: false,
    });
    const longPressTimerRef = useRef<number | null>(null);
    const suppressClickRef = useRef(false);
    const dragBodyStyleRef = useRef<{ userSelect: string; cursor: string } | null>(null);
    const ignoreNextPositionWriteRef = useRef(false);
    const hasInitializedFocus = useRef(false);
    const userInteractionRef = useRef(false);
    const isHoveringSidebar = useRef(false);
    const isSmoothPursuit = useRef(false);

    const turnsRef = useRef(turns);
    useEffect(() => { turnsRef.current = turns; }, [turns]);

    useEffect(() => {
        try {
            chrome.storage.local.get([UPDATE_BANNER_KEY], (result) => {
                if (!result[UPDATE_BANNER_KEY]) {
                    setBannerDismissed(false);
                }
            });
        } catch {}
    }, []);

    useEffect(() => {
        if (isOpen && !bannerDismissed && !showUpdateBanner) {
            setShowUpdateBanner(true);
        }
    }, [isOpen, bannerDismissed, showUpdateBanner]);

    const dismissUpdateBanner = useCallback(() => {
        setShowUpdateBanner(false);
        setBannerDismissed(true);
        try {
            chrome.storage.local.set({ [UPDATE_BANNER_KEY]: true });
        } catch {}
    }, []);

    const providerLabel = useMemo(() => {
        if (providerName === 'chatgpt') return 'ChatGPT';
        if (providerName === 'claude') return 'Claude';
        if (providerName === 'gemini') return 'Gemini';
        return 'your assistant';
    }, [providerName]);

    const applySidebarPosition = useCallback((pos: { x: number; y: number }) => {
        const resolved = createSidebarPositionFromPoint(pos);
        dragPositionRef.current = resolved;
        const direction = getSidebarOpenDirection(resolved);
        dragOpenDirectionRef.current = direction;

        const shell = sidebarShellRef.current;
        if (shell) {
            shell.style.setProperty('--sidebar-x', `${resolved.x}px`);
            shell.style.setProperty('--sidebar-y', `${resolved.y}px`);
            shell.dataset.openX = direction.x;
            shell.dataset.openY = direction.y;
        }
    }, []);

    const setDragStyles = useCallback((active: boolean) => {
        if (typeof document === 'undefined') return;
        if (active) {
            if (!dragBodyStyleRef.current) {
                dragBodyStyleRef.current = {
                    userSelect: document.body.style.userSelect,
                    cursor: document.body.style.cursor,
                };
            }
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'grabbing';
            return;
        }

        if (dragBodyStyleRef.current) {
            document.body.style.userSelect = dragBodyStyleRef.current.userSelect;
            document.body.style.cursor = dragBodyStyleRef.current.cursor;
            dragBodyStyleRef.current = null;
        }
    }, []);

    const beginDrag = useCallback(() => {
        dragStateRef.current.isDragging = true;
        suppressClickRef.current = true;
        setIsDragging(true);
        setDragStyles(true);

        const nextPos = {
            x: dragStateRef.current.lastX - dragStateRef.current.offsetX,
            y: dragStateRef.current.lastY - dragStateRef.current.offsetY,
        };
        applySidebarPosition(nextPos);
    }, [applySidebarPosition, setDragStyles]);

    const handleTogglePointerMove = useCallback((event: PointerEvent) => {
        if (dragStateRef.current.pointerId !== event.pointerId) return;
        dragStateRef.current.lastX = event.clientX;
        dragStateRef.current.lastY = event.clientY;

        if (!dragStateRef.current.isDragging) return;
        event.preventDefault();

        const nextPos = {
            x: event.clientX - dragStateRef.current.offsetX,
            y: event.clientY - dragStateRef.current.offsetY,
        };
        applySidebarPosition(nextPos);
    }, [applySidebarPosition]);

    const handleTogglePointerUp = useCallback((event: PointerEvent) => {
        if (dragStateRef.current.pointerId !== event.pointerId) return;

        if (longPressTimerRef.current) {
            window.clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }

        window.removeEventListener('pointermove', handleTogglePointerMove, true);
        window.removeEventListener('pointerup', handleTogglePointerUp, true);
        window.removeEventListener('pointercancel', handleTogglePointerUp, true);

        try {
            toggleButtonRef.current?.releasePointerCapture(event.pointerId);
        } catch {
        }

        const wasDragging = dragStateRef.current.isDragging;
        dragStateRef.current.isDragging = false;
        dragStateRef.current.pointerId = null;

        if (wasDragging) {
            setIsDragging(false);
            setDragStyles(false);
            const finalPos = dragPositionRef.current ?? sidebarPositionRef.current;
            dragPositionRef.current = null;
            dragOpenDirectionRef.current = null;
            setSidebarPosition(resolveSidebarPosition(finalPos.anchorX, finalPos.offsetX, finalPos.y));

            suppressClickRef.current = true;
            window.setTimeout(() => {
                suppressClickRef.current = false;
            }, 0);
        } else {
            suppressClickRef.current = false;
        }
    }, [handleTogglePointerMove, setDragStyles]);

    const handleTogglePointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0) return;
        event.stopPropagation();

        if (longPressTimerRef.current) {
            window.clearTimeout(longPressTimerRef.current);
        }

        const currentPos = dragPositionRef.current ?? sidebarPositionRef.current;
        const resolvedPos = resolveSidebarPosition(currentPos.anchorX, currentPos.offsetX, currentPos.y);
        dragStateRef.current.pointerId = event.pointerId;
        dragStateRef.current.offsetX = event.clientX - resolvedPos.x;
        dragStateRef.current.offsetY = event.clientY - resolvedPos.y;
        dragStateRef.current.lastX = event.clientX;
        dragStateRef.current.lastY = event.clientY;
        dragStateRef.current.isDragging = false;
        suppressClickRef.current = false;

        toggleButtonRef.current?.setPointerCapture(event.pointerId);
        longPressTimerRef.current = window.setTimeout(beginDrag, SIDEBAR_LONG_PRESS_MS);

        window.addEventListener('pointermove', handleTogglePointerMove, true);
        window.addEventListener('pointerup', handleTogglePointerUp, true);
        window.addEventListener('pointercancel', handleTogglePointerUp, true);
    }, [beginDrag, handleTogglePointerMove, handleTogglePointerUp]);

    const handleToggleClick = useCallback(() => {
        if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
        }
        onToggle();
    }, [onToggle]);

    useEffect(() => {
        sidebarPositionRef.current = sidebarPosition;
    }, [sidebarPosition]);

    useEffect(() => {
        if (ignoreNextPositionWriteRef.current) {
            ignoreNextPositionWriteRef.current = false;
            return;
        }
        try {
            localStorage.setItem(storageKey, JSON.stringify(sidebarPosition));
        } catch {
        }
    }, [sidebarPosition, storageKey]);

    useEffect(() => {
        ignoreNextPositionWriteRef.current = true;
        const next = loadSidebarPosition(storageKey);
        setSidebarPosition(next);
        dragPositionRef.current = null;
        dragOpenDirectionRef.current = null;
        dragStateRef.current.isDragging = false;
        setIsDragging(false);
        setDragStyles(false);
    }, [storageKey, setDragStyles]);

    useEffect(() => {
        const handleResize = () => {
            const basePos = dragPositionRef.current ?? sidebarPositionRef.current;
            const next = resolveSidebarPosition(basePos.anchorX, basePos.offsetX, basePos.y);
            if (dragStateRef.current.isDragging) {
                applySidebarPosition({ x: next.x, y: next.y });
            }
            setSidebarPosition(next);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [applySidebarPosition]);

    useEffect(() => {
        return () => {
            if (longPressTimerRef.current) {
                window.clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }
            window.removeEventListener('pointermove', handleTogglePointerMove, true);
            window.removeEventListener('pointerup', handleTogglePointerUp, true);
            window.removeEventListener('pointercancel', handleTogglePointerUp, true);
            setDragStyles(false);
        };
    }, [handleTogglePointerMove, handleTogglePointerUp, setDragStyles]);

    const preserveSidebarScroll = (callback: () => void) => {
        const list = document.querySelector('.scroll-pro-sidebar-list') as HTMLElement;
        if (!list) {
            callback();
            return;
        }

        const scrollTop = list.scrollTop;
        callback();

        requestAnimationFrame(() => {
            if (list.scrollTop !== scrollTop) {
                list.scrollTop = scrollTop;
            }
        });
    };

    const showToast = useCallback((message: string, type: ToastType = 'success') => {
        emitToast(message, type, 900, 'sidebar');
    }, []);

    const maybeShowContextHint = useCallback(() => {
        if (contextHintShown.current) return;
        contextHintShown.current = true;
        try { localStorage.setItem(CONTEXT_HINT_KEY, 'true'); } catch {}
        setTimeout(() => {
            emitToast('Tip: right-click for more formats', 'info', 2500, 'sidebar');
        }, 1200);
    }, []);

    const snippet = (value?: string, max = 120) => {
        if (!value) return '…';
        const clean = stripMarkdown(value).replace(/\s+/g, ' ').trim();
        return clean.length > max ? `${clean.slice(0, max)}…` : clean;
    };

    const chatTitle = getChatTitle();

    const generateChatTitle = useCallback((turnList: Turn[]) => {
        if (providerName) {
            const provider = [chatgpt, claude, gemini].find(p => p.name === providerName);
            const scrapedTitle = provider?.getChatTitle?.();
            if (scrapedTitle) return scrapedTitle;
        }

        const firstPrompt = turnList.find(t => t.role === 'user')?.text;
        if (!firstPrompt) return 'Untitled Chat';
        const clean = firstPrompt.trim();
        const slice = clean.slice(0, 60);
        return clean.length > 60 ? `${slice}…` : clean;
    }, [providerName]);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(COPY_MARKDOWN_KEY);
            if (saved === 'true') setCopyWithMarkdown(true);
            if (localStorage.getItem(CONTEXT_HINT_KEY) === 'true') {
                contextHintShown.current = true;
            }
        } catch {}
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(COPY_MARKDOWN_KEY, copyWithMarkdown ? 'true' : 'false');
        } catch {}
    }, [copyWithMarkdown]);

    const getTurnCopyText = useCallback((turn: Turn | undefined) => {
        if (!turn) return '';
        if (!copyWithMarkdown) return turn.text || '';
        if (!turn.element) return turn.text || '';
        const raw = serializeNodeToMarkdown(turn.element);
        const compact = raw.replace(/\n{3,}/g, '\n\n').trim();
        return compact || turn.text || '';
    }, [copyWithMarkdown]);

    type Block = {
        key: string;
        prompt: Turn;
        answer?: Turn;
        headings: Turn['headings'];
    };

    const blocks: Block[] = useMemo(() => {
        const list: Block[] = [];
        for (let i = 0; i < turns.length; i++) {
            const turn = turns[i];
            if (turn.role !== 'user') continue;
            const next = turns[i + 1];
            const answer = next && next.role === 'assistant' ? next : undefined;
            list.push({
                key: `block-${turn.id}`,
                prompt: turn,
                answer,
                headings: answer?.headings || [],
            });
        }
        return list;
    }, [turns]);

    const normalizedSearch = search.trim().toLowerCase();

    const filteredBlocks = useMemo(() => {
        const term = search.toLowerCase().trim();
        const showHeadings = viewLevel === 2;
        return blocks.filter((block) => {
            const promptText = (block.prompt.text || '').toLowerCase();
            const answerText = (block.answer?.text || '').toLowerCase();
            const headingsText = block.headings.map((h) => h.innerText.toLowerCase()).join(' ');
            if (!term) return true;
            return (
                promptText.includes(term) ||
                answerText.includes(term) ||
                (showHeadings && headingsText.includes(term))
            );
        });
    }, [blocks, search, viewLevel]);

    type FocusItem =
        | { key: string; kind: 'block'; block: Block }
        | { key: string; kind: 'heading'; block: Block; heading?: Turn['headings'][number] }
        | { key: string; kind: 'command'; command: 'export' };

    const focusableItems: FocusItem[] = useMemo(() => {
        const showHeadings = viewLevel === 2;
        const items: FocusItem[] = [];

        const showExport = normalizedSearch === '/export' || normalizedSearch === '/e' || normalizedSearch === '/ex';
        if (showExport) {
            items.push({ key: 'export-command', kind: 'command', command: 'export' });
        }

        filteredBlocks.forEach((block) => {
            items.push({ key: block.key, kind: 'block', block });
            if (showHeadings && block.answer) {
                if (block.headings.length > 0) {
                    block.headings.forEach((h, idx) => {
                        items.push({ key: `${block.key}-heading-${idx}`, kind: 'heading', block, heading: h });
                    });
                } else {
                    items.push({ key: `${block.key}-heading-0`, kind: 'heading', block, heading: undefined });
                }
            }
        });
        return items;
    }, [filteredBlocks, viewLevel, normalizedSearch]);

    const focusIndexByKey = useMemo(() => {
        const map = new Map<string, number>();
        focusableItems.forEach((item, idx) => map.set(item.key, idx));
        return map;
    }, [focusableItems]);

    const getCurrentExportBlocks = useCallback((): ExportBlock[] => {
        return blocks.map((block) => {
            const promptText = block.prompt.element
                ? serializeNodeToMarkdown(block.prompt.element)
                : (block.prompt.text || '');

            const answerText = block.answer?.element
                ? serializeNodeToMarkdown(block.answer.element)
                : (block.answer?.text || '');

            return {
                prompt: promptText.trim(),
                answer: answerText.trim(),
                headings: block.headings.map((h) => h.innerText),
            };
        });
    }, [blocks]);

    const buildCapturedExportBlocks = useCallback((turnList: CapturedTurn[]): ExportBlock[] => {
        const result: ExportBlock[] = [];
        let pendingPrompt: string | null = null;

        turnList.forEach((turn) => {
            const text = turn?.text?.trim();
            if (!text) return;

            if (turn.role === 'user') {
                if (pendingPrompt) {
                    result.push({ prompt: pendingPrompt });
                }
                pendingPrompt = text;
            } else {
                if (pendingPrompt !== null) {
                    result.push({ prompt: pendingPrompt, answer: text });
                    pendingPrompt = null;
                } else {
                    result.push({ prompt: 'User', answer: text });
                }
            }
        });

        if (pendingPrompt) {
            result.push({ prompt: pendingPrompt });
        }

        return result;
    }, []);

    const exportChat = useCallback(async (format: 'md' | 'pdf' | 'txt' | 'json' = exportFormat, exportBlocks?: ExportBlock[]) => {
        const turns = exportBlocks ?? getCurrentExportBlocks();
        if (!turns.length) {
            showToast('Nothing to export yet');
            return;
        }

        const filename = generateExportFilename({ type: 'chat', provider: providerName, title: chatTitle, format });

        if (format === 'md') {
            const lines: string[] = [];
            lines.push(`# Chat Export (${providerName}) - ${new Date().toLocaleString()}`, '');
            turns.forEach((block, idx) => {
                lines.push(`## Turn ${idx + 1}`, '');
                lines.push('**User**');
                lines.push(block.prompt || '…', '');
                if (block.answer) {
                    lines.push('**Assistant**');
                    lines.push(block.answer || '…', '');
                }
                lines.push('---', '');
            });
            downloadFile(lines.join('\n'), 'text/markdown', filename);
            return;
        }

        if (format === 'txt') {
            const lines: string[] = [];
            lines.push(`CHAT EXPORT (${providerName})`, `Exported: ${new Date().toLocaleString()}`, '', '='.repeat(60), '');
            turns.forEach((block, idx) => {
                const promptPlain = stripMarkdown(block.prompt);
                const answerPlain = stripMarkdown(block.answer || '');

                lines.push(`[${idx + 1}] User:`, promptPlain || '…', '');
                if (block.answer) {
                    lines.push('Assistant:', answerPlain || '…', '');
                }
                lines.push('-'.repeat(60), '');
            });
            downloadFile(lines.join('\n'), 'text/plain', filename);
            return;
        }

        if (format === 'json') {
            const data = {
                exported: new Date().toISOString(),
                provider: providerName,
                url: window.location.href,
                turns: turns.map((block) => ({
                    prompt: block.prompt,
                    response: block.answer || '',
                    headings: block.headings || [],
                })),
            };
            downloadFile(JSON.stringify(data, null, 2), 'application/json', filename);
            return;
        }

        if (format === 'pdf') {
            const renderedTurns = await Promise.all(turns.map(async (block) => ({
                promptHtml: await renderMarkdownToHtml(block.prompt || '…'),
                answerHtml: await renderMarkdownToHtml(block.answer || '…')
            })));

            const body = `
              <div class="header">
                <h1>${DOMPurify.sanitize(chatTitle)}</h1>
                <div class="header-meta">
                  <span>${DOMPurify.sanitize(providerName)}</span>
                  <span>${formatPdfDate(Date.now())}</span>
                  <span>${turns.length} turns</span>
                </div>
              </div>
              ${renderedTurns
                    .map(
                        (block) => `
                    <div class="turn">
                      <div class="content-section">
                        <div class="section-label">You</div>
                        <div class="prompt">${block.promptHtml}</div>
                      </div>
                      ${block.answerHtml
                                ? `<div class="content-section">
                        <div class="section-label">Assistant</div>
                        <div class="response">${block.answerHtml}</div>
                      </div>`
                                : ''
                            }
                    </div>
                  `
                    )
                    .join('')}
            `;
            const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${DOMPurify.sanitize(chatTitle)} - Export</title>${getPdfStyles()}</head><body>${body}</body></html>`;
            await printHtmlAsPdf(html);
        }
    }, [chatTitle, exportFormat, getCurrentExportBlocks, providerName, showToast]);

    const captureChatGPTViaNavigation = useCallback(async (): Promise<ExportBlock[]> => {
        const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

        const waitForHydration = async (block: Block) => {
            const start = Date.now();
            const MAX_WAIT = 2500; // Max wait time per block

            while (Date.now() - start < MAX_WAIT) {
                const promptEl = block.prompt.element?.querySelector('[data-message-author-role="user"]');
                const answerEl = block.answer?.element?.querySelector('[data-message-author-role="assistant"]');

                const hasPrompt = !block.prompt.element || (promptEl as HTMLElement)?.innerText?.trim().length > 0;
                const hasAnswer = !block.answer?.element || (answerEl as HTMLElement)?.innerText?.trim().length > 0;

                if (hasPrompt && hasAnswer) {
                    await sleep(50);
                    return;
                }

                await sleep(50); // Poll every 50ms
            }
        };

        const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false;

        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 2147483646;
            background: ${prefersLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.15)'};
            pointer-events: all;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding-bottom: 28px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        `;

        const style = document.createElement('style');
        style.textContent = `
            @keyframes scroll-pro-pill-in {
                from { opacity: 0; transform: translateY(8px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .scroll-pro-capture-stop {
                background: none;
                border: none;
                color: ${prefersLight ? '#7b808b' : '#6f7381'};
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                padding: 0 2px;
                letter-spacing: 0.01em;
                transition: color 0.15s;
            }
            .scroll-pro-capture-stop:hover {
                color: ${prefersLight ? '#15171c' : '#f5f5f7'};
            }
        `;
        overlay.appendChild(style);

        const pill = document.createElement('div');
        pill.style.cssText = `
            background: ${prefersLight ? '#f8f7f4' : '#050608'};
            border: 1px solid ${prefersLight ? '#d9d6cf' : '#262732'};
            border-radius: 10px;
            box-shadow: ${prefersLight ? '0 12px 28px rgba(20, 18, 12, 0.12)' : '0 16px 36px rgba(0, 0, 0, 0.45)'};
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 14px;
            position: relative;
            overflow: hidden;
            animation: scroll-pro-pill-in 0.2s ease-out;
        `;

        const mainText = document.createElement('span');
        mainText.style.cssText = `
            font-size: 13px;
            font-weight: 500;
            color: ${prefersLight ? '#15171c' : '#f5f5f7'};
            letter-spacing: 0.01em;
        `;
        mainText.textContent = 'Preparing...';

        const subText = document.createElement('span');
        subText.style.cssText = `
            font-size: 12px;
            color: ${prefersLight ? '#7b808b' : '#6f7381'};
        `;
        subText.textContent = '';

        const abortBtn = document.createElement('button');
        abortBtn.className = 'scroll-pro-capture-stop';
        abortBtn.textContent = 'Stop';

        const abortState = { aborted: false };
        abortBtn.onclick = (e) => {
            e.stopPropagation();
            abortState.aborted = true;
        };

        const progressBar = document.createElement('div');
        progressBar.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 0;
            height: 2px;
            width: 0%;
            background: ${prefersLight ? '#4b4f59' : '#b0b3c0'};
            border-radius: 0 1px 0 0;
            transition: width 0.3s ease;
        `;

        pill.appendChild(mainText);
        pill.appendChild(subText);
        pill.appendChild(abortBtn);
        pill.appendChild(progressBar);
        overlay.appendChild(pill);
        document.body.appendChild(overlay);

        try {
            const exportBlocks: ExportBlock[] = [];
            const totalBlocks = blocks.length;
            const startTime = Date.now();

            for (let i = 0; i < totalBlocks; i++) {
                if (abortState.aborted) {
                    showToast('Capture stopped');
                    break; // Exit loop, return what we have
                }

                const block = blocks[i];

                const elapsed = Date.now() - startTime;
                const avgTimePerBlock = i > 0 ? elapsed / i : 1000; // Default 1s for first block
                const remainingBlocks = totalBlocks - i;
                const estimatedRemainingMs = remainingBlocks * avgTimePerBlock;
                const estimatedSeconds = Math.ceil(estimatedRemainingMs / 1000);

                mainText.textContent = `Capturing ${i + 1} of ${totalBlocks}`;
                subText.textContent = `~${estimatedSeconds}s`;
                progressBar.style.width = `${Math.round(((i + 1) / totalBlocks) * 100)}%`;

                const targetElement = block.prompt.element || block.answer?.element;
                if (targetElement) {
                    scrollToElement(targetElement);
                    await waitForHydration(block);
                }

                // Use specific selectors to avoid capturing role headers
                const promptEl = block.prompt.element?.querySelector('[data-message-author-role="user"]');
                const promptText = (promptEl as HTMLElement)?.innerText?.trim() || block.prompt.text || '';

                const answerEl = block.answer?.element?.querySelector('[data-message-author-role="assistant"]');
                const answerText = (answerEl as HTMLElement)?.innerText?.trim() || block.answer?.text || '';

                const headings = block.headings?.map(h => h.innerText?.trim() || '').filter(Boolean) || [];

                const promptMarkdown = promptEl ? serializeNodeToMarkdown(promptEl) : promptText;
                const answerMarkdown = answerEl ? serializeNodeToMarkdown(answerEl) : answerText;

                exportBlocks.push({
                    prompt: promptMarkdown || promptText,
                    answer: answerMarkdown || answerText,
                    headings,
                });
            }

            return exportBlocks;
        } finally {
            overlay.remove();
        }
    }, [blocks, showToast]);

    const startExport = useCallback(async (format: 'md' | 'pdf' | 'txt' | 'json' = exportFormat) => {
        if (captureInProgressRef.current) return;

        if (providerName === 'chatgpt') {
            if (!hasCaptureConsent) {
                setShowCaptureConsent(true);
                return;
            }

            captureInProgressRef.current = true;
            try {
                const exportBlocks = await captureChatGPTViaNavigation();
                await exportChat(format, exportBlocks);
                showToast('Chat exported');
                maybeShowContextHint();
            } catch (err) {
                showToast('Export failed');
            } finally {
                captureInProgressRef.current = false;
            }
            return;
        }

        await exportChat(format);
        maybeShowContextHint();
    }, [captureChatGPTViaNavigation, exportChat, exportFormat, hasCaptureConsent, providerName, showToast, maybeShowContextHint]);

    const handleConsentAccept = useCallback(() => {
        try {
            localStorage.setItem(CHATGPT_CAPTURE_CONSENT_KEY, 'true');
        } catch {
        }
        setHasCaptureConsent(true);
        setShowCaptureConsent(false);
        startExport(exportFormat);
    }, [exportFormat, startExport]);

    const handleConsentDismiss = useCallback(() => {
        setShowCaptureConsent(false);
    }, []);

    const handleSearchKeyDown = useCallback((e: ReactKeyboardEvent<HTMLInputElement>) => {
        e.stopPropagation(); // Always stop propagation from search input
        const trimmed = search.trim().toLowerCase();

        if (e.key === 'Escape') {
            e.preventDefault();
            setSearch('');
            searchInputRef.current?.blur();
            sidebarShellRef.current?.focus();
            return;
        }

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            searchInputRef.current?.blur();
            sidebarShellRef.current?.focus();
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            if (trimmed === '/export' || trimmed === '/e' || trimmed === '/ex') {
                startExport();
                setSearch('');
            }
            searchInputRef.current?.blur();
            sidebarShellRef.current?.focus();
        }
    }, [search, startExport]);

    const stopSearchPropagation = useCallback((e: ReactKeyboardEvent<HTMLInputElement>) => {
        e.stopPropagation();
    }, []);

    useEffect(() => {
        return () => {};
    }, []);

    const findVisibleTurnIndex = useCallback(() => {
        if (!turns.length) return -1;

        const viewportHeight = window.innerHeight;
        const headerOffset = 100; // Approximate header height

        for (let i = 0; i < turns.length; i++) {
            const turn = turns[i];
            if (!turn.element) continue;
            const rect = turn.element.getBoundingClientRect();

            if ((rect.top >= headerOffset && rect.top < viewportHeight) ||
                (rect.top < headerOffset && rect.bottom > headerOffset)) {
                return i;
            }
        }
        return 0; // Default to first if none found
    }, [turns]);

    useEffect(() => {
        if (!container || !isOpen || isPaused) return;

        const scrollEl = findScrollable(container);
        if (!scrollEl) return;

        let ticking = false;

        const handleScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    if (!isHoveringSidebar.current) {
                        const visibleTurnIndex = findVisibleTurnIndex();
                        if (visibleTurnIndex >= 0) {
                            const turn = turns[visibleTurnIndex];
                            const itemIndex = focusableItems.findIndex(item =>
                                item.kind === 'block' && item.block.prompt.id === turn.id
                            );

                            if (itemIndex >= 0 && itemIndex !== focusedIndex) {
                                isSmoothPursuit.current = true;
                                setFocusedIndex(itemIndex);
                            }
                        }
                    }
                    ticking = false;
                });
                ticking = true;
            }
        };

        scrollEl.addEventListener('scroll', handleScroll, { passive: true });
        return () => scrollEl.removeEventListener('scroll', handleScroll);
    }, [container, isOpen, isPaused, turns, focusableItems, focusedIndex, findVisibleTurnIndex]);

    useEffect(() => {
        if (isOpen && !isPaused && !hasInitializedFocus.current) {
            hasInitializedFocus.current = true;

            const visibleTurnIndex = findVisibleTurnIndex();
            if (visibleTurnIndex >= 0) {
                const turn = turns[visibleTurnIndex];
                const itemIndex = focusableItems.findIndex(item =>
                    item.kind === 'block' && item.block.prompt.id === turn.id
                );
                if (itemIndex >= 0) {
                    setFocusedIndex(itemIndex);
                } else {
                    setFocusedIndex(0);
                }
            }

            sidebarShellRef.current?.focus();
        }

        if (!isOpen) {
            hasInitializedFocus.current = false;
        }
    }, [isOpen, isPaused]); // Removed turns and findVisibleTurnIndex to prevent aggressive re-sync

    useEffect(() => {
        if (focusedIndex >= focusableItems.length && focusableItems.length > 0) {
            setFocusedIndex(focusableItems.length - 1);
        }
    }, [focusableItems.length]);

    useEffect(() => {
        const handleStorage = (event: StorageEvent) => {
            if (event.key === LINE_CLAMP_KEY) {
                setLineClamp(getLineClamp());
            }
            if (event.key === 'scroll-pro-export-format' && event.newValue) {
                if (event.newValue === 'md' || event.newValue === 'pdf' || event.newValue === 'txt' || event.newValue === 'json') {
                    setExportFormat(event.newValue);
                }
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    useEffect(() => {
        if (!isOpen && contextMenu) {
            setContextMenu(null);
        }
        if (!isOpen && exportFormatMenu) {
            setExportFormatMenu(null);
        }
        if (!isOpen && copyFormatMenu) {
            setCopyFormatMenu(null);
        }
    }, [isOpen, contextMenu, exportFormatMenu, copyFormatMenu]);

    useEffect(() => {
        if (!isOpen || isPaused) return;
        const id = window.setTimeout(() => {
            if (focusedIndex < 0 || focusedIndex === 0) {
                searchInputRef.current?.focus();
                searchInputRef.current?.select();
            }
        }, 100); // Small delay to let scroll settle
        return () => window.clearTimeout(id);
    }, [isOpen, isPaused]);

    useEffect(() => {
        if (!contextMenu) return;
        const close = () => setContextMenu(null);
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
        };
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        window.addEventListener('keydown', handleKey);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
            window.removeEventListener('keydown', handleKey);
        };
    }, [contextMenu]);

    useEffect(() => {
        if (!exportFormatMenu) return;
        const close = () => setExportFormatMenu(null);
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
        };
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        window.addEventListener('keydown', handleKey);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
            window.removeEventListener('keydown', handleKey);
        };
    }, [exportFormatMenu]);

    useEffect(() => {
        if (!copyFormatMenu) return;
        const close = () => setCopyFormatMenu(null);
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
        };
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        window.addEventListener('keydown', handleKey);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
            window.removeEventListener('keydown', handleKey);
        };
    }, [copyFormatMenu]);

    useEffect(() => {
        const scrollEl = findScrollable(container || null);
        if (!scrollEl) return;
        const computeProgress = () => {
            const scrolled = scrollEl.scrollTop;
            const max = Math.max(scrollEl.scrollHeight - scrollEl.clientHeight, 0);
            const pct = max > 0 ? Math.round((scrolled / max) * 100) : 0;
            setProgress(pct);
        };
        computeProgress();
        scrollEl.addEventListener('scroll', computeProgress, { passive: true });
        return () => scrollEl.removeEventListener('scroll', computeProgress);
    }, [container, turns]);

    useEffect(() => {
        const handleExportEvent = (e: Event) => {
            const customEvent = e as CustomEvent;
            const { format } = customEvent.detail;
            if (providerName) {
                startExport(format);
            }
        };
        window.addEventListener('scroll-pro-export-chat', handleExportEvent as EventListener);
        return () => window.removeEventListener('scroll-pro-export-chat', handleExportEvent as EventListener);
    }, [providerName, startExport]);

    const handleCopyFullChat = useCallback(() => {
        const lines: string[] = [];
        blocks.forEach((block) => {
            const promptText = getTurnCopyText(block.prompt);
            lines.push(`User: ${promptText}`, '');
            if (block.answer) {
                const answerText = getTurnCopyText(block.answer);
                lines.push(`Assistant: ${answerText}`, '', '---', '');
            }
        });
        const fullText = lines.join('\n');
        copyToClipboard(fullText);
        showToast(copyWithMarkdown ? 'Full chat copied (markdown)' : 'Full chat copied');
        maybeShowContextHint();
    }, [blocks, copyWithMarkdown, getTurnCopyText, showToast, maybeShowContextHint]);

    useEffect(() => {
        if (!isOpen || isPaused) return;

        const handler = (e: KeyboardEvent) => {
            if (document.activeElement === searchInputRef.current) return;

            const target = e.target as HTMLElement | null;
            const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

            if (typing && target !== sidebarShellRef.current) return;

            if (e.key === 'Escape' || (e.key === "'" && e.metaKey)) {
                e.preventDefault();
                e.stopPropagation();
                if (showHelp) {
                    setShowHelp(false);
                } else {
                    onToggle();
                }
                return;
            }

            if (e.key === 'Backspace' && showHelp) {
                e.preventDefault();
                e.stopPropagation();
                setShowHelp(false);
                return;
            }

            const lowerKey = e.key?.toLowerCase();
            const hasChord = e.metaKey || e.ctrlKey;
            if (hasChord && e.code === 'Space') {
                e.preventDefault();
                e.stopPropagation();
                setViewLevel((prev) => (prev === 1 ? 2 : 1));
                return;
            }
            if (hasChord && ['c', 'x', 'z', 'm', 'e', ';', "'"].includes(lowerKey)) {
                const selection = document.getSelection();
                const shell = sidebarShellRef.current;
                const anchor = selection?.anchorNode || selection?.focusNode || null;
                if (selection && selection.toString().trim().length > 0 && shell && anchor && !shell.contains(anchor)) {
                    return;
                }

                if (lowerKey === ';' || lowerKey === "'") {
                    onToggle();
                    return;
                }

                if (lowerKey === 'c' && e.shiftKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCopyFullChat();
                    return;
                }

                e.preventDefault();
                e.stopPropagation();

                if (lowerKey === 'e') {
                    startExport();
                    showToast(providerName === 'chatgpt' ? 'Preparing full export...' : 'Chat exported');
                    return;
                }

                if (lowerKey === 'm') {
                    setCopyWithMarkdown((prev) => {
                        const next = !prev;
                        showToast(next ? 'Markdown copy: On' : 'Markdown copy: Off');
                        return next;
                    });
                    return;
                }

                const item = focusableItems[focusedIndex];
                if (item) {
                    if (item.kind === 'command' && lowerKey === 'e') {
                        startExport();
                        showToast(providerName === 'chatgpt' ? 'Preparing full export...' : 'Chat exported');
                        return;
                    }
                    if (item.kind === 'block') {
                        const { block } = item;
                        let textToCopy = '';
                        let toastText = '';

                        if (lowerKey === 'z' && block.answer) {
                            const promptText = getTurnCopyText(block.prompt);
                            const answerText = getTurnCopyText(block.answer);
                            textToCopy = `Q: ${promptText}\n\nA: ${answerText}`;
                            toastText = copyWithMarkdown ? 'Q&A copied (markdown)' : 'Q&A copied!';
                        } else if (lowerKey === 'c' && block.answer) {
                            textToCopy = getTurnCopyText(block.answer);
                            toastText = copyWithMarkdown ? 'Response copied (markdown)' : 'Response copied!';
                        } else if (lowerKey === 'x') {
                            textToCopy = getTurnCopyText(block.prompt);
                            toastText = copyWithMarkdown ? 'Prompt copied (markdown)' : 'Prompt copied!';
                        }
                        if (textToCopy) {
                            copyToClipboard(textToCopy);
                            showToast(toastText);
                        }
                    }
                }
                return;
            }

            if (e.key === '?') {
                e.preventDefault();
                e.stopPropagation();
                setShowHelp(prev => !prev);
                return;
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                e.stopPropagation();
                userInteractionRef.current = true;
                if (e.shiftKey) {
                    setFocusedIndex(prev => {
                        let next = prev + 1;
                        while (next < focusableItems.length) {
                            if (focusableItems[next].kind === 'block') return next;
                            next++;
                        }
                        return prev; // Stay if no next prompt
                    });
                } else {
                    setFocusedIndex(prev => Math.min(prev + 1, focusableItems.length - 1));
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                e.stopPropagation();
                userInteractionRef.current = true;
                if (e.shiftKey) {
                    setFocusedIndex(prev => {
                        let next = prev - 1;
                        while (next >= 0) {
                            if (focusableItems[next].kind === 'block') return next;
                            next--;
                        }
                        return prev; // Stay if no prev prompt
                    });
                } else {
                    setFocusedIndex(prev => Math.max(prev - 1, 0));
                }
            } else if (e.key === 'Tab' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                e.stopPropagation();
                setViewLevel(prev => prev === 1 ? 2 : 1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                const item = focusableItems[focusedIndex];
                if (item) {
                    if (item.kind === 'heading' && item.heading?.element) {
                        scrollToElement(item.heading.element);
                    } else if (item.kind === 'block' && item.block.prompt.element) {
                        scrollToElement(item.block.prompt.element);
                    } else if (item.kind === 'command' && item.command === 'export') {
                        startExport();
                        if (providerName === 'chatgpt') {
                            showToast('Preparing full export...');
                        } else {
                            showToast('Chat exported');
                        }
                        setSearch('');
                    }
                }
            }
        };

        window.addEventListener('keydown', handler, true); // Capture phase to beat Claude
        return () => window.removeEventListener('keydown', handler, true);
    }, [copyWithMarkdown, focusableItems, focusedIndex, getTurnCopyText, isOpen, isPaused, onToggle, providerName, showHelp, showToast, startExport]);

    // Capture-phase contextmenu handler (beats host page interception)
    const filteredBlocksRef = useRef(filteredBlocks);
    filteredBlocksRef.current = filteredBlocks;
    const focusIndexByKeyRef = useRef(focusIndexByKey);
    focusIndexByKeyRef.current = focusIndexByKey;

    useEffect(() => {
        if (!isOpen || isPaused) return;

        const handler = (e: MouseEvent) => {
            const shell = sidebarShellRef.current;
            if (!shell) return;

            const path = e.composedPath();
            if (!path.includes(shell)) return;

            const target = path[0] as HTMLElement;
            if (!target || typeof target.closest !== 'function') return;

            const itemEl = target.closest('[data-block-key]') as HTMLElement | null;
            if (itemEl) {
                const key = itemEl.getAttribute('data-block-key');
                const block = key ? filteredBlocksRef.current.find(b => b.key === key) : null;
                if (block) {
                    e.preventDefault();
                    e.stopPropagation();
                    const focusIdx = key ? (focusIndexByKeyRef.current.get(key) ?? -1) : -1;
                    if (focusIdx >= 0) setFocusedIndex(focusIdx);
                    const menuWidth = 220;
                    const menuHeight = 180;
                    const x = Math.min(e.clientX, window.innerWidth - menuWidth);
                    const y = Math.min(e.clientY, window.innerHeight - menuHeight);
                    setContextMenu({ x, y, block });
                }
                return;
            }

            const copyBtn = target.closest('[data-action="copy-format"]') as HTMLElement | null;
            if (copyBtn) {
                e.preventDefault();
                e.stopPropagation();
                setCopyFormatMenu({ x: e.clientX, y: e.clientY });
                return;
            }

            const exportBtn = target.closest('[data-action="export-format"]') as HTMLElement | null;
            if (exportBtn) {
                e.preventDefault();
                e.stopPropagation();
                setExportFormatMenu({ x: e.clientX, y: e.clientY });
                return;
            }

            e.preventDefault();
        };

        window.addEventListener('contextmenu', handler, true);
        return () => window.removeEventListener('contextmenu', handler, true);
    }, [isOpen, isPaused]);

    useEffect(() => {
        if (focusedIndex < 0) return;
        const item = focusableItems[focusedIndex];
        if (!item) return;
        const el = itemRefs.current.get(item.key);
        if (el) {
            const behavior = userInteractionRef.current || isSmoothPursuit.current ? 'smooth' : 'auto';

            const block = isSmoothPursuit.current ? 'center' : 'nearest';

            el.scrollIntoView({ behavior, block });

            if (userInteractionRef.current) {
                setTimeout(() => {
                    userInteractionRef.current = false;
                }, 50);
            }
            if (isSmoothPursuit.current) {
                setTimeout(() => {
                    isSmoothPursuit.current = false;
                }, 500); // Longer timeout for smooth scroll to finish
            }
        }
    }, [focusedIndex, focusableItems]);

    useEffect(() => {
        if (focusedIndex < 0) return;
        const item = focusableItems[focusedIndex];
        if (item?.kind === 'block') {
            const blockKey = item.block.key;
            if (blockKey && blockKey !== lastFocusedKey) {
                setLastFocusedKey(blockKey);
            }
        }
    }, [focusedIndex, focusableItems, lastFocusedKey]);

    const renderContextMenu = () => {
        if (!contextMenu) return null;
        const { block } = contextMenu;
        const hasAnswer = Boolean(block.answer);

        const onCopyPrompt = () => {
            copyToClipboard(getTurnCopyText(block.prompt));
            showToast(copyWithMarkdown ? 'Prompt copied (markdown)' : 'Prompt copied');
            setContextMenu(null);
        };

        const onCopyResponse = () => {
            if (!block.answer) return;
            copyToClipboard(getTurnCopyText(block.answer));
            showToast(copyWithMarkdown ? 'Response copied (markdown)' : 'Response copied');
            setContextMenu(null);
        };

        const onCopyQA = () => {
            if (!block.answer) return;
            const promptText = getTurnCopyText(block.prompt);
            const answerText = getTurnCopyText(block.answer);
            const text = `Q: ${promptText}\n\nA: ${answerText}`;
            copyToClipboard(text);
            showToast(copyWithMarkdown ? 'Prompt and response copied (markdown)' : 'Prompt and response copied');
            setContextMenu(null);
        };

        return (
            <div
                className="scroll-pro-context-menu"
                style={{ top: contextMenu.y, left: contextMenu.x }}
                ref={contextMenuRef}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onContextMenu={(e) => e.preventDefault()}
            >
                <button className="scroll-pro-context-item" onClick={onCopyResponse} disabled={!hasAnswer}>
                    <span className="scroll-pro-context-label">Copy response</span>
                    <span className="scroll-pro-context-kbd">⌘/Ctrl+C</span>
                </button>
                <button className="scroll-pro-context-item" onClick={onCopyQA} disabled={!hasAnswer}>
                    <span className="scroll-pro-context-label">Copy Q&A</span>
                    <span className="scroll-pro-context-kbd">⌘/Ctrl+Z</span>
                </button>
                <button className="scroll-pro-context-item" onClick={onCopyPrompt}>
                    <span className="scroll-pro-context-label">Copy prompt</span>
                    <span className="scroll-pro-context-kbd">⌘/Ctrl+X</span>
                </button>
                <div className="scroll-pro-context-divider" role="separator" />
                <button
                    className="scroll-pro-context-item"
                    onClick={() => setCopyWithMarkdown((prev) => !prev)}
                    role="menuitemcheckbox"
                    aria-checked={copyWithMarkdown}
                    aria-label="Toggle copy markdown"
                >
                    <span className="scroll-pro-context-check" aria-hidden="true">{copyWithMarkdown ? '✓' : ''}</span>
                    <span className="scroll-pro-context-label">Markdown</span>
                    <span className="scroll-pro-context-kbd">⌘/Ctrl+M</span>
                </button>
            </div>
        );
    };

    const renderExportFormatMenu = () => {
        if (!exportFormatMenu) return null;

        type FormatOption = 'md' | 'pdf' | 'txt' | 'json';
        const formats: Array<{ value: FormatOption; label: string }> = [
            { value: 'md', label: 'Markdown' },
            { value: 'pdf', label: 'PDF' },
            { value: 'txt', label: 'Text' },
            { value: 'json', label: 'JSON' },
        ];

        const handleFormatSelect = (format: FormatOption) => {
            try {
                localStorage.setItem('scroll-pro-export-format', format);
            } catch {}
            setExportFormat(format);

            startExport(format);
            if (providerName === 'chatgpt') {
                showToast('Preparing full export...');
            } else {
                showToast(`Exported as ${format.toUpperCase()}`);
            }

            setExportFormatMenu(null);
        };

        const menuWidth = 200; // Approximate context menu width
        const menuHeight = formats.length * 36 + 8; // Approximate height (36px per item + padding)
        const { x, y } = exportFormatMenu;

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let adjustedX = x;
        if (x + menuWidth > viewportWidth) {
            adjustedX = x - menuWidth;
        }

        let adjustedY = y;
        if (y + menuHeight > viewportHeight) {
            adjustedY = y - menuHeight;
        }

        return (
            <div
                className="scroll-pro-context-menu"
                style={{ top: adjustedY, left: adjustedX }}
                ref={exportFormatMenuRef}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onContextMenu={(e) => e.preventDefault()}
            >
                {formats.map((format) => (
                    <button
                        key={format.value}
                        className="scroll-pro-context-item"
                        onClick={() => handleFormatSelect(format.value)}
                    >
                        <span className="scroll-pro-context-label">{format.label}</span>
                        <span className="scroll-pro-context-kbd">{format.value.toUpperCase()}</span>
                    </button>
                ))}
            </div>
        );
    };

    const renderCopyFormatMenu = () => {
        if (!copyFormatMenu) return null;

        type CopyOption = { value: string; label: string; action: () => void };
        const options: CopyOption[] = [
            {
                value: 'text',
                label: 'Plain text',
                action: () => {
                    const lines: string[] = [];
                    blocks.forEach((block) => {
                        const promptText = block.prompt.text || '';
                        lines.push(`User: ${promptText}`, '');
                        if (block.answer) {
                            const answerText = block.answer.text || '';
                            lines.push(`Assistant: ${answerText}`, '', '---', '');
                        }
                    });
                    copyToClipboard(lines.join('\n'));
                    showToast('Full chat copied (plain text)');
                },
            },
            {
                value: 'md',
                label: 'Markdown',
                action: () => {
                    const lines: string[] = [];
                    blocks.forEach((block) => {
                        const promptText = block.prompt.element
                            ? serializeNodeToMarkdown(block.prompt.element).replace(/\n{3,}/g, '\n\n').trim()
                            : block.prompt.text || '';
                        lines.push(`**User:** ${promptText}`, '');
                        if (block.answer) {
                            const answerText = block.answer.element
                                ? serializeNodeToMarkdown(block.answer.element).replace(/\n{3,}/g, '\n\n').trim()
                                : block.answer.text || '';
                            lines.push(`**Assistant:** ${answerText}`, '', '---', '');
                        }
                    });
                    copyToClipboard(lines.join('\n'));
                    showToast('Full chat copied (markdown)');
                },
            },
            {
                value: 'json',
                label: 'JSON',
                action: () => {
                    const data = {
                        provider: providerName,
                        url: window.location.href,
                        turns: blocks.map((block) => ({
                            prompt: block.prompt.text || '',
                            response: block.answer?.text || '',
                        })),
                    };
                    copyToClipboard(JSON.stringify(data, null, 2));
                    showToast('Full chat copied (JSON)');
                },
            },
        ];

        const menuWidth = 200;
        const menuHeight = options.length * 36 + 8;
        const { x, y } = copyFormatMenu;

        let adjustedX = x;
        if (x + menuWidth > window.innerWidth) {
            adjustedX = x - menuWidth;
        }

        let adjustedY = y;
        if (y + menuHeight > window.innerHeight) {
            adjustedY = y - menuHeight;
        }

        return (
            <div
                className="scroll-pro-context-menu"
                style={{ top: adjustedY, left: adjustedX }}
                ref={copyFormatMenuRef}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onContextMenu={(e) => e.preventDefault()}
            >
                {options.map((option) => (
                    <button
                        key={option.value}
                        className="scroll-pro-context-item"
                        onClick={() => {
                            option.action();
                            setCopyFormatMenu(null);
                        }}
                    >
                        <span className="scroll-pro-context-label">{option.label}</span>
                        <span className="scroll-pro-context-kbd">{option.value.toUpperCase()}</span>
                    </button>
                ))}
            </div>
        );
    };

    const effectivePosition = isDragging && dragPositionRef.current
        ? dragPositionRef.current
        : sidebarPosition;
    const effectiveDirection = isDragging && dragOpenDirectionRef.current
        ? dragOpenDirectionRef.current
        : getSidebarOpenDirection(effectivePosition);

    return (
        <div
            ref={sidebarShellRef}
            className={`scroll-pro-sidebar-shell ${isOpen ? 'is-open' : ''} ${isDragging ? 'is-dragging' : ''}`}
            data-open-x={effectiveDirection.x}
            data-open-y={effectiveDirection.y}
            style={{
                ['--sidebar-line-clamp' as string]: lineClamp,
                ['--sidebar-x' as string]: `${effectivePosition.x}px`,
                ['--sidebar-y' as string]: `${effectivePosition.y}px`,
            }}
        >
            <button
                ref={toggleButtonRef}
                onClick={handleToggleClick}
                onPointerDown={handleTogglePointerDown}
                className="scroll-pro-toggle-icon"
                aria-label="Toggle outline"
                title="Toggle outline (press and hold to move)"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
            </button>

            {isOpen && (
                <div
                    className="scroll-pro-sidebar"
                    role="complementary"
                    aria-label="Scroll Pro outline"
                    onMouseEnter={() => isHoveringSidebar.current = true}
                    onMouseLeave={() => isHoveringSidebar.current = false}
                >
                    {showUpdateBanner ? (
                        <div className="scroll-pro-update-banner">
                            <button
                                className="scroll-pro-update-banner-close"
                                onClick={dismissUpdateBanner}
                                aria-label="Dismiss"
                            >
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <path d="M11 3L3 11M3 3l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                            </button>
                            <h3 className="scroll-pro-update-banner-title">Scroll just got a big update</h3>
                            <span className="scroll-pro-update-banner-subtitle">What's new</span>
                            <ul className="scroll-pro-update-banner-list">
                                <li>Copy &amp; export full conversations</li>
                                <li>Cleaner, faster sidebar</li>
                                <li>Drag the sidebar anywhere</li>
                                <li>Right-click any turn for more options</li>
                            </ul>
                            <span className="scroll-pro-update-banner-subtitle">What's next</span>
                            <p className="scroll-pro-update-banner-teaser">
                                Scroll helps you navigate within chats. Soon you'll search across them too.
                            </p>
                            <img
                                className="scroll-pro-update-banner-img"
                                src={chrome.runtime.getURL(whatsNextImg)}
                                alt="Command palette preview"
                            />
                            <a
                                className="scroll-pro-update-banner-cta"
                                href="https://tryscroll.app"
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={dismissUpdateBanner}
                            >
                                Get early access
                            </a>
                            <button
                                className="scroll-pro-update-banner-dismiss"
                                onClick={dismissUpdateBanner}
                            >
                                Maybe later
                            </button>
                        </div>
                    ) : showHelp ? (
                        <div className="scroll-pro-help">
                            <div className="scroll-pro-help-header">
                                <h3 className="scroll-pro-help-title">Keyboard shortcuts</h3>
                                <button
                                    className="scroll-pro-update-banner-close"
                                    onClick={() => setShowHelp(false)}
                                    aria-label="Close help"
                                >
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                        <path d="M11 3L3 11M3 3l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                    </svg>
                                </button>
                            </div>
                            <div className="scroll-pro-help-section">
                                <span className="scroll-pro-help-label">Navigate</span>
                                <div className="scroll-pro-help-row"><span className="scroll-pro-help-keys"><kbd>↑</kbd> <kbd>↓</kbd></span><span>Move between items</span></div>
                                <div className="scroll-pro-help-row"><span className="scroll-pro-help-keys"><kbd>Enter</kbd></span><span>Scroll to item</span></div>
                                <div className="scroll-pro-help-row"><span className="scroll-pro-help-keys"><kbd>Tab</kbd> <kbd>←</kbd> <kbd>→</kbd></span><span>Toggle Prompts / All</span></div>
                            </div>
                            <div className="scroll-pro-help-section">
                                <span className="scroll-pro-help-label">Copy &amp; export</span>
                                <div className="scroll-pro-help-row"><span className="scroll-pro-help-keys"><kbd>⌘</kbd><kbd>⇧</kbd><kbd>C</kbd></span><span>Copy full chat</span></div>
                                <div className="scroll-pro-help-row"><span className="scroll-pro-help-keys"><kbd>⌘</kbd><kbd>E</kbd></span><span>Export chat</span></div>
                                <div className="scroll-pro-help-row"><span className="scroll-pro-help-keys"><kbd>⌘</kbd><kbd>C</kbd></span><span>Copy focused response</span></div>
                                <div className="scroll-pro-help-row"><span className="scroll-pro-help-keys"><kbd>⌘</kbd><kbd>X</kbd></span><span>Copy focused prompt</span></div>
                            </div>
                            <div className="scroll-pro-help-section">
                                <span className="scroll-pro-help-label">Other</span>
                                <div className="scroll-pro-help-row"><span className="scroll-pro-help-keys"><kbd>⌘</kbd><kbd>M</kbd></span><span>Toggle markdown copy</span></div>
                                <div className="scroll-pro-help-row"><span className="scroll-pro-help-keys"><kbd>?</kbd></span><span>Toggle this help</span></div>
                                <div className="scroll-pro-help-row"><span className="scroll-pro-help-keys"><kbd>Esc</kbd></span><span>Close</span></div>
                            </div>
                            <p className="scroll-pro-help-tip">Right-click any turn or button for more options</p>
                        </div>
                    ) : (<>
                    <div className="scroll-pro-sidebar-head">
                        <div className="scroll-pro-sidebar-row">
                            <div className="scroll-pro-tab-group" role="group" aria-label="Outline filter">
                                <button
                                    onClick={() => setViewLevel(1)}
                                    className={`scroll-pro-tab ${viewLevel === 1 ? 'is-active' : ''}`}
                                    title="Show prompts only"
                                >
                                    Prompts
                                </button>
                                <span aria-hidden="true" className="scroll-pro-tab-sep">•</span>
                                <button
                                    onClick={() => setViewLevel(2)}
                                    className={`scroll-pro-tab ${viewLevel === 2 ? 'is-active' : ''}`}
                                    title="Show all content"
                                >
                                    All
                                </button>
                            </div>
                            <div className="scroll-pro-actions" role="group" aria-label="Chat actions">
                                <button
                                    data-action="copy-format"
                                    onClick={handleCopyFullChat}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setCopyFormatMenu({
                                            x: e.clientX,
                                            y: e.clientY,
                                        });
                                    }}
                                    className="scroll-pro-action-btn"
                                    title="Copy full chat (⌘⇧C) - Right-click for format"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                </button>
                                <button
                                    data-action="export-format"
                                    onClick={() => startExport()}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setExportFormatMenu({
                                            x: e.clientX,
                                            y: e.clientY,
                                        });
                                    }}
                                    className="scroll-pro-action-btn"
                                    title={`Export chat (${exportFormat.toUpperCase()}) - Right-click for format`}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="7 10 12 15 17 10"></polyline>
                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                </button>
                                <button
                                    onClick={() => setShowHelp(prev => !prev)}
                                    className={`scroll-pro-action-btn ${showHelp ? 'is-active' : ''}`}
                                    title="Keyboard shortcuts (?)"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div className="scroll-pro-search">
                            <svg className="scroll-pro-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <input
                                type="text"
                                placeholder="Filter…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="scroll-pro-search-input"
                                ref={searchInputRef}
                                onKeyDown={handleSearchKeyDown}
                                onKeyUp={stopSearchPropagation}
                                onKeyPress={stopSearchPropagation}
                            />
                        </div>
                    </div>

                    <div className="scroll-pro-sidebar-list">
                        {(() => {
                            const term = search.trim().toLowerCase();
                            const showExport = term === '/export' || term === '/e' || term === '/ex';
                            if (!showExport) return null;
                            const exportFocusIdx = focusIndexByKey.get('export-command') ?? -1;
                            return (
                                <div
                                    className={`scroll-pro-sidebar-item ${focusedIndex === exportFocusIdx ? 'is-focused' : ''}`}
                                    onClick={() => {
                                        startExport();
                                        if (providerName === 'chatgpt') {
                                            showToast('Preparing full export...');
                                        } else {
                                            showToast('Chat exported');
                                        }
                                        setSearch('');
                                    }}
                                    onMouseEnter={() => exportFocusIdx >= 0 && setFocusedIndex(exportFocusIdx)}
                                    onFocus={() => exportFocusIdx >= 0 && setFocusedIndex(exportFocusIdx)}
                                    tabIndex={0}
                                >
                                    <div className="scroll-pro-item-body">
                                        <p className="scroll-pro-item-title">Export full chat ({exportFormat.toUpperCase()})</p>
                                        <div className="scroll-pro-subheading-list">
                                            <span className="scroll-pro-subheading-fallback">Downloads a {exportFormat.toUpperCase()} file of this conversation</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                        {turns.length === 0 ? (
                            <div className="scroll-pro-empty">
                                <div className="scroll-pro-empty-card">
                                    <div className="scroll-pro-empty-title">
                                        Your chat outline will appear here as you talk with {providerLabel}
                                    </div>
                                    <div className="scroll-pro-empty-tip">
                                        Navigate your chat by clicking on prompts
                                    </div>
                                </div>
                            </div>
                        ) : filteredBlocks.map((block) => {
                            const focusIdx = focusIndexByKey.get(block.key) ?? -1;
                            return (
                                <div
                                    key={block.key}
                                    data-block-key={block.key}
                                    ref={(el) => {
                                        if (el) {
                                            itemRefs.current.set(block.key, el);
                                        } else {
                                            itemRefs.current.delete(block.key);
                                        }
                                    }}
                                    onClick={() => {
                                        if (contextMenu) return;
                                        if (focusIdx >= 0) setFocusedIndex(focusIdx);
                                        scrollToElement(block.prompt.element || block.answer?.element);
                                    }}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        if (focusIdx >= 0) setFocusedIndex(focusIdx);
                                        const menuWidth = 220;
                                        const menuHeight = 180;
                                        const x = Math.min(e.clientX, window.innerWidth - menuWidth);
                                        const y = Math.min(e.clientY, window.innerHeight - menuHeight);
                                        setContextMenu({ x, y, block });
                                    }}
                                    className={`scroll-pro-sidebar-item ${focusedIndex === focusIdx ? 'is-focused' : ''}`}
                                    aria-selected={focusedIndex === focusIdx}
                                >
                                    <div className="scroll-pro-item-body">
                                        <p className="scroll-pro-item-title">
                                            {block.prompt.text || '…'}
                                        </p>
                                        {viewLevel === 2 && block.answer && (
                                            <div className="scroll-pro-subheading-list">
                                                {block.headings.length > 0 ? (
                                                    block.headings.map((h, i) => {
                                                        const headingKey = `${block.key}-heading-${i}`;
                                                        const headingFocusIndex = focusIndexByKey.get(headingKey) ?? -1;
                                                        return (
                                                            <button
                                                                key={headingKey}
                                                                ref={(el) => {
                                                                    if (el) {
                                                                        itemRefs.current.set(headingKey, el);
                                                                    } else {
                                                                        itemRefs.current.delete(headingKey);
                                                                    }
                                                                }}
                                                                className={`scroll-pro-subheading ${focusedIndex === headingFocusIndex ? 'is-focused' : ''}`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (headingFocusIndex >= 0) setFocusedIndex(headingFocusIndex);
                                                                    scrollToElement(h.element);
                                                                }}
                                                            >
                                                                {h.innerText}
                                                            </button>
                                                        );
                                                    })
                                                ) : (
                                                    block.answer.text && (
                                                        <button
                                                            key={`${block.key}-heading-0`}
                                                            ref={(el) => {
                                                                const headingKey = `${block.key}-heading-0`;
                                                                if (el) {
                                                                    itemRefs.current.set(headingKey, el);
                                                                } else {
                                                                    itemRefs.current.delete(headingKey);
                                                                }
                                                            }}
                                                            className={`scroll-pro-subheading ${focusedIndex === focusIndexByKey.get(`${block.key}-heading-0`) ? 'is-focused' : ''}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const headingFocusIndex = focusIndexByKey.get(`${block.key}-heading-0`) ?? -1;
                                                                if (headingFocusIndex >= 0) setFocusedIndex(headingFocusIndex);
                                                                scrollToElement(block.answer!.element);
                                                            }}
                                                        >
                                                            {snippet(block.answer.text, 80)}
                                                        </button>
                                                    )
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {filteredBlocks.length === 0 && turns.length > 0 && (
                            <div className="scroll-pro-empty">No items found</div>
                        )}
                    </div>
                    </>)}
                </div>
            )}
            {contextMenu && (
                <div
                    className="scroll-pro-context-backdrop"
                    onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu(null);
                    }}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu(null);
                    }}
                />
            )}
            {renderContextMenu()}
            {exportFormatMenu && (
                <div
                    className="scroll-pro-context-backdrop"
                    onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setExportFormatMenu(null);
                    }}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setExportFormatMenu(null);
                    }}
                />
            )}
            {renderExportFormatMenu()}
            {copyFormatMenu && (
                <div
                    className="scroll-pro-context-backdrop"
                    onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setCopyFormatMenu(null);
                    }}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setCopyFormatMenu(null);
                    }}
                />
            )}
            {renderCopyFormatMenu()}
            {showCaptureConsent && (
                <div className="scroll-pro-modal-backdrop">
                    <div className="scroll-pro-modal" role="dialog" aria-modal="true" aria-labelledby="scroll-pro-capture-title">
                        <div className="scroll-pro-modal-header">
                            <span className="scroll-pro-modal-badge">Full export</span>
                            <h3 id="scroll-pro-capture-title">Load the whole chat</h3>
                            <p className="scroll-pro-modal-sub">ChatGPT hides replies until you scroll. We will scroll this page from top to bottom to capture everything.</p>
                        </div>
                        <ul className="scroll-pro-modal-list">
                            <li>Scrolls this page top to bottom</li>
                            <li>Waits for content to load as we scroll</li>
                            <li>Runs only while you keep this page open</li>
                        </ul>
                        <div className="scroll-pro-modal-actions">
                            <button className="scroll-pro-btn-primary" onClick={handleConsentAccept}>Allow scrolling</button>
                            <button className="scroll-pro-btn-ghost" onClick={handleConsentDismiss}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
