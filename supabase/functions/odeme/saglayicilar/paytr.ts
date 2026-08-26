// SLAW REZZ — PayTR sağlayıcısı (iFrame API / ödeme sayfası)
//
// PayTR'nin iyzico'dan farkları (tuzaklar):
//  1. İstek gövdesi JSON değil, application/x-www-form-urlencoded.
//  2. merchant_oid YALNIZCA alfanumerik olabilir — UUID'deki tireler temizlenir.
//  3. Tutar kuruş cinsinden tam sayıdır (1250.90 TL -> 125090).
//  4. Bildirim sunucudan sunucuya gelir ve yanıt gövdesi TAM OLARAK "OK"
//     olmalıdır; aksi halde PayTR bildirimi 24 saat boyunca tekrarlar.
//  5. Kullanıcının tarayıcı dönüşü AYRI bir istektir (merchant_ok_url) ve
//     sırası garanti değildir — bu yüzden dönüş route'u DB'ye dokunmaz.
//  6. Bildirim URL'i PayTR mağaza panelinden ayarlanır, kodla gönderilmez:
//     <fonksiyon-adresi>?bildirim=1
import { createHmac } from "node:crypto";
import { Buffer } from "node:buffer";
import type { BaslatSonuc, BildirimSonuc, Ctx, OdemeSaglayici, Siparis } from "../ortak/tipler.ts";

// Türkçe karakterli ürün adları btoa()'yı patlatır (InvalidCharacterError),
// bu yüzden UTF-8 baytları üzerinden base64 alınır.
// Not: bu üç yardımcı test edilebilsin diye dışa açıktır (test/paytr-test.js).
export const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
export const hmacB64 = (veri: string, anahtar: string) =>
  createHmac("sha256", anahtar).update(veri, "utf8").digest("base64");

export const oidUret = (id: string) => String(id).replace(/[^a-zA-Z0-9]/g, "");

export const paytr: OdemeSaglayici = {
  ad: "paytr",
  etiket: "PayTR",
  kullaniciDonusuVarMi: true,

  async baslat(sip: Siparis, ctx: Ctx): Promise<BaslatSonuc> {
    const merchant_id = ctx.env("PAYTR_MERCHANT_ID");
    const merchant_key = ctx.env("PAYTR_MERCHANT_KEY");
    const merchant_salt = ctx.env("PAYTR_MERCHANT_SALT");
    const test_mode = ctx.env("PAYTR_TEST_MODE") === "1" ? "1" : "0";

    const merchant_oid = oidUret(sip.id);
    const payment_amount = String(Math.round(Number(sip.tutar) * 100));   // kuruş
    const email = sip.eposta || "musteri@slawrezz.com";
    const user_ip = ctx.istemciIp;
    const no_installment = "0";
    const max_installment = "0";
    const currency = "TL";

    // PayTR sepet toplamını ödenen tutara eşitlemeyi zorunlu tutmaz
    // (iyzico'daki orantılı dağıtım mantığı burada gereksizdir).
    const sepet: Array<[string, string, number]> = (sip.kalemler || []).map(
      (k) => [`${k.ad} (${k.beden})`, k.birim.toFixed(2), k.adet],
    );
    if (sip.kargo > 0) sepet.push(["Kargo", sip.kargo.toFixed(2), 1]);
    const user_basket = b64(JSON.stringify(sepet));

    const hashStr = merchant_id + user_ip + merchant_oid + email + payment_amount +
      user_basket + no_installment + max_installment + currency + test_mode;
    const paytr_token = hmacB64(hashStr + merchant_salt, merchant_key);

    const govde = new URLSearchParams({
      merchant_id, user_ip, merchant_oid, email, payment_amount, paytr_token,
      user_basket, debug_on: test_mode, no_installment, max_installment,
      user_name: sip.ad_soyad,
      user_address: [sip.adres, sip.ilce, sip.sehir].filter(Boolean).join(" "),
      user_phone: String(sip.telefon || "").replace(/\D/g, ""),
      merchant_ok_url: `${ctx.fnUrl}?donus=basarili`,
      merchant_fail_url: `${ctx.fnUrl}?donus=basarisiz`,
      timeout_limit: "30",
      currency, test_mode,
    });

    const r = await fetch("https://www.paytr.com/odeme/api/get-token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: govde.toString(),
    });
    const sonuc = await r.json();
    if (sonuc.status !== "success") throw new Error(sonuc.reason || "PayTR hatası");

    return {
      odemeSayfasiUrl: `https://www.paytr.com/odeme/guvenli/${sonuc.token}`,
      referans: merchant_oid,
    };
  },

  async bildirimDogrula(req: Request, _ctx: Ctx): Promise<BildirimSonuc> {
    const merchant_key = _ctx.env("PAYTR_MERCHANT_KEY");
    const merchant_salt = _ctx.env("PAYTR_MERCHANT_SALT");
    const form = await req.formData();
    const merchant_oid = String(form.get("merchant_oid") || "");
    const status = String(form.get("status") || "");
    const total_amount = String(form.get("total_amount") || "");
    const gelenHash = String(form.get("hash") || "");

    // Doğrulama ikinci bir API çağrısıyla değil, hash'i yeniden hesaplayarak yapılır.
    const beklenen = hmacB64(merchant_oid + merchant_salt + status + total_amount, merchant_key);
    const ham = { merchant_oid, status, total_amount, failed_reason_msg: form.get("failed_reason_msg") };

    if (gelenHash !== beklenen) {
      return {
        referans: null, basarili: false, ham,
        yanit: new Response("PAYTR notification failed: bad hash",
          { status: 200, headers: { "Content-Type": "text/plain" } }),
      };
    }
    return {
      referans: merchant_oid,
      basarili: status === "success",
      tutarKurus: parseInt(total_amount, 10) || undefined,
      ham,
      // Gövde TAM OLARAK "OK" olmalı — JSON değil, boşluk/yeni satır yok.
      yanit: new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } }),
    };
  },
};
