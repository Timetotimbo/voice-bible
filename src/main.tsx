import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { PresentDisplay } from './Present';
import { RemotePage } from './Remote';
import './styles.css';
import { applyTheme, savedTheme } from './theme';

// Before the first paint, so a light theme doesn't flash dark
applyTheme(savedTheme());

// Works offline: the service worker keeps the app and the Bible text on the phone (built by vite.config.ts)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {}));
  // Asks the phone to keep the saved app and Bible text, instead of clearing them when space runs low
  navigator.storage?.persist?.().catch(() => {});
}

// The same address also opens the second screen for Present (?display=1) and the phone remote (?remote=code)
const params = new URLSearchParams(location.search);
const remote = params.get('remote');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {params.has('display') ? <PresentDisplay /> : remote ? <RemotePage code={remote} /> : <App />}
  </StrictMode>,
);
