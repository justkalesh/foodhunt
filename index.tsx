import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Type declaration for custom window property
declare global {
  interface Window {
    __clearFallback?: () => void;
  }
}

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

// Clear the fallback UI timeout since app loaded successfully
if (typeof window.__clearFallback === 'function') {
  window.__clearFallback();
}