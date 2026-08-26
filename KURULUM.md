# SLAW REZZ — Online Mağaza Kurulum Rehberi

Trendyol'dan bağımsız, kendi sanal POS'lu (iyzico **veya** PayTR) e-ticaret sitesi.

## Dosya Yapısı

| Dosya | Ne işe yarar |
|---|---|
| `index.html` | Vitrin: koleksiyon, kategori filtre, sıralama |
| `urun.html` | Ürün detayı: galeri, beden seçimi, ürün bilgileri/özellikleri, sepete ekle, WhatsApp sipariş |
| `sepet.html` | Sepet + teslimat formu (il/ilçe ayrı) + kart ödeme / WhatsApp sipariş |
| `siparis-takip.html` | **Üyeliksiz sipariş takip + iade/değişim talebi** (sipariş no + telefon son 4 hane) |
| `hesap.html` | Üye girişi/kaydı, sipariş geçmişi, kargo takip linki, iade butonu |
| `admin/index.html` | Yönetim paneli — 9 bölüm: Ürünler, Sipariş & Kargo, **İadeler**, Promosyon & Fiyat, Sorular, Finans, Rapor, Reklam, Mağaza |
| `hukuk/` | KVKK, mesafeli satış, çerez, iade, iletişim + satıcı künyesi |
| `js/config.js` | **Tek yapılandırma dosyası** — Supabase, WhatsApp, kargo, satıcı künyesi, ödeme sağlayıcı |
| `veri/urunler.json` | Aktarılan ürün kataloğu (site demo modda bundan beslenir) |
| `supabase/schema.sql` | Şema + RLS + RPC'ler (Migration 001-004 dahil) |
| `supabase/functions/odeme/` | **Çok sağlayıcılı ödeme fonksiyonu** (iyzico + PayTR) |
| `test/` | 67 test — `node test/birim-test.js`, `node test/akis-test.js`, `node --experimental-strip-types test/paytr-test.js` |

## Hemen Deneme (Demo Mod)

```
cd slaw-rezz
python -m http.server 8000
```
→ http://localhost:8000 (site) · http://localhost:8000/admin/ (panel, parola: `slaw2026`)

Demo modda sepet, sipariş, iade ve admin düzenlemeleri **yalnızca o tarayıcıda** saklanır.
Yani müşterinin verdiği sipariş size ulaşmaz — bu yüzden gerçek satış için Supabase şart.
Panelde bunu hatırlatan sarı bir uyarı bandı görünür.

Testleri çalıştırmak için:
```
node test/birim-test.js && node test/akis-test.js && node --experimental-strip-types test/paytr-test.js
```

## Canlıya Alma Adımları

### 1. Satıcı künyesi (ilk iş — 2 dakika)
`js/config.js` içindeki `satici` objesini doldurun: unvan, adres, il/ilçe, vergi dairesi,
vergi no (şahıs firmasında TCKN), e-posta. Bu **tek yer**; mesafeli satış sözleşmesi,
KVKK metni, iletişim sayfası ve fatura şablonu otomatik olarak buradan beslenir.

### 2. Supabase (veritabanı + üyelik)
1. https://supabase.com → yeni proje aç (bölge: Frankfurt önerilir).
2. SQL Editor'de `supabase/schema.sql` içeriğini çalıştır (Migration blokları dahil).
3. Settings > API'den **URL** ve **anon key**'i `js/config.js`'e yaz.
4. Ürünleri yükle: `SUPABASE_URL` ve `SUPABASE_SERVICE_KEY` ortam değişkenleriyle
   `python supabase/urunleri_yukle.py`.
5. Kendine bir üye hesabı aç (hesap.html), sonra SQL Editor'de:
   `insert into yoneticiler values ('SENIN-USER-UUID');`
   (UUID: Authentication > Users listesinde). Artık admin paneline bu hesapla girilir.

### 3. Sanal POS (iyzico veya PayTR)

Kod her ikisini de destekler; seçim **sunucudaki secret** ile yapılır.

```bash
# Ortak
supabase secrets set SITE_URL=https://siteadresi

# iyzico kullanacaksanız
supabase secrets set ODEME_SAGLAYICI=iyzico IYZICO_API_KEY=... IYZICO_SECRET=...
# test için ek olarak: IYZICO_SANDBOX=1

# PayTR kullanacaksanız
supabase secrets set ODEME_SAGLAYICI=paytr \
  PAYTR_MERCHANT_ID=... PAYTR_MERCHANT_KEY=... PAYTR_MERCHANT_SALT=...
# test için ek olarak: PAYTR_TEST_MODE=1

# Deploy — --no-verify-jwt ZORUNLU (sağlayıcı bildirimleri Authorization header'ı göndermez)
supabase functions deploy odeme --no-verify-jwt
```

**iyzico:** panelde callback adresi → `https://<proje>.supabase.co/functions/v1/odeme?bildirim=1`

**PayTR:** mağaza panelinde **bildirim URL'i** → `https://<proje>.supabase.co/functions/v1/odeme?bildirim=1`
(Bu adım elle yapılır, kodla gönderilmez. Ayarlanmazsa ödemeler "ödendi" olmaz.)

Sağlayıcı değiştirmek için tek yapılacak: `ODEME_SAGLAYICI` secret'ını değiştirip yeniden deploy.
İstemci kodunda hiçbir değişiklik gerekmez. `js/config.js` içindeki `odemeSaglayici` alanı
yalnızca arayüzdeki etiket içindir (buton yazısı, hukuk metni).

