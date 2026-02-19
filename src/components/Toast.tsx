import { useEffect, useState, useCallback, useRef } from 'react';
import { type ToastMessage } from '../services/toast';

type ToastEntry = ToastMessage & { exiting?: boolean };

const ToastIcon = ({ type }: { type: ToastMessage['type'] }) => {
    if (type === 'success') {
        return (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="scroll-pro-toast-icon success">
                <polyline points="20 6 9 17 4 12" />
            </svg>
        );
    }
    if (type === 'error') {
        return (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="scroll-pro-toast-icon error">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
        );
    }
    return (
        <svg width="6" height="6" viewBox="0 0 6 6" className="scroll-pro-toast-icon info">
            <circle cx="3" cy="3" r="3" fill="currentColor" />
        </svg>
    );
};

export const Toast = () => {
    const [toasts, setToasts] = useState<ToastEntry[]>([]);
    const timersRef = useRef<Map<string, number>>(new Map());

    const removeToast = useCallback((id: string) => {
        // Start exit animation
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
        // Remove after animation completes
        const timer = window.setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
            timersRef.current.delete(id);
        }, 200);
        timersRef.current.set(`exit-${id}`, timer);
    }, []);

    useEffect(() => {
        const handleToast = (e: Event) => {
            const toast = (e as CustomEvent).detail as ToastMessage;

            // Limit to 3 toasts (stacked)
            setToasts((prev) => {
                const next = [...prev, toast];
                if (next.length > 3) return next.slice(next.length - 3);
                return next;
            });

            // Auto-remove after duration
            const timer = window.setTimeout(() => {
                removeToast(toast.id);
                timersRef.current.delete(toast.id);
            }, toast.duration);
            timersRef.current.set(toast.id, timer);
        };

        window.addEventListener('scroll-pro-toast', handleToast);
        return () => {
            window.removeEventListener('scroll-pro-toast', handleToast);
            timersRef.current.forEach((timer) => window.clearTimeout(timer));
            timersRef.current.clear();
        };
    }, [removeToast]);

    if (toasts.length === 0) return null;

    return (
        <div className="scroll-pro-toast-container">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`scroll-pro-toast ${toast.exiting ? 'animate-toast-exit' : 'animate-toast-enter'}`}
                    onClick={() => removeToast(toast.id)}
                >
                    <ToastIcon type={toast.type} />
                    <span className="scroll-pro-toast-message">
                        {toast.message}
                    </span>
                    {toast.action && (
                        <button
                            className="scroll-pro-toast-action"
                            onClick={(e) => {
                                e.stopPropagation();
                                toast.action?.onClick();
                                removeToast(toast.id);
                            }}
                        >
                            {toast.action.label}
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
};
