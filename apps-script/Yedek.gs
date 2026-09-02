/**
 * ============================================================
 * GOOGLE DRIVE YEDEGI
 * ------------------------------------------------------------
 * Dort sekmenin tamamini tarihli bir JSON dosyasi olarak Drive'daki
 * "Slaw Rezz Yedekler" klasorune yazar.
 *
 * Neden: E-Tablolar'da yanlislikla satir silinirse veya bir formul tum
 * sayfayi bozarsa geri donulecek bir nokta olsun. Sheets'in kendi surum
 * gecmisi de vardir ama tek dosyaya baglidir; bu yedek ondan bagimsizdir.
 *
 * Kurulum: yedekTetikleyiciKur() bir kez calistirilir → her gun otomatik.
 * Ayrica uygulamanin Ayarlar sayfasindaki butondan elle tetiklenebilir.
 * ============================================================
 */

var YEDEK_KLASOR_ADI = 'Slaw Rezz Yedekler';
var SAKLANACAK_YEDEK = 30;      // bundan eskiler silinir

/** Gunluk tetikleyiciyi kurar. Iki kez calistirilirsa kopya olusturmaz. */
function yedekTetikleyiciKur() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'gunlukYedek') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('gunlukYedek').timeBased().everyDays(1).atHour(3).create();
  Logger.log('Gunluk yedek tetikleyicisi kuruldu (her gece 03:00 civari).');
}

function gunlukYedek() {
  var sonuc = yedekAl();
  Logger.log('Yedek alindi: %s', sonuc.ad);
}

/**
 * Yedegi olusturur ve dosya bilgisini dondurur.
 * Ayarlar sekmesindeki son_yedek damgasini gunceller.
 */
function yedekAl() {
  var klasor = yedekKlasoru();

  var icerik = {
    surum: 1,
    alindi: simdi(),
    kaynak: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    ayarlar: ayarlarGuvenli(),
    siparisler: tabloOku('siparisler'),
    odemeler: tabloOku('odemeler'),
    kasa: tabloOku('kasa')
  };

  var ad = 'slawrezz-yedek-' +
    Utilities.formatDate(new Date(), kitapSaatDilimi(), 'yyyy-MM-dd-HHmm') + '.json';

  var dosya = klasor.createFile(ad, JSON.stringify(icerik, null, 1), MimeType.PLAIN_TEXT);
  eskiYedekleriTemizle(klasor);
  ayarYaz('son_yedek', icerik.alindi);

  return {
    ad: ad,
    zaman: icerik.alindi,
    kayit: icerik.siparisler.length + icerik.odemeler.length + icerik.kasa.length,
    baglanti: dosya.getUrl()
  };
}

/** PIN ozeti ve gizli anahtar yedege YAZILMAZ. */
function ayarlarGuvenli() {
  var tum = ayarlariOku();
  return {
    acilis_bakiye: tum.acilis_bakiye,
    kullanicilar: tum.kullanicilar,
    son_yedek: tum.son_yedek
  };
}

function yedekKlasoru() {
  var kayitli = ayarlariOku().yedek_klasor_id;
  if (kayitli) {
    try { return DriveApp.getFolderById(kayitli); } catch (h) { /* silinmis, yeniden kur */ }
  }
  var bulunan = DriveApp.getFoldersByName(YEDEK_KLASOR_ADI);
  var klasor = bulunan.hasNext() ? bulunan.next() : DriveApp.createFolder(YEDEK_KLASOR_ADI);
  ayarYaz('yedek_klasor_id', klasor.getId());
  return klasor;
}

function eskiYedekleriTemizle(klasor) {
  var hepsi = [];
  var it = klasor.getFiles();
  while (it.hasNext()) {
    var d = it.next();
    if (d.getName().indexOf('slawrezz-yedek-') === 0) {
      hepsi.push({ dosya: d, tarih: d.getDateCreated().getTime() });
    }
  }
  hepsi.sort(function (a, b) { return b.tarih - a.tarih; });
  hepsi.slice(SAKLANACAK_YEDEK).forEach(function (y) { y.dosya.setTrashed(true); });
}

/**
 * Bir yedegi geri yukler — YALNIZCA acil durumda, elle calistirilir.
 * Once mevcut veriyi yedekler, sonra sekmeleri temizleyip yedegi yazar.
 *
 * Kullanim: yedekDosyaAdi degiskenine Drive'daki yedek dosyasinin adini
 * yazip fonksiyonu calistirin.
 */
function yedektenGeriYukle() {
  var yedekDosyaAdi = '';        // <<< orn. 'slawrezz-yedek-2026-09-02-0300.json'

  if (!yedekDosyaAdi) throw new Error('Once yedekDosyaAdi degiskenine dosya adini yazin.');

  var bulunan = DriveApp.getFilesByName(yedekDosyaAdi);
  if (!bulunan.hasNext()) throw new Error('Yedek bulunamadi: ' + yedekDosyaAdi);

  var icerik = JSON.parse(bulunan.next().getBlob().getDataAsString());
  yedekAl();      // once mevcut hali kaybetmemek icin yedekle

  ['siparisler', 'odemeler', 'kasa'].forEach(function (tabloAdi) {
    var cfg = SEKMELER[tabloAdi];
    var s = sekme(cfg.ad);
    if (s.getLastRow() > 1) {
      s.getRange(2, 1, s.getLastRow() - 1, cfg.basliklar.length).clearContent();
    }
    var kayitlar = icerik[tabloAdi] || [];
    if (kayitlar.length) {
      s.getRange(2, 1, kayitlar.length, cfg.basliklar.length)
        .setValues(kayitlar.map(function (k) { return satiraCevir(cfg, k); }));
    }
  });

  if (icerik.ayarlar && icerik.ayarlar.acilis_bakiye != null) {
    ayarYaz('acilis_bakiye', icerik.ayarlar.acilis_bakiye);
  }

  Logger.log('Geri yukleme tamam: %s', yedekDosyaAdi);
  dogrula();
}
