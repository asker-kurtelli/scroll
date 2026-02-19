import { createRoot, type Root } from 'react-dom/client';
import App from './App';
import styles from './styles/main.css?inline';

const HOST_ID = 'scroll-pro-root';
const APP_CONTAINER_ID = 'scroll-pro-app';

type HostElement = HTMLElement & { __scrollProRoot?: Root };
type StylableShadowRoot = ShadowRoot & { __scrollProSheet?: CSSStyleSheet };

const mount = () => {
  if (!document.body) {
    requestAnimationFrame(mount);
    return;
  }

  const { host, shadow } = ensureHost();
  const appContainer = ensureShadowElement(shadow, APP_CONTAINER_ID);

  const root = host.__scrollProRoot ?? createRoot(appContainer);
  host.__scrollProRoot = root;
  root.render(<App />);

  if (import.meta.hot) {
    import.meta.hot.accept();
    import.meta.hot.dispose(() => root.unmount());
  }
};

const ensureHost = () => {
  const host = (document.getElementById(HOST_ID) ?? document.createElement('div')) as HostElement;
  host.id = HOST_ID;

  if (!host.isConnected) {
    host.style.all = 'unset';
    document.body.appendChild(host);
  }

  const shadow = (host.shadowRoot ?? host.attachShadow({ mode: 'open' })) as StylableShadowRoot;
  applyStyles(shadow, styles);
  return { host, shadow };
};

const ensureShadowElement = (shadow: StylableShadowRoot, id: string) => {
  let element = shadow.getElementById(id);
  if (!element) {
    element = document.createElement('div');
    element.id = id;
    shadow.appendChild(element);
  }
  return element;
};

const applyStyles = (shadowRoot: StylableShadowRoot, cssText: string) => {
  if (shadowRoot.__scrollProSheet || shadowRoot.querySelector('style[data-scroll-pro-style]')) {
    return;
  }

  try {
    if (shadowRoot.adoptedStyleSheets && 'replaceSync' in CSSStyleSheet.prototype) {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(cssText);
      shadowRoot.adoptedStyleSheets = [...Array.from(shadowRoot.adoptedStyleSheets ?? []), sheet];
      shadowRoot.__scrollProSheet = sheet;
      return;
    }
  } catch {
    // Firefox Xray wrapper: adoptedStyleSheets not accessible in content scripts
  }

  const styleTag = document.createElement('style');
  styleTag.setAttribute('data-scroll-pro-style', 'true');
  styleTag.textContent = cssText;
  shadowRoot.appendChild(styleTag);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true });
} else {
  mount();
}
