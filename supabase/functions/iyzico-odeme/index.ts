// SLAW REZZ — ESKİ ödeme fonksiyonu (geriye dönük uyumluluk kabuğu)
//
// Ödeme mantığı artık supabase/functions/odeme/ altında, çok sağlayıcılı
// (iyzico + PayTR) yapıda. Bu dosya yalnızca iyzico panelinde kayıtlı eski
// callback adreslerinin kırılmaması için duruyor ve isteği yeni fonksiyona
// aktarıyor. iyzico panelindeki callback adresini
//   .../functions/v1/odeme?bildirim=1
// olarak güncelledikten ve iki hafta sorunsuz çalıştıktan sonra bu fonksiyon
// silinebilir:  supabase functions delete iyzico-odeme

Deno.serve((req) => {
  const u = new URL(req.url);
  const hedef = new URL(`${Deno.env.get("SUPABASE_URL")}/functions/v1/odeme`);
  hedef.search = u.search.replace("callback=1", "bildirim=1");
  // 307: HTTP metodu ve gövde korunur (POST -> POST)
  return Response.redirect(hedef.toString(), 307);
});
