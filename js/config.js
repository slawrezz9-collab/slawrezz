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
  metaPixelId: ""          // Meta reklamları için Pixel ID
};
