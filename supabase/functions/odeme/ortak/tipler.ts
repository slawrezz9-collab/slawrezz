// SLAW REZZ — ödeme sağlayıcı sözleşmesi
//
// Amaç: iyzico ve PayTR (ve ileride başkaları) aynı arayüzü uygular; uygulama
// kodu hangisinin kullanıldığını bilmez. Sağlayıcı seçimi ODEME_SAGLAYICI
// secret'ı ile SUNUCUDA yapılır — js/config.js'teki alan yalnızca arayüz
// etiketidir ve istemciden değiştirilerek ödeme yönlendirilemez.

export interface Kalem {
  id: string;
  ad: string;
  beden: string;
  adet: number;
  birim: number;
}

export interface Siparis {
  id: string;
  siparis_no: string | null;
  kullanici_id: string | null;
  ad_soyad: string;
  telefon: string;
  eposta: string | null;
  adres: string;
  sehir: string | null;
  ilce: string | null;
  kalemler: Kalem[];
  tutar: number;
  kargo: number;
  indirim: number;
  durum: string;
  odeme_referans: string | null;
  created_at: string;
}

export interface Ctx {
  siteUrl: string;      // SITE_URL — müşterinin geri döneceği site
  fnUrl: string;        // bu fonksiyonun tam adresi (callback üretimi için)
  istemciIp: string;
  env: (k: string) => string;
}

export interface BaslatSonuc {
  odemeSayfasiUrl: string;
  referans: string;     // siparisler.odeme_referans'a yazılır
}

export interface BildirimSonuc {
  referans: string | null;   // siparişi bulmak için
  basarili: boolean;
  tutarKurus?: number;       // varsa DB tutarıyla karşılaştırılır
  ham: unknown;              // denetim izi (odeme_ham)
  // Sağlayıcıya döndürülecek HAM yanıt. Bu alan kritik: iyzico 303 redirect
  // bekler, PayTR ise gövdesi tam olarak "OK" olan 200 bekler. Yanıtın şeklini
  // sağlayıcı belirler, yönlendirici sarmalamaz.
  yanit: Response;
}

export interface OdemeSaglayici {
  ad: string;
  etiket: string;
  baslat(sip: Siparis, ctx: Ctx): Promise<BaslatSonuc>;
  bildirimDogrula(req: Request, ctx: Ctx): Promise<BildirimSonuc>;
  // PayTR'de bildirim (sunucu→sunucu) ve kullanıcı dönüşü AYRI isteklerdir;
  // iyzico'da tek istektir. Yönlendirici buna göre route açar.
  kullaniciDonusuVarMi: boolean;
}
