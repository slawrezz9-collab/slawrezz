/**
 * ============================================================
 * SLAW REZZ MUHASEBE — SUNUCU
 * ------------------------------------------------------------
 * Google E-Tablolar'a bagli Apps Script web uygulamasi.
 * Tek giris noktasi doPost(e); istek govdesi JSON'dur.
 *
 * NEDEN text/plain?
 *   Tarayici, Content-Type: application/json gonderirse once bir CORS
 *   "preflight" (OPTIONS) istegi atar. Apps Script OPTIONS'a cevap veremez,
 *   istek basarisiz olur. text/plain "basit istek" sayilir, preflight
 *   tetiklemez. Bu yuzden arayuz JSON'u text/plain olarak gonderir.
 *
 * GUVENLIK
 *   Web uygulamasi baska bir adresten (GitHub Pages) cagrilabilmesi icin
 *   "Baglantiya sahip herkes" olarak yayinlanir. Korumayi su iki katman saglar:
 *     1) gizli_anahtar  — Ayarlar sekmesinde durur, her istekte aranir
 *     2) PIN            — Ayarlar sekmesinde tuzlu SHA-256 ozeti olarak durur
 *   OKUMA DAHIL her islem ikisini de ister. Link tek basina ele gecse bile
 *   PIN bilinmeden hicbir veri okunamaz.
 * ============================================================
 */

/* ---------- sabitler ---------- */

var SEKMELER = {
  siparisler: {
    ad: 'Siparisler',
    basliklar: ['ID', 'Tarih', 'Urun', 'Adet', 'Fiyat', 'Ekleyen', 'EklemeZamani'],
    alanlar: ['t', 'urun', 'adet', 'fiyat'],
    onEk: 's'
  },
  odemeler: {
    ad: 'Odemeler',
    basliklar: ['ID', 'Tarih', 'Tutar', 'Ekleyen', 'EklemeZamani'],
    alanlar: ['t', 'tutar'],
    onEk: 'o'
  },
  kasa: {
    ad: 'Kasa',
    basliklar: ['ID', 'Tarih', 'Aciklama', 'Tur', 'Tutar', 'Ekleyen', 'EklemeZamani'],
    alanlar: ['t', 'aciklama', 'tur', 'tutar'],
    onEk: 'k'
  }
};

var AYAR_SEKMESI = 'Ayarlar';
var EN_ESKI_TARIH = '2020-01-01';
var EN_YENI_TARIH = '2100-01-01';

/* ============================================================
   1) GIRIS NOKTALARI
   ============================================================ */

function doPost(e) {
  var istek;
  try {
    istek = JSON.parse(e.postData.contents);
  } catch (hata) {
    return cevap({ ok: false, hata: 'İstek okunamadı. Lütfen sayfayı yenileyip tekrar deneyin.' });
  }

  try {
    return cevap(yonlendir(istek));
  } catch (hata) {
    // Beklenmeyen hatalar da sessizce yutulmaz, kullaniciya Turkce doner.
    return cevap({ ok: false, hata: 'Sunucu hatası: ' + (hata && hata.message ? hata.message : hata) });
  }
}

/** Tarayiciya adres dogrudan yazilirsa bilgilendirici bir sayfa gosterir. */
function doGet() {
  return HtmlService.createHtmlOutput(
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<div style="font:16px/1.6 system-ui;max-width:34em;margin:12vh auto;padding:0 6vw;color:#14161B">' +
    '<h1 style="font-size:1.3rem">Slaw Rezz Muhasebe — veri sunucusu</h1>' +
    '<p>Burası uygulamanın veri adresidir, arayüzü değildir. ' +
    'Uygulamayı açmak için ana ekranınızdaki <b>Slaw Rezz</b> kısayolunu kullanın.</p>' +
    '</div>'
  );
}

function cevap(nesne) {
  return ContentService
    .createTextOutput(JSON.stringify(nesne))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
   2) YONLENDIRICI + KIMLIK DOGRULAMA
   ============================================================ */

