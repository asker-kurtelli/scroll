// Nudge target down slightly so it renders at the top of the visible area (avoids sticky headers)
const SCROLL_OFFSET = 24;
const SCROLL_DURATION = 700;

const findScrollContainer = (node: HTMLElement): HTMLElement | Window => {
  let scrollContainer: HTMLElement | Window = window;
  let parent = node.parentElement;
  while (parent) {
    const overflow = window.getComputedStyle(parent).overflowY;
    if (overflow === 'auto' || overflow === 'scroll') {
      scrollContainer = parent;
      break;
    }
    parent = parent.parentElement;
  }
  return scrollContainer;
};

const prefersReducedMotion = () => {
  try {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

const computeTargetPosition = (
  node: HTMLElement,
  scrollContainer: HTMLElement | Window,
  containerIsWindow: boolean
) => {
  const rect = node.getBoundingClientRect();
  const containerRect = containerIsWindow ? undefined : (scrollContainer as HTMLElement).getBoundingClientRect();
  const scrollTop = containerIsWindow ? window.scrollY : (scrollContainer as HTMLElement).scrollTop;
  const rawTarget = containerIsWindow
    ? rect.top + window.scrollY
    : rect.top + scrollTop - (containerRect?.top ?? 0);
  return Math.max(0, rawTarget - SCROLL_OFFSET);
};

const smoothScroll = (scrollContainer: HTMLElement | Window, targetPosition: number) => {
  const containerIsWindow = scrollContainer === window;
  const getScroll = () => (containerIsWindow ? window.scrollY : (scrollContainer as HTMLElement).scrollTop);
  const setScroll = (value: number) => {
    if (containerIsWindow) {
      window.scrollTo({ top: value });
    } else {
      (scrollContainer as HTMLElement).scrollTop = value;
    }
  };

  if (prefersReducedMotion()) {
    setScroll(targetPosition);
    return;
  }

  const start = getScroll();
  const distance = targetPosition - start;
  if (Math.abs(distance) < 1) {
    setScroll(targetPosition);
    return;
  }

  const cancelEvents: (keyof DocumentEventMap)[] = ['wheel', 'touchstart', 'mousedown', 'keydown'];
  let canceled = false;

  const cancel = () => {
    canceled = true;
    cleanup();
  };

  const cleanup = () => {
    cancelEvents.forEach((event) => window.removeEventListener(event, cancel, true));
  };

  cancelEvents.forEach((event) => window.addEventListener(event, cancel, { passive: true, capture: true }));

  const startTime = performance.now();
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

  const step = () => {
    if (canceled) return;
    const now = performance.now();
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / SCROLL_DURATION);
    const eased = easeOutCubic(t);
    setScroll(start + distance * eased);

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      // Snap to target in case layout shifted during animation
      setScroll(targetPosition);
      cleanup();
    }
  };

  requestAnimationFrame(step);
};

const scrollNodeIntoViewWithOffset = (node: HTMLElement) => {
  const scrollContainer = findScrollContainer(node);
  const containerIsWindow = scrollContainer === window;
  const targetPosition = computeTargetPosition(node, scrollContainer, containerIsWindow);

  smoothScroll(scrollContainer, targetPosition);

  return { scrollContainer, targetPosition };
};

export const highlightNode = (node: HTMLElement) => {
  // Add highlight with animation
  node.classList.add('scroll-pro-highlight', 'scroll-pro-highlight-active');

  // Trigger fade out after 1.5s
  setTimeout(() => {
    node.classList.remove('scroll-pro-highlight-active');
    // Remove base class after animation completes (0.5s transition)
    setTimeout(() => node.classList.remove('scroll-pro-highlight'), 500);
  }, 1500);
};

export const scrollToElement = (element: HTMLElement) => {
  if (!element) return;
  scrollNodeIntoViewWithOffset(element);
};
