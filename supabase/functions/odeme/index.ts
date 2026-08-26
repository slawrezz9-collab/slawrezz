// SLAW REZZ — çok sağlayıcılı ödeme yönlendiricisi (Supabase Edge Function)
//
// Deploy:  supabase functions deploy odeme --no-verify-jwt
//   --no-verify-jwt ZORUNLU: PayTR bildirimi ve iyzico callback'i Authorization
//   header'ı göndermez. Bu yüzden baslat() yolunda ek koruma var (aşağıya bak).
//
// Secrets:
//   supabase secrets set ODEME_SAGLAYICI=iyzico SITE_URL=https://...
//   iyzico:  IYZICO_API_KEY=... IYZICO_SECRET=... [IYZICO_SANDBOX=1]
//   PayTR :  PAYTR_MERCHANT_ID=... PAYTR_MERCHANT_KEY=... PAYTR_MERCHANT_SALT=... [PAYTR_TEST_MODE=1]
//
// PayTR kullanılacaksa bildirim adresini PayTR mağaza panelinden şu şekilde ayarlayın:
//   https://<proje>.supabase.co/functions/v1/odeme?bildirim=1
//
// İstemci sözleşmesi (değiştirmeyin — sepet.html buna göre yazılmıştır):
//   POST { siparisId }  ->  { odemeSayfasiUrl } | { hata }

import { createClient } from "npm:@supabase/supabase-js@2";
import { iyzico } from "./saglayicilar/iyzico.ts";
import { paytr } from "./saglayicilar/paytr.ts";
import type { Ctx, OdemeSaglayici, Siparis } from "./ortak/tipler.ts";

const SAGLAYICILAR: Record<string, OdemeSaglayici> = { iyzico, paytr };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};
const json = (govde: unknown, status = 200) =>
  new Response(JSON.stringify(govde), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const env = (k: string) => Deno.env.get(k) ?? "";
  const url = new URL(req.url);
  const siteUrl = (env("SITE_URL") || "").replace(/\/$/, "");
  const ctx: Ctx = {
    siteUrl,
    fnUrl: `${env("SUPABASE_URL")}/functions/v1/odeme`,
    istemciIp: req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "0.0.0.0",
    env,
  };

  const secili = SAGLAYICILAR[env("ODEME_SAGLAYICI") || "iyzico"];
  if (!secili) return json({ hata: "Tanımsız ödeme sağlayıcı" }, 500);

  const sb = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

  try {
    // ---- 1. Kullanıcının tarayıcı dönüşü (PayTR) ----
    // Bu istek DOĞRULANMAMIŞTIR; asla veritabanına yazmaz. Sipariş durumunu
    // yalnızca bildirim route'u değiştirir.
    const donus = url.searchParams.get("donus");
    if (donus) {
      return Response.redirect(`${siteUrl}/siparis-takip.html?odeme=${donus}`, 303);
    }

    // ---- 2. Sağlayıcı bildirimi ----
    // ?callback=1 eski iyzico adresidir, geriye dönük destekleniyor.
    if (url.searchParams.get("bildirim") === "1" || url.searchParams.get("callback") === "1") {
      const sonuc = await secili.bildirimDogrula(req, ctx);
      if (!sonuc.referans) return sonuc.yanit;   // hash geçersiz vb.

      const { data: sip } = await sb.from("siparisler").select("*")
        .eq("odeme_referans", sonuc.referans).maybeSingle();

      // Eski kayıtlar iyzico_token alanını kullanıyor olabilir
      const siparis = sip ?? (await sb.from("siparisler").select("*")
        .eq("iyzico_token", sonuc.referans).maybeSingle()).data;

      if (!siparis) return sonuc.yanit;                      // bilinmeyen referans
      if (siparis.durum !== "odeme_bekliyor") return sonuc.yanit;   // idempotent

      // Tutar uyuşmuyorsa siparişi ÖDENDİ yapma — denetim için kaydet.
      if (sonuc.tutarKurus && Math.round(Number(siparis.tutar) * 100) !== sonuc.tutarKurus) {
        await sb.from("siparisler").update({
          odeme_durum: "tutar_uyusmadi", odeme_ham: sonuc.ham,
        }).eq("id", siparis.id);
        return sonuc.yanit;
      }

      await sb.from("siparisler").update({
        durum: sonuc.basarili ? "odendi" : "odeme_bekliyor",
        odeme_durum: sonuc.basarili ? "basarili" : "basarisiz",
        odeme_ham: sonuc.ham,
      }).eq("id", siparis.id);

      return sonuc.yanit;
    }

    // ---- 3. Ödeme başlatma ----
    const { siparisId } = await req.json();
    const { data: sip, error } = await sb.from("siparisler").select("*")
      .eq("id", siparisId).single();
    if (error || !sip) throw new Error("Sipariş bulunamadı");

    // Fonksiyon JWT doğrulaması olmadan yayınlandığı için bu iki kontrol
    // opsiyonel değil: aynı sipariş için ikinci ödeme başlatılamaz ve
    // eski siparişler yeniden kullanılamaz.
    if (sip.durum !== "odeme_bekliyor") throw new Error("Sipariş zaten işlenmiş");
    if (Date.now() - new Date(sip.created_at).getTime() > 30 * 60 * 1000) {
      throw new Error("Sipariş süresi doldu, lütfen sepetinizi yenileyin");
    }

    // Fiyat DAİMA veritabanından okunur, istemciden gelen tutar kullanılmaz.
    const sonuc = await secili.baslat(sip as Siparis, ctx);

    await sb.from("siparisler").update({
      odeme_saglayici: secili.ad,
      odeme_referans: sonuc.referans,
      odeme_durum: "basladi",
    }).eq("id", sip.id);

    return json({ odemeSayfasiUrl: sonuc.odemeSayfasiUrl });
  } catch (e) {
    return json({ hata: (e as Error).message }, 400);
  }
});
