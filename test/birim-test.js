const fs = require("fs");
// --- minimal DOM/tarayici sahtesi ---
const depo = {};
global.localStorage = {
  getItem: (k) => (k in depo ? depo[k] : null),
  setItem: (k, v) => { depo[k] = String(v); },
  removeItem: (k) => { delete depo[k]; },
};
global.document = {
  body: { dataset: {} },
  addEventListener: () => {},
  querySelectorAll: () => [],
  documentElement: { style: { setProperty: () => {} } },
  createElement: () => ({ style: {}, setAttribute(){}, appendChild(){} }),
};
global.window = { SLAW_CONFIG: null };
global.Intl = Intl;

eval(fs.readFileSync("js/config.js", "utf8"));
eval(fs.readFileSync("js/magaza.js", "utf8"));
const S = window.SLAW;

let ok = 0, hata = 0;
const t = (ad, sart) => { if (sart) { ok++; console.log("  OK  " + ad); } else { hata++; console.log("  !!  " + ad); } };

console.log("\n--- durum haritalari ---");
const dA = S.durumHaritasi("admin"), dM = S.durumHaritasi("musteri");
t("admin: odendi -> Yeni", dA.odendi === "Yeni");
t("musteri: odendi -> Siparisiniz Alindi", dM.odendi === "Siparişiniz Alındı");
t("hesap.html bug: hazirlaniyor artik var", !!dM.hazirlaniyor);
t("hesap.html bug: iade artik var", !!dM.iade);
t("7 durum tam", Object.keys(dA).length === 7);
t("iade haritasi ayri", S.durumHaritasi("admin","iade").talep_edildi === "Talep Edildi");
t("SIRADAKI zinciri", S.SIRADAKI.odendi === "hazirlaniyor" && S.SIRADAKI.kargoda === "teslim");

console.log("\n--- siparis numarasi ---");
const n1 = S.siparisNoUret(), n2 = S.siparisNoUret();
const yil = new Date().getFullYear();
t("format SR-YYYY-00001", n1 === `SR-${yil}-00001`);
t("artan sayac", n2 === `SR-${yil}-00002`);
t("localStorage'a yazildi", JSON.parse(depo.slaw_siparis_sayac)[yil] === 2);

console.log("\n--- kargo takip linkleri ---");
t("yurtici linki", S.kargoTakipLinki("yurtici","123456").includes("123456"));
t("basitkargo linki", S.kargoTakipLinki("basitkargo","ABC1").endsWith("/takip/ABC1"));
t("takip no yoksa null", S.kargoTakipLinki("yurtici","") === null);
t("bilinmeyen firma null", S.kargoTakipLinki("olmayan","123") === null);
t("diger firmasi sablonsuz -> null", S.kargoTakipLinki("diger","123") === null);
t("ozel karakter encode", S.kargoTakipLinki("yurtici","A B").includes("A%20B"));
t("firma adi", S.kargoFirmaAdi("mng") === "MNG Kargo");
t("firma adi bos -> bos", S.kargoFirmaAdi(null) === "");
t("9 gercek firma + diger", Object.keys(S.KARGO_FIRMALARI).length === 10);

console.log("\n--- satici kunyesi ---");
t("bos config -> bos kunye", S.saticiAlan("kunye") === "");
window.SLAW_CONFIG.satici.unvan = "Test Ticaret";
window.SLAW_CONFIG.satici.adres = "Merkez Mah. 1. Sok No 2";
window.SLAW_CONFIG.satici.ilce = "Kadikoy";
window.SLAW_CONFIG.satici.il = "Istanbul";
window.SLAW_CONFIG.satici.vergiDairesi = "Goztepe";
window.SLAW_CONFIG.satici.vergiNo = "1234567890";
t("tamAdres birlestirme", S.saticiAlan("tamAdres") === "Merkez Mah. 1. Sok No 2 / Kadikoy / Istanbul");
t("vergiSatiri", S.saticiAlan("vergiSatiri") === "Goztepe V.D. — VKN/TCKN: 1234567890");
t("kunye unvan iceriyor", S.saticiAlan("kunye").startsWith("Test Ticaret"));
t("mersis bos kaldi", !S.saticiAlan("mersis"));
t("duz alan okuma", S.saticiAlan("unvan") === "Test Ticaret");

console.log(`\n=== ${ok} gecti, ${hata} kaldi ===`);
process.exit(hata ? 1 : 0);
