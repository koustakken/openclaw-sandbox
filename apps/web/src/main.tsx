import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/reset.css';
import './styles/vars.css';
import './styles/theme.css';

const params = new URLSearchParams(window.location.search);
const redirect = params.get('redirect');

// Only apply one-shot redirect when we are on app root.
// This prevents recursive /path?redirect=/path?redirect=... loops.
if (redirect && (window.location.pathname === '/' || window.location.pathname === '')) {
  const decoded = decodeURIComponent(redirect);
  if (!decoded.includes('redirect=')) {
    window.history.replaceState(null, '', decoded);
  } else {
    window.history.replaceState(null, '', '/');
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
