# SLAW REZZ — Online Mağaza Kurulum Rehberi

Trendyol'dan bağımsız, kendi sanal POS'lu (iyzico) e-ticaret sitesi.

## Dosya Yapısı

| Dosya | Ne işe yarar |
|---|---|
| `index.html` | Vitrin: koleksiyon, kategori filtre, sıralama |
| `urun.html` | Ürün detayı: galeri, beden seçimi, ürün bilgileri/özellikleri, sepete ekle, WhatsApp sipariş |
| `sepet.html` | Sepet + teslimat formu + iyzico ödeme / WhatsApp sipariş |
| `hesap.html` | Üye girişi/kaydı ve sipariş geçmişi (Supabase Auth) |
| `admin/index.html` | Yönetim paneli — 7 bölüm: Ürünler (fiyat/stok/ekle/sil), Sipariş & Kargo (durum akışı, kargo takip, iade/iptal), Promosyon & Fiyat (toplu indirim + kupon kodları), Sorular (soru-cevap yönetimi), Finans (ciro, aylık kırılım, fatura CSV), Rapor (en çok satanlar, katalog dağılımı), Reklam (Meta Pixel + katalog feed'i + Ads Manager bağlantıları) |
| `hukuk/` | KVKK, mesafeli satış, çerez, iade, iletişim sayfaları |
| `veri/urunler.json` | Trendyol'dan aktarılan 168 model (site bundan beslenir) |
| `trendyol_aktar.py` | Ürünleri yeniden çekmek için: `python trendyol_aktar.py` |
| `supabase/schema.sql` | Veritabanı şeması + güvenlik (RLS) kuralları |
| `supabase/urunleri_yukle.py` | JSON'daki ürünleri Supabase'e yükler |
| `supabase/functions/iyzico-odeme/` | iyzico 3D Secure ödeme fonksiyonu |

## Hemen Deneme (Demo Mod)

```
cd slaw-rezz
python -m http.server 8000
```
→ http://localhost:8000 (site) · http://localhost:8000/admin/ (panel, parola: `slaw2026`)

Demo modda: sepet ve admin düzenlemeleri tarayıcıda saklanır, ödeme butonu WhatsApp'a yönlendirir.

## Canlıya Alma Adımları

### 1. Supabase (veritabanı + üyelik)
1. https://supabase.com → yeni proje aç (bölge: Frankfurt önerilir).
2. SQL Editor'de `supabase/schema.sql` içeriğini çalıştır.
3. Settings > API'den **URL** ve **anon key**'i `js/config.js`'e yaz.
4. Ürünleri yükle: `SUPABASE_URL` ve `SUPABASE_SERVICE_KEY` ortam değişkenleriyle `python supabase/urunleri_yukle.py`.
5. Kendine bir üye hesabı aç (hesap.html), sonra SQL Editor'de:
   `insert into yoneticiler values ('SENIN-USER-UUID');`
   (UUID: Authentication > Users listesinde). Artık admin paneline bu hesapla girilir.

### 2. iyzico (sanal POS)
1. https://www.iyzico.com → üye işyeri başvurusu (vergi levhası + banka bilgisi ister).
2. Onay sonrası API Key/Secret alınır:
   ```
   supabase secrets set IYZICO_API_KEY=... IYZICO_SECRET=... SITE_URL=https://siteadresi
   supabase functions deploy iyzico-odeme
   ```
3. Test için `IYZICO_SANDBOX=1` secret'ı ile sandbox anahtarları kullanılabilir.

### 3. Yayınlama
- En kolayı: GitHub reposuna push → GitHub Pages (diğer projelerdeki gibi) veya Vercel.
- Alan adı: ör. `slawrezz.com` → DNS'i yayın platformuna yönlendir.
- **ETBİS kaydı** (e-ticaret bilgi sistemi) yapılmalı: https://etbis.ticaret.gov.tr

### 4. Meta Reklamları
1. Meta Business Suite → Events Manager → Pixel oluştur, ID'yi `js/config.js` → `metaPixelId`'ye yaz.
2. Pixel yalnızca çerez bandında "Kabul Et" diyen ziyaretçilerde yüklenir (KVKK uyumu).
3. Katalog reklamları için Commerce Manager'da katalog aç; ürün feed'i istenirse `veri/urunler.json`'dan CSV üretilebilir (bana söylemeniz yeterli).

### 5. Açılış Öncesi Doldurulacaklar
- `hukuk/` sayfalarındaki `[EKLENECEK]` alanları: şirket unvanı, adres, vergi/MERSİS no, e-posta.
- `admin/index.html` içindeki demo parolası (`slaw2026`) — Supabase'e geçince kullanılmaz ama yine de değiştirin.

## Güvenlik Mimarisi
- Kart bilgisi hiçbir zaman siteye girmez; iyzico'nun 3D Secure sayfasında işlenir.
- Ödeme tutarı **veritabanından** okunur; tarayıcıdan gelen fiyata güvenilmez.
- RLS: müşteri yalnız kendi siparişini görür; ürün düzenlemeyi yalnız `yoneticiler` tablosundakiler yapabilir.
- Yorumlar yalnız o ürünü satın almış üyeler tarafından yazılabilir, admin onayıyla yayınlanır (Haksız Ticari Uygulamalar Yönetmeliği uyumu).
