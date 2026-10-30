import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';

import App from './App.jsx';
import './index.css';

// Service worker: registered in production builds by vite-plugin-pwa.
// Updates are applied on the next launch (no push notifications in phase 1).
registerSW({ immediate: true });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
