/* ============================================================
   SERVIS CALISANI
   ------------------------------------------------------------
   Amaci TEK: uygulama kabugu (html/css/js/ikon/yazi tipi) cevrimdisi da
   acilsin. Veri asla onbelleklenmez.

   KRITIK KURAL — script.google.com isteklerine HIC DOKUNULMAZ.
   Veri istegi onbellege alinirsa kullaniciya eski rakam gosterilir; bu
   muhasebede kabul edilemez. (Bedlek Tarim'da Supabase icin ayni istisna var.)
   ============================================================ */

var SURUM = 'slawrezz-v1';
var KABUK = [
  './',
  './index.html',
  './stil.css',
  './hesap.js',
  './api.js',
  './ui.js',
  './gorunum.js',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(SURUM)
      .then(function (c) { return c.addAll(KABUK); })
      .then(function () { return self.skipWaiting(); })
      .catch(function () { /* bir dosya eksikse kurulum yine de sursun */ })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (adlar) {
      return Promise.all(adlar.map(function (ad) {
        if (ad !== SURUM) return caches.delete(ad);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var istek = e.request;
  if (istek.method !== 'GET') return;

  var url = new URL(istek.url);

  /* --- VERI: asla onbellege alinmaz, hep aga gider --- */
  if (url.hostname.indexOf('script.google.com') >= 0 ||
      url.hostname.indexOf('googleusercontent.com') >= 0) {
    return;                       // tarayicinin normal davranisi
  }

  /* --- Google Fonts: bir kez indir, sonra onbellekten ver --- */
  if (url.hostname.indexOf('fonts.googleapis.com') >= 0 ||
      url.hostname.indexOf('fonts.gstatic.com') >= 0) {
    e.respondWith(
      caches.match(istek).then(function (bulunan) {
        return bulunan || fetch(istek).then(function (cevap) {
          var kopya = cevap.clone();
          caches.open(SURUM).then(function (c) { c.put(istek, kopya); });
          return cevap;
        }).catch(function () { return bulunan; });
      })
    );
    return;
  }

  /* --- kendi dosyalarimiz: once ag, olmazsa onbellek ---
     Boylece guncelleme yayinlandiginda kullanici hemen yenisini alir;
     internet yoksa eski kabuk yine acilir. */
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(istek).then(function (cevap) {
        var kopya = cevap.clone();
        caches.open(SURUM).then(function (c) { c.put(istek, kopya); });
        return cevap;
      }).catch(function () {
        return caches.match(istek).then(function (bulunan) {
          return bulunan || caches.match('./index.html');
        });
      })
    );
  }
});
