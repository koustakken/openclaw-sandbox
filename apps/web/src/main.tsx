import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

const params = new URLSearchParams(window.location.search);
const redirect = params.get('redirect');

if (redirect) {
  window.history.replaceState(null, '', redirect);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