### 4. Yayınlama
- GitHub reposuna push → GitHub Pages. Şu an: https://slawrezz9-collab.github.io/slawrezz/
- Alan adı: ör. `slawrezz.com` → DNS'i yayın platformuna yönlendir, `js/config.js` → `siteUrl` güncelle.

### 5. ETBİS kaydı (zorunlu)
Kendi siteniz üzerinden satış yapıyorsanız kayıt zorunludur (şahıs firması dahil).
- Başvuru: https://eticaret.gov.tr → e-Devlet ile giriş, ücretsiz
- Şahıs firmasında MERSİS yerine **TCKN** kullanılır
- Alan adı bildirileceği için **domain kararından sonra** yapın
- Kayıt sonrası verilen numarayı `js/config.js` → `satici.etbisNo` alanına yazın;
  footer rozeti otomatik görünür (QR görseli varsa `satici.etbisQr`)

### 6. Meta Reklamları
1. Meta Business Suite → Events Manager → Pixel oluştur, ID'yi `js/config.js` → `metaPixelId`'ye yaz.
2. Pixel yalnızca çerez bandında "Kabul Et" diyen ziyaretçilerde yüklenir (KVKK uyumu).

### 7. Açılış öncesi kontrol listesi
- [ ] `satici` künyesi dolduruldu (Adım 1)
- [ ] Supabase bağlandı, admin paneldeki sarı "DEMO MOD" bandı kayboldu
- [ ] Sanal POS sandbox'ta test edildi (test kartıyla uçtan uca ödeme)
- [ ] Sağlayıcı panelinde bildirim URL'i ayarlandı
- [ ] ETBİS kaydı yapıldı, numara config'e yazıldı
- [ ] `admin/index.html` içindeki demo parolası (`slaw2026`) değiştirildi
      (Supabase'e geçince kullanılmaz ama panel public repoda ise yine de değiştirin)
- [ ] e-Arşiv fatura çözümü hazır (GİB portalı veya entegratör) — panelin
      "Fatura Kes" özelliği resmî fatura **değildir**, kendi iç takibinizdir

## İş Akışları

### Sipariş → teslimat
Sipariş düşer (durum: *Yeni*) → panelden **Hazırlanıyor** → kargo firması seç + takip no gir
→ **Kargoda** → **Teslim**. Müşteri her adımı `siparis-takip.html`'den veya hesabından izler;
kargo takip linki otomatik üretilir.

Toplu gönderi için: siparişleri seçin → **Kargo CSV'si** → Basit Kargo / Kolay Gelsin gibi
platformların toplu yükleme ekranına verin (sütun eşleştirmesi orada yapılır).

### İade / değişim
Müşteri `siparis-takip.html`'den sipariş no + telefon son 4 hanesiyle girer, ürünleri ve
adetleri seçip (kısmi iade mümkün) talep açar. Panelde **İadeler** sekmesine düşer:
**Onayla** (kargo firması + anlaşmalı kod girin — müşteri bunu takip sayfasında görür) veya
**Reddet** (gerekçe zorunlu, müşteriye gösterilir) → **Ürün Yolda** → **Ürün Elime Ulaştı**
(stoğa geri ekleme ve iade faturası burada sorulur).

**Bedel iadesi bilinçli olarak otomatik değildir:** kart ödemelerinde POS panelinizden,
havalede elle yaparsınız. Ürün elinize geçmeden para gitmesin diye böyle tasarlandı.

Telefonla gelen talepler için: Sipariş & Kargo sekmesinde **İade Talebi Aç** butonu.

## Güvenlik Mimarisi
- Kart bilgisi hiçbir zaman siteye girmez; sağlayıcının 3D Secure sayfasında işlenir.
- **Sipariş sunucuda oluşturulur** (`siparis_olustur` RPC): fiyat, kargo ve kupon indirimi
  veritabanındaki ürün fiyatlarından hesaplanır. Tarayıcıdan gelen tutar yok sayılır ve
  siparişlere doğrudan INSERT kapalıdır.
- Ödeme bildirimi sağlayıcıya sorularak/hash doğrulanarak teyit edilir; callback'ten gelen
  veriye güvenilmez. Tutar uyuşmazsa sipariş "ödendi" yapılmaz, denetim için işaretlenir.
- Aynı sipariş için ikinci ödeme başlatılamaz; 30 dakikadan eski siparişler reddedilir.
- **Misafir sipariş sorgulama** `security definer` RPC üzerinden yapılır ve kişisel veriyi
  maskeler: tam adres, tam telefon ve e-posta asla dönmez. Kaba kuvvete karşı sipariş
  numarası başına 15 dakikada 8 deneme sınırı vardır.
- İade taleplerinde tutar ve kalemler sunucuda doğrulanır; yalnızca siparişte gerçekten
  bulunan ürünler, sipariştekinden fazla olmayacak adetle seçilebilir.
- RLS: müşteri yalnız kendi siparişini görür; ürün/sipariş düzenlemeyi yalnız `yoneticiler`
  tablosundakiler yapabilir.
- Yorumlar yalnız o ürünü satın almış üyeler tarafından yazılabilir, admin onayıyla yayınlanır
  (Haksız Ticari Uygulamalar Yönetmeliği uyumu).