function yonlendir(istek) {
  var op = String(istek.op || '');

  // Gizli anahtar her istekte aranir.
  var ayarlar = ayarlariOku();
  if (!ayarlar.gizli_anahtar) {
    return { ok: false, hata: 'Kurulum tamamlanmamış: Ayarlar sekmesinde gizli_anahtar yok.' };
  }
  if (String(istek.anahtar || '') !== String(ayarlar.gizli_anahtar)) {
    return { ok: false, hata: 'Bu uygulamaya erişim izniniz yok.', yetkisiz: true };
  }

  // PIN de her istekte aranir — okuma dahil.
  if (!pinDogru(istek.pin, ayarlar)) {
    return { ok: false, hata: 'PIN yanlış.', pinGerekli: true };
  }

  switch (op) {
    case 'giris': return opGiris(ayarlar);
    case 'oku': return opOku(ayarlar);
    case 'ekle': return opYaz([{ tip: 'ekle', tablo: istek.tablo, kayit: istek.kayit }], istek);
    case 'guncelle': return opYaz([{ tip: 'guncelle', tablo: istek.tablo, kayit: istek.kayit }], istek);
    case 'sil': return opYaz([{ tip: 'sil', tablo: istek.tablo, id: istek.id }], istek);
    case 'toplu': return opYaz(istek.islemler || [], istek);
    case 'yedekle': return { ok: true, yedek: yedekAl() };
    case 'ayarYaz': return opAyarYaz(istek);
    default: return { ok: false, hata: 'Bilinmeyen işlem: ' + op };
  }
}

/** PIN'i tuzlu SHA-256 ozetiyle karsilastirir. Duz PIN hicbir yere yazilmaz. */
function pinDogru(pin, ayarlar) {
  if (!ayarlar.pin_hash) return true;              // PIN kurulmamissa serbest
  if (!pin) return false;
  return ozet(String(pin) + String(ayarlar.pin_salt || '')) === String(ayarlar.pin_hash);
}

function ozet(metin) {
  var ham = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, metin, Utilities.Charset.UTF_8);
  return ham.map(function (b) {
    return ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2);
  }).join('');
}

/* ============================================================
   3) ISLEMLER
   ============================================================ */

function opGiris(ayarlar) {
  return {
    ok: true,
    kullanicilar: String(ayarlar.kullanicilar || '')
      .split(',').map(function (s) { return s.trim(); }).filter(String),
    acilis: Number(ayarlar.acilis_bakiye) || 0,
    sonYedek: ayarlar.son_yedek || ''
  };
}

function opOku(ayarlar) {
  return {
    ok: true,
    veri: {
      acilis: Number(ayarlar.acilis_bakiye) || 0,
      siparisler: tabloOku('siparisler'),
      odemeler: tabloOku('odemeler'),
      kasa: tabloOku('kasa')
    },
    kullanicilar: String(ayarlar.kullanicilar || '')
      .split(',').map(function (s) { return s.trim(); }).filter(String),
    sonYedek: ayarlar.son_yedek || '',
    damga: new Date().toISOString()
  };
}

/**
 * Tum yazma islemleri buradan gecer. Tek kayit da toplu kuyruk da ayni yol.
 * LockService iki cihazin ayni anda yazmasini siraya sokar.
 */
function opYaz(islemler, istek) {
  if (!islemler.length) return { ok: true, sonuclar: [] };

  var kilit = LockService.getScriptLock();
  if (!kilit.tryLock(25000)) {
    return { ok: false, hata: 'Sistem şu anda başka bir kayıtla meşgul. Birkaç saniye sonra tekrar deneyin.' };
  }

  try {
    var kullanici = String(istek.kullanici || '').slice(0, 60);
    var sonuclar = [];

    for (var i = 0; i < islemler.length; i++) {
      var is = islemler[i];
      try {
        var cfg = SEKMELER[is.tablo];
        if (!cfg) throw new Error('Bilinmeyen tablo: ' + is.tablo);

        if (is.tip === 'ekle') {
          sonuclar.push({ ok: true, yerelId: is.yerelId, kayit: satirEkle(cfg, is.kayit, kullanici) });
        } else if (is.tip === 'guncelle') {
          sonuclar.push({ ok: true, yerelId: is.yerelId, kayit: satirGuncelle(cfg, is.kayit, kullanici) });
        } else if (is.tip === 'sil') {
          satirSil(cfg, is.id);
          sonuclar.push({ ok: true, yerelId: is.yerelId, silinen: is.id });
        } else {
          throw new Error('Bilinmeyen işlem tipi: ' + is.tip);
        }
      } catch (hata) {
        sonuclar.push({ ok: false, yerelId: is.yerelId, hata: hata.message || String(hata) });
      }
    }

    var basarisiz = sonuclar.filter(function (s) { return !s.ok; });
    return {
      ok: basarisiz.length === 0,
      hata: basarisiz.length ? basarisiz[0].hata : '',
      sonuclar: sonuclar,
      veri: opOku(ayarlariOku()).veri     // her yazmadan sonra guncel tam veri doner
    };
  } finally {
    kilit.releaseLock();
  }
}

