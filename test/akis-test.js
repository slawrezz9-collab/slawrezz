/* Demo mod uçtan uca akış testi.
 * Supabase olmadan: sipariş kaydı -> sipariş sorgulama -> iade talebi -> yönetici akışı.
 * Çalıştırma: node test/akis-test.js   (proje kökünden) */
const fs = require("fs");
const path = require("path");
const kok = path.join(__dirname, "..");

// --- minimal tarayıcı sahtesi ---
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
  createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
};
global.window = { SLAW_CONFIG: null };
global.alert = (m) => { throw new Error("beklenmeyen alert: " + m); };

eval(fs.readFileSync(path.join(kok, "js/config.js"), "utf8"));
eval(fs.readFileSync(path.join(kok, "js/magaza.js"), "utf8"));
const S = window.SLAW;

let ok = 0, hata = 0;
const t = (ad, sart) => { if (sart) { ok++; console.log("  OK  " + ad); } else { hata++; console.log("  !!  " + ad); } };

(async function () {
  // --- 1. sepet.html'in demo modda yazdığı sipariş kaydını taklit et ---
  const siparisNo = S.siparisNoUret();
  const siparis = {
    id: "S1", siparis_no: siparisNo, created_at: new Date().toISOString(),
    ad_soyad: "Ayşe Yılmaz", telefon: "0532 111 22 33", eposta: "a@b.com",
    adres: "Merkez Mahallesi 1. Sokak No 5 Daire 3", sehir: "İstanbul", ilce: "Kadıköy",
    tutar: 1250, kargo: 79.9, durum: "teslim",
    teslim_tarihi: new Date().toISOString(),
    kargo_firma: "yurtici", kargo_takip: "TR123456789",
    kalemler: [
      { id: "u1", ad: "Fitilli Atlet", beden: "M", adet: 2, birim: 300 },
      { id: "u2", ad: "Şort Etek", beden: "L", adet: 1, birim: 570.1 },
    ],
  };
  localStorage.setItem("slaw_siparisler", JSON.stringify([siparis]));

  console.log("\n--- sipariş sorgulama (misafir) ---");
  const bulunan = await S.siparisSorgula(siparisNo, "2233");
  t("dogru bilgiyle bulunuyor", bulunan && bulunan.siparis_no === siparisNo);
  t("adi maskeli (Ayşe Y.)", bulunan.ad === "Ayşe Y.");
  t("adres maskeli", bulunan.adres_maske.endsWith("...") && bulunan.adres_maske.length < 20);
  t("telefon maskeli", bulunan.telefon_maske === "0*** *** 2233");
  t("kalemler geliyor", bulunan.kalemler.length === 2);

  const yanlisTel = await S.siparisSorgula(siparisNo, "9999");
  t("yanlis telefonla bulunamiyor", yanlisTel === null);
  const yanlisNo = await S.siparisSorgula("SR-2000-99999", "2233");
  t("yanlis numarayla bulunamiyor", yanlisNo === null);
  t("eksik son4 reddediliyor", (await S.siparisSorgula(siparisNo, "22")) === null);

  console.log("\n--- iade edilebilirlik ---");
  t("teslim + suresi icinde -> edilebilir", S.iadeEdilebilirMi(siparis) === true);
  t("odeme bekleyen -> edilemez", S.iadeEdilebilirMi({ ...siparis, durum: "odeme_bekliyor" }) === false);
  const eski = new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString();
  t("20 gun once teslim -> edilemez", S.iadeEdilebilirMi({ ...siparis, teslim_tarihi: eski }) === false);

  console.log("\n--- kismi iade talebi ---");
  const talep = await S.iadeTalebiAc({
    siparis_no: siparisNo, tel_son4: "2233", siparis_id: "S1",
    tip: "iade", sebep: "beden", aciklama: "Dar geldi",
    kalemler: [{ id: "u1", ad: "Fitilli Atlet", beden: "M", adet: 1, birim: 300 }],
  });
  t("talep olusturuldu", talep && talep.durum === "talep_edildi");
  t("kismi iade tutari dogru (1x300)", talep.tutar === 300);

  const talepler = await S.iadeTalepleriGetir({ siparis_id: "S1" });
  t("talep listede", talepler.length === 1);

  const sorguSonrasi = await S.siparisSorgula(siparisNo, "2233");
  t("talep siparis sorgusunda gorunuyor", sorguSonrasi.iadeler.length === 1);

  console.log("\n--- kurallar ---");
  let hataMesaji = "";
  try {
    await S.iadeTalebiAc({ siparis_no: siparisNo, tel_son4: "2233", siparis_id: "S1",
      tip: "iade", sebep: "beden", kalemler: [{ id: "u1", adet: 1, birim: 300 }] });
  } catch (e) { hataMesaji = e.message; }
  t("ayni siparise ikinci acik talep engelleniyor", /açık bir talebiniz/.test(hataMesaji));

  hataMesaji = "";
  try {
    await S.iadeTalebiAc({ siparis_no: siparisNo, tel_son4: "2233", siparis_id: "S2",
      tip: "iade", sebep: "beden", kalemler: [] });
  } catch (e) { hataMesaji = e.message; }
  t("bos kalem listesi reddediliyor", /en az bir ürün/i.test(hataMesaji));

  console.log("\n--- yonetici akisi ---");
  await S.iadeTalebiGuncelle(talep.id, { durum: "onaylandi", kargo_firma: "aras", kargo_kodu: "KOD123" });
  const onayli = (await S.iadeTalepleriGetir({ siparis_id: "S1" }))[0];
  t("onaylandi", onayli.durum === "onaylandi");
  t("kargo kodu kaydedildi", onayli.kargo_kodu === "KOD123");
  t("guncellenme damgasi var", !!onayli.guncellendi);

  const musteriGorunumu = await S.siparisSorgula(siparisNo, "2233");
  t("musteri kargo kodunu goruyor", musteriGorunumu.iadeler[0].kargo_kodu === "KOD123");

  await S.iadeTalebiGuncelle(talep.id, { durum: "tamamlandi" });
  t("tamamlandi", (await S.iadeTalepleriGetir({ siparis_id: "S1" }))[0].durum === "tamamlandi");

  const yeniTalep = await S.iadeTalebiAc({
    siparis_no: siparisNo, tel_son4: "2233", siparis_id: "S1",
    tip: "degisim", sebep: "kusurlu", kalemler: [{ id: "u2", ad: "Şort Etek", beden: "L", adet: 1, birim: 570.1 }],
  });
  t("tamamlanan talep sonrasi yeni talep acilabiliyor", yeniTalep.tip === "degisim");

  console.log(`\n=== ${ok} geçti, ${hata} kaldı ===`);
  process.exit(hata ? 1 : 0);
})();
