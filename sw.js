/* Painel Formandos: service worker.
   Só guarda a "casca" do app (HTML, ícones, biblioteca XLSX). Os dados dos alunos
   NUNCA passam por aqui: as chamadas ao Google Apps Script vão direto à rede. */
const VERSAO = 'formandos-v1';
const CASCA = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(CASCA)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  // Apps Script e qualquer outro domínio de dados: não interceptar
  if (/script\.google(usercontent)?\.com$/.test(url.hostname)) return;
  const mesmaOrigem = url.origin === self.location.origin;
  const biblioteca = /cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(url.hostname);
  if (!mesmaOrigem && !biblioteca) return;
  if (req.mode === 'navigate' || (mesmaOrigem && /\.html$|\/$/.test(url.pathname))) {
    // página: rede primeiro (sempre a versão nova), cache só se estiver sem internet
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(VERSAO).then(c => c.put(req, cp)); return r; })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }
  // demais arquivos: cache primeiro, atualiza em segundo plano
  e.respondWith(caches.match(req).then(hit => {
    const rede = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) { const cp = r.clone(); caches.open(VERSAO).then(c => c.put(req, cp)); } return r; }).catch(() => hit);
    return hit || rede;
  }));
});