function opAyarYaz(istek) {
  var izinli = ['acilis_bakiye', 'kullanicilar'];
  if (izinli.indexOf(istek.anahtarAdi) < 0) {
    return { ok: false, hata: 'Bu ayar uygulamadan değiştirilemez.' };
  }
  if (istek.anahtarAdi === 'acilis_bakiye') {
    var s = Number(istek.deger);
    if (!isFinite(s) || s < 0) return { ok: false, hata: 'Açılış bakiyesi sıfır veya daha büyük bir sayı olmalı.' };
  }
  ayarYaz(istek.anahtarAdi, istek.deger);
  return { ok: true, veri: opOku(ayarlariOku()).veri };
}

/* ============================================================
   4) SEKME OKUMA / YAZMA   (ID bazli — asla satir numarasi ile degil)
   ============================================================ */

function kitap() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sekme(ad) {
  var s = kitap().getSheetByName(ad);
  if (!s) throw new Error('"' + ad + '" sekmesi bulunamadı. Kurulumu tamamlayın.');
  return s;
}

function tabloOku(tabloAdi) {
  var cfg = SEKMELER[tabloAdi];
  var s = sekme(cfg.ad);
  var sonSatir = s.getLastRow();
  if (sonSatir < 2) return [];

  var deger = s.getRange(2, 1, sonSatir - 1, cfg.basliklar.length).getDisplayValues();
  var liste = [];

  for (var i = 0; i < deger.length; i++) {
    var r = deger[i];
    if (!r[0]) continue;                       // ID'si olmayan satir atlanir
    var kayit = { id: String(r[0]), t: gunNormal(r[1]) };
    if (tabloAdi === 'siparisler') {
      kayit.urun = String(r[2] || '');
      kayit.adet = sayiCoz(r[3]);
      kayit.fiyat = sayiCoz(r[4]);
      kayit.ekleyen = String(r[5] || '');
      kayit.eklemeZamani = String(r[6] || '');
    } else if (tabloAdi === 'odemeler') {
      kayit.tutar = sayiCoz(r[2]);
      kayit.ekleyen = String(r[3] || '');
      kayit.eklemeZamani = String(r[4] || '');
    } else {
      kayit.aciklama = String(r[2] || '');
      kayit.tur = String(r[3] || '');
      kayit.tutar = sayiCoz(r[4]);
      kayit.ekleyen = String(r[5] || '');
      kayit.eklemeZamani = String(r[6] || '');
    }
    liste.push(kayit);
  }
  return liste;
}

function satirEkle(cfg, kayit, kullanici) {
  var temiz = kayitDogrula(cfg, kayit);
  temiz.id = cfg.onEk + '-' + Utilities.getUuid().slice(0, 8);
  temiz.ekleyen = kullanici;
  temiz.eklemeZamani = simdi();
  sekme(cfg.ad).appendRow(satiraCevir(cfg, temiz));
  return temiz;
}

function satirGuncelle(cfg, kayit, kullanici) {
  var id = String(kayit.id || '');
  if (!id) throw new Error('Güncellenecek kaydın kimliği yok.');

  var satirNo = idSatiriBul(cfg, id);
  var s = sekme(cfg.ad);
  var eski = s.getRange(satirNo, 1, 1, cfg.basliklar.length).getDisplayValues()[0];

  var temiz = kayitDogrula(cfg, kayit);
  temiz.id = id;
  // Ekleyen bilgisi kaydin ilk sahibinde kalir; degistiren ayrica isaretlenir.
  temiz.ekleyen = String(eski[cfg.basliklar.indexOf('Ekleyen')] || kullanici);
  temiz.eklemeZamani = String(eski[cfg.basliklar.indexOf('EklemeZamani')] || simdi()) +
    (kullanici ? ' · düzelten ' + kullanici + ' ' + simdi() : '');

  s.getRange(satirNo, 1, 1, cfg.basliklar.length).setValues([satiraCevir(cfg, temiz)]);
  return temiz;
}

