# Slaw Rezz Muhasebe

Banka hesabı, Bircan Abi cari hesabı ve mal alımlarını tek defterde toplayan
mobil öncelikli web uygulaması. Telefonun ana ekranına kurulur, çevrimdışı açılır.

**Uygulama:** https://slawrezz9-collab.github.io/slawrezz/

## Yapı

| Yol | Ne işe yarar |
|---|---|
| `index.html`, `stil.css` | arayüz kabuğu ve tasarım |
| `hesap.js` | iş kuralları — tüm rakamlar buradan hesaplanır |
| `api.js` | sunucu bağlantısı, çevrimdışı kuyruk |
| `ui.js`, `gorunum.js`, `app.js` | bileşenler, sayfalar, yönlendirme |
| `manifest.json`, `sw.js`, `icon-*.png` | ana ekrana kurulum ve çevrimdışı açılış |
| `apps-script/` | Google Apps Script sunucu kodu (E-Tablolar'a yapıştırılır) |

## Veri nerede?

Hiçbir muhasebe verisi bu depoda **durmaz**. Veriler yalnızca hesap sahibinin
kendi Google Drive'ındaki E-Tablolar dosyasında tutulur; uygulama oraya
Apps Script üzerinden bağlanır ve her istekte PIN sorar.

Kurulum adımları proje sahibindeki `KURULUM.md` dosyasındadır.
