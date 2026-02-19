import { useState, useEffect, useCallback } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import Sidebar from './components/Sidebar';
import { Toast } from './components/Toast';
import { useChatTurns } from './hooks/useChatTurns';

/** Check if the current URL is an active chat page (not settings, home, etc.) */
function checkIsChatPage(providerName: string): boolean {
  const path = window.location.pathname;
  switch (providerName) {
    case 'chatgpt':
      // /c/{id} or /g/{id} (GPT chats)
      return /^\/(c|g)\//.test(path);
    case 'claude':
      // /chat/{id}
      return /^\/chat\//.test(path);
    case 'gemini':
      // /app/{id} (but not /app alone which is the home page)
      return /^\/app\/.+/.test(path);
    default:
      return false;
  }
}

const App = () => {
  const { turns, provider, container } = useChatTurns();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isProviderSupported = !!provider && ['chatgpt', 'claude', 'gemini'].includes(provider.name);

  // Track whether we're on a chat page (reactive to SPA navigation)
  const [isChatPage, setIsChatPage] = useState(() =>
    isProviderSupported ? checkIsChatPage(provider!.name) : false
  );

  const updateChatPageStatus = useCallback(() => {
    if (provider) {
      setIsChatPage(checkIsChatPage(provider.name));
    }
  }, [provider]);

  // React to URL changes (SPA navigation)
  useEffect(() => {
    if (!isProviderSupported) return;
    updateChatPageStatus();

    // MutationObserver on document catches SPA navigations (URL changes before DOM settles)
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        updateChatPageStatus();
      }
    });
    observer.observe(document, { subtree: true, childList: true });

    window.addEventListener('popstate', updateChatPageStatus);
    return () => {
      observer.disconnect();
      window.removeEventListener('popstate', updateChatPageStatus);
    };
  }, [isProviderSupported, updateChatPageStatus]);

  const showSidebar = isProviderSupported && isChatPage;

  useEffect(() => {
    if (!showSidebar) setIsSidebarOpen(false);
  }, [showSidebar]);

  // Global keyboard shortcut: Cmd+' to toggle sidebar
  // Capture phase + stopImmediatePropagation to survive aggressive host pages (Claude.ai)
  useEffect(() => {
    if (!showSidebar) return;

    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "'") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setIsSidebarOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [showSidebar]);

  return (
    <div className="font-sans text-slate-900">
      {showSidebar && (
        <ErrorBoundary>
          <Sidebar
            turns={turns}
            providerName={provider?.name || 'unknown'}
            container={container}
            isOpen={isSidebarOpen}
            isPaused={false}
            onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          />
        </ErrorBoundary>
      )}
      <ErrorBoundary>
        <Toast />
      </ErrorBoundary>
    </div>
  );
};

export default App;
