/// <reference lib="webworker" />
// Basic service worker for notifications, simple link opening, and light precache for realprice.
const sw = self as unknown as ServiceWorkerGlobalScope;

const PRECACHE = 'rj-precache-v1';
const PRECACHE_URLS = ['/realprice/daily_latest.json'];

(sw as any).addEventListener('install', (event: ExtendableEvent) => {
  // skip waiting for faster updates during development
  sw.skipWaiting();
  // Warm same-origin realprice assets if base path is relative (VITE_REALPRICE_BASE not set to absolute URL)
  // Note: SW cannot intercept cross-origin requests, so precache is only useful for same-origin paths.
  const base = (import.meta as any)?.env?.VITE_REALPRICE_BASE || '';
  const shouldPrecache = !String(base || '').startsWith('http');
  if (shouldPrecache) {
    event.waitUntil((async () => {
      try {
        const cache = await caches.open(PRECACHE);
        await cache.addAll(PRECACHE_URLS);
      } catch {
        // ignore
      }
    })());
  }
});

(sw as any).addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil((async () => {
    // cleanup old caches
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k.startsWith('rj-precache-') && k !== PRECACHE).map(k => caches.delete(k)));
    } catch { /* noop */ }
    await sw.clients.claim();
  })());
});

(sw as any).addEventListener('push', (event: PushEvent) => {
  const data = (() => {
    try { return event.data ? event.data.json() : {}; } catch { return {}; }
  })() as any;
  const title = data?.title || '알림';
  const options: NotificationOptions = {
    body: data?.body || '',
    data: { url: data?.url || '/' },
    icon: '/vite.svg',
    badge: '/vite.svg',
  };
  event.waitUntil(sw.registration.showNotification(title, options));
});

(sw as any).addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url = event.notification?.data?.url || '/';
  event.waitUntil((async () => {
    const allClients = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const same = allClients.find((c: any) => 'focus' in c);
    if (same) {
      (same as WindowClient).navigate(url);
      (same as WindowClient).focus();
    } else {
      await sw.clients.openWindow(url);
    }
  })());
});

// Cache-first for same-origin realprice JSON
(sw as any).addEventListener('fetch', (event: FetchEvent) => {
  try {
    const url = new URL(event.request.url);
    if (url.origin === (sw.location as any).origin && url.pathname.startsWith('/realprice/')) {
      event.respondWith((async () => {
        const cache = await caches.open(PRECACHE);
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const resp = await fetch(event.request);
          if (resp && resp.ok) await cache.put(event.request, resp.clone());
          return resp;
        } catch {
          return new Response('offline', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
        }
      })());
    }
  } catch {
    // ignore non-HTTP(s) requests
  }
});
