import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initCrypto, migrateToSecureEncryption } from './utils/crypto';

// Initialize crypto system and migrate legacy keys on startup
(async () => {
  await initCrypto();
  await migrateToSecureEncryption();
})();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);