function satirSil(cfg, id) {
  if (!id) throw new Error('Silinecek kaydın kimliği yok.');
  sekme(cfg.ad).deleteRow(idSatiriBul(cfg, String(id)));
}

/**
 * ID kolonunda arayarak satir numarasini bulur.
 * Iki kisi ayni anda kullanirsa satir numaralari kayar; bu yuzden konum
 * asla ezberlenmez, her islemde yeniden aranir.
 */
function idSatiriBul(cfg, id) {
  var s = sekme(cfg.ad);
  var sonSatir = s.getLastRow();
  if (sonSatir < 2) throw new Error('Kayıt bulunamadı (tablo boş).');

  var idler = s.getRange(2, 1, sonSatir - 1, 1).getDisplayValues();
  for (var i = 0; i < idler.length; i++) {
    if (String(idler[i][0]) === id) return i + 2;
  }
  throw new Error('Kayıt bulunamadı — başka bir cihazda silinmiş olabilir.');
}

function satiraCevir(cfg, k) {
  return cfg.basliklar.map(function (baslik) {
    switch (baslik) {
      case 'ID': return k.id;
      case 'Tarih': return k.t;
      case 'Urun': return k.urun;
      case 'Adet': return k.adet;
      case 'Fiyat': return k.fiyat;
      case 'Aciklama': return k.aciklama;
      case 'Tur': return k.tur;
      case 'Tutar': return k.tutar;
      case 'Ekleyen': return k.ekleyen || '';
      case 'EklemeZamani': return k.eklemeZamani || '';
      default: return '';
    }
  });
}

/* ============================================================
   5) DOGRULAMA   (gecersiz veri sekmeye HIC yazilmaz)
   ============================================================ */

function kayitDogrula(cfg, ham) {
  if (!ham) throw new Error('Kayıt boş.');
  var k = {};

  // Tarih — her tabloda zorunlu
  k.t = gunNormal(ham.t);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(k.t)) {
    throw new Error('Tarih geçersiz. Gün, ay ve yılı eksiksiz seçin.');
  }
  if (k.t < EN_ESKI_TARIH || k.t > EN_YENI_TARIH) {
    throw new Error('Tarih makul aralıkta değil: ' + k.t);
  }

  if (cfg.ad === 'Siparisler') {
    k.urun = metin(ham.urun, 'Ürün');
    k.adet = pozitifSayi(ham.adet, 'Adet');
    k.fiyat = pozitifSayi(ham.fiyat, 'Birim fiyat');
  } else if (cfg.ad === 'Odemeler') {
    k.tutar = pozitifSayi(ham.tutar, 'Tutar');
  } else {
    k.aciklama = metin(ham.aciklama, 'Açıklama');
    k.tur = String(ham.tur || '').trim();
    if (k.tur !== 'Gelir' && k.tur !== 'Gider') {
      throw new Error('Tür yalnızca "Gelir" veya "Gider" olabilir.');
    }
    k.tutar = pozitifSayi(ham.tutar, 'Tutar');
  }
  return k;
}

function metin(v, ad) {
  var s = String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
  if (!s) throw new Error(ad + ' boş bırakılamaz.');
  if (s.length > 200) throw new Error(ad + ' en fazla 200 karakter olabilir.');
  return s;
}

/** Tutar her zaman POZITIF yazilir; isareti Tur belirler. */
function pozitifSayi(v, ad) {
  var s = Number(String(v == null ? '' : v).replace(',', '.'));
  if (!isFinite(s)) throw new Error(ad + ' sayı olmalı.');
  if (s <= 0) throw new Error(ad + ' sıfırdan büyük olmalı. Gider için eksi yazmayın; türü "Gider" seçin.');
  if (s > 1e12) throw new Error(ad + ' fazla büyük görünüyor, kontrol edin.');
  return Math.round(s * 100) / 100;
}

