export type ToastType = 'success' | 'info' | 'error';

export type ToastMessage = {
    id: string;
    message: string;
    type: ToastType;
    duration: number;
    origin?: 'global' | 'palette' | 'sidebar';
    action?: {
        label: string;
        onClick: () => void;
    };
};

export function showToast(
    message: string,
    type: ToastType = 'success',
    duration: number = 800,
    origin: ToastMessage['origin'] = 'global',
    action?: { label: string; onClick: () => void; }
): void {
    const toast: ToastMessage = {
        id: Date.now().toString() + Math.random(),
        message,
        type,
        duration,
        origin,
        action
    };

    window.dispatchEvent(
        new CustomEvent('scroll-pro-toast', {
            detail: toast
        })
    );
}
