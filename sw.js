/* Studi-Ente: Offline-Helfer (Service Worker).
   Läuft im Hintergrund auf dem Handy und merkt sich die App-Dateien.
   - Seite selbst: zuerst aus dem Internet (so kommen Updates sofort an), ohne Netz oder nach 4 s aus dem Speicher.
   - Bilder/Manifest: aus dem Speicher, im Hintergrund aufgefrischt.
   - Alles von anderen Adressen (Mensa-Daten, KI-Server) geht nie durch diesen Helfer. */
const SPEICHER = 'studi-ente-v1';
const SEITE = './index.html';
const DATEIEN = [SEITE, './manifest.webmanifest', './ente-180.png', './ente-512.png', './ente-android-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SPEICHER).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((alle) => Promise.all(alle.filter((n) => n.startsWith('studi-ente-') && n !== SPEICHER).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  if (r.mode === 'navigate') { e.respondWith(seite(r)); return; }
  e.respondWith(caches.match(r, { ignoreSearch: true }).then((alt) => {
    const neu = fetch(r).then((a) => { if (a.ok) { const k = a.clone(); caches.open(SPEICHER).then((c) => c.put(r, k)); } return a; });
    if (alt) { neu.catch(() => {}); return alt; }
    return neu;
  }));
});

/* Seite: Netz zuerst. Antwort immer unter demselben Namen speichern (ohne ?k=…), damit nur eine Kopie existiert. */
function seite(r) {
  // no-cache = immer kurz beim Server nachfragen ("gibt's was Neues?"), nicht still die alte Kopie des Browsers nehmen
  const netz = fetch(r.url, { cache: 'no-cache', credentials: 'same-origin' }).then((a) => {
    if (a.ok) { const k = a.clone(); caches.open(SPEICHER).then((c) => c.put(SEITE, k)); }
    return a;
  });
  const ausSpeicher = () => caches.match(SEITE).then((alt) => alt || netz);
  const zuLangsam = new Promise((ok) => setTimeout(ok, 4000)).then(() => caches.match(SEITE)).then((alt) => alt || netz);
  return Promise.race([netz.catch(ausSpeicher), zuLangsam]);
}
