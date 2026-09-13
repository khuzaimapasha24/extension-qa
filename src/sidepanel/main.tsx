import { initWebGpuGuard } from './webgpu-guard';
initWebGpuGuard();

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

// Suppress harmless Windows Chromium WebGPU driver warning (crbug.com/369219127)
if (typeof console !== 'undefined' && typeof console.warn === 'function') {
  const originalWarn = console.warn;
  console.warn = function (...args: unknown[]) {
    const text = args.map((a) => (typeof a === 'string' ? a : (a as Error)?.message || String(a))).join(' ');
    if (text.includes('powerPreference') || text.includes('369219127')) {
      return; // Suppress harmless Windows Chromium driver warning
    }
    originalWarn.apply(console, args);
  };
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
