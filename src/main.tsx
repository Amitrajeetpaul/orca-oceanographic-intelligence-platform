import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Without this, a new service worker can install and take over in the
// background but the already-open tab keeps running the old page it
// already loaded — the user would need to notice and manually refresh to
// ever see the update. updateSW(true) messages the waiting worker to
// activate, waits for it to actually take control, then reloads — so
// every visit is guaranteed to run the current build, with no user
// action needed and no risk of reloading before the new worker is live.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true);
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
