// SLAW REZZ — iyzico sağlayıcısı (CheckoutForm / 3D Secure)
// Mantık eski iyzico-odeme fonksiyonundan taşındı, davranışı korunuyor.
import { createHmac } from "node:crypto";
import type { BaslatSonuc, BildirimSonuc, Ctx, OdemeSaglayici, Siparis } from "../ortak/tipler.ts";

const kokUrl = (ctx: Ctx) =>
  ctx.env("IYZICO_SANDBOX") === "1" ? "https://sandbox-api.iyzipay.com" : "https://api.iyzipay.com";

// iyzico IYZWSv2 imza şeması
function imza(apiKey: string, secret: string, randomKey: string, uriPath: string, body: string) {
  const payload = randomKey + uriPath + body;
  const hash = createHmac("sha256", secret).update(payload).digest("hex");
  return "IYZWSv2 " + btoa(`apiKey:${apiKey}&randomKey:${randomKey}&signature:${hash}`);
}

async function cagir(ctx: Ctx, path: string, govde: unknown) {
  const apiKey = ctx.env("IYZICO_API_KEY");
  const secret = ctx.env("IYZICO_SECRET");
  const randomKey = Date.now().toString();
  const body = JSON.stringify(govde);
  const r = await fetch(kokUrl(ctx) + path, {
    method: "POST",
    headers: {
      Authorization: imza(apiKey, secret, randomKey, path, body),
      "x-iyzi-rnd": randomKey,
      "Content-Type": "application/json",
    },
    body,
  });
  return await r.json();
}

export const iyzico: OdemeSaglayici = {
  ad: "iyzico",
  etiket: "iyzico",
  kullaniciDonusuVarMi: false,   // bildirim ve kullanıcı dönüşü aynı istek

  async baslat(sip: Siparis, ctx: Ctx): Promise<BaslatSonuc> {
    const adParcalari = String(sip.ad_soyad || "").trim().split(/\s+/);
    const sehir = sip.sehir || "-";

    const basketItems = (sip.kalemler || []).map((k) => ({
      id: k.id,
      name: `${k.ad} (${k.beden}) x${k.adet}`,
      category1: "Giyim",
      itemType: "PHYSICAL",
      price: (k.birim * k.adet).toFixed(2),
    }));

    // iyzico'nun katı kuralı: sepet kalemleri toplamı ödenen tutara birebir
    // eşit olmalı. Kargo ayrı kalem olarak eklenir; kupon indirimi kalemlere
    // orantılı dağıtılır ve kuruş farkı son kalemde düzeltilir.
    const kalemToplam = (sip.kalemler || []).reduce((t, k) => t + k.birim * k.adet, 0);
    if (sip.tutar > kalemToplam) {
      basketItems.push({
        id: "kargo", name: "Kargo", category1: "Hizmet",
        itemType: "PHYSICAL", price: (sip.tutar - kalemToplam).toFixed(2),
      });
    } else if (sip.tutar < kalemToplam && kalemToplam > 0) {
      const oran = sip.tutar / kalemToplam;
      let dagitilan = 0;
      basketItems.forEach((b, i) => {
        if (i < basketItems.length - 1) {
          b.price = (Math.round(parseFloat(b.price) * oran * 100) / 100).toFixed(2);
          dagitilan += parseFloat(b.price);
        } else {
          b.price = (sip.tutar - dagitilan).toFixed(2);
        }
      });
    }

    const istek = {
      locale: "tr",
      conversationId: sip.id,
      price: String(sip.tutar),
      paidPrice: String(sip.tutar),
      currency: "TRY",
      basketId: sip.siparis_no || sip.id,
      paymentGroup: "PRODUCT",
      callbackUrl: `${ctx.fnUrl}?bildirim=1`,
      buyer: {
        id: sip.kullanici_id || sip.id,
        name: adParcalari[0] || "-",
        surname: adParcalari.slice(1).join(" ") || "-",
        gsmNumber: sip.telefon,
        email: sip.eposta || "musteri@slawrezz.com",
        identityNumber: "11111111111",   // opsiyonel alan; gerçek TCKN istenmiyor
        registrationAddress: sip.adres,
        ip: ctx.istemciIp,
        city: sehir,
        country: "Turkey",
      },
      shippingAddress: { contactName: sip.ad_soyad, city: sehir, country: "Turkey", address: sip.adres },
      billingAddress: { contactName: sip.ad_soyad, city: sehir, country: "Turkey", address: sip.adres },
      basketItems,
    };

    const sonuc = await cagir(ctx, "/payment/iyzipos/checkoutform/initialize/auth/ecom", istek);
    if (sonuc.status !== "success") throw new Error(sonuc.errorMessage || "iyzico hatası");
    return { odemeSayfasiUrl: sonuc.paymentPageUrl, referans: sonuc.token };
  },

  async bildirimDogrula(req: Request, ctx: Ctx): Promise<BildirimSonuc> {
    const form = await req.formData();
    const token = String(form.get("token") || "");
    // Callback'ten gelen veriye güvenilmez; sonuç iyzico'ya sorulur.
    const sonuc = await cagir(ctx, "/payment/iyzipos/checkoutform/auth/ecom/detail",
      { locale: "tr", token });
    const basarili = sonuc.paymentStatus === "SUCCESS";
    return {
      referans: token || null,
      basarili,
      tutarKurus: sonuc.paidPrice ? Math.round(parseFloat(sonuc.paidPrice) * 100) : undefined,
      ham: sonuc,
      // iyzico'da müşterinin tarayıcısı bu isteği yapar → siteye geri yolla
      yanit: Response.redirect(
        `${ctx.siteUrl}/siparis-takip.html?odeme=${basarili ? "basarili" : "basarisiz"}`, 303),
    };
  },
};
