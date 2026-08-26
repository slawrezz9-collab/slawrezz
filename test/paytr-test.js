/* PayTR imza ve kodlama testleri.
 * Yanlış hash = ödeme sessizce başarısız olur, bu yüzden ayrı test edilir.
 * Çalıştırma: node --experimental-strip-types test/paytr-test.js */
const path = require("path");
const { createHmac } = require("crypto");

(async function () {
  const mod = await import(
    "file://" + path.join(__dirname, "../supabase/functions/odeme/saglayicilar/paytr.ts")
      .replace(/\\/g, "/"));
  const { b64, hmacB64, oidUret } = mod;

  let ok = 0, hata = 0;
  const t = (ad, sart) => { if (sart) { ok++; console.log("  OK  " + ad); } else { hata++; console.log("  !!  " + ad); } };

  console.log("\n--- base64 (Türkçe karakter tuzağı) ---");
  t("ascii base64", b64("test") === "dGVzdA==");
  // btoa() bu girdide InvalidCharacterError atardı — asıl test bu
  const turkce = JSON.stringify([["Şort Etek (L)", "570.10", 1], ["Fitilli Atlet (M)", "300.00", 2]]);
  let patladi = false;
  let kodlanmis = "";
  try { kodlanmis = b64(turkce); } catch (e) { patladi = true; }
  t("Türkçe karakterli sepet kodlanabiliyor", !patladi && kodlanmis.length > 0);
  t("geri çözüldüğünde aynı", Buffer.from(kodlanmis, "base64").toString("utf8") === turkce);
  t("çıktı saf base64", /^[A-Za-z0-9+/]+=*$/.test(kodlanmis));

  console.log("\n--- merchant_oid (yalnız alfanumerik olmalı) ---");
  const uuid = "a3f7c1d2-4b5e-6789-abcd-ef0123456789";
  t("tireler temizlendi", oidUret(uuid) === "a3f7c1d24b5e6789abcdef0123456789");
  t("32 karakter", oidUret(uuid).length === 32);
  t("alfanumerik", /^[a-zA-Z0-9]+$/.test(oidUret(uuid)));
  t("demo id de gecerli", /^[a-zA-Z0-9]+$/.test(oidUret("S1756300000000")));

  console.log("\n--- hmac base64 imza ---");
  const beklenen = createHmac("sha256", "anahtar").update("veri", "utf8").digest("base64");
  t("hmacB64 dogru", hmacB64("veri", "anahtar") === beklenen);
  t("base64 formatinda", /^[A-Za-z0-9+/]+=*$/.test(hmacB64("veri", "anahtar")));
  t("farkli anahtar farkli imza", hmacB64("veri", "a") !== hmacB64("veri", "b"));

  console.log("\n--- bildirim hash dogrulamasi (PayTR formulu) ---");
  const key = "TESTKEY", salt = "TESTSALT";
  const oid = "abc123", status = "success", total = "125090";
  const dogruHash = hmacB64(oid + salt + status + total, key);
  t("dogru hash eslesiyor", hmacB64(oid + salt + status + total, key) === dogruHash);
  t("tutar degistirilirse eslesmiyor", hmacB64(oid + salt + status + "1", key) !== dogruHash);
  t("status degistirilirse eslesmiyor", hmacB64(oid + salt + "failed" + total, key) !== dogruHash);
  t("salt bilinmeden uretilemiyor", hmacB64(oid + "BASKASALT" + status + total, key) !== dogruHash);

  console.log("\n--- tutar kurusa cevirme ---");
  const kurus = (t2) => String(Math.round(Number(t2) * 100));
  t("1250.90 -> 125090", kurus(1250.9) === "125090");
  t("79.90 -> 7990", kurus(79.9) === "7990");
  t("kayan nokta hatasi yok (0.1+0.2)", kurus(0.1 + 0.2) === "30");
  t("tam sayi tutar", kurus(1500) === "150000");

  console.log(`\n=== ${ok} geçti, ${hata} kaldı ===`);
  process.exit(hata ? 1 : 0);
})();