/** Tarihi her tipten YYYY-AA-GG'ye indirger. */
function gunNormal(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date) return Utilities.formatDate(v, kitapSaatDilimi(), 'yyyy-MM-dd');
  var s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  var m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);   // 15.08.2026
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);

  var d = new Date(s);
  if (!isNaN(d.getTime())) return Utilities.formatDate(d, kitapSaatDilimi(), 'yyyy-MM-dd');
  return s;
}

/**
 * Metinden sayi cozer. Sekmeden getDisplayValues() ile gelen degerler
 * TURKCE bicimlidir: binlik ayirici NOKTA, ondalik ayirici VIRGUL.
 *
 * Bu yuzden "68.857" = altmis sekiz bin sekiz yuz elli yedi'dir,
 * 68 tam 857 degil. Yanlis cozulurse tutarlar 1000 kat sapar.
 */
function sayiCoz(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;

  var s = String(v).replace(/\s/g, '').replace(/[^\d,.\-]/g, '');
  if (!s) return 0;

  var eksi = s.charAt(0) === '-';
  if (eksi) s = s.slice(1);

  if (s.indexOf(',') >= 0) {
    // Virgul varsa o ondalik ayiricidir; noktalar binliktir.
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.indexOf('.') >= 0) {
    // Yalniz nokta var — binlik mi ondalik mi?
    // Ilk noktadan sonraki her grup tam 3 haneyse binlik ayiricidir.
    var parcalar = s.split('.');
    var hepsiUclu = parcalar.slice(1).every(function (p) { return p.length === 3; });
    if (hepsiUclu && parcalar[0].length > 0) s = parcalar.join('');
  }

  var n = Number(s);
  if (!isFinite(n)) return 0;
  return eksi ? -n : n;
}

function kitapSaatDilimi() { return kitap().getSpreadsheetTimeZone() || 'Europe/Istanbul'; }

function simdi() {
  return Utilities.formatDate(new Date(), kitapSaatDilimi(), 'yyyy-MM-dd HH:mm');
}

/* ============================================================
   6) AYARLAR SEKMESI  (anahtar / deger)
   ============================================================ */

function ayarlariOku() {
  var s = kitap().getSheetByName(AYAR_SEKMESI);
  if (!s || s.getLastRow() < 2) return {};
  var d = s.getRange(2, 1, s.getLastRow() - 1, 2).getDisplayValues();
  var o = {};
  d.forEach(function (r) { if (r[0]) o[String(r[0]).trim()] = r[1]; });
  return o;
}

function ayarYaz(anahtarAdi, deger) {
  var s = kitap().getSheetByName(AYAR_SEKMESI);
  if (!s) throw new Error('Ayarlar sekmesi yok.');
  var sonSatir = s.getLastRow();
  if (sonSatir >= 2) {
    var d = s.getRange(2, 1, sonSatir - 1, 1).getDisplayValues();
    for (var i = 0; i < d.length; i++) {
      if (String(d[i][0]).trim() === anahtarAdi) {
        s.getRange(i + 2, 2).setValue(deger);
        return;
      }
    }
  }
  s.appendRow([anahtarAdi, deger]);
}

/* ============================================================
   7) EDITORDEN ELLE CALISTIRILAN YARDIMCILAR
   ============================================================ */

/**
 * PIN belirler veya degistirir.
 * Kullanim: asagidaki satirdaki 1234'u kendi PIN'inizle degistirin,
 * fonksiyonu secip Calistir'a basin, sonra bu satiri eski haline getirin.
 */
function pinBelirle() {
  var yeniPin = '1234';                       // <<< KENDI PIN'INIZI YAZIN (4-6 hane)

  if (!/^\d{4,6}$/.test(yeniPin)) throw new Error('PIN 4-6 haneli rakam olmalı.');
  var tuz = Utilities.getUuid();
  ayarYaz('pin_salt', tuz);
  ayarYaz('pin_hash', ozet(yeniPin + tuz));
  Logger.log('PIN kaydedildi. Duz PIN hicbir yere yazilmadi.');
}

/** Gizli anahtari uretir veya yeniler. Ciktiyi web/api.js icine yapistirin. */
function gizliAnahtarUret() {
  var anahtar = Utilities.getUuid().replace(/-/g, '');
  ayarYaz('gizli_anahtar', anahtar);
  Logger.log('gizli_anahtar: ' + anahtar);
  Logger.log('Bu degeri web/api.js icindeki ANAHTAR alanina yapistirin.');
  return anahtar;
}
