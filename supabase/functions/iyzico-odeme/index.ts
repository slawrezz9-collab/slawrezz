// SLAW REZZ — iyzico Ödeme Formu başlatma (Supabase Edge Function)
// Deploy: supabase functions deploy iyzico-odeme
// Secrets: supabase secrets set IYZICO_API_KEY=... IYZICO_SECRET=... SITE_URL=https://...
//
// Akış: sepet.html sipariş kaydını oluşturur → bu fonksiyon iyzico
// CheckoutFormInitialize çağırır → müşteri iyzico'nun 3D Secure sayfasında öder
// → iyzico callback ile geri döner → durum "odendi" yapılır.
// Kart verisi hiçbir aşamada bizim tarafımıza uğramaz.

import { createClient } from "npm:@supabase/supabase-js@2";
import { createHash, createHmac } from "node:crypto";

const IYZ_URL = Deno.env.get("IYZICO_SANDBOX") === "1"
  ? "https://sandbox-api.iyzipay.com" : "https://api.iyzipay.com";

function iyzicoImza(apiKey: string, secret: string, randomKey: string, uriPath: string, body: string) {
  const payload = randomKey + uriPath + body;
  const hash = createHmac("sha256", secret).update(payload).digest("hex");
  return "IYZWSv2 " + btoa(`apiKey:${apiKey}&randomKey:${randomKey}&signature:${hash}`);
}

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);

    // ---- iyzico'dan dönüş (callback) ----
    if (url.searchParams.get("callback") === "1") {
      const form = await req.formData();
      const token = String(form.get("token") || "");
      // Ödeme sonucunu doğrula
      const apiKey = Deno.env.get("IYZICO_API_KEY")!;
      const secret = Deno.env.get("IYZICO_SECRET")!;
      const randomKey = Date.now().toString();
      const body = JSON.stringify({ locale: "tr", token });
      const path = "/payment/iyzipos/checkoutform/auth/ecom/detail";
      const r = await fetch(IYZ_URL + path, {
        method: "POST",
        headers: {
          Authorization: iyzicoImza(apiKey, secret, randomKey, path, body),
          "x-iyzi-rnd": randomKey,
          "Content-Type": "application/json",
        },
        body,
      });
      const sonuc = await r.json();
      const durum = sonuc.paymentStatus === "SUCCESS" ? "odendi" : "odeme_bekliyor";
      await sb.from("siparisler").update({ durum }).eq("iyzico_token", token);
      const site = Deno.env.get("SITE_URL") || "";
      return Response.redirect(
        `${site}/hesap.html?odeme=${durum === "odendi" ? "basarili" : "basarisiz"}`, 303);
    }

    // ---- ödeme başlatma ----
    const { siparisId } = await req.json();
    const { data: sip, error } = await sb.from("siparisler").select("*").eq("id", siparisId).single();
    if (error || !sip) throw new Error("Sipariş bulunamadı");
    if (sip.durum !== "odeme_bekliyor") throw new Error("Sipariş zaten işlenmiş");

    // Fiyatı asla istemciden alma — veritabanındaki tutarı kullan
    const apiKey = Deno.env.get("IYZICO_API_KEY")!;
    const secret = Deno.env.get("IYZICO_SECRET")!;
    const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/iyzico-odeme?callback=1`;

    const istek = {
      locale: "tr",
      conversationId: sip.id,
      price: String(sip.tutar),
      paidPrice: String(sip.tutar),
      currency: "TRY",
      basketId: sip.id,
      paymentGroup: "PRODUCT",
      callbackUrl: fnUrl,
      buyer: {
        id: sip.kullanici_id || sip.id,
        name: sip.ad_soyad.split(" ")[0],
        surname: sip.ad_soyad.split(" ").slice(1).join(" ") || "-",
        gsmNumber: sip.telefon,
        email: sip.eposta || "musteri@slawrezz.com",
        identityNumber: "11111111111", // opsiyonel alan; gerçek TCKN istenmiyor
        registrationAddress: sip.adres,
        ip: req.headers.get("x-forwarded-for") || "0.0.0.0",
        city: sip.sehir || "-",
        country: "Turkey",
      },
      shippingAddress: { contactName: sip.ad_soyad, city: sip.sehir || "-", country: "Turkey", address: sip.adres },
      billingAddress: { contactName: sip.ad_soyad, city: sip.sehir || "-", country: "Turkey", address: sip.adres },
      basketItems: (sip.kalemler as any[]).map((k, i) => ({
        id: k.id, name: `${k.ad} (${k.beden}) x${k.adet}`,
        category1: "Giyim", itemType: "PHYSICAL",
        price: String((k.birim * k.adet).toFixed(2)),
      })),
    };
    // Sepet kalemleri toplamı, ödenen tutara birebir eşitlenmeli.
    // Kargo eklenir; kupon indirimi kalemlere orantılı dağıtılır,
    // kuruş farkı son kalemde düzeltilir.
    const kalemToplam = (sip.kalemler as any[]).reduce((t, k) => t + k.birim * k.adet, 0);
    if (sip.tutar > kalemToplam) {
      istek.basketItems.push({
        id: "kargo", name: "Kargo", category1: "Hizmet",
        itemType: "PHYSICAL", price: String((sip.tutar - kalemToplam).toFixed(2)),
      });
    } else if (sip.tutar < kalemToplam) {
      const oran = sip.tutar / kalemToplam;
      let dagitilan = 0;
      istek.basketItems.forEach((b: any, i: number) => {
        if (i < istek.basketItems.length - 1) {
          b.price = (Math.round(parseFloat(b.price) * oran * 100) / 100).toFixed(2);
          dagitilan += parseFloat(b.price);
        } else {
          b.price = (sip.tutar - dagitilan).toFixed(2);
        }
      });
    }

    const body = JSON.stringify(istek);
    const path = "/payment/iyzipos/checkoutform/initialize/auth/ecom";
    const randomKey = Date.now().toString();
    const r = await fetch(IYZ_URL + path, {
      method: "POST",
      headers: {
        Authorization: iyzicoImza(apiKey, secret, randomKey, path, body),
        "x-iyzi-rnd": randomKey,
        "Content-Type": "application/json",
      },
      body,
    });
    const sonuc = await r.json();
    if (sonuc.status !== "success") throw new Error(sonuc.errorMessage || "iyzico hatası");

    await sb.from("siparisler").update({ iyzico_token: sonuc.token }).eq("id", sip.id);
    return new Response(JSON.stringify({ odemeSayfasiUrl: sonuc.paymentPageUrl }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ hata: (e as Error).message }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
