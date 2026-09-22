'use client';
if (typeof window !== 'undefined' && !(window as any).__fetchIntercepted) {
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    let [resource, config] = args;
    if (!config) config = {};
    if (!(config as RequestInit).credentials) {
      (config as RequestInit).credentials = 'include';
    }
    return originalFetch(resource, config);
  };
  (window as any).__fetchIntercepted = true;
}
export function FetchInterceptor() { return null; }

