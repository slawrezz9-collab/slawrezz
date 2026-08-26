// SLAW REZZ site yapılandırması
// Supabase projesi oluşturulunca URL ve anon key buraya yazılacak.
// Boş bırakılırsa site veri/urunler.json + localStorage ile çalışır (demo mod).
window.SLAW_CONFIG = {
  supabaseUrl: "",        // örn: https://xxxx.supabase.co
  supabaseAnonKey: "",    // Supabase > Settings > API > anon public

  whatsapp: "905413483945",                // sipariş hattı
  instagram: "",                            // varsa @kullanıcıadı

  // Trendyol puan rozeti — puan/sayı veri/yorumlar.json'dan otomatik gelir
  trendyolUrl: "https://www.trendyol.com/magaza/slaw-rezz-m-1074070",

  kargoUcreti: 79.90,
  ucretsizKargoLimiti: 1500,

  siteUrl: "https://slawrezz9-collab.github.io/slawrezz",   // yayın adresi (Meta katalog feed'i için)
  metaPixelId: "",         // Meta reklamları için Pixel ID

  // Ödeme sağlayıcı — bu alan SADECE arayüz etiketi içindir (buton yazısı, hukuk metni).
  // Gerçek seçim sunucuda, Edge Function'ın ODEME_SAGLAYICI secret'ı ile yapılır;
  // buradaki değer değiştirilerek ödeme yönlendirilemez.
  odemeSaglayici: "iyzico",     // iyzico | paytr
  odemeFonksiyonu: "odeme",     // Supabase Edge Function adı

  // ---------------------------------------------------------------------
  // SATICI KÜNYESİ — TEK KAYNAK.
  // Hukuk sayfaları (mesafeli satış, KVKK, iletişim, iade) ve fatura şablonu
  // bu objeden okur. Buradaki 4-5 alanı doldurmak tüm siteyi günceller.
  // Boş bırakılan alanlar sayfada "[EKLENECEK]" görünür; mersis/etbis gibi
  // opsiyonel alanlar boşsa ilgili satır tamamen gizlenir.
  // ---------------------------------------------------------------------
  satici: {
    unvan: "",            // şahıs firmasında genelde: "Ad Soyad - SLAW REZZ"
    yetkili: "",          // firma yetkilisi ad soyad
    adres: "",            // açık adres (mahalle, cadde, no)
    ilce: "",
    il: "",
    vergiDairesi: "",
    vergiNo: "",          // şahıs firmasında TCKN = VKN olarak kullanılır
    mersis: "",           // şahıs firmasında genelde yok — boşsa gizlenir
    eposta: "",           // iade/cayma bildirimleri buraya gelir
    telefon: "0541 348 39 45",
    etbisNo: "",          // ETBİS kaydı sonrası doldur — footer rozeti otomatik görünür
    etbisQr: "",          // ETBİS'ten indirilen bandrol görseli (örn "gorseller/etbis.png")
    etbisUrl: ""          // bandrol doğrulama linki
  }
};
