// Voice Bible's service worker: keeps the app and the Bible text on the phone, so it opens and searches offline.
// Built by vite.config.ts (the lists and version below are filled in at build time).
const VERSION = '__VERSION__';
const SCOPE = '__BASE__';
const SHELL = __SHELL__; // the app itself: pages, code, styles, icons
const DATA = __DATA__; // the Bible translations and the Strong's dictionary (big, so only re-fetched when they change)
const SHELL_CACHE = 'vb-shell-' + VERSION;
const DATA_CACHE = 'vb-data-__DATAKEY__';
const FONT_CACHE = 'vb-fonts';
const AUDIO_BASE = '__AUDIO__'; // the Natural voice recordings (another address)
const AUDIO_CACHE = 'vb-audio'; // saved by the reader (src/offlineAudio.ts) or kept when played on Wi-Fi
const FONT_CSS = __FONTS__; // the Google Fonts stylesheets in index.html

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      await shell.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })));
      // The Bible text: what isn't saved yet (a failure here doesn't stop the app working online)
      const data = await caches.open(DATA_CACHE);
      for (const u of DATA) {
        if (await data.match(u)) continue;
        try {
          const r = await fetch(u, { cache: 'reload' });
          if (r.ok) await data.put(u, r);
        } catch (e) {}
      }
      // The fonts: the stylesheets and the font files they name
      try {
        const fonts = await caches.open(FONT_CACHE);
        for (const css of FONT_CSS) {
          const r = await fetch(css);
          if (!r.ok) continue;
          await fonts.put(css, r.clone());
          const files = [...(await r.text()).matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]);
          await Promise.all(files.map(f => fetch(f).then(fr => fr.ok && fonts.put(f, fr)).catch(() => {})));
        }
      } catch (e) {}
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keep = [SHELL_CACHE, DATA_CACHE, FONT_CACHE, AUDIO_CACHE];
      for (const k of await caches.keys()) if (k.startsWith('vb-') && !keep.includes(k)) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

const timeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('slow')), ms))]);

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // The fonts: whatever was saved last, refreshed when online
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(async c => {
        const hit = await c.match(req, { ignoreVary: true });
        const fresh = fetch(req).then(r => (r.ok || r.type === 'opaque' ? c.put(req, r.clone()).then(() => r) : r)).catch(() => hit);
        return hit || fresh;
      }),
    );
    return;
  }
  if (AUDIO_BASE && req.url.startsWith(AUDIO_BASE)) {
    event.respondWith(recording(event, req));
    return;
  }
  if (url.origin !== location.origin || !url.pathname.startsWith(SCOPE)) return;
  const path = url.pathname.slice(SCOPE.length);
  // ClipForge (at /clipforge/) is a separate app, and the update check must ask the server
  if (path.startsWith('clipforge') || path === 'version.json') return;

  // Pages: the newest from the server, or the saved app when there's no connection (or it's very slow)
  if (req.mode === 'navigate') {
    event.respondWith(
      timeout(fetch(req), 5000).catch(async () => (await caches.match(SCOPE + 'index.html', { ignoreVary: true })) || Response.error()),
    );
    return;
  }
  // The Bible text and the app's files: from the phone, else from the server (and kept)
  event.respondWith(
    (async () => {
      const hit = await caches.match(req, { ignoreSearch: true, ignoreVary: true });
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok && (DATA.includes(url.pathname) || /\/assets\//.test(url.pathname))) {
        const c = await caches.open(DATA.includes(url.pathname) ? DATA_CACHE : SHELL_CACHE);
        c.put(req, r.clone());
      }
      return r;
    })(),
  );
});

// ---- Natural voice recordings ----
const keeping = new Set();
const onWifi = () => {
  const c = self.navigator.connection;
  return !!c && (c.type === 'wifi' || c.type === 'ethernet');
};
/** A saved recording if there is one (just the part asked for, so seeking to a verse works), else the network. */
async function recording(event, req) {
  const key = req.url.split('#')[0];
  const cache = await caches.open(AUDIO_CACHE);
  const hit = await cache.match(key, { ignoreVary: true, ignoreSearch: true });
  if (hit) return part(req, hit);
  // Played on Wi-Fi: keep the whole file for next time (not on mobile data)
  if (!keeping.has(key) && (/\.json$/.test(key) || onWifi())) {
    keeping.add(key);
    event.waitUntil(
      fetch(key, { mode: 'cors' })
        .then(r => (r.ok ? cache.put(key, r) : null))
        .catch(() => {})
        .finally(() => keeping.delete(key)),
    );
  }
  return fetch(req);
}
/** Answer a "Range: bytes=a-b" request from a whole saved file. */
async function part(req, res) {
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  if (!range) return res;
  const blob = await res.blob();
  const size = blob.size;
  let start = range[1] ? +range[1] : size - +range[2];
  let end = range[1] && range[2] ? +range[2] : size - 1;
  start = Math.max(0, Math.min(start, size - 1));
  end = Math.max(start, Math.min(end, size - 1));
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}
